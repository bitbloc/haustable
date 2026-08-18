import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { isOnline, addToOfflineQueue, posCache, syncOfflineQueue, getOfflineQueue, saveOfflineQueue } from '../utils/offlineHelper';
import { recordShiftTransaction } from '../utils/shiftHelper';

export function usePOSOrder() {
    const [loading, setLoading] = useState(false);

    const getActiveBooking = useCallback(async (tableId) => {
        if (!isOnline()) {
            console.log('[Offline Mode] Fetching active booking from local cache for table:', tableId);
            const bookings = posCache.getBookings();
            const booking = bookings.find(b => b.table_id === tableId && b.status !== 'completed' && b.status !== 'void' && b.status !== 'cancelled' && b.status !== 'no_show');
            return booking || null;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name)))')
                .eq('table_id', tableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching active booking:', error);
            }

            if (data) {
                // Update local bookings cache
                const currentBookings = posCache.getBookings().filter(b => b.table_id !== tableId);
                currentBookings.push(data);
                posCache.setBookings(currentBookings);
            } else {
                // Table is free / booking closed or voided -> remove from posCache
                const currentBookings = posCache.getBookings().filter(b => b.table_id !== tableId);
                posCache.setBookings(currentBookings);
            }
            return data;
        } catch (err) {
            console.error('Network error fetching booking, fallback to cache:', err);
            const bookings = posCache.getBookings();
            return bookings.find(b => b.table_id === tableId && b.status !== 'completed' && b.status !== 'void' && b.status !== 'cancelled' && b.status !== 'no_show') || null;
        }
    }, []);

    const createWalkIn = async (table = null, customPax = null, userId = null) => {
        const tableId = table ? table.id : null;
        const capacity = customPax ? parseInt(customPax) : (table ? (table.capacity || 2) : 2);

        if (!isOnline()) {
            console.log('[Offline Mode] Creating offline walk-in session');
            const tempId = `local_${Date.now()}`;
            const mockBooking = {
                id: tempId,
                table_id: tableId,
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: new Date().toISOString(),
                pax: capacity,
                user_id: userId || null,
                staff_remark: 'Walk-in Guest (Offline)',
                tables_layout: table || null
            };

            // Save to active bookings cache
            const bookings = posCache.getBookings().filter(b => tableId ? b.table_id !== tableId : true);
            bookings.push(mockBooking);
            posCache.setBookings(bookings);

            // Queue sync action
            addToOfflineQueue('create_walkin', {
                tableId: tableId,
                tempBookingId: tempId,
                pax: mockBooking.pax,
                user_id: userId || null,
                status: 'seated',
                bookingTime: mockBooking.booking_time,
                staffRemark: mockBooking.staff_remark
            });

            toast.info('เปิดโต๊ะเรียบร้อยแล้ว (โหมดออฟไลน์)');
            return mockBooking;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    table_id: tableId,
                    status: 'seated',
                    booking_type: 'walk_in',
                    source: 'pos',
                    booking_time: new Date().toISOString(),
                    pax: capacity,
                    user_id: userId || null,
                    staff_remark: 'Walk-in Guest'
                })
                .select('*, tables_layout(*), profiles(*)')
                .single();

            if (error) throw error;
            
            // Cache locally
            const bookings = posCache.getBookings().filter(b => tableId ? b.table_id !== tableId : true);
            bookings.push(data);
            posCache.setBookings(bookings);

            return data;
        } catch (err) {
            console.error('Failed to create walk-in online, fallback to offline queue:', err);
            const tempId = `local_${Date.now()}`;
            const mockBooking = {
                id: tempId,
                table_id: tableId,
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: new Date().toISOString(),
                pax: capacity,
                staff_remark: 'Walk-in Guest (Offline Fallback)',
                tables_layout: table || null
            };

            const bookings = posCache.getBookings().filter(b => tableId ? b.table_id !== tableId : true);
            bookings.push(mockBooking);
            posCache.setBookings(bookings);

            addToOfflineQueue('create_walkin', {
                tableId: tableId,
                tempBookingId: tempId,
                pax: mockBooking.pax,
                status: 'seated',
                bookingTime: mockBooking.booking_time,
                staffRemark: mockBooking.staff_remark
            });

            toast.info('เปิดโต๊ะเรียบร้อยแล้ว (โหมดออฟไลน์)');
            return mockBooking;
        }
    };

    const updateGuestCount = async (bookingId, newPax) => {
        const paxNum = parseInt(newPax) || 1;
        if (!isOnline() || (typeof bookingId === 'string' && bookingId.startsWith('local_'))) {
            const bookings = posCache.getBookings();
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1) {
                bookings[idx].pax = paxNum;
                posCache.setBookings(bookings);
            }
            addToOfflineQueue('update_pax', { bookingId, pax: paxNum });
            toast.success(`อัปเดตจำนวนลูกค้าเป็น ${paxNum} คนเรียบร้อย (ออฟไลน์)`);
            return true;
        }

        try {
            const { error } = await supabase
                .from('bookings')
                .update({ pax: paxNum })
                .eq('id', bookingId);
                
            if (error) throw error;
            
            const bookings = posCache.getBookings();
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1) {
                bookings[idx].pax = paxNum;
                posCache.setBookings(bookings);
            }
            toast.success(`อัปเดตจำนวนลูกค้าเป็น ${paxNum} คนเรียบร้อย`);
            return true;
        } catch (err) {
            console.error('Failed to update pax online:', err);
            toast.error('ไม่สามารถอัปเดตจำนวนคนได้: ' + err.message);
            return false;
        }
    };

    const createWalkInPickup = async (note = 'Walk-in Pick-up', userId = null) => {
        if (!isOnline()) {
            console.log('[Offline Mode] Creating offline walk-in pickup');
            const tempId = `local_pickup_${Date.now()}`;
            const mockBooking = {
                id: tempId,
                table_id: null,
                status: 'seated',
                booking_type: 'pickup',
                booking_time: new Date().toISOString(),
                pax: 1,
                customer_note: note,
                pickup_contact_name: note,
                staff_remark: 'Walk-in Pick-up (Offline)',
                user_id: userId || null
            };

            const bookings = posCache.getBookings();
            bookings.push(mockBooking);
            posCache.setBookings(bookings);

            addToOfflineQueue('create_pickup', {
                tempBookingId: tempId,
                customerNote: note,
                status: 'seated',
                bookingTime: mockBooking.booking_time,
                userId: userId || null
            });

            toast.warning('⚠️ ออฟไลน์: เปิดบิลรับกลับบ้านในเครื่องแล้ว');
            return mockBooking;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    table_id: null,
                    status: 'seated',
                    booking_type: 'pickup',
                    booking_time: new Date().toISOString(),
                    pax: 1,
                    customer_note: note,
                    pickup_contact_name: note,
                    staff_remark: 'Walk-in Pick-up',
                    user_id: userId || null
                })
                .select('*, profiles(*)')
                .single();

            if (error) throw error;
            
            const bookings = posCache.getBookings();
            bookings.push(data);
            posCache.setBookings(bookings);

            return data;
        } catch (err) {
            console.error('Failed to create walk-in pickup online, falling back to offline queue:', err);
            const tempId = `local_pickup_${Date.now()}`;
            const mockBooking = {
                id: tempId,
                table_id: null,
                status: 'seated',
                booking_type: 'pickup',
                booking_time: new Date().toISOString(),
                pax: 1,
                customer_note: note,
                pickup_contact_name: note,
                staff_remark: 'Walk-in Pick-up (Offline Fallback)'
            };

            const bookings = posCache.getBookings();
            bookings.push(mockBooking);
            posCache.setBookings(bookings);

            addToOfflineQueue('create_pickup', {
                tempBookingId: tempId,
                customerNote: note,
                status: 'seated',
                bookingTime: mockBooking.booking_time
            });

            toast.warning('⚠️ บันทึกการเปิดบิลรับกลับบ้านเข้าคิวออฟไลน์');
            return mockBooking;
        }
    };

    const submitOrderItems = async (bookingId, items) => {
        if (!items || items.length === 0) return true;

        // If booking is a local temporary booking but network is available, attempt to sync booking online first
        if (typeof bookingId === 'string' && bookingId.startsWith('local_') && isOnline()) {
            try {
                const bookings = posCache.getBookings();
                const localBooking = bookings.find(b => b.id === bookingId);
                if (localBooking) {
                    const { data: newBooking, error: createErr } = await supabase
                        .from('bookings')
                        .insert({
                            table_id: localBooking.table_id || null,
                            status: localBooking.status || 'seated',
                            booking_type: localBooking.booking_type || 'walk_in',
                            source: 'pos',
                            booking_time: localBooking.booking_time || new Date().toISOString(),
                            pax: localBooking.pax || 2,
                            user_id: localBooking.user_id || null,
                            staff_remark: localBooking.staff_remark || 'Walk-in Guest'
                        })
                        .select('*, tables_layout(*)')
                        .single();
                        
                    if (!createErr && newBooking) {
                        // Record local temp ID mapping so offline queue actions (like attach_customer) can map smoothly
                        try {
                            const idMapping = JSON.parse(localStorage.getItem('pos_offline_id_mapping')) || {};
                            idMapping[bookingId] = newBooking.id;
                            localStorage.setItem('pos_offline_id_mapping', JSON.stringify(idMapping));
                        } catch (mapErr) {}

                        // Replace the local booking in posCache with the new online booking
                        const idx = bookings.findIndex(b => b.id === bookingId);
                        if (idx !== -1) {
                            bookings[idx] = newBooking;
                            posCache.setBookings(bookings);
                        } else {
                            bookings.push(newBooking);
                            posCache.setBookings(bookings);
                        }
                        
                        const queue = getOfflineQueue();
                        const newQueue = queue.filter(q => 
                            !((q.type === 'create_walkin' || q.type === 'create_pickup') && q.payload.tempBookingId === bookingId)
                        );
                        if (queue.length !== newQueue.length) {
                            saveOfflineQueue(newQueue);
                        }

                        bookingId = newBooking.id;
                    }
                }
            } catch (syncErr) {
                console.warn("[submitOrderItems] Could not auto-sync local booking before inserting items:", syncErr);
            }
        }

        if (!isOnline() || (typeof bookingId === 'string' && bookingId.startsWith('local_'))) {
            console.log('[Offline Mode] Submitting items to offline queue');
            // Save order items inside booking cache for local UI consistency
            const resolveMenuItemId = (item) => {
                if (item.menu_item_id && typeof item.menu_item_id !== 'string') return item.menu_item_id;
                if (item.menu_item_id && typeof item.menu_item_id === 'string' && !item.menu_item_id.startsWith('reward-') && !item.menu_item_id.startsWith('local_') && !item.menu_item_id.startsWith('custom_')) return item.menu_item_id;
                if (item.id && typeof item.id !== 'string') return item.id;
                if (item.id && typeof item.id === 'string' && !item.id.startsWith('reward-') && !item.id.startsWith('local_') && !item.id.startsWith('custom_')) return item.id;
                return null;
            };

            const newOrderItems = items.map((item, i) => {
                const finalOpts = [...(item.selected_options || [])];
                if (item.item_note) {
                    finalOpts.push({ name: `Note: ${item.item_note}` });
                }
                const resolvedName = item.custom_name || item.name || 'เมนูเพิ่มเติม';
                const isCustom = item.is_custom || item.is_emergency || !resolveMenuItemId(item) || String(item.id).startsWith('custom_');
                const resolvedDest = item.destination 
                    || (item.selected_options?.find(o => o.destination)?.destination)
                    || (item.selected_options?.some(o => (typeof o === 'string' ? o : o.name || '').includes('บาร์')) ? 'bar' : (item.category_id === '7524bb8a-4698-45c6-aa17-d8ccc296f667' ? 'bar' : 'kitchen'));
                return {
                    id: `local_item_${Date.now()}_${i}`,
                    booking_id: bookingId,
                    menu_item_id: resolveMenuItemId(item),
                    quantity: item.quantity,
                    price_at_time: item.price,
                    selected_options: finalOpts,
                    name: resolvedName,
                    custom_name: isCustom ? resolvedName : null,
                    is_custom: isCustom,
                    destination: resolvedDest,
                    category_id: item.category_id || '',
                    category_name: item.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร'),
                    item_note: item.item_note || '',
                    menu_items: { 
                        name: resolvedName,
                        category_id: item.category_id || '',
                        menu_categories: { name: item.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร') }
                    }
                };
            });

            const bookings = posCache.getBookings();
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1) {
                const existingOrderItems = bookings[idx].order_items || [];
                bookings[idx].order_items = [...existingOrderItems, ...newOrderItems];
                posCache.setBookings(bookings);
            }

            addToOfflineQueue('submit_items', { bookingId, items });
            toast.info('บันทึกรายการอาหารเข้าคิวเรียบร้อยแล้ว (โหมดออฟไลน์)');
            return { bookingId, insertedItems: newOrderItems };
        }

        try {
            const resolveMenuItemId = (item) => {
                if (item.menu_item_id && typeof item.menu_item_id !== 'string') return item.menu_item_id;
                if (item.menu_item_id && typeof item.menu_item_id === 'string' && !item.menu_item_id.startsWith('reward-') && !item.menu_item_id.startsWith('local_') && !item.menu_item_id.startsWith('custom_')) return item.menu_item_id;
                if (item.id && typeof item.id !== 'string') return item.id;
                if (item.id && typeof item.id === 'string' && !item.id.startsWith('reward-') && !item.id.startsWith('local_') && !item.id.startsWith('custom_')) return item.id;
                return null;
            };

            const itemsToInsert = items.map(item => {
                const finalOpts = [...(item.selected_options || [])];
                if (item.item_note) {
                    finalOpts.push({ name: `Note: ${item.item_note}` });
                }
                const customName = item.custom_name || item.name || null;
                const isCustom = item.is_custom || item.is_emergency || !resolveMenuItemId(item) || String(item.id).startsWith('custom_');
                const resolvedDest = item.destination 
                    || (item.selected_options?.find(o => o.destination)?.destination)
                    || (item.selected_options?.some(o => (typeof o === 'string' ? o : o.name || '').includes('บาร์')) ? 'bar' : (item.category_id === '7524bb8a-4698-45c6-aa17-d8ccc296f667' ? 'bar' : 'kitchen'));
                return {
                    booking_id: bookingId,
                    menu_item_id: resolveMenuItemId(item),
                    quantity: item.quantity,
                    price_at_time: item.price,
                    selected_options: finalOpts,
                    custom_name: isCustom ? customName : null,
                    is_custom: isCustom,
                    destination: resolvedDest
                };
            });

            const { data: insertedData, error } = await supabase
                .from('order_items')
                .insert(itemsToInsert)
                .select('*, menu_items(name, category_id, menu_categories(name))');
            if (error) throw error;

            const enrichedInserted = (insertedData || []).map((row, index) => {
                const sourceItem = items[index] || {};
                const resolvedDest = row.destination 
                    || sourceItem.destination 
                    || (sourceItem.selected_options?.find(o => o.destination)?.destination) 
                    || (row.selected_options?.find(o => o.destination)?.destination) 
                    || (sourceItem.category_id === '7524bb8a-4698-45c6-aa17-d8ccc296f667' ? 'bar' : 'kitchen');
                const menuItemsObj = row.menu_items || {
                    name: row.custom_name || sourceItem.name || 'เมนูเพิ่มเติม',
                    category_id: sourceItem.category_id || '',
                    menu_categories: { name: sourceItem.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร') }
                };
                const finalName = row.custom_name || row.name || menuItemsObj.name || sourceItem.name || 'เมนูเพิ่มเติม';
                return {
                    ...row,
                    name: finalName,
                    custom_name: row.custom_name || finalName,
                    category_id: row.category_id || menuItemsObj.category_id || sourceItem.category_id || '',
                    category_name: row.category_name || menuItemsObj.menu_categories?.name || sourceItem.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร'),
                    menu_items: menuItemsObj,
                    selected_options: row.selected_options || sourceItem.selected_options || [],
                    item_note: sourceItem.item_note || '',
                    destination: resolvedDest,
                    is_custom: row.is_custom || sourceItem.is_custom || false
                };
            });

            return { bookingId, insertedItems: enrichedInserted };
        } catch (err) {
            console.error('Failed to submit items online, fallback to offline queue:', err);
            
            const newOrderItems = items.map((item, i) => {
                const finalOpts = [...(item.selected_options || [])];
                if (item.item_note) {
                    finalOpts.push({ name: `Note: ${item.item_note}` });
                }
                const resolvedName = item.custom_name || item.name || 'เมนูเพิ่มเติม';
                const isCustom = item.is_custom || item.is_emergency || !item.menu_item_id || String(item.id).startsWith('custom_');
                return {
                    id: `local_item_${Date.now()}_${i}`,
                    booking_id: bookingId,
                    menu_item_id: item.id || item.menu_item_id,
                    quantity: item.quantity,
                    price_at_time: item.price,
                    selected_options: finalOpts,
                    name: resolvedName,
                    custom_name: isCustom ? resolvedName : null,
                    is_custom: isCustom,
                    destination: item.destination || 'kitchen',
                    category_id: item.category_id || '',
                    category_name: item.category_name || '',
                    item_note: item.item_note || '',
                    menu_items: { 
                        name: resolvedName, 
                        category_id: item.category_id || '',
                        menu_categories: { name: item.category_name || (item.destination === 'bar' ? 'เครื่องดื่ม' : 'อาหาร') }
                    }
                };
            });

            // Local cache update
            const bookings = posCache.getBookings();
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1) {
                const existingOrderItems = bookings[idx].order_items || [];
                bookings[idx].order_items = [...existingOrderItems, ...newOrderItems];
                posCache.setBookings(bookings);
            }

            addToOfflineQueue('submit_items', { bookingId, items });
            toast.info('บันทึกรายการอาหารเข้าคิวเรียบร้อยแล้ว (โหมดออฟไลน์)');
            return { bookingId, insertedItems: newOrderItems };
        }
    };

    const completeCheckout = async (
        bookingId, 
        totalAmount, 
        paymentMethod = 'cash', 
        discountAmount = 0,
        xhausEarned = 0,
        xhausRedeemed = 0,
        xhausDiscount = 0,
        rewardCode = null,
        rewardId = null,
        profileId = null
    ) => {
        setLoading(true);
        
        if (!isOnline() || (typeof bookingId === 'string' && bookingId.startsWith('local_'))) {
            console.log('[Offline Mode] Checking out table offline');
            const bookings = posCache.getBookings();
            const updatedBookings = bookings.map(b => {
                if (b.id === bookingId) {
                    return { 
                        ...b, 
                        status: 'completed', 
                        total_amount: totalAmount, 
                        discount_amount: discountAmount, 
                        xhaus_earned: xhausEarned,
                        xhaus_redeemed: xhausRedeemed,
                        xhaus_discount: xhausDiscount,
                        xhaus_reward_id: rewardId,
                        user_id: profileId || b.user_id,
                        staff_remark: rewardCode 
                            ? `Paid by ${paymentMethod.toUpperCase()} | Reward: ${rewardCode}`
                            : `Paid by ${paymentMethod.toUpperCase()}` 
                    };
                }
                return b;
            });
            posCache.setBookings(updatedBookings);

            addToOfflineQueue('complete_checkout', { 
                bookingId, 
                totalAmount, 
                paymentMethod, 
                discountAmount, 
                xhausEarned, 
                xhausRedeemed, 
                xhausDiscount,
                rewardCode,
                rewardId,
                profileId
            });
            recordShiftTransaction(bookingId, totalAmount, paymentMethod);
            
            setLoading(false);
            toast.success('✅ เช็คบิลเรียบร้อยแล้ว (บันทึกออฟไลน์ในเครื่อง)');
            return true;
        }

        try {
            // 1. Complete booking status
            const remarkText = rewardCode 
                ? `Paid by ${paymentMethod.toUpperCase()} | Reward: ${rewardCode}`
                : `Paid by ${paymentMethod.toUpperCase()}`;

            const updatePayload = {
                status: 'completed',
                total_amount: totalAmount,
                discount_amount: discountAmount,
                staff_remark: remarkText,
                xhaus_earned: parseFloat(xhausEarned) || 0,
                xhaus_redeemed: parseFloat(xhausRedeemed) || 0,
                xhaus_discount: parseFloat(xhausDiscount) || 0
            };
            if (rewardId) {
                updatePayload.xhaus_reward_id = rewardId;
            }
            if (profileId) {
                updatePayload.user_id = profileId;
            }

            const { error: bookingErr } = await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('id', bookingId);

            if (bookingErr) throw bookingErr;

            // 1.5 Increment reward used_count quota if rewardId is present
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
                } catch (rwErr) {
                    console.warn('Failed to increment reward used_count:', rwErr);
                }
            }

            // 2. Process xhaus transaction in database (updates profile points & booking xhaus columns)
            const earned = parseFloat(xhausEarned) || 0;
            const redeemed = parseFloat(xhausRedeemed) || 0;

            if (earned > 0 || redeemed > 0 || profileId) {
                let rpcSucceeded = false;
                try {
                    const { error: rpcErr } = await supabase.rpc('process_checkout_xhaus', {
                        p_booking_id: bookingId,
                        p_xhaus_earned: earned,
                        p_xhaus_redeemed: redeemed,
                        p_xhaus_discount: parseFloat(xhausDiscount) || 0,
                        p_user_id: profileId || null
                    });
                    if (!rpcErr) rpcSucceeded = true;
                    else console.warn('process_checkout_xhaus RPC returned error:', rpcErr);
                } catch (rpcEx) {
                    console.warn('process_checkout_xhaus RPC call exception:', rpcEx);
                }

                // JS fallback profile update if RPC failed
                const targetProfileId = profileId;
                if (!rpcSucceeded && targetProfileId) {
                    try {
                        const { data: pData } = await supabase.from('profiles')
                            .select('xhaus_balance, total_earned_xhaus, total_redeemed_xhaus')
                            .eq('id', targetProfileId).maybeSingle();
                        if (pData) {
                            const currentBal = parseFloat(pData.xhaus_balance) || 0;
                            const newBalance = Math.max(0, currentBal + earned - redeemed);
                            const newEarned = (parseFloat(pData.total_earned_xhaus) || 0) + earned;
                            const newRedeemed = (parseFloat(pData.total_redeemed_xhaus) || 0) + redeemed;

                            await supabase.from('profiles').update({
                                xhaus_balance: newBalance,
                                total_earned_xhaus: newEarned,
                                total_redeemed_xhaus: newRedeemed
                            }).eq('id', targetProfileId);
                        }
                    } catch (e) {
                        console.error('JS fallback xhaus update failed:', e);
                    }
                }
            }

            setLoading(false);
            
            // Remove from local active bookings cache
            const bookings = posCache.getBookings().filter(b => b.id !== bookingId);
            posCache.setBookings(bookings);

            // Record in current shift
            recordShiftTransaction(bookingId, totalAmount, paymentMethod);

            toast.success('Order completed successfully');
            return true;
        } catch (err) {
            console.error('Failed to complete checkout online, queueing offline checkout:', err);
            
            const bookings = posCache.getBookings();
            const updatedBookings = bookings.map(b => {
                if (b.id === bookingId) {
                    return { 
                        ...b, 
                        status: 'completed', 
                        total_amount: totalAmount, 
                        discount_amount: discountAmount, 
                        xhaus_earned: xhausEarned,
                        xhaus_redeemed: xhausRedeemed,
                        xhaus_discount: xhausDiscount,
                        xhaus_reward_id: rewardId,
                        user_id: profileId || b.user_id,
                        staff_remark: `Paid by ${paymentMethod.toUpperCase()}` 
                    };
                }
                return b;
            });
            posCache.setBookings(updatedBookings);

            addToOfflineQueue('complete_checkout', { 
                bookingId, 
                totalAmount, 
                paymentMethod, 
                discountAmount, 
                xhausEarned, 
                xhausRedeemed, 
                xhausDiscount,
                rewardCode,
                rewardId,
                profileId
            });
            recordShiftTransaction(bookingId, totalAmount, paymentMethod);

            setLoading(false);
            toast.success('✅ เช็คบิลเรียบร้อยแล้ว (เข้าคิวรอส่งเซิร์ฟเวอร์)');
            return true;
        }
    };

    const acceptOrder = async (bookingId) => {
        setLoading(true);
        if (!isOnline() || (typeof bookingId === 'string' && bookingId.startsWith('local_'))) {
            console.log('[Offline Mode] Accepting order offline');
            const bookings = posCache.getBookings();
            const updated = bookings.map(b => b.id === bookingId ? { ...b, status: 'seated' } : b);
            posCache.setBookings(updated);
            setLoading(false);
            toast.success('Order accepted (Offline Mode)');
            return true;
        }

        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'seated' })
                .eq('id', bookingId);
            setLoading(false);
            if (error) throw error;
            
            toast.success('Order accepted');
            return true;
        } catch (err) {
            console.error('Failed to accept order online:', err);
            const bookings = posCache.getBookings();
            const updated = bookings.map(b => b.id === bookingId ? { ...b, status: 'seated' } : b);
            posCache.setBookings(updated);
            setLoading(false);
            toast.success('Order accepted (Fallback offline)');
            return true;
        }
    };

    const uploadPaymentSlip = async (bookingId, slipFile) => {
        setLoading(true);
        if (!isOnline()) {
            setLoading(false);
            toast.error('❌ ออฟไลน์: ไม่สามารถอัปโหลดสลิปได้ในขณะนี้');
            return false;
        }

        try {
            const fileExt = slipFile.name.split('.').pop();
            const fileName = `slip_${bookingId}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('slips')
                .upload(fileName, slipFile, {
                    cacheControl: '15552000'
                });
            
            if (uploadError) throw new Error('Upload Slip Failed: ' + uploadError.message);

            const { error: updateError } = await supabase
                .from('bookings')
                .update({ 
                    payment_slip_url: fileName
                })
                .eq('id', bookingId);

            if (updateError) throw updateError;
            
            toast.success('Slip uploaded successfully');
            return true;
        } catch (err) {
            console.error(err);
            toast.error(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    };
    const attachCustomerToBooking = async (bookingId, userId) => {
        if (!bookingId) {
            toast.success(userId ? 'ผูกสมาชิกกับออเดอร์เรียบร้อยแล้ว' : 'ยกเลิกการผูกสมาชิกเรียบร้อยแล้ว');
            return true;
        }
        
        if (!isOnline() || (typeof bookingId === 'string' && bookingId.startsWith('local_'))) {
            console.log('[Offline Mode] Attaching customer profile to local booking cache');
            const bookings = posCache.getBookings();
            const updated = bookings.map(b => b.id === bookingId ? { ...b, user_id: userId } : b);
            posCache.setBookings(updated);

            addToOfflineQueue('attach_customer', { bookingId, userId });
            toast.success('ผูกสมาชิกกับออเดอร์เรียบร้อยแล้ว');
            return true;
        }
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ user_id: userId })
                .eq('id', bookingId);
            if (error) throw error;
            toast.success(userId ? 'ผูกสมาชิกเรียบร้อยแล้ว' : 'ยกเลิกการผูกสมาชิกเรียบร้อยแล้ว');
            return true;
        } catch (err) {
            console.error(err);
            toast.error('Failed to update customer profile: ' + err.message);
            return false;
        }
    };

    const deleteOrderItem = async (orderItemId, bookingId = null) => {
        if (!orderItemId) return true;
        try {
            if (isOnline() && typeof orderItemId === 'string' && !orderItemId.startsWith('local_')) {
                const { error } = await supabase
                    .from('order_items')
                    .delete()
                    .eq('id', orderItemId);
                if (error) console.warn("Supabase deleteOrderItem error:", error);
            }
            if (bookingId) {
                const bookings = posCache.getBookings();
                const booking = bookings.find(b => b.id === bookingId);
                if (booking && booking.order_items) {
                    booking.order_items = booking.order_items.filter(i => i.id !== orderItemId);
                    posCache.setBookings(bookings);
                }
            }
            return true;
        } catch (err) {
            console.error("Error deleting order item:", err);
            return false;
        }
    };

    const updateOrderItemDbQty = async (orderItemId, newQty, bookingId = null) => {
        if (!orderItemId || newQty <= 0) return true;
        try {
            if (isOnline() && typeof orderItemId === 'string' && !orderItemId.startsWith('local_')) {
                const { error } = await supabase
                    .from('order_items')
                    .update({ quantity: newQty })
                    .eq('id', orderItemId);
                if (error) console.warn("Supabase updateOrderItemDbQty error:", error);
            }
            if (bookingId) {
                const bookings = posCache.getBookings();
                const booking = bookings.find(b => b.id === bookingId);
                if (booking && booking.order_items) {
                    const item = booking.order_items.find(i => i.id === orderItemId);
                    if (item) item.quantity = newQty;
                    posCache.setBookings(bookings);
                }
            }
            return true;
        } catch (err) {
            console.error("Error updating order item qty:", err);
            return false;
        }
    };

    return {
        loading,
        getActiveBooking,
        createWalkIn,
        createWalkInPickup,
        submitOrderItems,
        completeCheckout,
        acceptOrder,
        uploadPaymentSlip,
        attachCustomerToBooking,
        updateGuestCount,
        deleteOrderItem,
        updateOrderItemDbQty
    };
}
