import { describe, it, expect } from 'vitest';
import { parseAddressComponents } from '../courierExportHelper';
import { getBookingPaymentBreakdown, calculateShiftMetrics } from '../shiftHelper';

describe('Hausmade Logistics & Courier Address Parser', () => {
    it('correctly extracts postal code, province, district, subdistrict from Thai address', () => {
        const rawAddress = '123/45 หมู่บ้านสุขสันต์ ต.ในเมือง อ.เมือง จ.นครพนม 48000';
        const parsed = parseAddressComponents(rawAddress, {
            pickup_contact_name: 'คุณนพดล',
            pickup_contact_phone: '089-123-4567',
            tracking_token: 'HM-2026-001'
        });

        expect(parsed.postalCode).toBe('48000');
        expect(parsed.province).toBe('นครพนม');
        expect(parsed.district).toBe('เมือง');
        expect(parsed.subDistrict).toBe('ในเมือง');
        expect(parsed.recipientName).toBe('คุณนพดล');
        expect(parsed.phone).toBe('0891234567');
        expect(parsed.token).toBe('HM-2026-001');
    });

    it('handles unstructured address without prefixes gracefully', () => {
        const rawAddress = '99 ถนนสุนทรวิจิตร 48000';
        const parsed = parseAddressComponents(rawAddress, {
            customer_name: 'Guest User',
            phone: '0985284217'
        });

        expect(parsed.postalCode).toBe('48000');
        expect(parsed.recipientName).toBe('Guest User');
        expect(parsed.phone).toBe('0985284217');
        expect(parsed.addressLine.length).toBeGreaterThan(0);
    });
});

describe('Shift Segregation for Hausmade Orders', () => {
    it('isolates online Hausmade shipping sales from in-store cash drawer', () => {
        const bookings = [
            // 1. In-store POS Dine-in cash order
            {
                id: 'b1',
                booking_type: 'dine_in',
                order_type: 'dine_in',
                status: 'completed',
                payment_method: 'cash',
                total_amount: 500,
                deposit_amount: 500
            },
            // 2. In-store POS QR order
            {
                id: 'b2',
                booking_type: 'walk_in',
                order_type: 'pos',
                status: 'completed',
                payment_method: 'promptpay',
                total_amount: 300,
                deposit_amount: 300
            },
            // 3. Online Hausmade shipping order (PromptPay)
            {
                id: 'b3',
                booking_type: 'hausmade',
                order_type: 'hausmade_shipping',
                status: 'completed',
                payment_method: 'promptpay',
                total_amount: 1200,
                deposit_amount: 1200,
                shipping_fee: 50
            }
        ];

        const shift = {
            id: 'shift-01',
            opening_cash: 2000,
            cash_drop_amount: 0
        };

        const metrics = calculateShiftMetrics(shift, bookings);

        // Expected in-store cash in drawer: 2000 opening + 500 in-store cash = 2500
        expect(metrics.inStoreCash).toBe(500);
        expect(metrics.expectedCash).toBe(2500);

        // Online sales separated from drawer
        expect(metrics.onlineSales).toBe(1200);
        expect(metrics.onlineOrdersCount).toBe(1);

        // Total shift sales combines in-store + online
        expect(metrics.totalSales).toBe(2000); // 500 + 300 + 1200
        expect(metrics.inStoreSales).toBe(800);  // 500 + 300
    });
});

describe('Member Dynamic Tier Policy & Discounts', () => {
    it('strictly returns 0 discount when tier % discount is disabled (default shop policy)', async () => {
        const { calculateTierDiscount, DEFAULT_CRM_SETTINGS } = await import('../crmHelper');
        
        // Test Inner Haus customer with 1000 Baht subtotal
        const result = calculateTierDiscount('Inner Haus', 1000, DEFAULT_CRM_SETTINGS);
        expect(result.isEnabled).toBe(false);
        expect(result.discountAmount).toBe(0);
        expect(result.discountPercent).toBe(0);
    });

    it('calculates tier discount properly only when explicitly enabled', async () => {
        const { calculateTierDiscount } = await import('../crmHelper');
        
        const enabledSettings = {
            crm_enable_tier_discount: true,
            crm_tier_inner_discount_pct: 10,
            crm_tier_people_discount_pct: 5
        };

        const innerResult = calculateTierDiscount('Inner Haus', 1000, enabledSettings);
        expect(innerResult.isEnabled).toBe(true);
        expect(innerResult.discountPercent).toBe(10);
        expect(innerResult.discountAmount).toBe(100);

        const peopleResult = calculateTierDiscount('Haus People', 1000, enabledSettings);
        expect(peopleResult.isEnabled).toBe(true);
        expect(peopleResult.discountPercent).toBe(5);
        expect(peopleResult.discountAmount).toBe(50);
    });
});

