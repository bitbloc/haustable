import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: settings } = await supabase.from('app_settings').select('*');
  const clientId = settings.find(s => s.key === 'spotify_client_id')?.value;
  const clientSecret = settings.find(s => s.key === 'spotify_client_secret')?.value;

  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    console.log('Token response status:', tokenResp.status, tokenResp.statusText);
    const tokenData = await tokenResp.json();
    const access_token = tokenData.access_token;
    console.log('Access token:', access_token ? 'SUCCESS' : 'FAILED', tokenData);

    // Playlist tracks request
    const playlistId = '37i9dQZF1DXcBWIGg3m31s';
    const playlistTracksUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
    console.log('Sending playlist tracks request to:', playlistTracksUrl);

    const trackResp = await fetch(playlistTracksUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    console.log('Search status:', trackResp.status, trackResp.statusText);
    const trackBody = await trackResp.text();
    console.log('Search body:', trackBody.substring(0, 1000));

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
