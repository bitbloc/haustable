// app_settings keys that hold secrets. Same list as the RLS policy
// "app_settings_secrets_admin_only" (migration 20261117120000).
// Back-office pages must never load these into page state or localStorage:
// they are written (write-only) and read only by edge functions.
export const SECRET_SETTING_KEYS = new Set([
    'easyslip_api_key',
    'gemini_api_key',
    'line_channel_access_token',
    'line_channel_secret',
    'notte_api_key',
    'sms_api_key',
    'sms_api_secret',
    'spotify_client_secret',
    'staff_pin_code'
]);

export function withoutSecretSettings(obj) {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
        if (!SECRET_SETTING_KEYS.has(k)) out[k] = v;
    });
    return out;
}
