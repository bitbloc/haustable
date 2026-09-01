const DEFAULT_EASYSLIP_KEY = 'e0650eb6-a4c8-4e25-b109-54bf3a10256e'
const EASYSLIP_BASE_URL = 'https://api.easyslip.com/v2'

export default async function handler(req, res) {
    // Enable CORS for Vercel, localhost, and Capacitor mobile app
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    )

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const body = req.body || {}
        const {
            action = 'verify', // 'verify' | 'info'
            apiKey: customApiKey,
            base64,
            url,
            matchAmount,
            preferredProvider = 'auto',
            checkDuplicate = true,
            remark
        } = body

        const activeApiKey = (customApiKey && customApiKey.trim()) || process.env.EASYSLIP_API_KEY || DEFAULT_EASYSLIP_KEY

        // Handle Action: INFO (Get quota & connection status)
        if (action === 'info') {
            const resp = await fetch(`${EASYSLIP_BASE_URL}/info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${activeApiKey}`
                },
                signal: AbortSignal.timeout(8000)
            })

            const result = await resp.json()
            if (!resp.ok || !result.success) {
                return res.status(resp.status || 400).json({
                    success: false,
                    error: result.message || result.error?.message || 'การเชื่อมต่อ EasySlip ล้มเหลว กรุณาตรวจสอบ API Key'
                })
            }

            return res.status(200).json({
                success: true,
                data: result.data,
                message: 'เชื่อมต่อ EasySlip API สำเร็จเรียบร้อย'
            })
        }

        // Handle Action: VERIFY (Verify Bank / TrueMoney Slip)
        if (!base64 && !url) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาแนบรูปภาพสลิป (base64 หรือ url)'
            })
        }

        let cleanBase64 = base64
        if (cleanBase64 && cleanBase64.includes(',')) {
            cleanBase64 = cleanBase64.split(',')[1]
        }

        const payload = {}
        if (cleanBase64) payload.base64 = cleanBase64
        if (url) payload.url = url
        if (matchAmount && Number(matchAmount) > 0) payload.matchAmount = Number(matchAmount)
        if (checkDuplicate !== undefined) payload.checkDuplicate = checkDuplicate
        if (remark) payload.remark = remark.substring(0, 255)

        const callEasySlip = async (endpoint) => {
            const resp = await fetch(`${EASYSLIP_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${activeApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(8000)
            })
            const data = await resp.json()
            return { ok: resp.ok, status: resp.status, data }
        }

        let activeProvider = preferredProvider === 'truewallet' ? 'truewallet' : 'bank'
        let primaryEndpoint = activeProvider === 'truewallet' ? '/verify/truewallet' : '/verify/bank'
        let result = await callEasySlip(primaryEndpoint)

        // Auto-fallback to other provider if primary failed and provider wasn't strictly fixed
        if ((!result.ok || !result.data?.success) && preferredProvider === 'auto') {
            const fallbackEndpoint = activeProvider === 'bank' ? '/verify/truewallet' : '/verify/bank'
            const fallbackResult = await callEasySlip(fallbackEndpoint)
            if (fallbackResult.ok && fallbackResult.data?.success) {
                result = fallbackResult
                activeProvider = activeProvider === 'bank' ? 'truewallet' : 'bank'
            }
        }

        if (!result.ok || !result.data?.success) {
            const errData = result.data?.error || {}
            const errMsg = errData.message || result.data?.message || 'ไม่สามารถตรวจสอบสลิปได้'
            const isDuplicate = errData.code === 2002 || errData.code === 'DUPLICATE_SLIP'

            return res.status(200).json({
                success: false,
                verified: false,
                isDuplicate,
                error: errMsg,
                errorCode: errData.code || 'VERIFICATION_FAILED',
                rawResponse: result.data
            })
        }

        const data = result.data.data || {}
        const rawSlip = data.rawSlip || {}
        const transRef = rawSlip.transRef || rawSlip.transactionId || data.transRef || null
        const slipAmount = Number(data.amountInSlip || rawSlip.amount || 0)
        const senderName = rawSlip.sender?.account?.name || rawSlip.sender?.name || rawSlip.sender?.accountName || 'ไม่ระบุ'
        const receiverName = rawSlip.receiver?.account?.name || rawSlip.receiver?.name || rawSlip.receiver?.accountName || 'IN THE HAUS'
        const bankName = activeProvider === 'truewallet' 
            ? 'TrueMoney Wallet' 
            : (rawSlip.sender?.bank?.nameTh || rawSlip.sender?.bank?.shortCode || 'ธนาคาร')

        let isAmountMatched = data.isAmountMatched ?? true
        if (matchAmount && Number(matchAmount) > 0) {
            isAmountMatched = slipAmount >= Number(matchAmount)
        }

        return res.status(200).json({
            success: true,
            verified: isAmountMatched && !data.isDuplicate,
            provider: activeProvider,
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
        })

    } catch (err) {
        console.error('API /api/verify-slip error:', err)
        return res.status(500).json({
            success: false,
            verified: false,
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิปผ่านเซิร์ฟเวอร์: ' + err.message
        })
    }
}
