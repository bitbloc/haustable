import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

const OFFLINE_QUEUE_KEY = 'pos_offline_queue';
const CACHE_MENU_ITEMS = 'pos_cache_menu_items';
const CACHE_MENU_CATS = 'pos_cache_menu_categories';
const CACHE_TABLES = 'pos_cache_tables_layout';
const CACHE_BOOKINGS = 'pos_cache_active_bookings';

// Helper to check if network is available
export function isOnline() {
    return navigator.onLine;
}

// 1. Get/Set offline queue
export function getOfflineQueue() {
    try {
        return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    } catch {
        return [];
    }
}

export function saveOfflineQueue(queue) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function addToOfflineQueue(actionType, payload) {
    const queue = getOfflineQueue();
    const newAction = {
        id: crypto.randomUUID(),
        type: actionType,
        payload,
        timestamp: new Date().toISOString()
    };
    queue.push(newAction);
    saveOfflineQueue(queue);
    console.log(`[Offline Queue] Added action: ${actionType}`, newAction);
    
    // Broadcast status to UI
    window.dispatchEvent(new Event('offline-queue-changed'));
}

// 2. Cache Helpers
export function cacheData(key, data) {
    if (data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
}

export function getCachedData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
        return null;
    }
}

// Specialized caches
export const posCache = {
    getMenuItems: () => getCachedData(CACHE_MENU_ITEMS) || [],
    setMenuItems: (data) => cacheData(CACHE_MENU_ITEMS, data),
    
    getCategories: () => getCachedData(CACHE_MENU_CATS) || [],
    setCategories: (data) => cacheData(CACHE_MENU_CATS, data),
    
    getTables: () => getCachedData(CACHE_TABLES) || [],
    setTables: (data) => cacheData(CACHE_TABLES, data),
    
    getBookings: () => getCachedData(CACHE_BOOKINGS) || [],
    setBookings: (data) => cacheData(CACHE_BOOKINGS, data)
};

// 3. Sync offline queue to Supabase
let isSyncing = false;

export async function syncOfflineQueue() {
    if (isSyncing) return;
    if (!isOnline()) return;
    
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    
    isSyncing = true;
    console.log(`[Offline Sync] Starting sync for ${queue.length} actions...`);
    toast.info(`🔄 ตรวจพบข้อมูลค้างในเครื่อง ${queue.length} รายการ กำลังเชื่อมโยงข้อมูลกับเซิร์ฟเวอร์...`);

    const idMapping = {}; // Maps local temp IDs to database real IDs
    const remainingQueue = [];

    for (const action of queue) {
        try {
            console.log(`[Offline Sync] Processing: ${action.type}`, action.payload);
            
            if (action.type === 'create_walkin') {
                const { tableId, tempBookingId, pax, status, bookingTime, staffRemark } = action.payload;
                
                const { data, error } = await supabase
                    .from('bookings')
                    .insert({
                        table_id: tableId,
                        status: status || 'seated',
                        booking_type: 'walk_in',
                        booking_time: bookingTime || new Date().toISOString(),
                        pax: pax || 2,
                        staff_remark: staffRemark || 'Offline Walk-in'
                    })
                    .select()
                    .single();
                
                if (error) throw error;
                
                // Save mapping
                idMapping[tempBookingId] = data.id;
                console.log(`[Offline Sync] Mapped booking local ID ${tempBookingId} -> remote ID ${data.id}`);
            } 
            
            else if (action.type === 'submit_items') {
                let { bookingId, items } = action.payload;
                
                // If this references a local booking ID created earlier in the queue, swap it
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                
                // Make sure bookingId is a valid number, if it's still a local string ID skip/throw
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }

                const itemsToInsert = items.map(item => ({
                    booking_id: bookingId,
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    price_at_time: item.price,
                    selected_options: item.selected_options || []
                }));

                const { error } = await supabase.from('order_items').insert(itemsToInsert);
                if (error) throw error;
            } 
            
            else if (action.type === 'complete_checkout') {
                let { bookingId, totalAmount, paymentMethod } = action.payload;
                
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }

                const { error } = await supabase
                    .from('bookings')
                    .update({
                        status: 'completed',
                        total_amount: totalAmount,
                        staff_remark: `Paid by ${paymentMethod.toUpperCase()} (Offline Sync)`
                    })
                    .eq('id', bookingId);
                
                if (error) throw error;
            }
            
            else if (action.type === 'call_staff') {
                let { bookingId, staffRemark } = action.payload;
                
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }

                const { error } = await supabase
                    .from('bookings')
                    .update({ staff_remark: staffRemark })
                    .eq('id', bookingId);
                    
                if (error) throw error;
            }
            
        } catch (err) {
            console.error(`[Offline Sync] Failed to sync action:`, action, err);
            // Save failed action back to queue so we can retry later
            remainingQueue.push(action);
        }
    }

    saveOfflineQueue(remainingQueue);
    isSyncing = false;
    
    if (remainingQueue.length === 0) {
        toast.success(`✅ เชื่อมโยงข้อมูลออฟไลน์เรียบร้อยแล้ว!`);
    } else {
        toast.error(`⚠️ การเชื่อมต่อไม่สมบูรณ์: เหลือ ${remainingQueue.length} รายการที่กำลังลองใหม่`);
    }
    
    window.dispatchEvent(new Event('offline-queue-changed'));
}

// 4. Register online listener
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Network] Internet restored. Syncing queue...');
        syncOfflineQueue();
    });
}
