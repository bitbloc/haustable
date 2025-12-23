
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10"
import webpush from "https://esm.sh/web-push@3.6.7?target=deno&no-check"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const publicVapidKey = "BIdzmSkckPWxlQPKaJDo7og5NvuzLgbAgFft3hW9J_80a0YAIY_9Aqg1e4ozrm44Zg0_gog_RzkYhLtJPVpLwYE";
const privateVapidKey = "SNw3uEcFZ2EPMevMKWPas7CjQZA2YiZwqsPPquYO78A";

// Set VAPID details inside handler or try-catch block to prevent cold start crashes if something is wrong
try {
    webpush.setVapidDetails(
      'mailto:admin@inthehaus.com',
      publicVapidKey,
      privateVapidKey
    );
} catch (e) {
    console.error("VAPID Setup Error:", e);
}

Deno.serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { title, body, url } = await req.json()

    // Query all subscriptions (In production, you might want to filter by user role or ID)
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')

    if (error) {
        console.error("Db Error:", error)
        throw error
    }

    console.log(`Found ${subscriptions ? subscriptions.length : 0} subscriptions`)
    
    if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ success: true, count: 0, message: "No subscribers" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const payload = JSON.stringify({
      title: title || 'New Notification',
      body: body || 'You have a new update.',
      url: url || '/',
      icon: '/pwa-icon.png'
    })

    const promises = subscriptions.map((sub) => {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
        };

        return webpush.sendNotification(pushSubscription, payload)
            .catch(async (err) => {
                // Check specifically for common "Gone" or "Not Found" status codes
                // WebPush library throws an error object with statusCode
                const statusCode = err.statusCode || err.code;
                
                if (statusCode === 410 || statusCode === 404) {
                    console.log(`Subscription ${sub.id} expired (Status ${statusCode}). Deleting...`);
                    // Clean up valid but dead subscription
                    await supabaseClient
                        .from('push_subscriptions')
                        .delete()
                        .eq('id', sub.id);
                } else {
                    console.error('Error sending push to:', sub.id, err.message);
                }
                return null;
            })
    })

    await Promise.all(promises)

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Handler Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
