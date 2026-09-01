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
 * Resolves the verification API endpoint (Vercel Serverless Function or Cloud URL for mobile app)
 */
function getApiEndpoint() {
    if (typeof window !== 'undefined') {
        const proto = window.location.protocol
        const host = window.location.hostname
        if (proto === 'capacitor:' || proto === 'ionic:' || host === 'localhost' && window.location.port !== '5173') {
            return 'https://haustable.vercel.app/api/verify-slip'
        }
        return '/api/verify-slip'
    }
    return 'https://haustable.vercel.app/api/verify-slip'
}

/**
 * Main verification entrypoint for Frontend
 * Calls server-side proxy to guarantee zero CORS blocking.
 * 
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

        // Fetch custom API key from app_settings if available
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
            console.warn('[verifyPaymentSlip] Settings read warning:', sErr)
        }

        // 1. Call Vercel Serverless Proxy (/api/verify-slip)
        try {
            const endpoint = getApiEndpoint()
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'verify',
                    base64,
                    matchAmount: Number(matchAmount),
                    preferredProvider: provider,
                    checkDuplicate: true,
                    remark,
                    apiKey
                })
            })

            if (resp.ok) {
                const result = await resp.json()
                if (result && result.success !== undefined) {
                    return result
                }
            }
        } catch (proxyErr) {
            console.warn('[verifyPaymentSlip] Serverless proxy error, trying Supabase Edge Function:', proxyErr)
        }

        // 2. Fallback: Call Supabase Edge Function
        try {
            const { data, error } = await supabase.functions.invoke('verify-payment-slip', {
                body: {
                    action: 'verify',
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
        } catch (edgeErr) {
            console.warn('[verifyPaymentSlip] Supabase Edge Function error:', edgeErr)
        }

        return {
            success: false,
            verified: false,
            error: 'ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้ชั่วคราว คุณสามารถเลือก "ส่งให้เจ้าหน้าที่ตรวจสอบด้วยตนเอง"'
        }

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
 * Test EasySlip API Connection and retrieve Quota Information via Serverless Proxy (No CORS)
 */
export async function testEasySlipConnection(customApiKey = null) {
    try {
        let keyToTest = customApiKey
        if (!keyToTest) {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'easyslip_api_key').maybeSingle()
            keyToTest = data?.value || DEFAULT_EASYSLIP_KEY
        }

        // 1. Try Vercel Serverless Proxy (/api/verify-slip with action='info')
        try {
            const endpoint = getApiEndpoint()
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'info',
                    apiKey: keyToTest.trim()
                })
            })

            const result = await resp.json()
            if (resp.ok && result.success) {
                return {
                    success: true,
                    data: result.data,
                    message: 'เชื่อมต่อ EasySlip API สำเร็จเรียบร้อย'
                }
            } else if (result.error) {
                return {
                    success: false,
                    error: result.error
                }
            }
        } catch (proxyErr) {
            console.warn('[testEasySlipConnection] Serverless proxy error, trying Supabase Edge Function:', proxyErr)
        }

        // 2. Try Supabase Edge Function
        try {
            const { data, error } = await supabase.functions.invoke('verify-payment-slip', {
                body: {
                    action: 'info',
                    apiKey: keyToTest.trim()
                }
            })

            if (!error && data?.success) {
                return {
                    success: true,
                    data: data.data,
                    message: 'เชื่อมต่อ EasySlip API สำเร็จเรียบร้อย'
                }
            }
        } catch (edgeErr) {
            console.warn('[testEasySlipConnection] Edge Function error:', edgeErr)
        }

        return {
            success: false,
            error: 'ไม่สามารถเชื่อมต่อ EasySlip API ได้ กรุณาตรวจสอบ API Key หรืออินเทอร์เน็ต'
        }
    } catch (err) {
        return {
            success: false,
            error: 'การเชื่อมต่อ EasySlip ล้มเหลว: ' + err.message
        }
    }
}
