import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: settingsData } = await supabase.from('app_settings').select('*');
  const appSettings = settingsData?.reduce((acc, curr) => {
    acc[curr.setting_key] = curr.setting_value
    return acc
  }, {}) || {};

  const CHANNEL_SECRET = appSettings.line_channel_secret;

  const payload = {
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          text: 'stback'
        },
        replyToken: 'dummyToken123',
        source: {
          type: 'user',
          userId: 'dummyUserId123'
        }
      }
    ]
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('SHA256', CHANNEL_SECRET).update(body).digest('base64');

  const resp = await fetch('https://lxfavbzmebqqsffgyyph.supabase.co/functions/v1/line-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': signature
    },
    body: body
  });

  const txt = await resp.text();
  console.log('Status:', resp.status);
  console.log('Response:', txt);
}

run();
