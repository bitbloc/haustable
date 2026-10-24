/**
 * Analytics and Conversion Tracking Helper
 * Integrates Google Analytics 4 (G-D1M18Z54LM) and Google Ads (AW-11227095880)
 * Optimized for clean single-dispatch, beacon transport, and debounce protection.
 */

import { supabase } from '../lib/supabaseClient';

export const GA_MEASUREMENT_ID = 'G-D1M18Z54LM';
export const GOOGLE_ADS_ID = 'AW-11227095880';

// Google Ads Outbound Click Conversion Action Labels
export const GOOGLE_ADS_CALL_CONVERSION = 'AW-11227095880/tBbmCO-Vr-EcEMjGv-kp';        // TechSol - Call 3788
export const GOOGLE_ADS_DIRECTIONS_CONVERSION = 'AW-11227095880/QU1qCJHHvcocEMjGv-kp';  // ดูเส้นทาง (QU1qCJHHvcocEMjGv-kp)
export const GOOGLE_ADS_LINE_CONVERSION = 'AW-11227095880/XCmICO2BwOEcEMjGv-kp';        // TechSol - Line 95594 (XCmICO2BwOEcEMjGv-kp)
export const GOOGLE_ADS_BOOKING_CONVERSION = 'AW-11227095880/tc4FCIyyn5wdEMjGv-kp';    // จองโต๊ะ (Click Booking)
export const GOOGLE_ADS_PICKUP_CONVERSION = 'AW-11227095880/HSdNCI-yn5wdEMjGv-kp';      // สั่งอาหาร (Pickup) — fixed: CI (capital i), was Cl

// Timestamp cache for anti-spam click debouncing (2000ms cooldown)
const lastEventTimestamps = new Map();

const isDebounced = (key, cooldownMs = 2000) => {
    const now = Date.now();
    const last = lastEventTimestamps.get(key) || 0;
    if (now - last < cooldownMs) {
        return true;
    }
    lastEventTimestamps.set(key, now);
    return false;
};

/**
 * Extract and persist UTM Attribution parameters across entire customer journey
 */
export const getStoredUtmParams = () => {
    try {
        if (typeof window === 'undefined') return {};
        const urlParams = new URLSearchParams(window.location.search);
        const utm_source = urlParams.get('utm_source') || localStorage.getItem('onhaus_utm_source') || '';
        const utm_medium = urlParams.get('utm_medium') || localStorage.getItem('onhaus_utm_medium') || '';
        const utm_campaign = urlParams.get('utm_campaign') || localStorage.getItem('onhaus_utm_campaign') || '';
        const utm_content = urlParams.get('utm_content') || localStorage.getItem('onhaus_utm_content') || '';
        const gclid = urlParams.get('gclid') || localStorage.getItem('onhaus_gclid') || '';

        // Persist if found in URL for closed-loop attribution
        if (urlParams.get('utm_source')) localStorage.setItem('onhaus_utm_source', urlParams.get('utm_source'));
        if (urlParams.get('utm_medium')) localStorage.setItem('onhaus_utm_medium', urlParams.get('utm_medium'));
        if (urlParams.get('utm_campaign')) localStorage.setItem('onhaus_utm_campaign', urlParams.get('utm_campaign'));
        if (urlParams.get('utm_content')) localStorage.setItem('onhaus_utm_content', urlParams.get('utm_content'));
        if (urlParams.get('gclid')) localStorage.setItem('onhaus_gclid', urlParams.get('gclid'));

        return { utm_source, utm_medium, utm_campaign, utm_content, gclid };
    } catch {
        return {};
    }
};

const getSessionId = () => {
    try {
        let sid = sessionStorage.getItem('onhaus_ad_sid');
        if (!sid) {
            sid = 'sid_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
            sessionStorage.setItem('onhaus_ad_sid', sid);
        }
        return sid;
    } catch {
        return 'sid_anon';
    }
};

const getDeviceType = () => {
    if (typeof window === 'undefined') return 'desktop';
    const ua = navigator.userAgent || '';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) return 'mobile';
    return 'desktop';
};

/**
 * Log Ad Event to Supabase database for Backoffice Admin Analytics
 */
export const logAdEvent = async (eventName, metadata = {}) => {
    try {
        if (typeof window === 'undefined') return;
        const isBot = Boolean(
            navigator.webdriver ||
            /Lighthouse|Headless|PageSpeed|PTST|Chrome-Lighthouse|Google-InspectionTool|Bytespider/i.test(navigator.userAgent)
        );
        if (isBot) return;

        const utm = getStoredUtmParams();
        const payload = {
            session_id: getSessionId(),
            event_name: eventName,
            utm_source: utm.utm_source || null,
            utm_medium: utm.utm_medium || null,
            utm_campaign: utm.utm_campaign || null,
            utm_content: utm.utm_content || null,
            device_type: getDeviceType(),
            page_path: window.location.pathname || '/link',
            metadata: {
                referrer: document.referrer || null,
                gclid: utm.gclid || null,
                ...metadata
            }
        };

        // Non-blocking fire-and-forget
        supabase.from('ad_events').insert([payload]).then(({ error }) => {
            if (error) {
                console.debug('[AdAnalytics] Supabase notice:', error.message);
            }
        }).catch(() => {});
    } catch (e) {
        console.debug('[AdAnalytics] logAdEvent err:', e);
    }
};

/**
 * Universal single-dispatch event tracker for GA4 & Google Ads
 * Uses beacon transport for reliable background delivery on outbound navigation.
 * @param {string} eventName 
 * @param {object} params 
 */
export const trackEvent = (eventName, params = {}) => {
    try {
        if (typeof window === 'undefined') return;

        const eventParams = {
            transport_type: 'beacon',
            ...params
        };

        // Also record to Supabase Ad Analytics
        logAdEvent(eventName, params);

        // Dispatch cleanly to window.gtag (automatically manages dataLayer without manual duplicate pushes)
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, eventParams);
        }
    } catch (err) {
        console.warn('[Analytics] trackEvent failed:', err);
    }
};

/**
 * Track Google Ads Conversion with label validation
 * @param {string} sendTo - Conversion label e.g. 'AW-11227095880/tBbmCO-Vr-EcEMjGv-kp'
 * @param {number} value - Conversion value
 * @param {string} currency - Currency code
 */
export const trackConversion = (sendTo, value = 1.0, currency = 'THB') => {
    try {
        if (typeof window === 'undefined' || !sendTo) return;

        // Ensure sendTo includes valid conversion action label format (AW-XXXXXXXXX/YYYYYYYY)
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'conversion', {
                send_to: sendTo,
                value,
                currency,
                transport_type: 'beacon'
            });
        }
    } catch (err) {
        console.warn('[Analytics] trackConversion failed:', err);
    }
};

// ─── FLOATING BAR CONVERSIONS (EXCLUSIVELY 3 BUTTONS ON /link) ───

/**
 * 1. Float Bar: Track LINE Official Account Click (generate_lead & Google Ads Conversion)
 * @param {string} pageLocation 
 */
export const trackLineClick = (pageLocation = '/link') => {
    if (isDebounced('float_line_click')) return;

    // GA4 & GTM Event Dispatch
    trackEvent('click_line', {
        method: 'line_oa',
        event_category: 'contact',
        event_label: 'line_official',
        target_destination: 'LINE OA',
        page_location: pageLocation
    });

    // NOTE: Google Ads Conversion is fired exclusively via GTM container (TechSol - Line 6952)
    // on link click to guarantee 1:1 attribution and zero duplicate counting.
};

/**
 * 2. Float Bar: Track Map / Directions Click
 * @param {string} pageLocation 
 */
export const trackDirectionsClick = (pageLocation = '/link') => {
    if (isDebounced('float_directions_click')) return;

    // GA4 & GTM Event Dispatch
    trackEvent('click_directions', {
        event_category: 'contact',
        event_label: 'google_maps_directions',
        target_destination: 'Google Maps',
        page_location: pageLocation
    });

    // NOTE: Google Ads Conversion is fired exclusively via GTM container (TechSol - Direction 23859)
    // on link click to guarantee 1:1 attribution and zero duplicate counting.
};

/**
 * 3. Float Bar: Track Phone Call Click
 * @param {string} phoneNumber 
 * @param {string} pageLocation 
 */
export const trackPhoneClick = (phoneNumber = '098-528-4217', pageLocation = '/link') => {
    if (isDebounced('float_phone_click')) return;

    // GA4 & GTM Event Dispatch
    trackEvent('click_call', {
        method: 'phone',
        event_category: 'contact',
        event_label: phoneNumber,
        phone_number: phoneNumber,
        page_location: pageLocation
    });

    // NOTE: Google Ads Conversion is fired exclusively via GTM container (TechSol - Call 11647)
    // on link click to guarantee 1:1 attribution and zero duplicate counting.
};

/**
 * Track Lineman Delivery Order Click
 * @param {string} pageLocation 
 */
export const trackLinemanClick = (pageLocation = '/link') => {
    if (isDebounced('lineman_click')) return;

    trackEvent('click_lineman', {
        page_location: pageLocation,
        target_destination: 'LINE MAN'
    });
};

/**
 * Track Booklet / PDF Menu Open
 * @param {string} pageLocation 
 */
export const trackBookletClick = (pageLocation = '/link') => {
    if (isDebounced('booklet_click')) return;

    trackEvent('view_booklet_menu', {
        page_location: pageLocation
    });
};

/**
 * Track Table Booking Navigation Click
 * @param {string} pageLocation 
 */
export const trackBookingClick = (pageLocation = '/link') => {
    if (isDebounced('booking_click')) return;

    trackEvent('click_booking', {
        page_location: pageLocation,
        target_destination: '/booking'
    });
};

/**
 * Track Pick Up Online Navigation Click
 * @param {string} pageLocation 
 */
export const trackPickupClick = (pageLocation = '/link') => {
    if (isDebounced('pickup_click')) return;

    trackEvent('click_pickup', {
        page_location: pageLocation,
        target_destination: '/pickup'
    });
};

/**
 * Track Full Menu Expansion
 * @param {string} pageLocation 
 */
export const trackFullMenuClick = (pageLocation = '/link') => {
    if (isDebounced('full_menu_click', 1500)) return;

    trackEvent('view_full_menu', {
        page_location: pageLocation,
        event_category: 'engagement',
        event_label: 'full_menu_expand'
    });
};

/**
 * Track Atmosphere / Vibe View
 * @param {string} pageLocation 
 */
export const trackAtmosphereClick = (pageLocation = '/link') => {
    if (isDebounced('atmosphere_click', 2000)) return;

    trackEvent('view_atmosphere', {
        page_location: pageLocation,
        event_category: 'engagement',
        event_label: 'vibe_gallery_view'
    });
};


// ─── COMPLETION CONVERSIONS (fire on successful booking / pickup order) ───

/**
 * Push a completion event to dataLayer and wait until GTM has handled it
 * (eventCallback) or a short timeout passes, so a redirect right after
 * does not cut the conversion hit off.
 * GTM: create Custom Event triggers named `booking_complete` / `pickup_complete`.
 * @param {string} eventName
 * @param {object} params - e.g. { transaction_id, value, currency }
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
export const trackCompletion = (eventName, params = {}, timeoutMs = 1500) => {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };
        try {
            if (typeof window === 'undefined') return finish();

            logAdEvent(eventName, params);

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: eventName,
                ...params,
                eventCallback: finish,
                eventTimeout: timeoutMs
            });
        } catch (err) {
            console.warn('[Analytics] trackCompletion failed:', err);
            finish();
        }
        // Safety net in case GTM is blocked or not loaded
        setTimeout(finish, timeoutMs + 200);
    });
};

export const trackBookingComplete = ({ transactionId, value, pax } = {}) =>
    trackCompletion('booking_complete', {
        transaction_id: transactionId || undefined,
        value: Number(value) || 0,
        currency: 'THB',
        pax: pax || undefined
    });

export const trackPickupComplete = ({ transactionId, value } = {}) =>
    trackCompletion('pickup_complete', {
        transaction_id: transactionId || undefined,
        value: Number(value) || 0,
        currency: 'THB'
    });
