import { supabase } from '../lib/supabaseClient';

const broadcastListeners = new Set();
let posBroadcastChannel = null;
let posChannelSubPromise = null;
let broadcastReconnectTimer = null;
const broadcastDispatchHistory = new Map(); // deduplicate dual wildcard + explicit deliveries

function dispatchBroadcastEvent(event, payload) {
    if (!event) return;
    const now = Date.now();
    // Unique deduplication token per broadcast message
    const dedupToken = `${event}_${payload?.booking_id || ''}_${payload?.table_id || ''}_${payload?.timestamp || ''}`;
    const lastSeen = broadcastDispatchHistory.get(dedupToken);
    if (lastSeen && (now - lastSeen < 1500)) {
        return; // Suppress duplicate same-event dispatch within 1.5s
    }
    broadcastDispatchHistory.set(dedupToken, now);
    if (broadcastDispatchHistory.size > 100) {
        for (const [k, t] of broadcastDispatchHistory.entries()) {
            if (now - t > 10000) broadcastDispatchHistory.delete(k);
        }
    }

    console.log(`⚡ [RealtimeNotifier] Broadcast dispatched [${event}]:`, payload);
    broadcastListeners.forEach(listener => {
        try {
            listener({ event, payload });
        } catch (err) {
            console.error('[RealtimeNotifier] Error in broadcast listener:', err);
        }
    });
}

function getBroadcastChannel() {
    if (!posBroadcastChannel) {
        posBroadcastChannel = supabase.channel('pos-realtime-notifications', {
            config: {
                broadcast: { ack: true }
            }
        });

        // 1. Wildcard listener for all broadcast events
        posBroadcastChannel.on('broadcast', { event: '*' }, ({ event, payload }) => {
            dispatchBroadcastEvent(event, payload);
        });

        // 2. Explicit event listeners (ensures legacy Phoenix sockets match without relying solely on wildcard filter)
        const explicitEvents = [
            'qr_order_created',
            'call_staff',
            'call_bill',
            'online_order_created',
            'payment_slip_uploaded',
            'table_moved',
            'bills_merged',
            'online_order_status_updated'
        ];
        explicitEvents.forEach(evt => {
            posBroadcastChannel.on('broadcast', { event: evt }, ({ payload }) => {
                dispatchBroadcastEvent(evt, payload);
            });
        });

        posChannelSubPromise = new Promise((resolve) => {
            const timer = setTimeout(resolve, 2000);
            posBroadcastChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timer);
                    if (broadcastReconnectTimer) {
                        clearTimeout(broadcastReconnectTimer);
                        broadcastReconnectTimer = null;
                    }
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.warn(`[RealtimeNotifier] Channel status: ${status}, scheduling auto-reconnect...`);
                    try {
                        if (posBroadcastChannel) supabase.removeChannel(posBroadcastChannel);
                    } catch (e) {}
                    posBroadcastChannel = null;
                    posChannelSubPromise = null;
                    clearTimeout(timer);
                    resolve();

                    // Automatic reconnect loop for active POS terminals
                    if (broadcastListeners.size > 0 && !broadcastReconnectTimer) {
                        broadcastReconnectTimer = setTimeout(() => {
                            broadcastReconnectTimer = null;
                            console.log('⚡ [RealtimeNotifier] Auto-reconnecting broadcast channel...');
                            getBroadcastChannel();
                        }, 2500);
                    }
                }
            });
        });
    }
    return { channel: posBroadcastChannel, promise: posChannelSubPromise };
}

// Lifecycle watcher: revive channel whenever Android WebView is foregrounded or network reconnects
if (typeof window !== 'undefined') {
    const handleRevive = () => {
        if (document.visibilityState === 'visible' && broadcastListeners.size > 0) {
            if (!posBroadcastChannel || posBroadcastChannel.state !== 'joined') {
                console.log('⚡ [RealtimeNotifier] Foreground/online triggered broadcast channel re-verification');
                getBroadcastChannel();
            }
        }
    };
    document.addEventListener('visibilitychange', handleRevive);
    window.addEventListener('online', handleRevive);
    window.addEventListener('focus', handleRevive);
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


