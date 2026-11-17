import { supabase } from '../lib/supabaseClient'

// app_settings keys the customer pages actually read. Selecting the whole table cost
// ~27 KB per page view (tax images, staff config, ...); these lists keep it to what is shown.
export const CRM_SETTING_KEYS = [
    'crm_welcome_xhaus',
    'crm_redeem_rate_xhaus',
    'crm_min_redeem_xhaus',
    'crm_base_spend_amount',
    'crm_max_redeem_percent'
]

const PAYMENT_SETTING_KEYS = [
    'payment_qr_url',
    'promptpay_id',
    'promptpay_name',
    'truewallet_phone',
    'truewallet_account_name',
    'truewallet_qr_url'
]

export const BOOKING_SETTING_KEYS = [
    ...PAYMENT_SETTING_KEYS,
    'floorplan_url',
    'easyslip_enabled_booking',
    'policy_dine_in',
    'booking_min_spend',
    'booking_min_advance_hours',
    'booking_deposit_required',
    'booking_hold_minutes',
    'booking_time_slots',
    'side_dish_config',
    'side_dish_enabled',
    'closing_time',
    'qr_kitchen_close_time'
]

export const PICKUP_SETTING_KEYS = [
    ...PAYMENT_SETTING_KEYS,
    ...CRM_SETTING_KEYS,
    'policy_pickup',
    'pickup_min_advance_hours',
    'opening_time',
    'closing_time',
    'qr_kitchen_close_time',
    'easyslip_enabled_pickup',
    'pickup_pay_at_store_enabled'
]

/** Fetch the given app_settings keys as a { key: value } map. Throws on network / API error. */
export const fetchSettingsMap = async (keys) => {
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys)
    if (error) throw error
    return (data || []).reduce((acc, s) => { acc[s.key] = s.value; return acc }, {})
}
