/**
 * Analytics and Conversion Tracking Helper
 * Integrates Google Analytics 4 (G-D1M18Z54LM), Google Ads (AW-11227095880), and GTM (dataLayer)
 */

export const GA_MEASUREMENT_ID = 'G-D1M18Z54LM';
export const GOOGLE_ADS_ID = 'AW-11227095880';
export const GOOGLE_TAG_ID = 'GT-WKP3BT8G';
export const GOOGLE_ADS_DIRECTIONS_CONVERSION = 'AW-11227095880/uWqACPuDvOEcEMjGv-kp';

/**
 * Universal event tracker for GA4, Google Ads, and GTM dataLayer
 * @param {string} eventName 
 * @param {object} params 
 */
export const trackEvent = (eventName, params = {}) => {
    try {
        if (typeof window === 'undefined') return;

        // 1. Dispatch to window.gtag (GA4 & Google Ads)
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }

        // 2. Dispatch to window.dataLayer (GTM container)
        if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push({
                event: eventName,
                ...params
            });
        }
    } catch (err) {
        console.warn('[Analytics] trackEvent failed:', err);
    }
};

/**
 * Track Google Ads Conversion
 * @param {string} sendTo - Conversion label or ID
 * @param {number} value - Conversion value
 * @param {string} currency - Currency code
 */
export const trackConversion = (sendTo, value = 1.0, currency = 'THB') => {
    try {
        if (typeof window === 'undefined') return;

        if (typeof window.gtag === 'function') {
            window.gtag('event', 'conversion', {
                send_to: sendTo,
                value,
                currency
            });
        }
    } catch (err) {
        console.warn('[Analytics] trackConversion failed:', err);
    }
};

/**
 * Track Map / Directions Click
 * @param {string} pageLocation 
 */
export const trackDirectionsClick = (pageLocation = '/link') => {
    trackEvent('click_directions', {
        page_location: pageLocation,
        target_destination: 'Google Maps'
    });
    trackConversion(GOOGLE_ADS_DIRECTIONS_CONVERSION, 1.0, 'THB');
};

/**
 * Track Phone Call Click
 * @param {string} phoneNumber 
 * @param {string} pageLocation 
 */
export const trackPhoneClick = (phoneNumber = '098-528-4217', pageLocation = '/link') => {
    trackEvent('click_phone', {
        phone_number: phoneNumber,
        page_location: pageLocation
    });
    trackEvent('contact', {
        method: 'phone',
        event_category: 'engagement',
        event_label: phoneNumber,
        transport_type: 'beacon',
        page_location: pageLocation
    });
    trackConversion(GOOGLE_ADS_ID, 1.0, 'THB');
};

/**
 * Track LINE Official Account Click
 * @param {string} pageLocation 
 */
export const trackLineClick = (pageLocation = '/link') => {
    trackEvent('click_line', {
        page_location: pageLocation,
        target_destination: 'LINE OA'
    });
    trackEvent('generate_lead', {
        event_category: 'engagement',
        event_label: 'line_oa',
        page_location: pageLocation
    });
};

/**
 * Track Lineman Delivery Order Click
 * @param {string} pageLocation 
 */
export const trackLinemanClick = (pageLocation = '/link') => {
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
    trackEvent('view_booklet_menu', {
        page_location: pageLocation
    });
};
