import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    hashPin, 
    saveOfflineStaffCredential, 
    saveBulkOfflineStaffCredentials, 
    verifyPinOffline, 
    getOfflineStaffAuth, 
    getOfflineStaffCount, 
    getOfflineStaffList,
    STORAGE_OFFLINE_AUTH, 
    STORAGE_STAFF_CACHE,
    PIN_SALT 
} from '../staffAuthHelper';
import { 
    isOnline, 
    setNetworkStatus, 
    getOfflineQueue, 
    saveOfflineQueue, 
    addToOfflineQueue 
} from '../offlineHelper';

describe('POS Offline PIN Authentication & Network Resilience Tests', () => {

    beforeEach(() => {
        localStorage.clear();
        setNetworkStatus(true);
    });

    describe('1. PIN Hashing & Security', () => {
        it('should deterministically hash a 4-digit PIN with salt', async () => {
            const pin = '1234';
            const hash1 = await hashPin(pin);
            const hash2 = await hashPin(pin);

            expect(hash1).toBeDefined();
            expect(hash1.length).toBe(64); // SHA-256 hex string
            expect(hash1).toBe(hash2);
        });

        it('should trim surrounding whitespace from PIN before hashing', async () => {
            const hashA = await hashPin('5678');
            const hashB = await hashPin('  5678  ');
            expect(hashA).toBe(hashB);
        });

        it('should produce different hashes for different PINs', async () => {
            const hash1 = await hashPin('1111');
            const hash2 = await hashPin('2222');
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty or null PIN gracefully', async () => {
            const hashEmpty = await hashPin('');
            const hashNull = await hashPin(null);
            expect(hashEmpty).toBe('');
            expect(hashNull).toBe('');
        });
    });

    describe('2. Offline Staff Credential Storage & Verification', () => {
        it('should return NO_OFFLINE_CACHE when no staff credentials have been saved', async () => {
            const result = await verifyPinOffline('1234');
            expect(result.success).toBe(false);
            expect(result.reason).toBe('NO_OFFLINE_CACHE');
            expect(result.message).toContain('ยังไม่มีข้อมูลพนักงาน');
        });

        it('should save credential on successful login and allow offline verification', async () => {
            const staff = {
                id: 'staff-uuid-1',
                display_name: 'สมชาย แคชเชียร์',
                role: 'cashier'
            };

            await saveOfflineStaffCredential(staff, '4321');

            // Verify stored in localStorage without plain-text PIN
            const store = getOfflineStaffAuth();
            expect(store['staff-uuid-1']).toBeDefined();
            expect(store['staff-uuid-1'].display_name).toBe('สมชาย แคชเชียร์');
            expect(store['staff-uuid-1'].pin).toBeUndefined(); // Raw PIN must NEVER be saved!
            expect(store['staff-uuid-1'].pin_hash).toBeDefined();
            expect(store['staff-uuid-1'].pin_hash.length).toBe(64);

            // Offline verification with correct PIN
            const verifySuccess = await verifyPinOffline('4321');
            expect(verifySuccess.success).toBe(true);
            expect(verifySuccess.staff.id).toBe('staff-uuid-1');
            expect(verifySuccess.staff.display_name).toBe('สมชาย แคชเชียร์');
            expect(verifySuccess.staff.role).toBe('cashier');

            // Offline verification with incorrect PIN
            const verifyFail = await verifyPinOffline('9999');
            expect(verifyFail.success).toBe(false);
            expect(verifyFail.reason).toBe('INVALID_PIN');
        });

        it('should correctly distinguish between multiple staff members offline', async () => {
            await saveOfflineStaffCredential({ id: 'staff_1', display_name: 'ก้อย', role: 'staff' }, '1111');
            await saveOfflineStaffCredential({ id: 'staff_2', display_name: 'แนน', role: 'manager' }, '2222');
            await saveOfflineStaffCredential({ id: 'staff_3', display_name: 'บอส', role: 'owner' }, '3333');

            expect(getOfflineStaffCount()).toBe(3);

            const auth1 = await verifyPinOffline('1111');
            expect(auth1.success).toBe(true);
            expect(auth1.staff.display_name).toBe('ก้อย');

            const auth2 = await verifyPinOffline('2222');
            expect(auth2.success).toBe(true);
            expect(auth2.staff.display_name).toBe('แนน');

            const auth3 = await verifyPinOffline('3333');
            expect(auth3.success).toBe(true);
            expect(auth3.staff.display_name).toBe('บอส');
            expect(auth3.staff.role).toBe('owner');
        });

        it('should support bulk sync from Supabase RPC without exposing raw PINs', async () => {
            const pinHash1 = await hashPin('7890');
            const pinHash2 = await hashPin('9988');

            const serverPayload = [
                { id: 'uuid-1', display_name: 'Admin A', role: 'admin', pin_hash: pinHash1 },
                { id: 'uuid-2', display_name: 'Cashier B', role: 'cashier', pin_hash: pinHash2 }
            ];

            saveBulkOfflineStaffCredentials(serverPayload);

            expect(getOfflineStaffCount()).toBe(2);

            const check1 = await verifyPinOffline('7890');
            expect(check1.success).toBe(true);
            expect(check1.staff.display_name).toBe('Admin A');

            const check2 = await verifyPinOffline('9988');
            expect(check2.success).toBe(true);
            expect(check2.staff.display_name).toBe('Cashier B');

            // Safe list returns names without hashes
            const safeList = getOfflineStaffList();
            expect(safeList.length).toBe(2);
            expect(safeList[0].pin_hash).toBeUndefined();
        });
    });

    describe('3. Network Status & Reactive Offline Alerts', () => {
        it('should track online/offline status and dispatch pos-network-status-changed events', () => {
            let capturedEvent = null;
            const listener = (e) => {
                capturedEvent = e.detail;
            };

            window.addEventListener('pos-network-status-changed', listener);

            // Transition from Online to Offline
            setNetworkStatus(false, 'TEST_DISCONNECT');
            expect(isOnline()).toBe(false);
            expect(capturedEvent).toEqual({
                isOnline: false,
                wasOffline: false,
                reason: 'TEST_DISCONNECT'
            });

            // Transition from Offline to Online
            setNetworkStatus(true, 'TEST_RECONNECT');
            expect(isOnline()).toBe(true);
            expect(capturedEvent).toEqual({
                isOnline: true,
                wasOffline: true,
                reason: 'TEST_RECONNECT'
            });

            window.removeEventListener('pos-network-status-changed', listener);
        });

        it('should correctly queue sync_shift actions in the offline queue', () => {
            const shiftPayload = {
                id: 'shift_offline_123',
                staffName: 'กะเช้า',
                openingFloat: 1000,
                status: 'open',
                openedAt: new Date().toISOString()
            };

            addToOfflineQueue('sync_shift', shiftPayload);

            const queue = getOfflineQueue();
            expect(queue.length).toBe(1);
            expect(queue[0].type).toBe('sync_shift');
            expect(queue[0].payload.id).toBe('shift_offline_123');
            expect(queue[0].payload.staffName).toBe('กะเช้า');
        });
    });
});
