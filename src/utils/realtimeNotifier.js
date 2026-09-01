import { supabase } from '../lib/supabaseClient';

let posBroadcastChannel = null;
let posChannelSubPromise = null;

function getBroadcastChannel() {
    if (!posBroadcastChannel) {
        posBroadcastChannel = supabase.channel('pos-realtime-notifications', {
            config: {
                broadcast: { ack: true }
            }
        });
        posChannelSubPromise = new Promise((resolve) => {
            const timer = setTimeout(resolve, 2000);
            posBroadcastChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timer);
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.warn(`[RealtimeNotifier] Channel status: ${status}, resetting channel.`);
                    posBroadcastChannel = null;
                    posChannelSubPromise = null;
                    clearTimeout(timer);
                    resolve();
                }
            });
        });
    }
    return { channel: posBroadcastChannel, promise: posChannelSubPromise };
}

/**
 * Send an instant Realtime Broadcast signal directly to POS terminals (< 50ms).
 * @param {string} event - e.g. 'online_order_created', 'qr_order_created', 'call_staff', 'call_bill', 'payment_slip_uploaded'
 * @param {object} payload - Metadata including table_id, table_name, booking_id
 */
export async function sendPOSBroadcast(event, payload = {}) {
    try {
        const { channel, promise } = getBroadcastChannel();
        const fullPayload = {
            ...payload,
            timestamp: Date.now()
        };

        if (promise) {
            await promise;
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
        const channel = supabase.channel(channelName, {
            config: { broadcast: { ack: true } }
        });
        const fullPayload = {
            ...payload,
            tracking_token: trackingToken,
            timestamp: Date.now()
        };

        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 1500);
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

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


