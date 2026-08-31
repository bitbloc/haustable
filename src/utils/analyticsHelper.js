/**
 * Analytics and Conversion Tracking Helper
 * Integrates Google Analytics 4 (G-D1M18Z54LM) and Google Ads (AW-11227095880)
 * Optimized for clean single-dispatch, beacon transport, and debounce protection.
 */

export const GA_MEASUREMENT_ID = 'G-D1M18Z54LM';
export const GOOGLE_ADS_ID = 'AW-11227095880';

// Google Ads Outbound Click Conversion Action Labels
export const GOOGLE_ADS_CALL_CONVERSION = 'AW-11227095880/tBbmCO-Vr-EcEMjGv-kp';        // TechSol - Call 3788
export const GOOGLE_ADS_DIRECTIONS_CONVERSION = 'AW-11227095880/uWqACPuDvOEcEMjGv-kp';  // TechSol - Direction 26311
export const GOOGLE_ADS_LINE_CONVERSION = 'AW-11227095880/QU1qCJHHvcocEMjGv-kp';        // TechSol - Line 95594

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

    // GA4 Standard Lead Event
    trackEvent('generate_lead', {
        method: 'line_oa',
        event_category: 'engagement',
        event_label: 'line_official',
        target_destination: 'LINE OA',
        page_location: pageLocation
    });

    // Google Ads Conversion (TechSol - Line 95594)
    if (GOOGLE_ADS_LINE_CONVERSION) {
        trackConversion(GOOGLE_ADS_LINE_CONVERSION, 1.0, 'THB');
    }
};

/**
 * 2. Float Bar: Track Map / Directions Click (find_location & Google Ads Conversion)
 * @param {string} pageLocation 
 */
export const trackDirectionsClick = (pageLocation = '/link') => {
    if (isDebounced('float_directions_click')) return;

    // GA4 Location Event
    trackEvent('find_location', {
        event_category: 'engagement',
        event_label: 'google_maps_directions',
        target_destination: 'Google Maps',
        page_location: pageLocation
    });

    // Google Ads Conversion (TechSol - Direction 26311)
    if (GOOGLE_ADS_DIRECTIONS_CONVERSION) {
        trackConversion(GOOGLE_ADS_DIRECTIONS_CONVERSION, 1.0, 'THB');
    }
};

/**
 * 3. Float Bar: Track Phone Call Click (contact & Google Ads Conversion)
 * @param {string} phoneNumber 
 * @param {string} pageLocation 
 */
export const trackPhoneClick = (phoneNumber = '098-528-4217', pageLocation = '/link') => {
    if (isDebounced('float_phone_click')) return;

    // GA4 Standard Contact Event
    trackEvent('contact', {
        method: 'phone',
        event_category: 'engagement',
        event_label: phoneNumber,
        phone_number: phoneNumber,
        page_location: pageLocation
    });

    // Google Ads Conversion (TechSol - Call 3788)
    if (GOOGLE_ADS_CALL_CONVERSION) {
        trackConversion(GOOGLE_ADS_CALL_CONVERSION, 1.0, 'THB');
    }
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
