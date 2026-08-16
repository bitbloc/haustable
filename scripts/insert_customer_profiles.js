import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertCustomers() {
  const customerProfiles = [
    {
      company_name: 'บริษัท ฮ็อป อินน์ โฮเต็ล จำกัด (มหาชน) (สำนักงานใหญ่)',
      customer_type: 'company',
      tax_id: '0107568000035',
      branch_type: 'head_office',
      branch_code: '00000',
      address: 'สำนักงานใหญ่',
      notes: 'ลูกค้าตามรายงานภาษีขาย POS เดิม'
    },
    {
      company_name: 'บริษัทโปรทา จำกัด',
      customer_type: 'company',
      tax_id: '0105562141581',
      branch_type: 'head_office',
      branch_code: '00000',
      address: 'สำนักงานใหญ่',
      notes: 'ลูกค้าตามรายงานภาษีขาย POS เดิม'
    }
  ];

  const { data, error } = await supabase.from('tax_customer_profiles').insert(customerProfiles).select();
  if (error) {
    console.error('Error inserting customer profiles:', error);
  } else {
    console.log('✓ Successfully inserted customer profiles:', data);
  }
}

insertCustomers();
