import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { isOnline, addToOfflineQueue, posCache, syncOfflineQueue } from '../utils/offlineHelper';
import { recordShiftTransaction } from '../utils/shiftHelper';

export function usePOSOrder() {
    const [loading, setLoading] = useState(false);

    const getActiveBooking = useCallback(async (tableId) => {
        if (!isOnline()) {
            console.log('[Offline Mode] Fetching active booking from local cache for table:', tableId);
            const bookings = posCache.getBookings();
            const booking = bookings.find(b => b.table_id === tableId && b.status !== 'completed');
            return booking || null;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id))')
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
            }
            return data;
        } catch (err) {
            console.error('Network error fetching booking, fallback to cache:', err);
            const bookings = posCache.getBookings();
            return bookings.find(b => b.table_id === tableId && b.status !== 'completed') || null;
        }
    }, []);

    const createWalkIn = async (table = null, customPax = null) => {
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
                status: 'seated',
                bookingTime: mockBooking.booking_time,
                staffRemark: mockBooking.staff_remark
            });

            toast.warning('⚠️ ออฟไลน์: บันทึกข้อมูลโต๊ะในเครื่องแล้ว');
            return mockBooking;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    table_id: tableId,
                    status: 'seated',
                    booking_type: 'walk_in',
                    booking_time: new Date().toISOString(),
                    pax: capacity,
                    staff_remark: 'Walk-in Guest'
                })
                .select('*, tables_layout(*)')
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

            toast.warning('⚠️ บันทึกข้อมูลเข้าคิวออฟไลน์');
            return mockBooking;
        }
    };

    const updateGuestCount = async (bookingId, newPax) => {
        const paxNum = parseInt(newPax) || 1;
        if (!isOnline()) {
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

    const createWalkInPickup = async (note) => {
        if (!isOnline()) {
            console.log('[Offline Mode] Creating offline walk-in pickup');
            const tempId = `local_pickup_${Date.now()}`;
            const mockBooking = {
                id: tempId,
                table_id: null,
                status: 'pending',
                booking_type: 'pickup',
                booking_time: new Date().toISOString(),
                pax: 1,
                customer_note: note,
                pickup_contact_name: note,
                staff_remark: 'Walk-in Pick-up (Offline)'
            };

            const bookings = posCache.getBookings();
            bookings.push(mockBooking);
            posCache.setBookings(bookings);

            addToOfflineQueue('create_pickup', {
                tempBookingId: tempId,
                customerNote: note,
                status: 'pending',
                bookingTime: mockBooking.booking_time
            });

            toast.warning('⚠️ ออฟไลน์: เปิดบิลรับกลับบ้านในเครื่องแล้ว');
            return mockBooking;
        }

        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    table_id: null,
                    status: 'pending',
                    booking_type: 'pickup',
                    booking_time: new Date().toISOString(),
                    pax: 1,
                    customer_note: note,
                    pickup_contact_name: note,
                    staff_remark: 'Walk-in Pick-up'
                })
                .select('*')
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
                status: 'pending',
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
                status: 'pending',
                bookingTime: mockBooking.booking_time
            });

            toast.warning('⚠️ บันทึกการเปิดบิลรับกลับบ้านเข้าคิวออฟไลน์');
            return mockBooking;
        }
    };

    const submitOrderItems = async (bookingId, items) => {
        if (!items || items.length === 0) return true;

        if (!isOnline()) {
            console.log('[Offline Mode] Submitting items to offline queue');
            // Save order items inside booking cache for local UI consistency
            const bookings = posCache.getBookings();
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1) {
                const existingOrderItems = bookings[idx].order_items || [];
                const newOrderItems = items.map((item, i) => {
                    const finalOpts = [...(item.selected_options || [])];
                    if (item.item_note) {
                        finalOpts.push({ name: `Note: ${item.item_note}` });
                    }
                    return {
                        id: `local_item_${Date.now()}_${i}`,
                        booking_id: bookingId,
                        menu_item_id: item.id,
                        quantity: item.quantity,
                        price_at_time: item.price,
                        selected_options: finalOpts,
                        menu_items: { name: item.name } // simulate relation join
                    };
                });
                bookings[idx].order_items = [...existingOrderItems, ...newOrderItems];
                posCache.setBookings(bookings);
            }

            addToOfflineQueue('submit_items', { bookingId, items });
            toast.warning('⚠️ ออฟไลน์: บันทึกรายการอาหารในเครื่องแล้ว');
            return true;
        }

        try {
            const itemsToInsert = items.map(item => {
                const finalOpts = [...(item.selected_options || [])];
                if (item.item_note) {
                    finalOpts.push({ name: `Note: ${item.item_note}` });
                }
                return {
                    booking_id: bookingId,
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    price_at_time: item.price,
                    selected_options: finalOpts
                };
            });

            const { error } = await supabase.from('order_items').insert(itemsToInsert);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Failed to submit items online, fallback to offline queue:', err);
            
            // Local cache update
            const bookings = posCache.getBookings();
            const idx = bookings.findIndex(b => b.id === bookingId);
            if (idx !== -1) {
                const existingOrderItems = bookings[idx].order_items || [];
                const newOrderItems = items.map((item, i) => {
                    const finalOpts = [...(item.selected_options || [])];
                    if (item.item_note) {
                        finalOpts.push({ name: `Note: ${item.item_note}` });
                    }
                    return {
                        id: `local_item_${Date.now()}_${i}`,
                        booking_id: bookingId,
                        menu_item_id: item.id,
                        quantity: item.quantity,
                        price_at_time: item.price,
                        selected_options: finalOpts,
                        menu_items: { name: item.name }
                    };
                });
                bookings[idx].order_items = [...existingOrderItems, ...newOrderItems];
                posCache.setBookings(bookings);
            }

            addToOfflineQueue('submit_items', { bookingId, items });
            toast.warning('⚠️ บันทึกรายการอาหารเข้าคิวออฟไลน์');
            return true;
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
        rewardId = null
    ) => {
        setLoading(true);
        
        if (!isOnline()) {
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
                rewardId
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
                staff_remark: remarkText
            };
            if (rewardId) {
                updatePayload.xhaus_reward_id = rewardId;
            }

            const { error: bookingErr } = await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('id', bookingId);

            if (bookingErr) throw bookingErr;

            // 2. Process xhaus transaction in database (updates profile points & dynamic tier details)
            const { error: rpcErr } = await supabase.rpc('process_checkout_xhaus', {
                p_booking_id: bookingId,
                p_xhaus_earned: xhausEarned,
                p_xhaus_redeemed: xhausRedeemed,
                p_xhaus_discount: xhausDiscount
            });

            if (rpcErr) {
                console.warn('process_checkout_xhaus RPC notice/error:', rpcErr);
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
                rewardId
            });
            recordShiftTransaction(bookingId, totalAmount, paymentMethod);

            setLoading(false);
            toast.success('✅ เช็คบิลเรียบร้อยแล้ว (เข้าคิวรอส่งเซิร์ฟเวอร์)');
            return true;
        }
    };

    const acceptOrder = async (bookingId) => {
        setLoading(true);
        if (!isOnline()) {
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
        if (!isOnline()) {
            console.log('[Offline Mode] Attaching customer profile to local booking cache');
            const bookings = posCache.getBookings();
            const updated = bookings.map(b => b.id === bookingId ? { ...b, user_id: userId } : b);
            posCache.setBookings(updated);

            addToOfflineQueue('attach_customer', { bookingId, userId });
            toast.warning('⚠️ ออฟไลน์: บันทึกการผูกสิทธิ์สมาชิกในเครื่องแล้ว');
            return true;
        }
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ user_id: userId })
                .eq('id', bookingId);
            if (error) throw error;
            toast.success(userId ? 'Attached customer profile successfully' : 'Detached customer profile successfully');
            return true;
        } catch (err) {
            console.error(err);
            toast.error('Failed to update customer profile: ' + err.message);
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
        updateGuestCount
    };
}
