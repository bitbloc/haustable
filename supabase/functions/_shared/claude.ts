// Run a Gemini-shaped generateContent request on Claude and answer in Gemini's
// response shape, so callers written for Gemini keep working unchanged.
//
// Why (2026-11-26): Google suspended the Cloud project that owns our Gemini key.
// While ANTHROPIC_API_KEY is set, AI calls go to Claude. Unset it (or set
// AI_PROVIDER=gemini) to go back to Gemini once the project is restored.

import Anthropic from 'npm:@anthropic-ai/sdk'

// Model per job (owner decision 2026-11-26): accuracy work (receipt OCR, the
// sales briefing) runs on Claude Opus 5.5; high-volume work (Yuzu slip reading)
// passes { model: CLAUDE_FAST_MODEL }. CLAUDE_MODEL overrides the default.
export const CLAUDE_ACCURATE_MODEL = 'claude-opus-5-5'
export const CLAUDE_FAST_MODEL = 'claude-haiku-5-5'
const DEFAULT_MODEL = CLAUDE_ACCURATE_MODEL
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export function claudeEnabled(): boolean {
  const provider = (Deno.env.get('AI_PROVIDER') || '').toLowerCase()
  if (provider === 'gemini') return false
  return Boolean(Deno.env.get('ANTHROPIC_API_KEY'))
}

export class ClaudeCallError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Gemini responseSchema (OpenAPI subset, often upper-case types) -> the JSON
// Schema subset Claude structured outputs accept: lower-case types,
// additionalProperties:false on every object, no numeric/length constraints.
export function geminiSchemaToJsonSchema(s: any): any {
  if (!s || typeof s !== 'object') return s
  const type = String(s.type || '').toLowerCase()
  const out: any = {}
  if (s.description) out.description = s.description
  if (Array.isArray(s.enum)) out.enum = s.enum
  if (type === 'object') {
    out.type = 'object'
    out.properties = Object.fromEntries(
      Object.entries(s.properties || {}).map(([k, v]) => [k, geminiSchemaToJsonSchema(v)]),
    )
    if (Array.isArray(s.required)) out.required = s.required
    out.additionalProperties = false
  } else if (type === 'array') {
    out.type = 'array'
    if (s.items) out.items = geminiSchemaToJsonSchema(s.items)
  } else if (type) {
    out.type = type
  }
  if (s.nullable && out.type) return { anyOf: [out, { type: 'null' }] }
  return out
}

function toBlocks(parts: any[]): any[] {
  const blocks: any[] = []
  for (const p of parts || []) {
    if (typeof p?.text === 'string' && p.text) {
      blocks.push({ type: 'text', text: p.text })
      continue
    }
    const inline = p?.inline_data || p?.inlineData
    if (inline?.data) {
      const mime = String(inline.mime_type || inline.mimeType || 'image/jpeg').toLowerCase()
      if (mime === 'application/pdf') {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: inline.data } })
      } else if (IMAGE_TYPES.has(mime)) {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: mime, data: inline.data } })
      } else {
        throw new ClaudeCallError(400, `UNSUPPORTED_FILE_TYPE: ${mime}`)
      }
    }
  }
  return blocks
}

/**
 * @param request Gemini generateContent body (contents, system_instruction, generationConfig)
 * @returns Gemini-shaped response: { candidates: [{ content: { parts: [{ text }] } }], modelVersion }
 */
export async function generateWithClaude(
  request: any,
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<any> {
  const client = new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    timeout: opts.timeoutMs ?? 90_000,
    maxRetries: 1,
  })
  const model = opts.model || Deno.env.get('CLAUDE_MODEL') || DEFAULT_MODEL
  // Server-side refusal fallbacks exist for Opus/Sonnet; Haiku 5.5 has none.
  const fallbackParams = model.startsWith('claude-haiku')
    ? {}
    : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }

  const systemParts = request?.system_instruction?.parts || request?.systemInstruction?.parts || []
  let system = systemParts.map((p: any) => p?.text || '').filter(Boolean).join('\n\n')
  const gen = request?.generationConfig || {}
  const wantsJson = /json/i.test(String(gen.response_mime_type || gen.responseMimeType || ''))
  // Gemini's thinkingConfig.thinkingLevel maps to Claude effort. Reading a bill needs
  // little reasoning: 'low' answers faster. Claude Opus 5.5 defaults to 'medium'.
  const level = String(gen.thinkingConfig?.thinkingLevel || gen.thinking_config?.thinking_level || '').toLowerCase()
  const effort = ['low', 'medium', 'high'].includes(level) ? level : null
  const schema = gen.responseSchema || gen.response_schema
  // With a schema, structured outputs guarantee parseable JSON in that shape.
  const outputConfig = schema
    ? { output_config: { format: { type: 'json_schema', schema: geminiSchemaToJsonSchema(schema) }, ...(effort ? { effort } : {}) } }
    : {}
  if (wantsJson && !schema) {
    system = `${system}\n\nReturn only the JSON object: no markdown fences, no text before or after it.`.trim()
  }

  const messages = (request?.contents || [])
    .map((c: any) => ({
      role: c?.role === 'model' ? 'assistant' : 'user',
      content: toBlocks(c?.parts),
    }))
    .filter((m: any) => m.content.length > 0)
  if (messages.length === 0) throw new ClaudeCallError(400, 'EMPTY_REQUEST')

  const maxTokens = Math.min(Math.max(Number(gen.maxOutputTokens || gen.max_output_tokens) || 16000, 1024), 32000)

  const params: any = {
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
    ...(effort && !schema ? { output_config: { effort } } : {}),
    ...fallbackParams,
  }
  let response: any
  try {
    try {
      response = await (client.beta.messages.create as any)({ ...params, ...outputConfig })
    } catch (err) {
      // Schema rejected: retry once as plain JSON-by-instruction so the feature keeps working.
      if (!schema || !(err instanceof Anthropic.BadRequestError)) throw err
      console.warn('[Claude] structured output rejected, retrying without schema:', err.message)
      response = await (client.beta.messages.create as any)({
        ...params,
        system: [params.system, 'Return only the JSON object: no markdown fences, no text before or after it.']
          .filter(Boolean).join('\n\n'),
      })
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new ClaudeCallError(err.status ?? 0, err.message)
    }
    throw new ClaudeCallError(0, `NETWORK: ${(err as Error)?.message ?? err}`)
  }

  if (response.stop_reason === 'refusal') {
    throw new ClaudeCallError(422, `REFUSED: ${response.stop_details?.category ?? 'unknown'}`)
  }
  const text = (response.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
  if (!text) throw new ClaudeCallError(502, `EMPTY_RESPONSE (stop_reason: ${response.stop_reason})`)

  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] } }],
    modelVersion: response.model || model,
    usageMetadata: {
      promptTokenCount: response.usage?.input_tokens,
      candidatesTokenCount: response.usage?.output_tokens,
    },
  }
}
