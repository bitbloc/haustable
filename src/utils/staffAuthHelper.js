/**
 * POS Offline Staff PIN Authentication & Security Helper
 * 
 * Provides:
 * 1. Salted SHA-256 PIN hashing (Web Crypto API with deterministic fallback).
 * 2. Secure local credential caching for offline POS APK login and unlock.
 * 3. Offline PIN validation matching against hashed credentials (zero raw PIN storage).
 * 4. Online synchronization of staff hashes from Supabase RPC.
 */

import { supabase } from '../lib/supabaseClient';
import { isOnline } from './offlineHelper';

export const PIN_SALT = 'IN_THE_HAUS_POS_OFFLINE_PIN_V1';
export const STORAGE_OFFLINE_AUTH = 'pos_offline_staff_auth';
export const STORAGE_STAFF_CACHE = 'pos_cache_staff_list';

/**
 * Hash a 4+ digit PIN using SHA-256 with store salt.
 * Uses Web Crypto API when available, with a lightweight pure-JS SHA-256 fallback.
 */
export async function hashPin(pin, salt = PIN_SALT) {
    const normalizedPin = String(pin || '').trim();
    if (!normalizedPin) return '';
    const payload = `${salt}:${normalizedPin}`;

    if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(payload);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.warn('[StaffAuth] crypto.subtle failed, using fallback:', e);
        }
    }

    // Pure JS SHA-256 fallback (RFC 6234 compliant)
    return sha256Fallback(payload);
}

/**
 * Pure JS SHA-256 fallback for environments where crypto.subtle is restricted
 */
function sha256Fallback(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j;
    let result = '';

    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;
    
    let hash = [];
    const k = [];
    let primeCounter = 0;

    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (i = 0; i < 313; i += candidate) {
                isComposite[i] = candidate;
            }
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    
    hash = hash.slice(0, 8);

    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return '';
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength | 0);
    
    for (j = 0; j < words[lengthProperty];) {
        const w = words.slice(j, j += 16);
        const oldHash = hash.slice(0);

        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15], w2 = w[i - 2];
            const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
            const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
            const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
            const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
            const s0_h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
            const s1_h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
            
            const temp1 = hash[7] + s1_h + ch + k[i] + (w[i] = (i < 16) ? w[i] : (
                w[i - 16] + s0 + w[i - 7] + s1
            ) | 0);
            const temp2 = s0_h + maj;
            
            hash = [(temp1 + temp2) | 0].concat(hash);
            hash[4] = (hash[4] + temp1) | 0;
            hash.pop();
        }
        
        for (i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }
    
    for (i = 0; i < 8; i++) {
        for (j = 3; j >= 0; j--) {
            const b = (hash[i] >> (8 * j)) & 255;
            result += (b < 16 ? '0' : '') + b.toString(16);
        }
    }
    return result;
}

/**
 * Retrieve the offline staff credentials registry from localStorage.
 * Returns an object keyed by staff ID: { [id]: { id, display_name, role, pin_hash, cached_at } }
 */
export function getOfflineStaffAuth() {
    try {
        const raw = localStorage.getItem(STORAGE_OFFLINE_AUTH);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Save or update a single staff member's offline credentials upon successful login.
 */
export async function saveOfflineStaffCredential(staff, pin) {
    if (!staff || !staff.id || !pin) return;
    try {
        const pinHash = await hashPin(pin);
        const store = getOfflineStaffAuth();
        store[staff.id] = {
            id: String(staff.id),
            display_name: staff.display_name || 'Staff',
            role: staff.role || 'staff',
            pin_hash: pinHash,
            cached_at: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_OFFLINE_AUTH, JSON.stringify(store));

        // Also update the safe staff list cache
        const staffList = getOfflineStaffList();
        const existingIdx = staffList.findIndex(s => s.id === staff.id);
        const safeStaff = { id: staff.id, display_name: staff.display_name, role: staff.role };
        if (existingIdx !== -1) {
            staffList[existingIdx] = safeStaff;
        } else {
            staffList.push(safeStaff);
        }
        localStorage.setItem(STORAGE_STAFF_CACHE, JSON.stringify(staffList));

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('pos-staff-cache-updated'));
        }
    } catch (e) {
        console.error('[StaffAuth] Failed to cache offline staff credential:', e);
    }
}

/**
 * Bulk save offline credentials (used during online sync from Supabase RPC).
 */
export function saveBulkOfflineStaffCredentials(credentialsList = []) {
    if (!Array.isArray(credentialsList) || credentialsList.length === 0) return;
    try {
        const store = getOfflineStaffAuth();
        const safeStaffList = [];

        for (const item of credentialsList) {
            if (item && item.id && item.pin_hash) {
                store[item.id] = {
                    id: String(item.id),
                    display_name: item.display_name || 'Staff',
                    role: item.role || 'staff',
                    pin_hash: item.pin_hash,
                    cached_at: new Date().toISOString()
                };
                safeStaffList.push({
                    id: String(item.id),
                    display_name: item.display_name || 'Staff',
                    role: item.role || 'staff'
                });
            }
        }
        localStorage.setItem(STORAGE_OFFLINE_AUTH, JSON.stringify(store));
        if (safeStaffList.length > 0) {
            localStorage.setItem(STORAGE_STAFF_CACHE, JSON.stringify(safeStaffList));
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('pos-staff-cache-updated'));
        }
    } catch (e) {
        console.error('[StaffAuth] Failed to save bulk offline credentials:', e);
    }
}

/**
 * Verify an entered PIN offline against locally stored credentials.
 * Returns:
 * - { success: true, staff: { id, display_name, role } }
 * - { success: false, reason: 'NO_OFFLINE_CACHE' | 'INVALID_PIN', message: string }
 */
export async function verifyPinOffline(enteredPin) {
    const cleanPin = String(enteredPin || '').trim();
    if (!cleanPin) {
        return { success: false, reason: 'INVALID_PIN', message: 'กรุณาระบุรหัส PIN' };
    }

    const store = getOfflineStaffAuth();
    const staffRecords = Object.values(store);

    if (staffRecords.length === 0) {
        return {
            success: false,
            reason: 'NO_OFFLINE_CACHE',
            message: 'ยังไม่มีข้อมูลพนักงานที่เคยบันทึกไว้ในเครื่องนี้ (กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าใช้งานครั้งแรก)'
        };
    }

    const inputHash = await hashPin(cleanPin);
    const matched = staffRecords.find(record => record.pin_hash === inputHash);

    if (matched) {
        return {
            success: true,
            staff: {
                id: matched.id,
                display_name: matched.display_name,
                role: matched.role
            }
        };
    }

    return {
        success: false,
        reason: 'INVALID_PIN',
        message: 'รหัส PIN ไม่ถูกต้อง (โหมดออฟไลน์)'
    };
}

/**
 * Get count of cached staff members with offline PIN access
 */
export function getOfflineStaffCount() {
    try {
        const store = getOfflineStaffAuth();
        return Object.keys(store).length;
    } catch {
        return 0;
    }
}

/**
 * Get safe list of cached staff (without PIN hashes)
 */
export function getOfflineStaffList() {
    try {
        const raw = localStorage.getItem(STORAGE_STAFF_CACHE);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        // Fallback from auth store
        const store = getOfflineStaffAuth();
        return Object.values(store).map(s => ({
            id: s.id,
            display_name: s.display_name,
            role: s.role
        }));
    } catch {
        return [];
    }
}

/**
 * Sync staff credentials from server when online.
 * Tries the `get_staff_offline_pin_hashes` RPC if deployed.
 * If not deployed, safely falls back without error.
 */
export async function syncStaffCredentialsOnline() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabase.rpc('get_staff_offline_pin_hashes');
        if (!error && Array.isArray(data) && data.length > 0) {
            saveBulkOfflineStaffCredentials(data);
            console.log(`[StaffAuth] Synced ${data.length} staff credentials for offline access.`);
        }
    } catch (err) {
        // RPC might not exist or network timed out; silent fallback to opportunistic caching
        console.log('[StaffAuth] Background sync of offline PIN hashes skipped:', err?.message || err);
    }
}
