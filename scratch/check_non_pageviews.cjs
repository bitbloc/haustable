const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lxfavbzmebqqsffgyyph.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI');

async function check() {
  const { data, error } = await supabase
    .from('ad_events')
    .select('created_at, event_name, metadata')
    .neq('event_name', 'page_view')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching ad_events:', error);
  } else {
    console.log('Non-page_view events in history:');
    console.table(data?.map(d => ({
      time: d.created_at,
      event: d.event_name,
      referrer: d.metadata?.referrer?.substring(0, 30),
      gclid: d.metadata?.gclid ? 'YES' : 'NO'
    })));
  }
}
check();
