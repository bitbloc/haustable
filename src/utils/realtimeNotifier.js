import { supabase } from '../lib/supabaseClient';

let posBroadcastChannel = null;

function getBroadcastChannel() {
    if (!posBroadcastChannel) {
        posBroadcastChannel = supabase.channel('pos-realtime-notifications');
        posBroadcastChannel.subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[RealtimeNotifier] Channel status: ${status}, recreating...`);
                posBroadcastChannel = null;
            }
        });
    }
    return posBroadcastChannel;
}

/**
 * Send an instant Realtime Broadcast signal directly to POS terminals (< 50ms).
 * @param {string} event - e.g. 'qr_order_created', 'call_staff', 'call_bill', 'payment_slip_uploaded'
 * @param {object} payload - Metadata including table_id, table_name, booking_id
 */
export async function sendPOSBroadcast(event, payload = {}) {
    try {
        const channel = getBroadcastChannel();
        const fullPayload = {
            ...payload,
            timestamp: Date.now()
        };

        // If channel is not yet subscribed, subscribe before sending
        if (channel.state !== 'joined') {
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 1500);
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });
        }

        const res = await channel.send({
            type: 'broadcast',
            event: event,
            payload: fullPayload
        });

        console.log(`⚡ [RealtimeNotifier] Broadcast "${event}" sent:`, res);
        return res;
    } catch (err) {
        console.warn(`[RealtimeNotifier] Failed to broadcast event "${event}":`, err);
        return null;
    }
}

/**
 * Send an instant Realtime Broadcast signal directly to a customer's tracking room (< 50ms).
 * @param {string} trackingToken - UUID tracking token for the booking
 * @param {string} event - e.g. 'order_status_updated'
 * @param {object} payload - Metadata including status, booking_id
 */
export async function sendTrackingBroadcast(trackingToken, event = 'order_status_updated', payload = {}) {
    if (!trackingToken) return null;
    try {
        const channelName = `tracking_room_${trackingToken}`;
        const channel = supabase.channel(channelName);
        const fullPayload = {
            ...payload,
            tracking_token: trackingToken,
            timestamp: Date.now()
        };

        if (channel.state !== 'joined') {
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 1500);
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });
        }

        const res = await channel.send({
            type: 'broadcast',
            event: event,
            payload: fullPayload
        });

        console.log(`⚡ [RealtimeNotifier] Tracking Broadcast "${event}" sent to ${channelName}:`, res);
        return res;
    } catch (err) {
        console.warn(`[RealtimeNotifier] Failed to broadcast tracking event "${event}":`, err);
        return null;
    }
}

