import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

const OFFLINE_QUEUE_KEY = 'pos_offline_queue';
const CACHE_MENU_ITEMS = 'pos_cache_menu_items';
const CACHE_MENU_CATS = 'pos_cache_menu_categories';
const CACHE_TABLES = 'pos_cache_tables_layout';
const CACHE_BOOKINGS = 'pos_cache_active_bookings';

const CACHE_PROFILES = 'pos_cache_customer_profiles';

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
    try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('offline-queue-changed'));
        }
    } catch (e) {
        console.error('[Offline Storage Error] Failed to save offline queue:', e);
        // Quota safety: if localStorage is full, attempt to save last 50 actions
        if (Array.isArray(queue) && queue.length > 50) {
            try {
                localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('offline-queue-changed'));
                }
            } catch (retryErr) {
                console.error('[Offline Storage Error] Hard failure saving pruned queue:', retryErr);
            }
        }
    }
}

export function addToOfflineQueue(actionType, payload) {
    const queue = getOfflineQueue();
    const newAction = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (err) {
            console.warn(`[Offline Cache] Quota or storage write error for key ${key}:`, err);
        }
    }
}

export function getCachedData(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (err) {
        console.warn(`[Offline Cache] Error parsing key ${key}:`, err);
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
    setBookings: (data) => cacheData(CACHE_BOOKINGS, data),

    getProfiles: () => getCachedData(CACHE_PROFILES) || [],
    setProfiles: (data) => cacheData(CACHE_PROFILES, data)
};

// 3. Sync offline queue to Supabase
let isSyncing = false;

export async function verifyConnection() {
    try {
        const { error } = await supabase.from('tables_layout').select('id', { count: 'exact', head: true }).limit(1);
        return !error;
    } catch {
        return false;
    }
}

export async function syncOfflineQueue(isManual = false) {
    if (isSyncing) return;
    if (!isOnline()) return;
    
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    
    isSyncing = true;

    // Verify actual server connectivity before triggering toasts or sync queries
    const connected = await verifyConnection();
    if (!connected) {
        console.log('[Offline Sync] Supabase server is unreachable. Postponing sync.');
        isSyncing = false;
        return;
    }
    
    console.log(`[Offline Sync] Starting sync for ${queue.length} actions...`);
    if (isManual) {
        toast.info(`🔄 ตรวจพบข้อมูลค้างในเครื่อง ${queue.length} รายการ กำลังเชื่อมโยงข้อมูลกับเซิร์ฟเวอร์...`);
    }

    let idMapping = {}; // Maps local temp IDs to database real IDs
    try {
        idMapping = JSON.parse(localStorage.getItem('pos_offline_id_mapping')) || {};
    } catch (e) {}
    
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
                try { localStorage.setItem('pos_offline_id_mapping', JSON.stringify(idMapping)); } catch(e) {}
                console.log(`[Offline Sync] Mapped booking local ID ${tempBookingId} -> remote ID ${data.id}`);
                
                // Replace in posCache
                const bookings = posCache.getBookings();
                const idx = bookings.findIndex(b => b.id === tempBookingId);
                if (idx !== -1) {
                    bookings[idx] = { ...bookings[idx], ...data };
                    posCache.setBookings(bookings);
                }
            }

            else if (action.type === 'create_pickup') {
                const { tempBookingId, customerNote, status, bookingTime } = action.payload;

                const { data, error } = await supabase
                    .from('bookings')
                    .insert({
                        table_id: null,
                        status: status || 'pending',
                        booking_type: 'pickup',
                        booking_time: bookingTime || new Date().toISOString(),
                        pax: 1,
                        customer_note: customerNote,
                        pickup_contact_name: customerNote,
                        staff_remark: 'Walk-in Pick-up (Offline Sync)'
                    })
                    .select()
                    .single();

                if (error) throw error;

                idMapping[tempBookingId] = data.id;
                try { localStorage.setItem('pos_offline_id_mapping', JSON.stringify(idMapping)); } catch(e) {}
                console.log(`[Offline Sync] Mapped pickup local ID ${tempBookingId} -> remote ID ${data.id}`);
                
                // Replace in posCache
                const bookings = posCache.getBookings();
                const idx = bookings.findIndex(b => b.id === tempBookingId);
                if (idx !== -1) {
                    bookings[idx] = { ...bookings[idx], ...data };
                    posCache.setBookings(bookings);
                }
            }

            else if (action.type === 'update_pax') {
                let { bookingId, pax } = action.payload;
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }
                const { error } = await supabase
                    .from('bookings')
                    .update({ pax })
                    .eq('id', bookingId);
                if (error) throw error;
            }

            else if (action.type === 'attach_customer') {
                let { bookingId, userId } = action.payload;
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }
                const { error } = await supabase
                    .from('bookings')
                    .update({ user_id: userId })
                    .eq('id', bookingId);
                if (error) throw error;
            }
            
            else if (action.type === 'submit_items') {
                let { bookingId, items } = action.payload;
                
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }

                const resolveMenuItemId = (item) => {
                    if (item.menu_item_id && typeof item.menu_item_id !== 'string') return item.menu_item_id;
                    if (item.menu_item_id && typeof item.menu_item_id === 'string' && !item.menu_item_id.startsWith('reward-') && !item.menu_item_id.startsWith('local_')) return item.menu_item_id;
                    if (item.id && typeof item.id !== 'string') return item.id;
                    if (item.id && typeof item.id === 'string' && !item.id.startsWith('reward-') && !item.id.startsWith('local_')) return item.id;
                    return item.menu_item_id || item.id;
                };

                const itemsToInsert = items.map(item => {
                    const finalOpts = [...(item.selected_options || [])];
                    if (item.item_note) {
                        finalOpts.push({ name: `Note: ${item.item_note}` });
                    }
                    return {
                        booking_id: bookingId,
                        menu_item_id: resolveMenuItemId(item),
                        quantity: item.quantity,
                        price_at_time: item.price,
                        selected_options: finalOpts
                    };
                });

                const { error } = await supabase.from('order_items').insert(itemsToInsert);
                if (error) throw error;
            } 
            
            else if (action.type === 'complete_checkout') {
                let { bookingId, totalAmount, paymentMethod, rewardCode, rewardId, discountAmount, xhausEarned, xhausRedeemed, xhausDiscount, profileId } = action.payload;
                
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }

                const updatePayload = {
                    status: 'completed',
                    total_amount: totalAmount,
                    discount_amount: discountAmount || 0,
                    xhaus_earned: xhausEarned || 0,
                    xhaus_redeemed: xhausRedeemed || 0,
                    xhaus_discount: xhausDiscount || 0,
                    staff_remark: rewardCode 
                        ? `Paid by ${paymentMethod.toUpperCase()} | Reward: ${rewardCode} (Offline Sync)`
                        : `Paid by ${paymentMethod.toUpperCase()} (Offline Sync)`
                };
                if (rewardId) {
                    updatePayload.xhaus_reward_id = rewardId;
                }
                if (profileId) {
                    updatePayload.user_id = profileId;
                }

                const { error } = await supabase
                    .from('bookings')
                    .update(updatePayload)
                    .eq('id', bookingId);
                
                if (error) throw error;

                if (rewardId) {
                    try {
                        const { data: rw } = await supabase
                            .from('xhaus_rewards')
                            .select('used_count')
                            .eq('id', rewardId)
                            .maybeSingle();
                        if (rw) {
                            await supabase
                                .from('xhaus_rewards')
                                .update({ used_count: (rw.used_count || 0) + 1 })
                                .eq('id', rewardId);
                        }
                    } catch (e) {}
                }

                // Sync xhaus points if redeemed/earned
                if (xhausEarned || xhausRedeemed) {
                    try {
                        const { error: rpcErr } = await supabase.rpc('process_checkout_xhaus', {
                            p_booking_id: bookingId,
                            p_xhaus_earned: xhausEarned || 0,
                            p_xhaus_redeemed: xhausRedeemed || 0,
                            p_xhaus_discount: xhausDiscount || 0
                        });
                        if (rpcErr) throw rpcErr;
                    } catch (err) {
                        console.warn('Failed RPC process_checkout_xhaus during sync, falling back to JS update:', err);
                        if (profileId) {
                            try {
                                const { data: pData } = await supabase.from('profiles')
                                    .select('xhaus_balance, total_earned_xhaus, total_redeemed_xhaus')
                                    .eq('id', profileId).single();
                                if (pData) {
                                    await supabase.from('profiles').update({
                                        xhaus_balance: (parseFloat(pData.xhaus_balance) || 0) + (xhausEarned || 0) - (xhausRedeemed || 0),
                                        total_earned_xhaus: (parseFloat(pData.total_earned_xhaus) || 0) + (xhausEarned || 0),
                                        total_redeemed_xhaus: (parseFloat(pData.total_redeemed_xhaus) || 0) + (xhausRedeemed || 0)
                                    }).eq('id', profileId);
                                }
                            } catch (e) {
                                console.error('JS fallback xhaus update also failed during sync:', e);
                            }
                        }
                    }
                }
            }

            // BUG #4 FIX: Sync drink stamp updates queued from offline checkout
            else if (action.type === 'drink_stamp_update') {
                const { profileId, eligibleDrinkCount, useFreeDrinkQuota } = action.payload;
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('drink_stamp_count, free_drink_quota, total_drinks_purchased')
                        .eq('id', profileId)
                        .maybeSingle();

                    if (profile) {
                        const currentStamps = profile.drink_stamp_count || 0;
                        const currentQuota = profile.free_drink_quota || 0;
                        const currentTotal = profile.total_drinks_purchased || 0;

                        const totalStamps = currentStamps + eligibleDrinkCount;
                        const earnedNewQuota = Math.floor(totalStamps / 10);
                        const newStampCount = totalStamps % 10;
                        const newQuota = Math.max(0, currentQuota - (useFreeDrinkQuota ? 1 : 0) + earnedNewQuota);
                        const newTotalPurchased = currentTotal + eligibleDrinkCount;

                        await supabase
                            .from('profiles')
                            .update({
                                drink_stamp_count: newStampCount,
                                free_drink_quota: newQuota,
                                total_drinks_purchased: newTotalPurchased
                            })
                            .eq('id', profileId);
                    }
                } catch (err) {
                    console.warn('Failed to sync drink stamp update:', err);
                    throw err; // throw to let offline queue retry later
                }
            }

            else if (action.type === 'split_payment') {
                let { bookingId, tempSplitId, paidItems, paymentMethod, totalAmount, bookingMetadata } = action.payload;
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }

                // 1. Create a new completed booking for the split
                const splitBookingPayload = {
                    table_id: bookingMetadata?.table_id || null,
                    status: 'completed',
                    booking_type: bookingMetadata?.booking_type || 'walk_in',
                    source: bookingMetadata?.source || 'pos',
                    booking_time: new Date().toISOString(),
                    pax: bookingMetadata?.pax || 0,
                    user_id: bookingMetadata?.user_id || null,
                    staff_remark: `Split Paid by ${paymentMethod.toUpperCase()}`,
                    total_amount: totalAmount,
                    discount_amount: 0,
                    tracking_token: crypto.randomUUID()
                };

                const { data: newSplitBooking, error: insertError } = await supabase
                    .from('bookings')
                    .insert(splitBookingPayload)
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                const newSplitBookingId = newSplitBooking.id;

                if (tempSplitId) {
                    idMapping[tempSplitId] = newSplitBookingId;
                    try { localStorage.setItem('pos_offline_id_mapping', JSON.stringify(idMapping)); } catch(e) {}
                }

                // 2. Insert paid items to the new split booking
                const splitOrderItemsToInsert = paidItems.map(item => ({
                    booking_id: newSplitBookingId,
                    menu_item_id: item.menu_item_id,
                    quantity: item.quantity,
                    price_at_time: item.price_at_time || 0,
                    selected_options: item.selected_options || []
                }));

                const { error: insertItemsError } = await supabase
                    .from('order_items')
                    .insert(splitOrderItemsToInsert);

                if (insertItemsError) throw insertItemsError;

                // 3. Deduct/Delete from original booking
                for (const item of paidItems) {
                    if (item.menu_item_id) {
                        const { data: dbItem } = await supabase
                            .from('order_items')
                            .select('*')
                            .eq('booking_id', bookingId)
                            .eq('menu_item_id', item.menu_item_id)
                            .limit(1)
                            .maybeSingle();

                        if (dbItem) {
                            if (dbItem.quantity <= item.quantity) {
                                await supabase.from('order_items').delete().eq('id', dbItem.id);
                            } else {
                                await supabase.from('order_items').update({ quantity: dbItem.quantity - item.quantity }).eq('id', dbItem.id);
                            }
                        }
                    }
                }
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

            else if (action.type === 'move_table') {
                let { bookingId, tableId } = action.payload;
                if (idMapping[bookingId]) {
                    bookingId = idMapping[bookingId];
                }
                if (typeof bookingId === 'string' && bookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local booking: ${bookingId}`);
                }
                const { error } = await supabase
                    .from('bookings')
                    .update({ table_id: tableId })
                    .eq('id', bookingId);
                if (error) throw error;
            }
            
            else if (action.type === 'merge_bills') {
                let { sourceBookingId, targetBookingId } = action.payload;
                if (idMapping[sourceBookingId]) {
                    sourceBookingId = idMapping[sourceBookingId];
                }
                if (idMapping[targetBookingId]) {
                    targetBookingId = idMapping[targetBookingId];
                }
                if (typeof sourceBookingId === 'string' && sourceBookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local source booking: ${sourceBookingId}`);
                }
                if (typeof targetBookingId === 'string' && targetBookingId.startsWith('local_')) {
                    throw new Error(`Cannot find database ID mapping for local target booking: ${targetBookingId}`);
                }
                
                // Move items
                const { error: itemsErr } = await supabase
                    .from('order_items')
                    .update({ booking_id: targetBookingId })
                    .eq('booking_id', sourceBookingId);
                if (itemsErr) throw itemsErr;
                
                // Void source booking
                const { error: voidErr } = await supabase
                    .from('bookings')
                    .update({ status: 'void', staff_remark: 'Merged offline' })
                    .eq('id', sourceBookingId);
                if (voidErr) throw voidErr;
            }
            
        } catch (err) {
            console.error(`[Offline Sync] Failed to sync action (${action.type}):`, action, err);
            
            const isNetworkErr = !isOnline() || 
                (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('network')));
            
            if (isNetworkErr) {
                console.warn('[Offline Sync] Connection lost mid-sync. Aborting sync loop and preserving remaining queue items.');
                toast.warning('⚠️ การเชื่อมต่อสัญญาณหลุดขณะ Sync ข้อมูล ถูกบันทึกไว้ในเครื่องรอเชื่อมต่ออีกครั้ง');
                // Push current action and all un-processed actions back to remainingQueue
                remainingQueue.push(action);
                const currentIdx = queue.indexOf(action);
                if (currentIdx !== -1 && currentIdx < queue.length - 1) {
                    remainingQueue.push(...queue.slice(currentIdx + 1));
                }
                break;
            }

            toast.error(`Sync error (${action.type}): ${err.message || JSON.stringify(err)}`);
            action.retryCount = (action.retryCount || 0) + 1;
            if (action.retryCount < 5) {
                remainingQueue.push(action);
            } else {
                console.warn(`[Offline Sync] Discarding unrecoverable offline action (${action.type}) after 5 retries:`, action);
                toast.error(`Discarded sync action: ${action.type} after 5 retries.`);
            }
        }
    }

    saveOfflineQueue(remainingQueue);
    isSyncing = false;
    
    if (isManual) {
        if (remainingQueue.length === 0) {
            toast.success(`✅ เชื่อมโยงข้อมูลออฟไลน์เรียบร้อยแล้ว!`);
        } else {
            toast.error(`⚠️ การเชื่อมต่อไม่สมบูรณ์: เหลือ ${remainingQueue.length} รายการที่กำลังลองใหม่`);
        }
    }
    
    window.dispatchEvent(new Event('offline-queue-changed'));
}

// 4. Register online listener
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Network] Internet restored. Syncing queue...');
        syncOfflineQueue();
    });

    // Background interval check to auto-sync offline queue when internet connection drops/restores silently
    setInterval(() => {
        const queue = getOfflineQueue();
        if (queue.length > 0 && navigator.onLine) {
            console.log('[Network] Background polling: offline queue has items. Syncing...');
            syncOfflineQueue();
        }
    }, 15000);
}
