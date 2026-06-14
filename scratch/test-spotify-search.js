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

    const { access_token } = await tokenResp.json();

    // Blinding Lights by The Weeknd
    const trackId = '4Li2WHPv7gaIPnZyaIInJ9';
    const trackUrl = `https://api.spotify.com/v1/tracks/${trackId}`;
    console.log('Sending track details request to:', trackUrl);

    const trackResp = await fetch(trackUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    console.log('Track status:', trackResp.status, trackResp.statusText);
    const trackBody = await trackResp.text();
    console.log('Track body:', trackBody.substring(0, 1000));

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
