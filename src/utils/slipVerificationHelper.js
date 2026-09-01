import { supabase } from '../lib/supabaseClient'

export const DEFAULT_EASYSLIP_KEY = 'e0650eb6-a4c8-4e25-b109-54bf3a10256e'
const EASYSLIP_BASE_URL = 'https://api.easyslip.com/v2'

/**
 * Resizes and converts an image File to a base64 string
 * Automatically downscales if image is too large (> 1280px) to ensure sub-second verification.
 */
export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error('No file provided'))
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const MAX_WIDTH = 1280
                const MAX_HEIGHT = 1280
                let width = img.width
                let height = img.height

                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    if (width > height) {
                        height = Math.round((height * MAX_WIDTH) / width)
                        width = MAX_WIDTH
                    } else {
                        width = Math.round((width * MAX_HEIGHT) / height)
                        height = MAX_HEIGHT
                    }
                }

                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)

                // Export as JPEG with 0.85 quality
                const base64Data = canvas.toDataURL('image/jpeg', 0.85)
                resolve(base64Data)
            }
            img.onerror = () => {
                // If canvas resize fails, resolve with raw reader result
                resolve(e.target.result)
            }
            img.src = e.target.result
        }
        reader.onerror = (err) => reject(err)
        reader.readAsDataURL(file)
    })
}

/**
 * Direct client-side verification fallback in case Edge Function is not reachable
 */
async function directEasySlipVerify({ base64, matchAmount, provider, apiKey }) {
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64
    const endpoint = provider === 'truewallet' ? '/verify/truewallet' : '/verify/bank'

    const payload = {
        base64: cleanBase64,
        checkDuplicate: true
    }
    if (matchAmount && matchAmount > 0) {
        payload.matchAmount = Number(matchAmount)
    }

    const resp = await fetch(`${EASYSLIP_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey || DEFAULT_EASYSLIP_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })

    const result = await resp.json()
    if (!resp.ok || !result.success) {
        // If bank failed and provider wasn't explicitly locked to bank, try truewallet
        if (provider !== 'bank' && endpoint === '/verify/bank') {
            try {
                const walletResp = await fetch(`${EASYSLIP_BASE_URL}/verify/truewallet`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey || DEFAULT_EASYSLIP_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                const walletResult = await walletResp.json()
                if (walletResp.ok && walletResult.success) {
                    return formatEasySlipData(walletResult.data, 'truewallet', matchAmount)
                }
            } catch (e) {
                console.warn('[directEasySlipVerify] Truewallet retry error:', e)
            }
        }

        const msg = result.error?.message || result.message || 'ไม่สามารถตรวจสอบสลิปได้'
        return {
            success: false,
            verified: false,
            error: msg,
            errorCode: result.error?.code || 'ERROR'
        }
    }

    return formatEasySlipData(result.data, provider === 'truewallet' ? 'truewallet' : 'bank', matchAmount)
}

function formatEasySlipData(data, provider, matchAmount) {
    const rawSlip = data.rawSlip || {}
    const transRef = rawSlip.transRef || rawSlip.transactionId || null
    const slipAmount = Number(data.amountInSlip || rawSlip.amount || 0)
    const senderName = rawSlip.sender?.account?.name || rawSlip.sender?.name || rawSlip.sender?.accountName || 'ไม่ระบุ'
    const receiverName = rawSlip.receiver?.account?.name || rawSlip.receiver?.name || rawSlip.receiver?.accountName || 'IN THE HAUS'
    const bankName = provider === 'truewallet' 
        ? 'TrueMoney Wallet' 
        : (rawSlip.sender?.bank?.nameTh || rawSlip.sender?.bank?.shortCode || 'ธนาคาร')

    let isAmountMatched = data.isAmountMatched ?? true
    if (matchAmount && matchAmount > 0) {
        isAmountMatched = slipAmount >= Number(matchAmount)
    }

    return {
        success: true,
        verified: isAmountMatched && !data.isDuplicate,
        provider,
        isAmountMatched,
        isDuplicate: Boolean(data.isDuplicate),
        amountInSlip: slipAmount,
        amountExpected: matchAmount ? Number(matchAmount) : slipAmount,
        transRef,
        transferDate: rawSlip.date || rawSlip.dateTime || new Date().toISOString(),
        senderName,
        receiverName,
        bankName,
        rawSlip: data
    }
}

/**
 * Main verification entrypoint for Frontend
 * @param {Object} params
 * @param {File} [params.file] - The uploaded slip File object
 * @param {string} [params.base64] - The Base64 string of the slip (optional if file provided)
 * @param {number} [params.matchAmount] - Expected amount in THB to verify against slip
 * @param {'bank'|'truewallet'|'auto'} [params.provider='auto'] - Preferred payment method
 * @param {string} [params.remark] - Order remark / tracking note
 */
export async function verifyPaymentSlip({ file, base64: rawBase64, matchAmount = 0, provider = 'auto', remark = '' }) {
    try {
        let base64 = rawBase64
        if (!base64 && file) {
            base64 = await fileToBase64(file)
        }

        if (!base64) {
            return { success: false, verified: false, error: 'กรุณาอัปโหลดรูปภาพสลิป' }
        }

        // 1. First try calling Supabase Edge Function
        try {
            const { data, error } = await supabase.functions.invoke('verify-payment-slip', {
                body: {
                    base64,
                    matchAmount: Number(matchAmount),
                    preferredProvider: provider,
                    checkDuplicate: true,
                    remark
                }
            })

            if (!error && data && data.success !== undefined) {
                return data
            }
            if (error) {
                console.warn('[verifyPaymentSlip] Edge function returned error, falling back to direct verify:', error)
            }
        } catch (edgeErr) {
            console.warn('[verifyPaymentSlip] Edge function invoke exception, fallback to direct verify:', edgeErr)
        }

        // 2. Direct API Fallback
        // Fetch API key from app_settings
        let apiKey = DEFAULT_EASYSLIP_KEY
        try {
            const { data: settingData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'easyslip_api_key')
                .maybeSingle()
            if (settingData?.value && settingData.value.trim() !== '') {
                apiKey = settingData.value.trim()
            }
        } catch (sErr) {
            console.warn('[verifyPaymentSlip] Settings read error:', sErr)
        }

        return await directEasySlipVerify({ base64, matchAmount, provider, apiKey })

    } catch (err) {
        console.error('[verifyPaymentSlip] Critical Verification Error:', err)
        return {
            success: false,
            verified: false,
            error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป'
        }
    }
}

/**
 * Test EasySlip API Connection and retrieve Quota Information
 */
export async function testEasySlipConnection(customApiKey = null) {
    try {
        let keyToTest = customApiKey
        if (!keyToTest) {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'easyslip_api_key').maybeSingle()
            keyToTest = data?.value || DEFAULT_EASYSLIP_KEY
        }

        const resp = await fetch(`${EASYSLIP_BASE_URL}/info`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${keyToTest.trim()}`
            }
        })

        const result = await resp.json()
        if (!resp.ok || !result.success) {
            return {
                success: false,
                error: result.message || result.error?.message || 'การเชื่อมต่อ EasySlip ล้มเหลว กรุณาตรวจสอบ API Key'
            }
        }

        return {
            success: true,
            data: result.data,
            message: 'เชื่อมต่อ EasySlip API สำเร็จเรียบร้อย'
        }
    } catch (err) {
        return {
            success: false,
            error: 'ไม่สามารถเชื่อมต่อไปยัง EasySlip ได้: ' + err.message
        }
    }
}
