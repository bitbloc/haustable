import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const supabase = createClient(supabaseUrl, supabaseKey);

// All rows from the Tax Sale Report Jan - Mar 2026 PDF
const rawRows = [
  // Page 1
  { date: '2026-01-01', inv: 'ก/00001357 - ก/00001393', amount: 20268.00 },
  { date: '2026-01-01', inv: 'INTHEHAUS/00004729 - INTHEHAUS/00004734', amount: 1607.70 },
  { date: '2026-01-02', inv: 'ก/00001394 - ก/00001430', amount: 15867.00 },
  { date: '2026-01-02', inv: 'INTHEHAUS/00004735 - INTHEHAUS/00004740', amount: 2353.00 },
  { date: '2026-01-03', inv: 'ก/00001431 - ก/00001461', amount: 13996.00 },
  { date: '2026-01-03', inv: 'INTHEHAUS/00004741 - INTHEHAUS/00004744', amount: 1160.70 },
  { date: '2026-01-04', inv: 'ก/00001462 - ก/00001485', amount: 15155.00 },
  { date: '2026-01-04', inv: 'INTHEHAUS/00004745 - INTHEHAUS/00004752', amount: 1999.90 },
  { date: '2026-01-05', inv: 'ก/00001486 - ก/00001501', amount: 7379.30 },
  { date: '2026-01-05', inv: 'INTHEHAUS/00004753 - INTHEHAUS/00004756', amount: 953.30 },
  { date: '2026-01-09', inv: 'ก/00001503 - ก/00001510', amount: 2921.30 },
  { date: '2026-01-09', inv: 'INTHEHAUS/00004757 - INTHEHAUS/00004759', amount: 641.00 },
  { date: '2026-01-10', inv: 'ก/00001511 - ก/00001522', amount: 7795.00 },
  { date: '2026-01-10', inv: 'INTHEHAUS/00004760 - INTHEHAUS/00004764', amount: 2003.40 },
  { date: '2026-01-11', inv: 'ก/00001523 - ก/00001533', amount: 4006.00 },
  { date: '2026-01-11', inv: 'INTHEHAUS/00004765 - INTHEHAUS/00004768', amount: 693.00 },
  { date: '2026-01-12', inv: 'ก/00001534 - ก/00001541', amount: 4022.00 },
  { date: '2026-01-12', inv: 'INTHEHAUS/00004769 - INTHEHAUS/00004776', amount: 2164.10 },
  { date: '2026-01-13', inv: 'ก/00001542 - ก/00001552', amount: 4838.00 },
  { date: '2026-01-13', inv: 'INTHEHAUS/00004777 - INTHEHAUS/00004780', amount: 813.10 },
  { date: '2026-01-14', inv: 'ก/00001553 - ก/00001559', amount: 5704.00 },
  { date: '2026-01-14', inv: 'INTHEHAUS/00004781 - INTHEHAUS/00004783', amount: 1357.20 },
  { date: '2026-01-15', inv: 'ก/00001560 - ก/00001572', amount: 8734.30 },
  { date: '2026-01-15', inv: 'INTHEHAUS/00004784 - INTHEHAUS/00004787', amount: 613.00 },
  { date: '2026-01-16', inv: 'ก/00001573 - ก/00001588', amount: 5311.00 },

  // Page 2
  { date: '2026-01-16', inv: 'INTHEHAUS/00004788 - INTHEHAUS/00004788', amount: 207.00 },
  { date: '2026-01-17', inv: 'ก/00001589 - ก/00001594', amount: 1977.00 },
  { date: '2026-01-17', inv: 'INTHEHAUS/00004789 - INTHEHAUS/00004789', amount: 207.00 },
  { date: '2026-01-18', inv: 'ก/00001595 - ก/00001601', amount: 3181.00 },
  { date: '2026-01-18', inv: 'INTHEHAUS/00004790 - INTHEHAUS/00004794', amount: 1316.50 },
  { date: '2026-01-19', inv: 'ก/00001602 - ก/00001610', amount: 4381.00 },
  { date: '2026-01-19', inv: 'INTHEHAUS/00004795 - INTHEHAUS/00004796', amount: 465.00 },
  { date: '2026-01-20', inv: 'ก/00001611 - ก/00001622', amount: 3712.00 },
  { date: '2026-01-20', inv: 'INTHEHAUS/00004797 - INTHEHAUS/00004801', amount: 1546.80 },
  { date: '2026-01-21', inv: 'ก/00001623 - ก/00001625', amount: 1672.00 },
  { date: '2026-01-21', inv: 'INTHEHAUS/00004802 - INTHEHAUS/00004803', amount: 303.00 },
  { date: '2026-01-22', inv: 'ก/00001626 - ก/00001642', amount: 6555.00 },
  { date: '2026-01-22', inv: 'INTHEHAUS/00004804 - INTHEHAUS/00004806', amount: 546.00 },
  { date: '2026-01-23', inv: 'ก/00001643 - ก/00001651', amount: 3409.00 },
  { date: '2026-01-23', inv: 'INTHEHAUS/00004807 - INTHEHAUS/00004811', amount: 1083.00 },
  { date: '2026-01-24', inv: 'ก/00001652 - ก/00001653', amount: 1962.65 },
  { date: '2026-01-24', inv: 'INTHEHAUS/00004812 - INTHEHAUS/00004818', amount: 3914.70 },
  { date: '2026-01-25', inv: 'ก/00001654 - ก/00001664', amount: 5392.00 },
  { date: '2026-01-25', inv: 'INTHEHAUS/00004819 - INTHEHAUS/00004821', amount: 1057.90 },
  { date: '2026-01-26', inv: 'ก/00001665 - ก/00001672', amount: 3262.00 },
  { date: '2026-01-26', inv: 'INTHEHAUS/00004822 - INTHEHAUS/00004825', amount: 2706.30 },
  { date: '2026-01-27', inv: 'ก/00001673 - ก/00001680', amount: 6167.00 },
  { date: '2026-01-27', inv: 'INTHEHAUS/00004826 - INTHEHAUS/00004828', amount: 2349.00 },
  { date: '2026-01-28', inv: 'ก/00001681 - ก/00001685', amount: 1989.00 },
  { date: '2026-01-28', inv: 'INTHEHAUS/00004829 - INTHEHAUS/00004830', amount: 1080.90 },
  { date: '2026-01-29', inv: 'ก/00001686 - ก/00001691', amount: 4498.00 },
  { date: '2026-01-29', inv: 'INTHEHAUS/00004831 - INTHEHAUS/00004835', amount: 1510.50 },
  { date: '2026-01-30', inv: 'ก/00001692 - ก/00001707', amount: 9254.00 },
  { date: '2026-01-30', inv: 'INTHEHAUS/00004836 - INTHEHAUS/00004839', amount: 940.40 },
  { date: '2026-01-31', inv: 'ก/00001708 - ก/00001716', amount: 4562.00 },
  { date: '2026-01-31', inv: 'INTHEHAUS/00004840 - INTHEHAUS/00004842', amount: 834.20 },
  { date: '2026-02-01', inv: 'ก/00001717 - ก/00001730', amount: 4959.00 },
  { date: '2026-02-01', inv: 'INTHEHAUS/00004843 - INTHEHAUS/00004845', amount: 833.40 },

  // Page 3
  { date: '2026-02-02', inv: 'ก/00001731 - ก/00001737', amount: 3182.00 },
  { date: '2026-02-02', inv: 'INTHEHAUS/00004846 - INTHEHAUS/00004848', amount: 552.00 },
  { date: '2026-02-03', inv: 'ก/00001738 - ก/00001750', amount: 7278.50 },
  { date: '2026-02-03', inv: 'INTHEHAUS/00004849 - INTHEHAUS/00004852', amount: 1059.30 },
  { date: '2026-02-04', inv: 'ก/00001751 - ก/00001758', amount: 3828.00 },
  { date: '2026-02-04', inv: 'INTHEHAUS/00004853 - INTHEHAUS/00004856', amount: 968.50 },
  { date: '2026-02-05', inv: 'ก/00001759 - ก/00001768', amount: 4448.00 },
  { date: '2026-02-05', inv: 'INTHEHAUS/00004857 - INTHEHAUS/00004859', amount: 516.00 },
  { date: '2026-02-06', inv: 'ก/00001769 - ก/00001776', amount: 2845.00 },
  { date: '2026-02-06', inv: 'INTHEHAUS/00004860 - INTHEHAUS/00004862', amount: 629.00 },
  { date: '2026-02-07', inv: 'ก/00001777 - ก/00001788', amount: 5969.00 },
  { date: '2026-02-07', inv: 'INTHEHAUS/00004863 - INTHEHAUS/00004866', amount: 805.00 },
  { date: '2026-02-08', inv: 'ก/00001789 - ก/00001796', amount: 4845.00 },
  { date: '2026-02-08', inv: 'INTHEHAUS/00004867 - INTHEHAUS/00004877', amount: 2445.80 },
  { date: '2026-02-09', inv: 'ก/00001797 - ก/00001803', amount: 6455.00 },
  { date: '2026-02-09', inv: 'INTHEHAUS/00004878 - INTHEHAUS/00004880', amount: 677.10 },
  { date: '2026-02-10', inv: 'ก/00001804 - ก/00001816', amount: 5786.00 },
  { date: '2026-02-10', inv: 'INTHEHAUS/00004881 - INTHEHAUS/00004888', amount: 1660.20 },
  { date: '2026-02-11', inv: 'ก/00001817 - ก/00001829', amount: 5899.00 },
  { date: '2026-02-11', inv: 'INTHEHAUS/00004889 - INTHEHAUS/00004891', amount: 571.00 },
  { date: '2026-02-12', inv: 'ก/00001830 - ก/00001835', amount: 2836.00 },
  { date: '2026-02-12', inv: 'INTHEHAUS/00004892 - INTHEHAUS/00004893', amount: 497.00 },
  { date: '2026-02-13', inv: 'ก/00001836 - ก/00001845', amount: 6346.00 },
  { date: '2026-02-13', inv: 'INTHEHAUS/00004894 - INTHEHAUS/00004896', amount: 1069.60 },
  { date: '2026-02-14', inv: 'ก/00001846 - ก/00001884', amount: 20643.00 },
  { date: '2026-02-14', inv: 'INTHEHAUS/00004897 - INTHEHAUS/00004901', amount: 1206.30 },
  { date: '2026-02-15', inv: 'ก/00001885 - ก/00001897', amount: 4706.00 },
  { date: '2026-02-15', inv: 'INTHEHAUS/00004902 - INTHEHAUS/00004905', amount: 1209.60 },
  { date: '2026-02-16', inv: 'ก/00001898 - ก/00001908', amount: 3879.00 },
  { date: '2026-02-16', inv: 'INTHEHAUS/00004906 - INTHEHAUS/00004910', amount: 1529.00 },
  { date: '2026-02-17', inv: 'ก/00001909 - ก/00001922', amount: 5759.00 },
  { date: '2026-02-17', inv: 'INTHEHAUS/00004911 - INTHEHAUS/00004913', amount: 627.00 },
  { date: '2026-02-18', inv: 'ก/00001923 - ก/00001929', amount: 2158.00 },

  // Page 4
  { date: '2026-02-18', inv: 'INTHEHAUS/00004914 - INTHEHAUS/00004918', amount: 1108.40 },
  { date: '2026-02-19', inv: 'ก/00001930 - ก/00001939', amount: 4258.00 },
  { date: '2026-02-19', inv: 'INTHEHAUS/00004919 - INTHEHAUS/00004920', amount: 258.00 },
  { date: '2026-02-20', inv: 'ก/00001940 - ก/00001952', amount: 5866.00 },
  { date: '2026-02-20', inv: 'INTHEHAUS/00004921 - INTHEHAUS/00004926', amount: 1198.40 },
  { date: '2026-02-21', inv: 'ก/00001953 - ก/00001968', amount: 8915.00 },
  { date: '2026-02-21', inv: 'INTHEHAUS/00004927 - INTHEHAUS/00004932', amount: 966.00 },
  { date: '2026-02-22', inv: 'ก/00001969 - ก/00001981', amount: 6032.00 },
  { date: '2026-02-22', inv: 'INTHEHAUS/00004933 - INTHEHAUS/00004936', amount: 898.00 },
  { date: '2026-02-23', inv: 'ก/00001982 - ก/00001989', amount: 2288.00 },
  { date: '2026-02-23', inv: 'INTHEHAUS/00004937 - INTHEHAUS/00004939', amount: 1009.60 },
  { date: '2026-02-24', inv: 'ก/00001990 - ก/00002000', amount: 5822.00 },
  { date: '2026-02-25', inv: 'ก/00002001 - ก/00002013', amount: 6366.00 },
  { date: '2026-02-25', inv: 'INTHEHAUS/00004940 - INTHEHAUS/00004940', amount: 268.00 },
  { date: '2026-02-26', inv: 'ก/00002014 - ก/00002021', amount: 2870.00 },
  { date: '2026-02-26', inv: 'INTHEHAUS/00004941 - INTHEHAUS/00004944', amount: 1139.50 },
  { date: '2026-02-27', inv: 'ก/00002022 - ก/00002032', amount: 5561.45 },
  { date: '2026-02-27', inv: 'INTHEHAUS/00004945 - INTHEHAUS/00004948', amount: 676.00 },
  { date: '2026-02-28', inv: 'ก/00002033 - ก/00002045', amount: 7159.00 },
  { date: '2026-02-28', inv: 'INTHEHAUS/00004949 - INTHEHAUS/00004951', amount: 710.30 },
  { date: '2026-03-01', inv: 'ก/00002046 - ก/00002061', amount: 7783.00 },
  { date: '2026-03-01', inv: 'INTHEHAUS/00004952 - INTHEHAUS/00004955', amount: 1536.70 },
  { date: '2026-03-02', inv: 'ก/00002062 - ก/00002077', amount: 8580.00 },
  { date: '2026-03-02', inv: 'INTHEHAUS/00004956 - INTHEHAUS/00004957', amount: 437.00 },
  { date: '2026-03-03', inv: 'ก/00002078 - ก/00002089', amount: 4374.00 },
  { date: '2026-03-03', inv: 'INTHEHAUS/00004958 - INTHEHAUS/00004960', amount: 1001.30 },
  { date: '2026-03-04', inv: 'ก/00002090 - ก/00002107', amount: 7263.00 },
  { date: '2026-03-04', inv: 'INTHEHAUS/00004961 - INTHEHAUS/00004962', amount: 258.00 },
  { date: '2026-03-05', inv: 'ก/00002108 - ก/00002119', amount: 8650.00 },
  { date: '2026-03-05', inv: 'INTHEHAUS/00004963 - INTHEHAUS/00004963', amount: 159.00 },
  { date: '2026-03-06', inv: 'ก/00002120 - ก/00002130', amount: 4531.00 },
  { date: '2026-03-06', inv: 'INTHEHAUS/00004964 - INTHEHAUS/00004968', amount: 1525.10 },
  { date: '2026-03-07', inv: 'LINE MAN / PICKUP', amount: 429.30 },

  // Page 5
  { date: '2026-03-07', inv: 'ก/00002131 - ก/00002140', amount: 7307.00 },
  { date: '2026-03-08', inv: 'ก/00002141 - ก/00002157', amount: 6292.00 },
  { date: '2026-03-08', inv: 'INTHEHAUS/00004969 - INTHEHAUS/00004970', amount: 1002.60 },
  { date: '2026-03-09', inv: 'ก/00002158 - ก/00002162', amount: 3290.00 },
  { date: '2026-03-09', inv: 'INTHEHAUS/00004971 - INTHEHAUS/00004972', amount: 628.50 },
  { date: '2026-03-10', inv: 'ก/00002163 - ก/00002175', amount: 6493.15 },
  { date: '2026-03-11', inv: 'ก/00002176 - ก/00002181', amount: 1586.00 },
  { date: '2026-03-11', inv: 'INTHEHAUS/00004973 - INTHEHAUS/00004976', amount: 782.50 },
  { date: '2026-03-12', inv: 'ก/00002182 - ก/00002197', amount: 10217.00 },
  { date: '2026-03-12', inv: 'INTHEHAUS/00004977 - INTHEHAUS/00004981', amount: 1307.30 },
  { date: '2026-03-13', inv: 'ก/00002198 - ก/00002211', amount: 8172.75 },
  { date: '2026-03-13', inv: 'INTHEHAUS/00004982 - INTHEHAUS/00004984', amount: 590.10 },
  { date: '2026-03-14', inv: 'ก/00002212 - ก/00002226', amount: 9536.00 },
  { date: '2026-03-14', inv: 'INTHEHAUS/00004985 - INTHEHAUS/00004986', amount: 631.90 },
  { date: '2026-03-15', inv: 'ก/00002227 - ก/00002238', amount: 6346.15 },
  { date: '2026-03-15', inv: 'INTHEHAUS/00004987 - INTHEHAUS/00004987', amount: 129.00 },
  { date: '2026-03-16', inv: 'ก/00002239 - ก/00002252', amount: 5959.00 },
  { date: '2026-03-16', inv: 'INTHEHAUS/00004988 - INTHEHAUS/00004990', amount: 1132.90 },
  { date: '2026-03-17', inv: 'ก/00002253 - ก/00002270', amount: 9516.00 },
  { date: '2026-03-17', inv: 'INTHEHAUS/00004991 - INTHEHAUS/00004992', amount: 487.00 },
  { date: '2026-03-18', inv: 'ก/00002271 - ก/00002280', amount: 3264.00 },
  { date: '2026-03-18', inv: 'INTHEHAUS/00004993 - INTHEHAUS/00004994', amount: 688.20 },
  { date: '2026-03-19', inv: 'ก/00002281 - ก/00002287', amount: 3369.45 },
  { date: '2026-03-19', inv: 'INTHEHAUS/00004995 - INTHEHAUS/00004995', amount: 366.30 },
  { date: '2026-03-20', inv: 'ก/00002288 - ก/00002298', amount: 4967.00 },
  { date: '2026-03-21', inv: 'ก/00002299 - ก/00002316', amount: 11322.00 },
  { date: '2026-03-21', inv: 'INTHEHAUS/00004996 - INTHEHAUS/00004998', amount: 1944.80 },
  { date: '2026-03-22', inv: 'ก/00002317 - ก/00002332', amount: 7176.00 },
  { date: '2026-03-22', inv: 'INTHEHAUS/00004999 - INTHEHAUS/00005000', amount: 1395.90 },
  { date: '2026-03-23', inv: 'ก/00002333 - ก/00002344', amount: 6760.50 },
  { date: '2026-03-23', inv: 'INTHEHAUS/00005001 - INTHEHAUS/00005003', amount: 390.00 },
  { date: '2026-03-24', inv: 'ก/00002345 - ก/00002354', amount: 2821.00 },
  { date: '2026-03-24', inv: 'INTHEHAUS/00005004 - INTHEHAUS/00005009', amount: 2279.70 },

  // Page 6
  { date: '2026-03-25', inv: 'ก/00002355 - ก/00002368', amount: 5860.00 },
  { date: '2026-03-25', inv: 'INTHEHAUS/00005010 - INTHEHAUS/00005010', amount: 1602.00 },
  { date: '2026-03-26', inv: 'ก/00002369 - ก/00002380', amount: 4200.00 },
  { date: '2026-03-26', inv: 'INTHEHAUS/00005011 - INTHEHAUS/00005012', amount: 275.00 },
  { date: '2026-03-27', inv: 'ก/00002381 - ก/00002390', amount: 5957.00 },
  { date: '2026-03-27', inv: 'INTHEHAUS/00005013 - INTHEHAUS/00005015', amount: 389.00 },
  { date: '2026-03-28', inv: 'ก/00002391 - ก/00002402', amount: 4248.00 },
  { date: '2026-03-28', inv: 'INTHEHAUS/00005016 - INTHEHAUS/00005018', amount: 1401.30 },
  { date: '2026-03-29', inv: 'ก/00002403 - ก/00002420', amount: 8724.00 },
  { date: '2026-03-29', inv: 'INTHEHAUS/00005019 - INTHEHAUS/00005024', amount: 1995.60 },
  { date: '2026-03-30', inv: 'ก/00002421 - ก/00002428', amount: 5435.00 },
  { date: '2026-03-30', inv: 'INTHEHAUS/00005025 - INTHEHAUS/00005026', amount: 1338.00 },
  { date: '2026-03-31', inv: 'ก/00002429 - ก/00002438', amount: 5799.00 },
  { date: '2026-03-31', inv: 'INTHEHAUS/00005027 - INTHEHAUS/00005030', amount: 1689.70 },
];

const totalSum = rawRows.reduce((s, r) => s + r.amount, 0);
console.log(`Total Rows: ${rawRows.length}`);
console.log(`Calculated Grand Total: ${totalSum.toFixed(2)} (Expected: 620037.80)`);

async function runSeed() {
  // 1. Update Company Tax Settings
  console.log('1. Updating Company Tax Settings...');
  const settingsEntries = [
    { key: 'tax_company_name', value: 'ร้านในบ้าน นครพนม' },
    { key: 'tax_company_name_en', value: 'IN THE HAUS NAKHON PHANOM' },
    { key: 'tax_id', value: '1120100144907' },
    { key: 'tax_branch_type', value: 'head_office' },
    { key: 'tax_branch_code', value: '00000' },
    { key: 'tax_address', value: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม 48000' },
    { key: 'tax_is_vat_registered', value: 'false' },
    { key: 'tax_vat_rate', value: '7.00' },
    { key: 'tax_vat_model', value: 'inclusive' },
    { key: 'tax_receipt_prefix', value: 'REC' },
    { key: 'tax_invoice_prefix', value: 'INV' }
  ];
  const { error: setErr } = await supabase.from('app_settings').upsert(settingsEntries, { onConflict: 'key' });
  if (setErr) console.error('app_settings error:', setErr);
  else console.log('✓ app_settings updated successfully');

  // 2. Insert Customer Profiles from Page 7
  console.log('2. Inserting Customer Profiles from Page 7...');
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
  for (const prof of customerProfiles) {
    const { data: existing } = await supabase.from('tax_customer_profiles').select('id').eq('tax_id', prof.tax_id).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('tax_customer_profiles').update(prof).eq('id', existing[0].id);
      console.log(`✓ Updated customer profile ${prof.company_name}`);
    } else {
      await supabase.from('tax_customer_profiles').insert([prof]);
      console.log(`✓ Inserted customer profile ${prof.company_name}`);
    }
  }

  // 3. Insert Full Tax Invoices from Page 7
  console.log('3. Inserting Full Tax Invoices from Page 7...');
  const taxInvoices = [
    {
      invoice_number: 'INV-202603-0001',
      doc_type: 'receipt',
      customer_type: 'company',
      customer_name: 'บริษัท ฮ็อป อินน์ โฮเต็ล จำกัด (มหาชน) (สำนักงานใหญ่)',
      customer_tax_id: '0107568000035',
      customer_branch_type: 'head_office',
      customer_branch_code: '00000',
      customer_address: 'สำนักงานใหญ่',
      subtotal: 134.00,
      discount_amount: 0.00,
      pre_vat_amount: 134.00,
      vat_rate: 0.00,
      vat_amount: 0.00,
      total_amount: 134.00,
      wht_rate: 0.00,
      wht_amount: 0.00,
      net_payable: 134.00,
      payment_method: 'CASH',
      items: [
        { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: 134.00 }
      ],
      issuer_name: 'ร้านในบ้าน นครพนม',
      issuer_tax_id: '1120100144907',
      issuer_branch: '00000',
      issuer_address: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม',
      status: 'issued',
      notes: 'ออกแทนใบเสร็จอย่างย่อ ก/00002180 (Document No: 26000001, POS ID: H1)',
      issued_at: '2026-03-11T12:00:00.000Z'
    },
    {
      invoice_number: 'INV-202603-0002',
      doc_type: 'receipt',
      customer_type: 'company',
      customer_name: 'บริษัทโปรทา จำกัด',
      customer_tax_id: '0105562141581',
      customer_branch_type: 'head_office',
      customer_branch_code: '00000',
      customer_address: 'สำนักงานใหญ่',
      subtotal: 314.00,
      discount_amount: 0.00,
      pre_vat_amount: 314.00,
      vat_rate: 0.00,
      vat_amount: 0.00,
      total_amount: 314.00,
      wht_rate: 0.00,
      wht_amount: 0.00,
      net_payable: 314.00,
      payment_method: 'CASH',
      items: [
        { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: 314.00 }
      ],
      issuer_name: 'ร้านในบ้าน นครพนม',
      issuer_tax_id: '1120100144907',
      issuer_branch: '00000',
      issuer_address: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม',
      status: 'issued',
      notes: 'ออกแทนใบเสร็จอย่างย่อ ก/00002200 (Document No: 26000002, POS ID: H1)',
      issued_at: '2026-03-13T12:00:00.000Z'
    }
  ];

  for (const inv of taxInvoices) {
    const { error: invErr } = await supabase.from('tax_invoices').upsert(inv, { onConflict: 'invoice_number' });
    if (invErr) console.error(`tax_invoices error for ${inv.invoice_number}:`, invErr);
    else console.log(`✓ tax_invoice ${inv.invoice_number} seeded`);
  }

  // 4. Insert Daily POS Historical Bookings for 1.8M Tracker & POS Revenue Calculation
  console.log('4. Inserting Daily POS Historical Bookings...');
  const bookingsToInsert = rawRows.map((row, index) => ({
    booking_time: `${row.date}T18:00:00.000Z`,
    created_at: `${row.date}T18:00:00.000Z`,
    status: 'completed',
    total_amount: row.amount,
    deposit_amount: row.amount,
    booking_type: row.inv.includes('INTHEHAUS') ? 'dine_in' : 'pickup',
    staff_remark: `POS เก่า (POS ID: H1, บิล: ${row.inv})`,
    pickup_contact_name: 'Sale summary report (POS เก่า)',
    pax: 1
  }));

  // Batch insert into bookings in chunks of 50
  for (let i = 0; i < bookingsToInsert.length; i += 50) {
    const chunk = bookingsToInsert.slice(i, i + 50);
    const { data: bData, error: bErr } = await supabase.from('bookings').insert(chunk).select('id');
    if (bErr) {
      console.error(`bookings insert error at chunk ${i}:`, bErr);
    } else {
      console.log(`✓ Inserted bookings chunk ${i + 1} - ${i + chunk.length}`);
    }
  }

  console.log('✅ ALL HISTORICAL DATA SEEDED SUCCESSFULLY!');
}

runSeed();
