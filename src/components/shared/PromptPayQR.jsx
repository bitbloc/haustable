// PromptPay QR with the amount baked in. Imported lazily (LazyPromptPayQR) so the QR
// libraries download only when a customer reaches a payment step.
import generatePayload from 'promptpay-qr'
import { QRCodeSVG } from 'qrcode.react'
import { normalizePromptPayId } from '../../utils/promptpayId'

export default function PromptPayQR({ promptpayId, amount, size = 176, fallbackUrl, alt = 'PromptPay QR', onClick, className = '' }) {
    let payload = null
    try {
        payload = generatePayload(normalizePromptPayId(promptpayId), { amount: amount > 0 ? amount : undefined })
    } catch (e) {
        console.warn('PromptPay payload failed:', e)
    }
    if (payload) {
        return <QRCodeSVG value={payload} size={size} level="M" className={className} onClick={onClick} />
    }
    if (fallbackUrl) {
        return <img src={fallbackUrl} alt={alt} style={{ width: size, height: size }} className={`object-contain ${className}`} onClick={onClick} />
    }
    return null
}
