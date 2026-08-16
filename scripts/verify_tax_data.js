import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, created_at, booking_time, total_amount, status')
    .gte('created_at', '2026-01-01T00:00:00.000Z')
    .lte('created_at', '2026-12-31T23:59:59.999Z');

  if (error) {
    console.error('Query error:', error);
    return;
  }

  const completed = (bookings || []).filter(b => b.status === 'completed' || b.status === 'confirmed');
  const sum = completed.reduce((s, b) => s + Number(b.total_amount || 0), 0);

  const jan = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-01')).reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const feb = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-02')).reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const mar = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-03')).reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const apr = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-04')).reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const may = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-05')).reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const jun = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-06')).reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const jul = completed.filter(b => (b.booking_time || b.created_at).startsWith('2026-07')).reduce((s, b) => s + Number(b.total_amount || 0), 0);

  const q1 = jan + feb + mar;
  const q2 = apr + may + jun;

  console.log('=== 2026 POS REVENUE BREAKDOWN (JAN - JUL 2026) ===');
  console.log(`Total Completed Bookings: ${completed.length}`);
  console.log(`- January 2026:    ฿${jan.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`- February 2026:   ฿${feb.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`- March 2026:      ฿${mar.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`  >> Q1 Subtotal:  ฿${q1.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: 620,037.80)`);
  console.log(`- April 2026:      ฿${apr.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`- May 2026:        ฿${may.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`- June 2026:       ฿${jun.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`  >> Q2 Subtotal:  ฿${q2.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: 770,202.60)`);
  console.log(`- July 2026:       ฿${jul.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: 327,147.45)`);
  console.log('----------------------------------------------------');
  console.log(`🔥 YTD GROSS TOTAL (Jan - Jul): ฿${sum.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: 1,717,387.85)`);
  console.log(`📊 1.8M VAT Tracker Progress: ${((sum / 1800000) * 100).toFixed(2)}%`);
  console.log(`⚠️ Remaining to 1.8M Threshold: ฿${Math.max(0, 1800000 - sum).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

  const { data: invs } = await supabase.from('tax_invoices').select('*').order('issued_at', { ascending: true });
  console.log('\n=== OFFICIAL TAX INVOICES IN SYSTEM ===');
  console.log(`Total Invoices: ${invs?.length || 0}`);
  (invs || []).forEach((i, idx) => {
    console.log(`${idx + 1}. [${i.invoice_number}] ${i.customer_name} | ฿${Number(i.total_amount).toFixed(2)} | Tax ID: ${i.customer_tax_id} | Issued: ${i.issued_at?.slice(0, 10)}`);
  });

  const { data: custs } = await supabase.from('tax_customer_profiles').select('*').order('company_name', { ascending: true });
  console.log('\n=== REGISTERED TAX CUSTOMER PROFILES ===');
  console.log(`Total Directory Profiles: ${custs?.length || 0}`);
  (custs || []).forEach((c, idx) => {
    console.log(`${idx + 1}. ${c.company_name} | Tax ID: ${c.tax_id}`);
  });
}

check();
