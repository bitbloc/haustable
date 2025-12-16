import { createClient } from "@supabase/supabase-js"

console.log("Hello from send-line-push!")

Deno.serve(async (req) => {
    try {
        const { userId, message, type } = await req.json()
        // type: 'confirm' | 'cancel' | 'custom'

        // 1. Create Supabase Client
        // We need service_role key to access 'app_settings' securely if RLS is strict (though regular user might be fine if RLS allows)
        // Actually, this function will typically be called by authenticated admin.
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 2. Fetch LINE Config from DB
        // We can also use SERVICE_ROLE_KEY if we want to bypass RLS to read settings sure.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: settingsData, error: settingsError } = await supabaseAdmin
            .from('app_settings')
            .select('key, value')
            .in('key', ['line_channel_access_token'])

        if (settingsError) throw settingsError

        const tokenSetting = settingsData.find(s => s.key === 'line_channel_access_token')
        if (!tokenSetting?.value) {
            return new Response(JSON.stringify({ error: 'LINE Token not found in settings' }), { status: 500 })
        }

        const CHANNEL_ACCESS_TOKEN = tokenSetting.value

        // 3. Get User's LINE User ID
        // Check if we have a table mapping user_id -> line_user_id. 
        // In this project, 'profiles' likely stores it if login was via LINE?
        // Wait, the project auth details aren't fully clear on LINE Login. 
        // If the user logs in via simple email, we might NOT know their LINE ID unless we asked for it or used LINE Login.

        // **CRITICAL ASSUMPTION**: User logged in via LINE or we have their LINE ID.
        // If we only have 'phone_number', we cannot send LINE Push unless we use "Multicast" with phone number (NOT SUPPORTED by standard API, usually needs User ID).
        // LINE Notification API (different from Messaging API) can use tokens.

        // Let's assume 'profiles' table has 'provider_token' or similar if they used LINE login, 
        // OR we are fetching `line_user_id`.
        // Let's look at `bookings` -> `user_id`.

        // Actually, for this MVP, if we don't have LINE Login, we CANNOT Push Message to them unless they added the bot and we captured their ID via webhook.
        // IF the user is just a web-user, this feature might be dead on arrival without LINE Login.
        // BUT usually 'LINE OA' implies we want to msg them.

        // *Workaround for now*: We'll assume the 'user_id' in bookings IS the LINE User ID (if using LIFF login) OR we fetch it from profiles.
        // Let's fetch the profile to see if there's a stored LINE ID.

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, line_user_id') // Hypothetical field
            .eq('id', userId)
            .single()

        // Use userId directly if profile lookup fails/irrelevant (e.g. if the auth provider ID IS the line ID)
        const targetLineId = profile?.line_user_id || userId

        // 4. Send Message to LINE API
        const resp = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: targetLineId,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            }),
        })

        if (!resp.ok) {
            const errorText = await resp.text()
            console.error("LINE API Error:", errorText)
            return new Response(JSON.stringify({ error: 'Failed to send to LINE', details: errorText }), { status: resp.status })
        }

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
