import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

// All rows from the Tax Sale Report April - June 2026 PDF
const rawRowsQ2 = [
  // Page 1
  { date: '2026-04-01', inv: 'ก/00002439 - ก/00002449', amount: 9315.00 },
  { date: '2026-04-01', inv: 'INTHEHAUS/00005031 - INTHEHAUS/00005034', amount: 1350.60 },
  { date: '2026-04-02', inv: 'ก/00002450 - ก/00002460', amount: 2515.00 },
  { date: '2026-04-02', inv: 'INTHEHAUS/00005035 - INTHEHAUS/00005037', amount: 781.30 },
  { date: '2026-04-03', inv: 'ก/00002461 - ก/00002474', amount: 9908.00 },
  { date: '2026-04-03', inv: 'INTHEHAUS/00005038 - INTHEHAUS/00005041', amount: 903.30 },
  { date: '2026-04-04', inv: 'ก/00002475 - ก/00002495', amount: 7553.00 },
  { date: '2026-04-06', inv: 'ก/00002496 - ก/00002516', amount: 10803.40 },
  { date: '2026-04-06', inv: 'INTHEHAUS/00005042 - INTHEHAUS/00005043', amount: 1590.30 },
  { date: '2026-04-07', inv: 'ก/00002517 - ก/00002534', amount: 11002.00 },
  { date: '2026-04-07', inv: 'INTHEHAUS/00005044 - INTHEHAUS/00005045', amount: 643.50 },
  { date: '2026-04-08', inv: 'ก/00002535 - ก/00002545', amount: 6807.00 },
  { date: '2026-04-08', inv: 'INTHEHAUS/00005046 - INTHEHAUS/00005047', amount: 1023.60 },
  { date: '2026-04-09', inv: 'ก/00002546 - ก/00002558', amount: 5045.00 },
  { date: '2026-04-09', inv: 'INTHEHAUS/00005048 - INTHEHAUS/00005049', amount: 495.30 },
  { date: '2026-04-10', inv: 'ก/00002559 - ก/00002576', amount: 9195.00 },
  { date: '2026-04-10', inv: 'INTHEHAUS/00005050 - INTHEHAUS/00005054', amount: 2159.10 },
  { date: '2026-04-11', inv: 'ก/00002577 - ก/00002588', amount: 4197.00 },
  { date: '2026-04-11', inv: 'INTHEHAUS/00005055 - INTHEHAUS/00005056', amount: 387.00 },
  { date: '2026-04-12', inv: 'ก/00002589 - ก/00002613', amount: 15032.00 },
  { date: '2026-04-12', inv: 'INTHEHAUS/00005057 - INTHEHAUS/00005058', amount: 878.40 },
  { date: '2026-04-13', inv: 'ก/00002614 - ก/00002619', amount: 4400.00 },
  { date: '2026-04-13', inv: 'INTHEHAUS/00005059 - INTHEHAUS/00005062', amount: 2110.00 },
  { date: '2026-04-16', inv: 'ก/00002620 - ก/00002638', amount: 11588.35 },
  { date: '2026-04-16', inv: 'INTHEHAUS/00005063 - INTHEHAUS/00005068', amount: 2507.00 },

  // Page 2
  { date: '2026-04-17', inv: 'ก/00002639 - ก/00002650', amount: 7949.00 },
  { date: '2026-04-17', inv: 'INTHEHAUS/00005069 - INTHEHAUS/00005070', amount: 413.00 },
  { date: '2026-04-18', inv: 'ก/00002651 - ก/00002663', amount: 9287.00 },
  { date: '2026-04-18', inv: 'INTHEHAUS/00005071 - INTHEHAUS/00005072', amount: 244.60 },
  { date: '2026-04-19', inv: 'ก/00002664 - ก/00002674', amount: 8333.00 },
  { date: '2026-04-19', inv: 'INTHEHAUS/00005073 - INTHEHAUS/00005075', amount: 674.00 },
  { date: '2026-04-20', inv: 'ก/00002675 - ก/00002680', amount: 2689.00 },
  { date: '2026-04-21', inv: 'ก/00002681 - ก/00002696', amount: 8239.50 },
  { date: '2026-04-21', inv: 'INTHEHAUS/00005076 - INTHEHAUS/00005077', amount: 460.20 },
  { date: '2026-04-22', inv: 'ก/00002697 - ก/00002711', amount: 7783.00 },
  { date: '2026-04-22', inv: 'INTHEHAUS/00005078 - INTHEHAUS/00005078', amount: 483.30 },
  { date: '2026-04-23', inv: 'ก/00002712 - ก/00002730', amount: 8010.50 },
  { date: '2026-04-23', inv: 'INTHEHAUS/00005079 - INTHEHAUS/00005079', amount: 892.80 },
  { date: '2026-04-24', inv: 'ก/00002731 - ก/00002743', amount: 11999.00 },
  { date: '2026-04-24', inv: 'INTHEHAUS/00005080 - INTHEHAUS/00005083', amount: 825.40 },
  { date: '2026-04-25', inv: 'ก/00002744 - ก/00002762', amount: 9713.00 },
  { date: '2026-04-25', inv: 'INTHEHAUS/00005084 - INTHEHAUS/00005085', amount: 475.00 },
  { date: '2026-04-26', inv: 'ก/00002763 - ก/00002776', amount: 6039.50 },
  { date: '2026-04-27', inv: 'ก/00002777 - ก/00002786', amount: 7145.00 },
  { date: '2026-04-28', inv: 'ก/00002787 - ก/00002796', amount: 5112.00 },
  { date: '2026-04-28', inv: 'INTHEHAUS/00005086 - INTHEHAUS/00005088', amount: 529.00 },
  { date: '2026-04-29', inv: 'ก/00002797 - ก/00002812', amount: 7102.00 },
  { date: '2026-04-29', inv: 'INTHEHAUS/00005089 - INTHEHAUS/00005090', amount: 244.00 },
  { date: '2026-04-30', inv: 'ก/00002813 - ก/00002827', amount: 10973.00 },
  { date: '2026-04-30', inv: 'INTHEHAUS/00005091 - INTHEHAUS/00005091', amount: 194.00 },
  { date: '2026-05-01', inv: 'ก/00002828 - ก/00002845', amount: 9460.50 },
  { date: '2026-05-01', inv: 'INTHEHAUS/00005092 - INTHEHAUS/00005093', amount: 308.00 },
  { date: '2026-05-02', inv: 'ก/00002846 - ก/00002860', amount: 7481.00 },
  { date: '2026-05-02', inv: 'INTHEHAUS/00005094 - INTHEHAUS/00005095', amount: 274.00 },
  { date: '2026-05-03', inv: 'ก/00002861 - ก/00002875', amount: 8997.00 },
  { date: '2026-05-03', inv: 'INTHEHAUS/00005096 - INTHEHAUS/00005097', amount: 654.00 },
  { date: '2026-05-04', inv: 'ก/00002876 - ก/00002885', amount: 4079.30 },
  { date: '2026-05-04', inv: 'INTHEHAUS/00005098 - INTHEHAUS/00005099', amount: 1230.90 },

  // Page 3
  { date: '2026-05-05', inv: 'ก/00002886 - ก/00002899', amount: 7141.00 },
  { date: '2026-05-05', inv: 'INTHEHAUS/00005100 - INTHEHAUS/00005105', amount: 1799.60 },
  { date: '2026-05-06', inv: 'ก/00002900 - ก/00002910', amount: 3880.20 },
  { date: '2026-05-07', inv: 'ก/00002911 - ก/00002920', amount: 5569.15 },
  { date: '2026-05-07', inv: 'INTHEHAUS/00005106 - INTHEHAUS/00005106', amount: 801.90 },
  { date: '2026-05-08', inv: 'ก/00002921 - ก/00002925', amount: 2470.00 },
  { date: '2026-05-08', inv: 'INTHEHAUS/00005107 - INTHEHAUS/00005107', amount: 1332.90 },
  { date: '2026-05-09', inv: 'ก/00002926 - ก/00002943', amount: 14893.00 },
  { date: '2026-05-09', inv: 'INTHEHAUS/00005108 - INTHEHAUS/00005110', amount: 901.20 },
  { date: '2026-05-10', inv: 'ก/00002944 - ก/00002956', amount: 7067.00 },
  { date: '2026-05-10', inv: 'INTHEHAUS/00005111 - INTHEHAUS/00005111', amount: 442.80 },
  { date: '2026-05-11', inv: 'ก/00002957 - ก/00002970', amount: 6529.00 },
  { date: '2026-05-11', inv: 'INTHEHAUS/00005112 - INTHEHAUS/00005114', amount: 492.00 },
  { date: '2026-05-12', inv: 'ก/00002971 - ก/00002986', amount: 8693.00 },
  { date: '2026-05-12', inv: 'INTHEHAUS/00005115 - INTHEHAUS/00005117', amount: 531.00 },
  { date: '2026-05-13', inv: 'ก/00002987 - ก/00002999', amount: 8511.00 },
  { date: '2026-05-13', inv: 'INTHEHAUS/00005118 - INTHEHAUS/00005122', amount: 2354.90 },
  { date: '2026-05-14', inv: 'ก/00003000 - ก/00003015', amount: 9554.00 },
  { date: '2026-05-14', inv: 'INTHEHAUS/00005123 - INTHEHAUS/00005123', amount: 207.00 },
  { date: '2026-05-15', inv: 'ก/00003016 - ก/00003027', amount: 6874.00 },
  { date: '2026-05-15', inv: 'INTHEHAUS/00005124 - INTHEHAUS/00005126', amount: 735.10 },
  { date: '2026-05-16', inv: 'ก/00003028 - ก/00003036', amount: 4869.00 },
  { date: '2026-05-16', inv: 'INTHEHAUS/00005127 - INTHEHAUS/00005128', amount: 612.70 },
  { date: '2026-05-17', inv: 'ก/00003037 - ก/00003051', amount: 8495.00 },
  { date: '2026-05-17', inv: 'INTHEHAUS/00005129 - INTHEHAUS/00005130', amount: 645.20 },
  { date: '2026-05-18', inv: 'ก/00003052 - ก/00003056', amount: 2121.00 },
  { date: '2026-05-18', inv: 'INTHEHAUS/00005131 - INTHEHAUS/00005133', amount: 962.00 },
  { date: '2026-05-19', inv: 'ก/00003057 - ก/00003068', amount: 7384.00 },
  { date: '2026-05-19', inv: 'INTHEHAUS/00005134 - INTHEHAUS/00005135', amount: 537.20 },
  { date: '2026-05-20', inv: 'ก/00003069 - ก/00003079', amount: 10991.75 },
  { date: '2026-05-20', inv: 'INTHEHAUS/00005136 - INTHEHAUS/00005137', amount: 459.00 },
  { date: '2026-05-21', inv: 'ก/00003080 - ก/00003084', amount: 4036.00 },
  { date: '2026-05-21', inv: 'INTHEHAUS/00005138 - INTHEHAUS/00005140', amount: 1127.70 },

  // Page 4
  { date: '2026-05-22', inv: 'ก/00003085 - ก/00003097', amount: 6117.00 },
  { date: '2026-05-22', inv: 'INTHEHAUS/00005141 - INTHEHAUS/00005141', amount: 190.00 },
  { date: '2026-05-23', inv: 'ก/00003098 - ก/00003116', amount: 11026.00 },
  { date: '2026-05-23', inv: 'INTHEHAUS/00005142 - INTHEHAUS/00005142', amount: 129.00 },
  { date: '2026-05-24', inv: 'ก/00003117 - ก/00003123', amount: 1877.00 },
  { date: '2026-05-24', inv: 'INTHEHAUS/00005143 - INTHEHAUS/00005145', amount: 1017.30 },
  { date: '2026-05-25', inv: 'ก/00003124 - ก/00003135', amount: 6303.00 },
  { date: '2026-05-25', inv: 'INTHEHAUS/00005146 - INTHEHAUS/00005149', amount: 830.00 },
  { date: '2026-05-26', inv: 'ก/00003136 - ก/00003149', amount: 8859.00 },
  { date: '2026-05-27', inv: 'ก/00003150 - ก/00003163', amount: 8593.00 },
  { date: '2026-05-27', inv: 'INTHEHAUS/00005150 - INTHEHAUS/00005152', amount: 750.30 },
  { date: '2026-05-28', inv: 'ก/00003164 - ก/00003175', amount: 6426.00 },
  { date: '2026-05-28', inv: 'INTHEHAUS/00005153 - INTHEHAUS/00005154', amount: 676.30 },
  { date: '2026-05-29', inv: 'ก/00003176 - ก/00003193', amount: 10838.00 },
  { date: '2026-05-29', inv: 'INTHEHAUS/00005155 - INTHEHAUS/00005155', amount: 129.00 },
  { date: '2026-05-30', inv: 'ก/00003194 - ก/00003215', amount: 14861.00 },
  { date: '2026-05-31', inv: 'ก/00003216 - ก/00003232', amount: 10217.00 },
  { date: '2026-06-01', inv: 'ก/00003233 - ก/00003252', amount: 9735.00 },
  { date: '2026-06-01', inv: 'INTHEHAUS/00005156 - INTHEHAUS/00005156', amount: 1695.60 },
  { date: '2026-06-02', inv: 'ก/00003253 - ก/00003274', amount: 10110.00 },
  { date: '2026-06-02', inv: 'INTHEHAUS/00005157 - INTHEHAUS/00005159', amount: 599.00 },
  { date: '2026-06-03', inv: 'ก/00003275 - ก/00003287', amount: 8105.00 },
  { date: '2026-06-03', inv: 'INTHEHAUS/00005160 - INTHEHAUS/00005160', amount: 493.20 },
  { date: '2026-06-04', inv: 'ก/00003288 - ก/00003300', amount: 5729.50 },
  { date: '2026-06-04', inv: 'INTHEHAUS/00005161 - INTHEHAUS/00005164', amount: 831.00 },
  { date: '2026-06-05', inv: 'ก/00003301 - ก/00003308', amount: 3408.50 },
  { date: '2026-06-05', inv: 'INTHEHAUS/00005165 - INTHEHAUS/00005166', amount: 518.70 },
  { date: '2026-06-06', inv: 'ก/00003309 - ก/00003327', amount: 8419.00 },
  { date: '2026-06-06', inv: 'INTHEHAUS/00005167 - INTHEHAUS/00005172', amount: 1869.50 },
  { date: '2026-07-07', inv: 'ก/00003328 - ก/00003349', amount: 14498.00 }, // Note date 07/06/2026
  { date: '2026-06-07', inv: 'INTHEHAUS/00005173 - INTHEHAUS/00005174', amount: 465.00 },
  { date: '2026-06-08', inv: 'ก/00003350 - ก/00003365', amount: 9858.00 },
  { date: '2026-06-08', inv: 'INTHEHAUS/00005175 - INTHEHAUS/00005177', amount: 494.00 },

  // Page 5
  { date: '2026-06-09', inv: 'ก/00003366 - ก/00003386', amount: 12341.00 },
  { date: '2026-06-09', inv: 'INTHEHAUS/00005178 - INTHEHAUS/00005181', amount: 965.80 },
  { date: '2026-06-10', inv: 'ก/00003387 - ก/00003397', amount: 7005.00 },
  { date: '2026-06-10', inv: 'INTHEHAUS/00005182 - INTHEHAUS/00005184', amount: 583.40 },
  { date: '2026-06-11', inv: 'ก/00003398 - ก/00003409', amount: 4135.00 },
  { date: '2026-06-11', inv: 'INTHEHAUS/00005185 - INTHEHAUS/00005185', amount: 179.00 },
  { date: '2026-06-12', inv: 'ก/00003410 - ก/00003421', amount: 5234.00 },
  { date: '2026-06-12', inv: 'INTHEHAUS/00005186 - INTHEHAUS/00005187', amount: 322.00 },
  { date: '2026-06-13', inv: 'ก/00003422 - ก/00003433', amount: 5903.00 },
  { date: '2026-06-13', inv: 'INTHEHAUS/00005188 - INTHEHAUS/00005191', amount: 877.40 },
  { date: '2026-06-14', inv: 'ก/00003434 - ก/00003450', amount: 8334.00 },
  { date: '2026-06-14', inv: 'INTHEHAUS/00005192 - INTHEHAUS/00005196', amount: 1166.00 },
  { date: '2026-06-15', inv: 'ก/00003451 - ก/00003462', amount: 6517.00 },
  { date: '2026-06-15', inv: 'INTHEHAUS/00005197 - INTHEHAUS/00005202', amount: 1166.00 },
  { date: '2026-06-16', inv: 'ก/00003463 - ก/00003481', amount: 9102.00 },
  { date: '2026-06-16', inv: 'INTHEHAUS/00005203 - INTHEHAUS/00005207', amount: 1740.80 },
  { date: '2026-06-17', inv: 'ก/00003482 - ก/00003503', amount: 12618.00 },
  { date: '2026-06-17', inv: 'INTHEHAUS/00005209 - INTHEHAUS/00005214', amount: 1271.10 },
  { date: '2026-06-18', inv: 'ก/00003504 - ก/00003523', amount: 14878.00 },
  { date: '2026-06-18', inv: 'INTHEHAUS/00005215 - INTHEHAUS/00005224', amount: 2053.00 },
  { date: '2026-06-19', inv: 'ก/00003524 - ก/00003543', amount: 12746.00 },
  { date: '2026-06-19', inv: 'INTHEHAUS/00005225 - INTHEHAUS/00005228', amount: 830.00 },
  { date: '2026-06-20', inv: 'ก/00003544 - ก/00003558', amount: 7812.30 },
  { date: '2026-06-20', inv: 'INTHEHAUS/00005229 - INTHEHAUS/00005232', amount: 507.00 },
  { date: '2026-06-21', inv: 'ก/00003559 - ก/00003572', amount: 5501.00 },
  { date: '2026-06-21', inv: 'INTHEHAUS/00005233 - INTHEHAUS/00005240', amount: 1548.00 },
  { date: '2026-06-22', inv: 'ก/00003573 - ก/00003582', amount: 3879.00 },
  { date: '2026-06-22', inv: 'INTHEHAUS/00005241 - INTHEHAUS/00005243', amount: 599.00 },
  { date: '2026-06-23', inv: 'ก/00003583 - ก/00003595', amount: 6250.00 },
  { date: '2026-06-23', inv: 'INTHEHAUS/00005244 - INTHEHAUS/00005245', amount: 488.20 },
  { date: '2026-06-24', inv: 'ก/00003596 - ก/00003605', amount: 4713.00 },
  { date: '2026-06-24', inv: 'INTHEHAUS/00005246 - INTHEHAUS/00005250', amount: 1288.20 },
  { date: '2026-06-25', inv: 'ก/00003606 - ก/00003613', amount: 2652.00 },

  // Page 6
  { date: '2026-06-25', inv: 'INTHEHAUS/00005251 - INTHEHAUS/00005254', amount: 1266.10 },
  { date: '2026-06-26', inv: 'ก/00003614 - ก/00003625', amount: 7943.65 },
  { date: '2026-06-26', inv: 'INTHEHAUS/00005255 - INTHEHAUS/00005260', amount: 1883.20 },
  { date: '2026-06-27', inv: 'ก/00003626 - ก/00003637', amount: 6813.00 },
  { date: '2026-06-28', inv: 'ก/00003638 - ก/00003659', amount: 9713.00 },
  { date: '2026-06-28', inv: 'INTHEHAUS/00005261 - INTHEHAUS/00005266', amount: 1245.00 },
  { date: '2026-06-29', inv: 'ก/00003660 - ก/00003676', amount: 15192.00 },
  { date: '2026-06-30', inv: 'ก/00003677 - ก/00003696', amount: 10668.60 },
  { date: '2026-06-30', inv: 'INTHEHAUS/00005267 - INTHEHAUS/00005270', amount: 1100.00 },
];

// Fix row 07/06/2026 if typo in date
const normalizedRows = rawRowsQ2.map(r => {
  if (r.date === '2026-07-07' && r.inv.includes('3328')) {
    return { ...r, date: '2026-06-07' };
  }
  return r;
});

const totalSumQ2 = normalizedRows.reduce((s, r) => s + r.amount, 0);
console.log(`Total Q2 Rows: ${normalizedRows.length}`);
console.log(`Calculated Q2 Grand Total: ${totalSumQ2.toFixed(2)} (Expected: 770202.60)`);

async function runSeedQ2() {
  // 1. Insert Customer Profiles from Page 7
  console.log('1. Inserting Customer Profiles from Page 7...');
  const customerProfilesQ2 = [
    {
      company_name: 'บริษัท เวิลด์เทรนนิ่ง จำกัด ( สำนักงานใหญ่ )',
      customer_type: 'company',
      tax_id: '0905555001144',
      branch_type: 'head_office',
      branch_code: '00000',
      address: 'สำนักงานใหญ่',
      notes: 'ลูกค้าตามรายงานภาษีขาย POS เดิม (Q2)'
    },
    {
      company_name: 'บริษัท เน็ก เจนเนอร์เรชั่น จีโนมิค จำกัด',
      customer_type: 'company',
      tax_id: '0105557155065',
      branch_type: 'head_office',
      branch_code: '00000',
      address: 'สำนักงานใหญ่',
      notes: 'ลูกค้าตามรายงานภาษีขาย POS เดิม (Q2)'
    },
    {
      company_name: 'บริษัท บีโอ เมริเยอร์ (ประเทศไทย) จำกัด (สำนักงานใหญ่)',
      customer_type: 'company',
      tax_id: '0105543872545',
      branch_type: 'head_office',
      branch_code: '00000',
      address: 'สำนักงานใหญ่',
      notes: 'ลูกค้าตามรายงานภาษีขาย POS เดิม (Q2)'
    }
  ];

  for (const prof of customerProfilesQ2) {
    const { data: existing } = await supabase.from('tax_customer_profiles').select('id').eq('tax_id', prof.tax_id).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('tax_customer_profiles').update(prof).eq('id', existing[0].id);
      console.log(`✓ Updated customer profile ${prof.company_name}`);
    } else {
      await supabase.from('tax_customer_profiles').insert([prof]);
      console.log(`✓ Inserted customer profile ${prof.company_name}`);
    }
  }

  // 2. Insert Full Tax Invoices from Page 7
  console.log('2. Inserting Full Tax Invoices from Page 7...');
  const taxInvoicesQ2 = [
    {
      invoice_number: 'INV-202604-0003',
      doc_type: 'receipt',
      customer_type: 'company',
      customer_name: 'บริษัท เวิลด์เทรนนิ่ง จำกัด ( สำนักงานใหญ่ )',
      customer_tax_id: '0905555001144',
      customer_branch_type: 'head_office',
      customer_branch_code: '00000',
      customer_address: 'สำนักงานใหญ่',
      subtotal: 900.00,
      discount_amount: 0.00,
      pre_vat_amount: 900.00,
      vat_rate: 0.00,
      vat_amount: 0.00,
      total_amount: 900.00,
      wht_rate: 0.00,
      wht_amount: 0.00,
      net_payable: 900.00,
      payment_method: 'CASH',
      items: [
        { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: 900.00 }
      ],
      issuer_name: 'ร้านในบ้าน นครพนม',
      issuer_tax_id: '1120100144907',
      issuer_branch: '00000',
      issuer_address: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม',
      status: 'issued',
      notes: 'ออกแทนใบเสร็จอย่างย่อ ก/00002491 (Document No: 26000003, POS ID: H1)',
      issued_at: '2026-04-04T12:00:00.000Z'
    },
    {
      invoice_number: 'INV-202604-0004',
      doc_type: 'receipt',
      customer_type: 'company',
      customer_name: 'บริษัท เน็ก เจนเนอร์เรชั่น จีโนมิค จำกัด',
      customer_tax_id: '0105557155065',
      customer_branch_type: 'head_office',
      customer_branch_code: '00000',
      customer_address: 'สำนักงานใหญ่',
      subtotal: 1362.00,
      discount_amount: 0.00,
      pre_vat_amount: 1362.00,
      vat_rate: 0.00,
      vat_amount: 0.00,
      total_amount: 1362.00,
      wht_rate: 0.00,
      wht_amount: 0.00,
      net_payable: 1362.00,
      payment_method: 'CASH',
      items: [
        { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: 1362.00 }
      ],
      issuer_name: 'ร้านในบ้าน นครพนม',
      issuer_tax_id: '1120100144907',
      issuer_branch: '00000',
      issuer_address: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม',
      status: 'issued',
      notes: 'ออกแทนใบเสร็จอย่างย่อ ก/00002696 (Document No: 26000004, POS ID: H1)',
      issued_at: '2026-04-21T12:00:00.000Z'
    },
    {
      invoice_number: 'INV-202606-0005',
      doc_type: 'receipt',
      customer_type: 'company',
      customer_name: 'บริษัท บีโอ เมริเยอร์ (ประเทศไทย) จำกัด (สำนักงานใหญ่)',
      customer_tax_id: '0105543872545',
      customer_branch_type: 'head_office',
      customer_branch_code: '00000',
      customer_address: 'สำนักงานใหญ่',
      subtotal: 382.00,
      discount_amount: 0.00,
      pre_vat_amount: 382.00,
      vat_rate: 0.00,
      vat_amount: 0.00,
      total_amount: 382.00,
      wht_rate: 0.00,
      wht_amount: 0.00,
      net_payable: 382.00,
      payment_method: 'CASH',
      items: [
        { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: 382.00 }
      ],
      issuer_name: 'ร้านในบ้าน นครพนม',
      issuer_tax_id: '1120100144907',
      issuer_branch: '00000',
      issuer_address: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม',
      status: 'issued',
      notes: 'ออกแทนใบเสร็จอย่างย่อ ก/00003355 (Document No: 26000005, POS ID: H1)',
      issued_at: '2026-06-08T12:00:00.000Z'
    }
  ];

  for (const inv of taxInvoicesQ2) {
    const { error: invErr } = await supabase.from('tax_invoices').upsert(inv, { onConflict: 'invoice_number' });
    if (invErr) console.error(`tax_invoices error for ${inv.invoice_number}:`, invErr);
    else console.log(`✓ tax_invoice ${inv.invoice_number} seeded`);
  }

  // 3. Insert Daily POS Historical Bookings for April - June 2026
  console.log('3. Inserting Daily POS Historical Bookings for Q2 (Apr - Jun)...');
  const bookingsToInsert = normalizedRows.map((row) => ({
    booking_time: `${row.date}T18:00:00.000Z`,
    created_at: `${row.date}T18:00:00.000Z`,
    status: 'completed',
    total_amount: row.amount,
    deposit_amount: row.amount,
    booking_type: row.inv.includes('INTHEHAUS') ? 'dine_in' : 'pickup',
    staff_remark: `POS เก่า (POS ID: H1, บิล: ${row.inv})`,
    pickup_contact_name: 'Sale summary report (POS เก่า Q2)',
    pax: 1
  }));

  // Batch insert into bookings in chunks of 50
  for (let i = 0; i < bookingsToInsert.length; i += 50) {
    const chunk = bookingsToInsert.slice(i, i + 50);
    const { data: bData, error: bErr } = await supabase.from('bookings').insert(chunk).select('id');
    if (bErr) {
      console.error(`bookings insert error at chunk ${i}:`, bErr);
    } else {
      console.log(`✓ Inserted Q2 bookings chunk ${i + 1} - ${i + chunk.length}`);
    }
  }

  console.log('✅ ALL Q2 HISTORICAL DATA SEEDED SUCCESSFULLY!');
}

runSeedQ2();
