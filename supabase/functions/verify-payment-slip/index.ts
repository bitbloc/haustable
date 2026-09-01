import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_EASYSLIP_KEY = 'e0650eb6-a4c8-4e25-b109-54bf3a10256e'
const EASYSLIP_BASE_URL = 'https://api.easyslip.com/v2'

interface VerifyRequest {
  base64?: string
  url?: string
  matchAmount?: number
  preferredProvider?: 'bank' | 'truewallet' | 'auto'
  checkDuplicate?: boolean
  remark?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: any = await req.json()
    const { action = 'verify', apiKey: customApiKey, base64, url, matchAmount, preferredProvider = 'auto', checkDuplicate = true, remark } = body

    // 1. Resolve EasySlip API Key from DB, Env, or Request
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let apiKey = customApiKey?.trim() || Deno.env.get('EASYSLIP_API_KEY') || DEFAULT_EASYSLIP_KEY
    try {
      const { data: settingData } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'easyslip_api_key')
        .maybeSingle()
      if (settingData?.value && settingData.value.trim() !== '') {
        apiKey = settingData.value.trim()
      }
    } catch (e) {
      console.warn('[verify-payment-slip] Error reading easyslip_api_key setting:', e)
    }

    // Handle Action: INFO (Connection & Quota check)
    if (action === 'info') {
      const resp = await fetch(`${EASYSLIP_BASE_URL}/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      const result = await resp.json()
      if (!resp.ok || !result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.message || result.error?.message || 'การเชื่อมต่อ EasySlip ล้มเหลว'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: resp.status || 400
        })
      }
      return new Response(JSON.stringify({
        success: true,
        data: result.data,
        message: 'เชื่อมต่อ EasySlip API สำเร็จเรียบร้อย'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (!base64 && !url) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing slip image (base64 or url required)' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Format clean Base64 string if data URI provided
    let cleanBase64 = base64
    if (cleanBase64 && cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1]
    }

    const payload: any = {}
    if (cleanBase64) {
      payload.base64 = cleanBase64
    } else if (url) {
      payload.url = url
    }
    if (matchAmount && matchAmount > 0) {
      payload.matchAmount = Number(matchAmount)
    }
    if (checkDuplicate !== undefined) {
      payload.checkDuplicate = checkDuplicate
    }
    if (remark) {
      payload.remark = remark.substring(0, 255)
    }

    // 2. Call EasySlip API v2
    const callEasySlip = async (endpoint: '/verify/bank' | '/verify/truewallet') => {
      const resp = await fetch(`${EASYSLIP_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      const result = await resp.json()
      return { ok: resp.ok, status: resp.status, data: result }
    }

    let activeProvider: 'bank' | 'truewallet' = 'bank'
    let verificationResult: any = null

    if (preferredProvider === 'truewallet') {
      activeProvider = 'truewallet'
      const res = await callEasySlip('/verify/truewallet')
      verificationResult = res.data
      if (!res.ok && preferredProvider === 'auto') {
        const bankRes = await callEasySlip('/verify/bank')
        if (bankRes.ok) {
          activeProvider = 'bank'
          verificationResult = bankRes.data
        }
      }
    } else if (preferredProvider === 'bank') {
      activeProvider = 'bank'
      const res = await callEasySlip('/verify/bank')
      verificationResult = res.data
      if (!res.ok && preferredProvider === 'auto') {
        const walletRes = await callEasySlip('/verify/truewallet')
        if (walletRes.ok) {
          activeProvider = 'truewallet'
          verificationResult = walletRes.data
        }
      }
    } else {
      // 'auto' mode: try bank first, if error try truewallet
      const bankRes = await callEasySlip('/verify/bank')
      if (bankRes.ok && bankRes.data?.success) {
        activeProvider = 'bank'
        verificationResult = bankRes.data
      } else {
        const walletRes = await callEasySlip('/verify/truewallet')
        if (walletRes.ok && walletRes.data?.success) {
          activeProvider = 'truewallet'
          verificationResult = walletRes.data
        } else {
          // If both failed, use the bank error or wallet error
          activeProvider = 'bank'
          verificationResult = bankRes.data || walletRes.data
        }
      }
    }

    // 3. Process Response
    if (!verificationResult?.success) {
      const errorMsg = verificationResult?.error?.message || verificationResult?.message || 'ไม่สามารถตรวจสอบข้อมูลสลิปได้'
      const errorCode = verificationResult?.error?.code || 'VERIFICATION_FAILED'

      return new Response(JSON.stringify({
        success: false,
        verified: false,
        error: errorMsg,
        errorCode,
        provider: activeProvider,
        details: verificationResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const data = verificationResult.data
    const rawSlip = data.rawSlip || {}

    // Extract standardized information
    let transRef = rawSlip.transRef || rawSlip.transactionId || null
    let transferDate = rawSlip.date || rawSlip.dateTime || new Date().toISOString()
    let slipAmount = Number(data.amountInSlip || rawSlip.amount || 0)
    let senderName = rawSlip.sender?.account?.name || rawSlip.sender?.name || rawSlip.sender?.accountName || 'ไม่ระบุ'
    let receiverName = rawSlip.receiver?.account?.name || rawSlip.receiver?.name || rawSlip.receiver?.accountName || 'IN THE HAUS'
    let bankName = activeProvider === 'truewallet' 
      ? 'TrueMoney Wallet' 
      : (rawSlip.sender?.bank?.nameTh || rawSlip.sender?.bank?.shortCode || 'ธนาคาร')

    // Amount match validation:
    // EasySlip returns isAmountMatched. We also double check if matchAmount is specified
    let isAmountMatched = data.isAmountMatched ?? true
    if (matchAmount && matchAmount > 0) {
      // Slip amount must be >= matchAmount (allow overpayment, but flag underpayment)
      isAmountMatched = slipAmount >= Number(matchAmount)
    }

    // Check DB for duplicate transaction reference if transRef exists
    let isDbDuplicate = false
    if (transRef) {
      try {
        const { data: existingBooking } = await supabaseAdmin
          .from('bookings')
          .select('id, booking_time, total_amount')
          .eq('slip_trans_ref', transRef)
          .in('status', ['confirmed', 'paid', 'seated', 'ready', 'completed', 'approved'])
          .maybeSingle()

        if (existingBooking) {
          isDbDuplicate = true
        }
      } catch (dbErr) {
        console.warn('[verify-payment-slip] DB duplicate check error:', dbErr)
      }
    }

    const isDuplicate = Boolean(data.isDuplicate || isDbDuplicate)

    return new Response(JSON.stringify({
      success: true,
      verified: isAmountMatched && !isDuplicate,
      provider: activeProvider,
      isAmountMatched,
      isDuplicate,
      amountInSlip: slipAmount,
      amountExpected: matchAmount ? Number(matchAmount) : slipAmount,
      transRef,
      transferDate,
      senderName,
      receiverName,
      bankName,
      rawSlip: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error('[verify-payment-slip] Exception:', err.message)
    return new Response(JSON.stringify({ 
      success: false, 
      verified: false,
      error: err.message || 'Internal Server Error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})
