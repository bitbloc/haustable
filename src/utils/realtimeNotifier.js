import { supabase } from '../lib/supabaseClient';

const broadcastListeners = new Set();
let posBroadcastChannel = null;
let posChannelSubPromise = null;

function getBroadcastChannel() {
    if (!posBroadcastChannel) {
        posBroadcastChannel = supabase.channel('pos-realtime-notifications', {
            config: {
                broadcast: { ack: true }
            }
        });

        // Listen for all incoming broadcasts on the shared topic and fan out to registered listeners
        posBroadcastChannel.on('broadcast', { event: '*' }, ({ event, payload }) => {
            console.log(`⚡ [RealtimeNotifier] Broadcast received [${event}]:`, payload);
            broadcastListeners.forEach(listener => {
                try {
                    listener({ event, payload });
                } catch (err) {
                    console.error('[RealtimeNotifier] Error in broadcast listener:', err);
                }
            });
        });

        posChannelSubPromise = new Promise((resolve) => {
            const timer = setTimeout(resolve, 2000);
            posBroadcastChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timer);
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.warn(`[RealtimeNotifier] Channel status: ${status}, resetting broadcaster reference.`);
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
 * Register a listener for POS Realtime Broadcast events.
 * Multiple components can subscribe safely without creating duplicate WebSocket channels
 * and without tearing down the shared channel when unmounting.
 * @param {Function} callback - ({ event, payload }) => void
 * @returns {Function} unsubscribe function to remove listener
 */
export function subscribePOSBroadcast(callback) {
    if (typeof callback !== 'function') return () => {};
    broadcastListeners.add(callback);
    getBroadcastChannel(); // Ensure channel is pre-warmed & subscribed

    return () => {
        broadcastListeners.delete(callback);
    };
}

/**
 * Pre-warm the broadcast channel subscription so sending is instant (< 5ms) when an order is placed.
 */
export function prewarmPOSBroadcastChannel() {
    return getBroadcastChannel();
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

        // Instantly notify local in-memory listeners (< 0.1ms)
        broadcastListeners.forEach(listener => {
            try {
                listener({ event, payload: fullPayload });
            } catch (err) {
                console.error('[RealtimeNotifier] Local broadcast listener error:', err);
            }
        });

        if (promise) {
            await promise;
        }

        const res = await channel.send({
            type: 'broadcast',
            event: event,
            payload: fullPayload
        });

        // Local cross-tab & in-app instant sync (0ms)
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('onhaus_pos_sync');
                bc.postMessage({ event, payload: fullPayload });
                bc.close();
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pos_sync_event', { detail: { event, payload: fullPayload } }));
                localStorage.setItem('pos_last_order_sync', String(Date.now()));
            }
        } catch (e) {}

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
    let channel = null;
    try {
        const channelName = `tracking_room_${trackingToken}`;
        channel = supabase.channel(channelName, {
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
    } finally {
        if (channel) {
            try {
                supabase.removeChannel(channel);
            } catch (e) {}
        }
    }
}


