import { describe, it, expect } from 'vitest';

describe('GPS Auto-Submit & POS Approval Flow', () => {
    // 1. Simulation of CustomerOrderLanding checkout payload generation
    const buildCustomerCheckoutPayload = ({ isGeofenceVerified, isAutoSubmit, existingBooking, tableId, cartTotal }) => {
        let bookingStatus = 'seated';
        let staffRemarkPrefix = '';
        let needsApproval = false;

        if (!existingBooking) {
            if (isGeofenceVerified) {
                bookingStatus = 'seated';
                staffRemarkPrefix = '[QR:ORDER] ';
                needsApproval = false;
            } else if (isAutoSubmit) {
                // Auto-submit flow for unverified GPS
                bookingStatus = 'pending';
                staffRemarkPrefix = '[QR:AUTO-SUBMIT] [GPS_UNVERIFIED] [WAITING_APPROVAL] ';
                needsApproval = true;
            } else {
                throw new Error('GPS unverified and auto-submit not requested');
            }
        }

        const payload = {
            table_id: tableId,
            status: bookingStatus,
            staff_remark: `${staffRemarkPrefix}Customer online order total ฿${cartTotal}`,
            is_auto_submit: !isGeofenceVerified && isAutoSubmit
        };

        const broadcastPayload = {
            event: 'qr_order_created',
            booking_id: 1234,
            table_id: tableId,
            gps_verified: Boolean(isGeofenceVerified),
            needs_approval: needsApproval,
            is_auto_submit: !isGeofenceVerified && isAutoSubmit
        };

        return { payload, broadcastPayload };
    };

    it('should create seated order directly when GPS is verified', () => {
        const result = buildCustomerCheckoutPayload({
            isGeofenceVerified: true,
            isAutoSubmit: false,
            existingBooking: null,
            tableId: 6, // Table H9
            cartTotal: 350
        });

        expect(result.payload.status).toBe('seated');
        expect(result.payload.staff_remark).toContain('[QR:ORDER]');
        expect(result.payload.staff_remark).not.toContain('GPS_UNVERIFIED');
        expect(result.broadcastPayload.gps_verified).toBe(true);
        expect(result.broadcastPayload.needs_approval).toBe(false);
    });

    it('should create pending order with WAITING_APPROVAL tag when GPS fails and Auto-Submit is used', () => {
        const result = buildCustomerCheckoutPayload({
            isGeofenceVerified: false,
            isAutoSubmit: true,
            existingBooking: null,
            tableId: 6, // Table H9
            cartTotal: 420
        });

        expect(result.payload.status).toBe('pending');
        expect(result.payload.staff_remark).toContain('[QR:AUTO-SUBMIT]');
        expect(result.payload.staff_remark).toContain('[GPS_UNVERIFIED]');
        expect(result.payload.staff_remark).toContain('[WAITING_APPROVAL]');
        expect(result.payload.is_auto_submit).toBe(true);

        expect(result.broadcastPayload.gps_verified).toBe(false);
        expect(result.broadcastPayload.needs_approval).toBe(true);
        expect(result.broadcastPayload.is_auto_submit).toBe(true);
    });

    // 2. Simulation of POSDashboard auto-print gatekeeper logic
    const shouldPOSAutoPrintAndSeat = (booking) => {
        const isWaitingGpsApproval = booking.status === 'pending' && (booking.staff_remark || '').includes('GPS_UNVERIFIED');
        if (isWaitingGpsApproval) {
            return {
                canAutoSeat: false,
                canAutoPrint: false,
                requiresStaffAction: true,
                toastType: 'approval_alert'
            };
        }

        return {
            canAutoSeat: booking.status === 'pending',
            canAutoPrint: true,
            requiresStaffAction: false,
            toastType: 'normal_order'
        };
    };

    it('should hold auto-print and auto-seat on POS when GPS is unverified', () => {
        const unverifiedBooking = {
            id: 991,
            status: 'pending',
            staff_remark: '[QR:AUTO-SUBMIT] [GPS_UNVERIFIED] [WAITING_APPROVAL] Order 1',
            table_id: 6
        };

        const decision = shouldPOSAutoPrintAndSeat(unverifiedBooking);
        expect(decision.canAutoSeat).toBe(false);
        expect(decision.canAutoPrint).toBe(false);
        expect(decision.requiresStaffAction).toBe(true);
        expect(decision.toastType).toBe('approval_alert');
    });

    it('should auto-print normally when order is verified or already approved', () => {
        const verifiedBooking = {
            id: 992,
            status: 'seated',
            staff_remark: '[QR:ORDER] Order 2',
            table_id: 6
        };

        const decision = shouldPOSAutoPrintAndSeat(verifiedBooking);
        expect(decision.canAutoPrint).toBe(true);
        expect(decision.requiresStaffAction).toBe(false);
        expect(decision.toastType).toBe('normal_order');
    });

    // 3. Simulation of CustomerOrderStatus timeline progression
    const getCustomerOrderSteps = (booking) => {
        const isWaitingStaffApproval = booking?.status === 'pending' || (booking?.staff_remark || '').includes('WAITING_APPROVAL');
        const isPreparing = booking?.status === 'seated' || booking?.status === 'confirmed';
        const isCompleted = booking?.status === 'completed';

        if (isWaitingStaffApproval) {
            return [
                { id: 'submitted', label: 'ส่งออเดอร์แล้ว', status: 'done' },
                { id: 'waiting_approval', label: 'รอพนักงานอนุมัติ', status: 'current' },
                { id: 'preparing', label: 'กำลังจัดเตรียม', status: 'upcoming' },
                { id: 'served', label: 'อาหารพร้อมเสิร์ฟ', status: 'upcoming' }
            ];
        }

        return [
            { id: 'submitted', label: 'ส่งออเดอร์แล้ว', status: 'done' },
            { id: 'preparing', label: 'กำลังจัดเตรียม', status: isPreparing ? 'current' : 'done' },
            { id: 'served', label: 'อาหารพร้อมเสิร์ฟ', status: isCompleted ? 'done' : 'upcoming' }
        ];
    };

    it('should display "รอพนักงานอนุมัติ" step on customer status page for unverified orders', () => {
        const pendingOrder = {
            status: 'pending',
            staff_remark: '[QR:AUTO-SUBMIT] [GPS_UNVERIFIED] [WAITING_APPROVAL]'
        };

        const steps = getCustomerOrderSteps(pendingOrder);
        expect(steps.some(s => s.id === 'waiting_approval')).toBe(true);
        expect(steps.find(s => s.id === 'waiting_approval').status).toBe('current');
    });

    it('should skip "รอพนักงานอนุมัติ" step when order is approved/seated', () => {
        const approvedOrder = {
            status: 'seated',
            staff_remark: '[QR:AUTO-SUBMIT] [GPS_UNVERIFIED]'
        };

        const steps = getCustomerOrderSteps(approvedOrder);
        expect(steps.some(s => s.id === 'waiting_approval')).toBe(false);
        expect(steps.find(s => s.id === 'preparing').status).toBe('current');
    });
});
