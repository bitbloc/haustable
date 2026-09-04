import { describe, it, expect } from 'vitest'

describe('Order Notification & Webhook Audit', () => {
    // 1. Classification test
    const classifyOrder = (orderData) => {
        const bookingType = orderData.booking_type || (orderData.shipping_address ? 'hausmade' : 'pickup')
        const isHausmade = bookingType === 'hausmade' || (orderData.order_type && String(orderData.order_type).includes('hausmade'))
        const isShipping = isHausmade && (orderData.order_type === 'hausmade_shipping' || (orderData.shipping_address && orderData.shipping_address !== 'รับหน้าร้าน IN THE HAUS'))
        const isFoodPickup = bookingType === 'pickup' || orderData.order_type === 'pickup'
        const isDineIn = bookingType === 'dine_in'

        if (isHausmade) {
            return {
                channelTitle: isShipping ? '📦 มีออเดอร์ HAUSMADE (จัดส่งพัสดุ) เข้าใหม่!' : '🛍️ มีออเดอร์ HAUSMADE (รับหน้าร้าน) เข้าใหม่!',
                orderTypeLabel: isShipping ? '🚚 จัดส่งพัสดุ (Shipping)' : '🏪 รับหน้าร้าน (Store Pickup)',
                category: 'HAUSMADE'
            }
        } else if (isFoodPickup) {
            return {
                channelTitle: '🥡 มีออเดอร์สั่งกลับบ้าน (Food Pickup) เข้าใหม่!',
                orderTypeLabel: '🏪 รับกลับบ้าน (Takeaway Pickup)',
                category: 'FOOD PICKUP'
            }
        } else if (isDineIn) {
            return {
                channelTitle: '🍽️ มีการจองโต๊ะ (Dine-in) เข้าใหม่!',
                orderTypeLabel: '🍽️ ทานที่ร้าน (Dine-in)',
                category: 'DINE-IN RESERVATION'
            }
        }
        return {
            channelTitle: '🧾 มีออเดอร์ใหม่เข้าระบบ!',
            orderTypeLabel: '🏪 รับหน้าร้าน (Store Pickup)',
            category: 'ORDER'
        }
    }

    // 2. Item summary test
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

    // 3. DB Sanitization test
    const sanitizeForDb = (bookingId, item) => ({
        booking_id: bookingId,
        menu_item_id: item.menu_item_id || item.id,
        quantity: Number(item.quantity || item.qty || 1),
        price_at_time: Number(item.price_at_time ?? item.price ?? 0),
        selected_options: item.selected_options || null,
        ...(item.custom_name ? { custom_name: item.custom_name } : {}),
        ...(item.status ? { status: item.status } : {}),
        ...(item.destination ? { destination: item.destination } : {})
    })

    it('correctly classifies a food takeaway pickup order instead of HAUSMADE', () => {
        const pickupOrder = {
            booking_type: 'pickup',
            pickup_contact_name: 'banff line',
            pickup_contact_phone: '0456845963',
            total_amount: 19
        }
        const res = classifyOrder(pickupOrder)
        expect(res.category).toBe('FOOD PICKUP')
        expect(res.channelTitle).toContain('สั่งกลับบ้าน (Food Pickup)')
        expect(res.orderTypeLabel).toContain('รับกลับบ้าน')
    })

    it('correctly classifies a hausmade shipping order', () => {
        const hmOrder = {
            booking_type: 'hausmade',
            order_type: 'hausmade_shipping',
            shipping_address: '123 River Road, Nakhon Phanom'
        }
        const res = classifyOrder(hmOrder)
        expect(res.category).toBe('HAUSMADE')
        expect(res.channelTitle).toContain('จัดส่งพัสดุ')
    })

    it('correctly classifies a hausmade store pickup order', () => {
        const hmOrder = {
            booking_type: 'hausmade',
            order_type: 'hausmade_pickup'
        }
        const res = classifyOrder(hmOrder)
        expect(res.category).toBe('HAUSMADE')
        expect(res.channelTitle).toContain('รับหน้าร้าน')
    })

    it('formats items without "undefined" when name is present', () => {
        const item = {
            name: 'น้ำเปล่าสิงห์ 600 มล',
            quantity: 1,
            price_at_time: 20
        }
        const str = formatItemSummary(item, 0)
        expect(str).toBe('• 1x น้ำเปล่าสิงห์ 600 มล (฿20)')
        expect(str).not.toContain('undefined')
    })

    it('formats fallback gracefully when name is completely missing (no undefined)', () => {
        const item = {
            quantity: 2,
            price: 50
        }
        const str = formatItemSummary(item, 0)
        expect(str).toBe('• 2x สินค้า #1 (฿50)')
        expect(str).not.toContain('undefined')
    })

    it('includes options properly in item row string', () => {
        const item = {
            name: 'อเมริกาโน่เย็น',
            quantity: 2,
            price_at_time: 85,
            selected_options: [{ name: 'หวานน้อย 25%' }, { name: 'คั่วกลาง' }]
        }
        const str = formatItemSummary(item, 0)
        expect(str).toContain('หวานน้อย 25%, คั่วกลาง')
        expect(str).toContain('• 2x อเมริกาโน่เย็น')
    })

    it('sanitizes item for database insert without exposing extra fields like name or price', () => {
        const frontendItem = {
            id: 74,
            menu_item_id: 74,
            name: 'น้ำเปล่าสิงห์ 600 มล',
            qty: 1,
            quantity: 1,
            price: 20,
            price_at_time: 20,
            selected_options: null,
            optionsSummary: []
        }
        const dbItem = sanitizeForDb('booking-123', frontendItem)
        expect(dbItem).toEqual({
            booking_id: 'booking-123',
            menu_item_id: 74,
            quantity: 1,
            price_at_time: 20,
            selected_options: null
        })
        expect(dbItem.name).toBeUndefined()
        expect(dbItem.price).toBeUndefined()
    })
})
