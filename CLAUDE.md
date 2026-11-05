# CLAUDE.md

Project design system and engineering rules live in `.agents/AGENTS.md` and apply to Claude Code too:

@.agents/AGENTS.md

## Mandatory Design QA

For every task that changes UI, typography, layout, or responsive behavior:

1. Read the existing design system (`.agents/AGENTS.md`, `tailwind.config.js`, `src/index.css`) and preserve approved decisions.
2. Implement the change using the project's existing conventions.
3. Run the application with the existing workflow (`npm run dev`, Vite).
4. Inspect the actual rendered page in a real browser — the Claude desktop built-in browser pane, or Playwright MCP when running in a plain terminal.
5. Capture screenshots at desktop (1440px), tablet (768px), and mobile (375px) where relevant. POS screens: also check the target device viewport.
6. Audit typography hierarchy, font loading, line-height, text wrapping, spacing (4/8px scale), alignment, overflow, and responsive composition.
7. Thai text checks (required whenever Thai copy is on screen):
   - Thai glyphs render in the intended Thai font (IBM Plex Sans Thai), not a system fallback; Latin-only fonts must have a Thai fallback in the stack.
   - Upper vowels and tone marks (ิ ี ึ ื ั ็ ่ ้ ๊ ๋ ์) and lower vowels (ุ ู) are not clipped by tight `line-height`, `overflow: hidden`, `truncate`, or fixed heights.
   - Line breaks fall between words, not mid-word (Thai has no spaces; check `word-break` / `line-break` and narrow containers).
   - Mixed Thai/Latin/number lines share a consistent baseline and size.
8. Report concrete defects with screenshot evidence and affected selectors or files.
9. Fix verified defects and capture updated screenshots.
10. Recheck the affected viewports before marking the task complete.

Do not claim a visual check was completed unless the rendered output was actually inspected.
Do not change approved fonts, design tokens, or unrelated components without justification.
Prefer the smallest change that fixes the issue. Do not repeatedly adjust arbitrary font sizes or spacing values without identifying the root cause.
If the browser cannot be launched or screenshots cannot be inspected, state that visual QA is incomplete.

Final report must include:

- Files changed
- Screenshots or viewports inspected
- Typography and layout issues found
- Fixes applied and verified
- Remaining issues or unverified checks
