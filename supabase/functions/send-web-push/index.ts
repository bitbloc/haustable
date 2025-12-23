
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VAPID Keys (Ideally these should be in Secrets, but for ease of setup we put them here as requested)
const publicVapidKey = "BIdzmSkckPWxlQPKaJDo7og5NvuzLgbAgFft3hW9J_80a0YAIY_9Aqg1e4ozrm44Zg0_gog_RzkYhLtJPVpLwYE";
const privateVapidKey = "SNw3uEcFZ2EPMevMKWPas7CjQZA2YiZwqsPPquYO78A";

webpush.setVapidDetails(
  'mailto:admin@inthehaus.com',
  publicVapidKey,
  privateVapidKey
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { title, body, url, type } = await req.json()

    // Query all subscriptions (In production, you might want to filter by user role or ID)
    // For Staff View, we want to notify ALL registered staff who have subscribed.
    // Assuming 'push_subscriptions' stores subscriptions for staff.
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')

    if (error) throw error

    console.log(`Found ${subscriptions.length} subscriptions`)

    const payload = JSON.stringify({
      title: title || 'New Notification',
      body: body || 'You have a new update.',
      url: url || '/',
      icon: '/pwa-icon.png'
    })

    const promises = subscriptions.map((sub) => {
        // Construct the subscription object expected by web-push
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
        };

        return webpush.sendNotification(pushSubscription, payload)
            .catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription has expired or is no longer valid
                    console.log(`Subscription ${sub.id} expired, deleting...`)
                    return supabaseClient.from('push_subscriptions').delete().eq('id', sub.id)
                }
                console.error('Error sending push:', err)
                return err
            })
    })

    await Promise.all(promises)

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
