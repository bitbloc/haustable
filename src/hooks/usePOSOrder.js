import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export function usePOSOrder() {
    const [loading, setLoading] = useState(false);

    const getActiveBooking = useCallback(async (tableId) => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('bookings')
            .select('*, order_items(*, menu_items(name))')
            .eq('table_id', tableId)
            .in('status', ['pending', 'confirmed', 'seated', 'ready'])
            .gte('booking_time', `${today}T00:00:00`)
            .order('booking_time', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching active booking:', error);
        }
        return data;
    }, []);

    const createWalkIn = async (table) => {
        const { data, error } = await supabase
            .from('bookings')
            .insert({
                table_id: table.id,
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: new Date().toISOString(),
                pax: table.capacity || 2,
                staff_remark: 'Walk-in Guest' // Use remark as a fallback for guest name
            })
            .select()
            .single();

        if (error) {
            toast.error('Failed to create walk-in: ' + error.message);
            return null;
        }
        return data;
    };

    const submitOrderItems = async (bookingId, items) => {
        if (!items || items.length === 0) return true;

        const itemsToInsert = items.map(item => ({
            booking_id: bookingId,
            menu_item_id: item.id,
            quantity: item.quantity,
            price_at_time: item.price,
            selected_options: item.selected_options || []
        }));

        const { error } = await supabase.from('order_items').insert(itemsToInsert);

        if (error) {
            toast.error('Failed to add items: ' + error.message);
            return false;
        }
        return true;
    };

    const completeCheckout = async (bookingId, totalAmount, paymentMethod = 'cash') => {
        setLoading(true);
        const { error } = await supabase
            .from('bookings')
            .update({
                status: 'completed',
                total_amount: totalAmount,
                // Fallback for missing payment_method/status columns
                staff_remark: `Paid by ${paymentMethod.toUpperCase()}`
            })
            .eq('id', bookingId);

        setLoading(false);
        if (error) {
            console.error('Checkout Update Error:', error);
            toast.error('Checkout failed: ' + error.message);
            return false;
        }
        toast.success('Order completed successfully');
        return true;
    };

    const acceptOrder = async (bookingId) => {
        setLoading(true);
        const { error } = await supabase
            .from('bookings')
            .update({ status: 'seated' })
            .eq('id', bookingId);
        setLoading(false);
        if (error) {
            toast.error('Failed to accept order: ' + error.message);
            return false;
        }
        toast.success('Order accepted');
        return true;
    };

    const uploadPaymentSlip = async (bookingId, slipFile) => {
        setLoading(true);
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

    return {
        loading,
        getActiveBooking,
        createWalkIn,
        submitOrderItems,
        completeCheckout,
        acceptOrder,
        uploadPaymentSlip
    };
}
