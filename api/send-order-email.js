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
        
        // 1. Order Classification & Titles
        const bookingType = orderData.booking_type || (orderData.shipping_address ? 'hausmade' : 'pickup')
        const isHausmade = bookingType === 'hausmade' || (orderData.order_type && String(orderData.order_type).includes('hausmade'))
        const isShipping = isHausmade && (orderData.order_type === 'hausmade_shipping' || (orderData.shipping_address && orderData.shipping_address !== 'รับหน้าร้าน IN THE HAUS'))
        const isFoodPickup = bookingType === 'pickup' || orderData.order_type === 'pickup'
        const isDineIn = bookingType === 'dine_in'

        let channelTitle = '🧾 มีออเดอร์ใหม่เข้าระบบ!'
        let orderTypeLabel = '🏪 รับหน้าร้าน (Store Pickup)'
        let orderCategoryName = 'ORDER'
        let adminUrl = `${appOrigin}/admin`

        if (isHausmade) {
            channelTitle = isShipping ? '📦 มีออเดอร์ HAUSMADE (จัดส่งพัสดุ) เข้าใหม่!' : '🛍️ มีออเดอร์ HAUSMADE (รับหน้าร้าน) เข้าใหม่!'
            orderTypeLabel = isShipping ? '🚚 จัดส่งพัสดุ (Shipping)' : '🏪 รับหน้าร้าน (Store Pickup)'
            orderCategoryName = 'HAUSMADE'
            adminUrl = `${appOrigin}/admin/hausmade`
        } else if (isFoodPickup) {
            channelTitle = '🥡 มีออเดอร์สั่งกลับบ้าน (Food Pickup) เข้าใหม่!'
            orderTypeLabel = '🏪 รับกลับบ้าน (Takeaway Pickup)'
            orderCategoryName = 'FOOD PICKUP'
            adminUrl = `${appOrigin}/pos?view=online`
        } else if (isDineIn) {
            channelTitle = '🍽️ มีการจองโต๊ะ (Dine-in) เข้าใหม่!'
            orderTypeLabel = '🍽️ ทานที่ร้าน (Dine-in)'
            orderCategoryName = 'DINE-IN RESERVATION'
            adminUrl = `${appOrigin}/admin?tab=bookings`
        }

        const customerName = orderData.pickup_contact_name || orderData.customer_name || (isHausmade ? 'ลูกค้า HAUSMADE' : 'ลูกค้าออนไลน์')
        const customerPhone = orderData.pickup_contact_phone || orderData.phone_number || orderData.customer_phone || '-'
        
        const totalAmount = Number(orderData.total_amount || 0)
        const shippingFee = Number(orderData.shipping_fee || 0)
        const discountAmount = Number(orderData.discount_amount || orderData.xhaus_discount || 0)
        const subtotal = totalAmount + discountAmount - (isShipping ? shippingFee : 0)
        
        const shippingAddress = orderData.shipping_address || '-'
        const pickupSchedule = orderData.booking_time ? new Date(orderData.booking_time).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'
        const customerNote = orderData.customer_note || '-'
        const paymentSlipUrl = orderData.payment_slip_url || ''
        const trackingUrl = `${appOrigin}/track/${trackingToken}`

        // Expand slip URL if relative
        let slipFullUrl = ''
        if (paymentSlipUrl) {
            if (paymentSlipUrl.startsWith('http')) {
                slipFullUrl = paymentSlipUrl
            } else {
                const supabaseHost = process.env.VITE_SUPABASE_URL || 'https://lxfavbzmebqqsffgyyph.supabase.co'
                slipFullUrl = `${supabaseHost}/storage/v1/object/public/slips/${paymentSlipUrl}`
            }
        }

        // 2. Resolve missing item names via Supabase if needed (guarantees zero "undefined" names)
        let resolvedItems = Array.isArray(orderItems) ? [...orderItems] : []
        const missingNameItemIds = resolvedItems
            .filter(i => !(i.name || i.custom_name || i.menu_item_name || i.item_name) && (i.menu_item_id || i.id))
            .map(i => i.menu_item_id || i.id)

        if (missingNameItemIds.length > 0) {
            try {
                const { createClient } = await import('@supabase/supabase-js')
                const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lxfavbzmebqqsffgyyph.supabase.co'
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'
                const supabase = createClient(supabaseUrl, supabaseKey)

                const { data: menuData } = await supabase
                    .from('menu_items')
                    .select('id, name, price')
                    .in('id', missingNameItemIds)

                if (menuData && menuData.length > 0) {
                    const nameMap = new Map(menuData.map(m => [m.id, m]))
                    resolvedItems = resolvedItems.map(item => {
                        const itemId = item.menu_item_id || item.id
                        const found = nameMap.get(itemId)
                        if (found) {
                            return {
                                ...item,
                                name: item.name || item.custom_name || found.name,
                                price: item.price ?? item.price_at_time ?? found.price
                            }
                        }
                        return item
                    })
                }
            } catch (dbErr) {
                console.warn('[send-order-email] Failed to query menu_items for missing names:', dbErr)
            }
        }

        // Build items summary for LINE / Discord
        const formatItemSummary = (item, idx) => {
            const qty = Number(item.quantity || item.qty || 1)
            const name = item.name || item.custom_name || item.menu_item_name || item.item_name || item.menu_items?.name || `สินค้า #${idx + 1}`
            const unitPrice = Number(item.price_at_time ?? item.price ?? 0)

            let optText = ''
            if (item.selected_options) {
                if (typeof item.selected_options === 'string') {
                    optText = item.selected_options
                } else if (Array.isArray(item.selected_options)) {
                    optText = item.selected_options
                        .map(o => (typeof o === 'string' ? o : o.name || o.choice_name || o.value || ''))
                        .filter(Boolean)
                        .join(', ')
                } else if (typeof item.selected_options === 'object') {
                    optText = Object.values(item.selected_options).flat().filter(Boolean).join(', ')
                }
            }
            const optDisplay = optText ? ` (${optText})` : ''
            return `• ${qty}x ${name}${optDisplay} (฿${unitPrice.toLocaleString()})`
        }

        const lineItemsSummary = resolvedItems.length > 0
            ? resolvedItems.map(formatItemSummary).join('\n')
            : '• 1x รายการสั่งซื้อ'

        // Build HTML Email
        const emailSubject = `[${orderCategoryName}] ออเดอร์ใหม่ #${shortId} (${orderTypeLabel}) ยอด ฿${totalAmount.toLocaleString()}.-`
        
        const itemsRowsHtml = resolvedItems.map((item, idx) => {
            const name = item.name || item.custom_name || item.menu_item_name || item.item_name || item.menu_items?.name || `สินค้า #${idx + 1}`
            const qty = Number(item.quantity || item.qty || 1)
            const unitPrice = Number(item.price_at_time ?? item.price ?? 0)
            const rowTotal = unitPrice * qty
            let optText = ''
            if (item.selected_options) {
                if (typeof item.selected_options === 'string') {
                    optText = item.selected_options
                } else if (Array.isArray(item.selected_options)) {
                    optText = item.selected_options.map(o => (typeof o === 'string' ? o : o.name || o.choice_name || o.value || '')).filter(Boolean).join(', ')
                } else if (typeof item.selected_options === 'object') {
                    optText = Object.values(item.selected_options).flat().filter(Boolean).join(', ')
                }
            }

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
                ${orderCategoryName} NEW ORDER
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
                    <td style="padding: 6px 0; font-size: 13px; color: #666;">เวลารับสินค้า:</td>
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
                    [ 📦 เปิดหน้า TRACKING ลูกค้า (${shortId}) ]
                </a>
            </div>

            ${slipFullUrl ? `
            <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 12px; color: #166534;">
                <strong>✓ มีการแนบสลิปชำระเงินเรียบร้อย</strong><br/>
                <a href="${slipFullUrl}" target="_blank" style="color: #15803d; font-family: monospace; font-size: 11px; word-break: break-all;">เปิดดูไฟล์สลิป ➔ ${slipFullUrl}</a>
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
                        from: `${orderCategoryName} Store <orders@inthehaus.co>`,
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

        // Construct notification message for LINE & Discord
        const notificationMessage = `${channelTitle}
━━━━━━━━━━━━━━━
🏷️ รหัส: #${shortId} (${orderTypeLabel})
👤 ลูกค้า: ${customerName}
📞 โทร: ${customerPhone}
💰 ยอดสุทธิ: ฿${totalAmount.toLocaleString()} บาท
${isShipping ? `📍 ที่อยู่จัดส่ง: ${shippingAddress}\n` : ''}${orderData.booking_time ? `🕒 กำหนดเวลารับ: ${pickupSchedule}\n` : ''}${customerNote && customerNote !== '-' ? `📝 หมายเหตุ: ${customerNote}\n` : ''}
📦 สินค้า:
${lineItemsSummary}
${slipFullUrl ? `\n🧾 สลิปชำระเงิน: ${slipFullUrl}` : ''}
✉️ ส่งอีเมลแจ้งเตือนไปที่: ${targetEmail}
━━━━━━━━━━━━━━━
🔍 ตรวจสอบ: ${adminUrl}
📦 Tracking: ${trackingUrl}`

        // 2. Dispatch to LINE Group
        let lineSent = false
        if (LINE_CHANNEL_ACCESS_TOKEN && LINE_GROUP_ID) {
            try {
                const lineResp = await fetch('https://api.line.me/v2/bot/message/push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                    },
                    body: JSON.stringify({
                        to: LINE_GROUP_ID,
                        messages: [{ type: 'text', text: notificationMessage }]
                    })
                })
                if (lineResp.ok) {
                    lineSent = true
                }
            } catch (lErr) {
                console.warn('[send-order-email] LINE dispatch exception:', lErr)
            }
        }

        // 3. Dispatch to Discord Webhook (if DISCORD_WEBHOOK_URL is configured)
        let discordSent = false
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
        if (discordWebhookUrl) {
            try {
                const discordResp = await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: notificationMessage })
                })
                if (discordResp.ok) {
                    discordSent = true
                }
            } catch (dErr) {
                console.warn('[send-order-email] Discord dispatch exception:', dErr)
            }
        }

        return res.status(200).json({
            success: true,
            emailSent,
            lineSent,
            discordSent,
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
