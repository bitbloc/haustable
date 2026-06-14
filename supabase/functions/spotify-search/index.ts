import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse Query Parameters
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query) {
      return new Response(JSON.stringify({ tracks: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Setup Supabase Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Fetch Spotify Credentials from DB
    const { data: idData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'spotify_client_id').maybeSingle()
    const { data: secretData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'spotify_client_secret').maybeSingle()

    const spotifyClientId = idData?.value
    const spotifyClientSecret = secretData?.value

    if (!spotifyClientId || !spotifyClientSecret) {
      console.error('Spotify Client ID or Secret is not configured in app_settings.')
      return new Response(JSON.stringify({ error: 'Spotify integration is not configured. Please set spotify_client_id and spotify_client_secret in settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Request Access Token from Spotify
    const tokenUrl = 'https://accounts.spotify.com/api/token'
    const credentials = btoa(`${spotifyClientId}:${spotifyClientSecret}`)
    
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    })

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text()
      console.error('Spotify Auth Failed:', errBody)
      return new Response(JSON.stringify({ error: 'Spotify authentication failed. Check your API credentials.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { access_token } = await tokenResp.json()

    // 5. Search Tracks on Spotify
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=12`
    const searchResp = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    if (!searchResp.ok) {
      const errBody = await searchResp.text()
      console.error('Spotify Search Failed:', errBody)
      return new Response(JSON.stringify({ error: 'Spotify search request failed.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const searchData = await searchResp.json()
    const tracks = (searchData.tracks?.items || []).map((item: any) => {
      // Find the medium image (typically index 1) or fallback to smallest/largest
      const images = item.album?.images || []
      const albumImage = images[1]?.url || images[0]?.url || ''

      return {
        id: item.id,
        name: item.name,
        artists: (item.artists || []).map((a: any) => a.name).join(', '),
        albumName: item.album?.name || '',
        albumImage,
        duration_ms: item.duration_ms,
        uri: item.uri,
        previewUrl: item.preview_url || ''
      }
    })

    return new Response(JSON.stringify({ tracks }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Spotify Search Function Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
