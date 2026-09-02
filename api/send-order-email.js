/**
 * Vercel Serverless Function: send-order-email
 * Sends high-contrast, premium order notification email to Rithawat@gmail.com
 * when a new HAUSMADE order (Shipping or Pickup) is placed.
 */

const DEFAULT_TARGET_EMAIL = 'Rithawat@gmail.com'
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_123456789' // Uses RESEND_API_KEY if configured in Vercel
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'LKoEdJlI0uQUbjxot6TQEhxKGfZNDyPifZAYcuXK4OIxbHF56bqZvCT5NPuUSEsdZY2LOuDkDdMRwf62buy8il5ytzTqFxmjJToe3Hn3KFuAy4Jz2PQ7joM9xABSuyL4vkrU31DllxrMMqBFz1Up3gdB04t89/1O/w1cDnyilFU='
const LINE_GROUP_ID = process.env.LINE_GROUP_ID || 'Cc2c65da5408563ef57ae61dee6ce3c1d'

export default async function handler(req, res) {
    // Enable CORS
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
            orderData = {},
            orderItems = [],
            targetEmail = DEFAULT_TARGET_EMAIL,
            appOrigin = 'https://inthehaus.co'
        } = body

        const orderId = orderData.id || 'N/A'
        const trackingToken = orderData.tracking_token || orderId
        const shortId = (trackingToken && typeof trackingToken === 'string') ? trackingToken.slice(-6).toUpperCase() : String(orderId).slice(-4)
        
        const customerName = orderData.pickup_contact_name || orderData.customer_name || 'ลูกค้า HAUSMADE'
        const customerPhone = orderData.pickup_contact_phone || orderData.phone_number || '-'
        const orderType = orderData.order_type || (orderData.shipping_address ? 'hausmade_shipping' : 'hausmade_pickup')
        const isShipping = orderType === 'hausmade_shipping' || (orderData.shipping_address && orderData.shipping_address !== 'รับหน้าร้าน IN THE HAUS')
        const orderTypeLabel = isShipping ? '🚚 จัดส่งพัสดุ (Shipping)' : '🏪 รับหน้าร้าน (Store Pickup)'
        
        const totalAmount = Number(orderData.total_amount || 0)
        const shippingFee = Number(orderData.shipping_fee || 0)
        const discountAmount = Number(orderData.discount_amount || orderData.xhaus_discount || 0)
        const subtotal = totalAmount + discountAmount - (isShipping ? shippingFee : 0)
        
        const shippingAddress = orderData.shipping_address || '-'
        const pickupSchedule = orderData.booking_time ? new Date(orderData.booking_time).toLocaleString('th-TH') : '-'
        const customerNote = orderData.customer_note || '-'
        const paymentSlipUrl = orderData.payment_slip_url || ''
        const trackingUrl = `${appOrigin}/track/${trackingToken}`
        const adminUrl = `${appOrigin}/admin/hausmade`

        // Build HTML Email
        const emailSubject = `[HAUSMADE] ออเดอร์ใหม่ #${shortId} (${isShipping ? 'จัดส่ง' : 'รับหน้าร้าน'}) ยอด ฿${totalAmount.toLocaleString()}.-`
        
        const itemsRowsHtml = orderItems.map((item, idx) => {
            const name = item.custom_name || item.name || item.menu_items?.name || `สินค้า #${idx + 1}`
            const qty = item.quantity || 1
            const unitPrice = Number(item.price_at_time || item.price || 0)
            const rowTotal = unitPrice * qty
            const optText = item.selected_options ? (typeof item.selected_options === 'string' ? item.selected_options : JSON.stringify(item.selected_options)) : ''

            return `
                <tr style="border-bottom: 1px solid #e5e5e5;">
                    <td style="padding: 10px 8px; font-size: 13px; color: #1f1d1b;">
                        <strong>${name}</strong>
                        ${optText ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">${optText}</div>` : ''}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; color: #1f1d1b; text-align: center; font-family: monospace;">
                        x${qty}
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; color: #1f1d1b; text-align: right; font-family: monospace;">
                        ฿${unitPrice.toLocaleString()}.-
                    </td>
                    <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; color: #1f1d1b; text-align: right; font-family: monospace;">
                        ฿${rowTotal.toLocaleString()}.-
                    </td>
                </tr>
            `
        }).join('')

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${emailSubject}</title>
</head>
<body style="margin:0; padding:20px; background-color:#f6f4f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1f1d1b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 2px solid #1f1d1b; box-shadow: 4px 4px 0px #1f1d1b;">
        
        <!-- Header Banner -->
        <div style="background-color: #f7d432; padding: 20px; border-bottom: 2px solid #1f1d1b; text-align: center;">
            <div style="font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #1f1d1b; text-transform: uppercase;">
                // IN THE HAUS ATELIER · NAKHON PHANOM
            </div>
            <h1 style="margin: 6px 0 0 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #1f1d1b;">
                HAUSMADE NEW ORDER
            </h1>
            <div style="display: inline-block; background: #1f1d1b; color: #ffffff; padding: 4px 10px; font-family: monospace; font-size: 12px; font-weight: bold; margin-top: 8px;">
                ${orderTypeLabel} · #${shortId}
            </div>
        </div>

        <!-- Order Summary Card -->
        <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #666; width: 35%;">ชื่อลูกค้า:</td>
                    <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #1f1d1b;">${customerName}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #666;">เบอร์ติดต่อ:</td>
                    <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #1f1d1b; font-family: monospace;">${customerPhone}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #666;">ประเภทออเดอร์:</td>
                    <td style="padding: 6px 0; font-size: 14px; font-weight: bold; color: #1f1d1b;">${orderTypeLabel}</td>
                </tr>
                ${isShipping ? `
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #666; vertical-align: top;">ที่อยู่จัดส่ง:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #1f1d1b; line-height: 1.5; font-weight: 500;">${shippingAddress}</td>
                </tr>
                ` : `
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #666;">เวลารับหน้าร้าน:</td>
                    <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #1f1d1b;">${pickupSchedule}</td>
                </tr>
                `}
                ${customerNote && customerNote !== '-' ? `
                <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #666; vertical-align: top;">หมายเหตุ:</td>
                    <td style="padding: 6px 0; font-size: 12px; color: #854d0e; background: #fefce8; padding: 6px 8px; border: 1px solid #fef08a;">${customerNote}</td>
                </tr>
                ` : ''}
            </table>

            <!-- Items Table -->
            <div style="border-top: 2px solid #1f1d1b; border-bottom: 2px solid #1f1d1b; margin: 16px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f6f4f0; border-bottom: 1px solid #1f1d1b;">
                            <th style="padding: 8px; text-align: left; font-size: 11px; font-family: monospace; color: #1f1d1b;">รายการสินค้า</th>
                            <th style="padding: 8px; text-align: center; font-size: 11px; font-family: monospace; color: #1f1d1b;">จำนวน</th>
                            <th style="padding: 8px; text-align: right; font-size: 11px; font-family: monospace; color: #1f1d1b;">ราคา</th>
                            <th style="padding: 8px; text-align: right; font-size: 11px; font-family: monospace; color: #1f1d1b;">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRowsHtml || '<tr><td colspan="4" style="padding:10px; text-align:center;">-</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- Total Calculation Breakdown -->
            <div style="background: #f9f8f6; padding: 14px 16px; border: 1px solid #e5e5e5; margin-bottom: 20px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #666;">ยอดรวมสินค้า (Subtotal):</span>
                    <span style="font-family: monospace; font-weight: bold;">฿${subtotal.toLocaleString()}.-</span>
                </div>
                ${isShipping ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #666;">ค่าจัดส่งพัสดุ (Shipping Fee):</span>
                    <span style="font-family: monospace; font-weight: bold;">${shippingFee === 0 ? 'ส่งฟรี! (฿0.-)' : `฿${shippingFee.toLocaleString()}.-`}</span>
                </div>
                ` : ''}
                ${discountAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #b91c1c;">
                    <span>ส่วนลดโปรโมชั่น / xhaus:</span>
                    <span style="font-family: monospace; font-weight: bold;">-฿${discountAmount.toLocaleString()}.-</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #d4d4d4; font-size: 16px;">
                    <strong style="color: #1f1d1b;">ยอดสุทธิที่ชำระ (Total Paid):</strong>
                    <strong style="font-family: monospace; color: #1f1d1b; font-size: 18px;">฿${totalAmount.toLocaleString()}.-</strong>
                </div>
            </div>

            <!-- Action CTAs -->
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 24px;">
                <a href="${adminUrl}" style="display: block; background: #1f1d1b; color: #ffffff; text-decoration: none; padding: 12px; text-align: center; font-family: monospace; font-weight: bold; font-size: 13px; border: 1px solid #1f1d1b;">
                    [ 🔍 เปิดดูและอัปเดตสถานะในระบบแอดมิน ➔ ]
                </a>
                <a href="${trackingUrl}" style="display: block; background: #ffffff; color: #1f1d1b; text-decoration: none; padding: 10px; text-align: center; font-family: monospace; font-weight: bold; font-size: 12px; border: 1px solid #1f1d1b;">
                    [ 📦 เปิดหน้า TRACKING ลูกค้า (${trackingToken}) ]
                </a>
            </div>

            ${paymentSlipUrl ? `
            <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 12px; color: #166534;">
                <strong>✓ มีการแนบสลิปชำระเงินเรียบร้อย</strong><br/>
                <span style="font-family: monospace; font-size: 11px;">ไฟล์สลิป: ${paymentSlipUrl}</span>
            </div>
            ` : ''}
        </div>

        <!-- Footer -->
        <div style="background: #1f1d1b; color: #a8a29e; padding: 14px; text-align: center; font-family: monospace; font-size: 11px;">
            IN THE HAUS ATELIER SYSTEM // NAKHON PHANOM<br/>
            AUTOMATED ORDER DISPATCH TO ${targetEmail}
        </div>
    </div>
</body>
</html>
        `

        let emailSent = false
        let emailServiceError = null

        // 1. Try Resend API (if configured)
        if (RESEND_API_KEY && RESEND_API_KEY.startsWith('re_') && RESEND_API_KEY !== 're_123456789') {
            try {
                const resendResp = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'HAUSMADE Store <orders@inthehaus.co>',
                        to: [targetEmail],
                        subject: emailSubject,
                        html: htmlContent
                    })
                })
                const resendData = await resendResp.json()
                if (resendResp.ok) {
                    emailSent = true
                    console.log('[send-order-email] Resend email sent successfully:', resendData)
                } else {
                    emailServiceError = resendData
                    console.warn('[send-order-email] Resend API response error:', resendData)
                }
            } catch (rErr) {
                emailServiceError = rErr.message
                console.warn('[send-order-email] Resend fetch exception:', rErr)
            }
        }

        // 2. Dual Fallback / Redundancy: Dispatch to LINE Group to guarantee zero missed orders!
        let lineSent = false
        if (LINE_CHANNEL_ACCESS_TOKEN && LINE_GROUP_ID) {
            try {
                const lineItemsSummary = orderItems.map(i => `• ${i.quantity || 1}x ${i.name || i.custom_name} (฿${i.price || i.price_at_time})`).join('\n')
                const lineMessage = `🛍️ มีออเดอร์ HAUSMADE เข้าใหม่!\n━━━━━━━━━━━━━━━\n🏷️ รหัส: #${shortId} (${orderTypeLabel})\n👤 ลูกค้า: ${customerName}\n📞 โทร: ${customerPhone}\n💰 ยอดสุทธิ: ฿${totalAmount.toLocaleString()} บาท\n${isShipping ? `📍 ที่อยู่: ${shippingAddress}\n` : ''}\n📦 สินค้า:\n${lineItemsSummary}\n\n✉️ ส่งอีเมลแจ้งเตือนไปที่: ${targetEmail}\n━━━━━━━━━━━━━━━\n🔍 ตรวจสอบ: ${adminUrl}\n📦 Tracking: ${trackingUrl}`

                const lineResp = await fetch('https://api.line.me/v2/bot/message/push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({
                        to: LINE_GROUP_ID,
                        messages: [{ type: 'text', text: lineMessage }]
                    })
                })
                if (lineResp.ok) {
                    lineSent = true
                }
            } catch (lErr) {
                console.warn('[send-order-email] LINE dispatch exception:', lErr)
            }
        }

        return res.status(200).json({
            success: true,
            emailSent,
            lineSent,
            targetEmail,
            orderId,
            message: `Order notification processed for ${targetEmail}`
        })

    } catch (err) {
        console.error('[send-order-email] Handler exception:', err)
        return res.status(500).json({
            success: false,
            error: err.message
        })
    }
}
