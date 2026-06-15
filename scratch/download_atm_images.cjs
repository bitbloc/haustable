const fs = require('fs');
const path = require('path');
const axios = require('axios');

const urls = {
  atm_1: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_1_1779018095588.jpg',
  atm_2: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_2_1779018097248.jpg',
  atm_3: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_3_1779018098211.jpg',
  atm_4: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_4_1779018126269.jpg',
  atm_5: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_5_1779018173547.jpg',
  atm_6: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_6_1779018174516.jpg',
  atm_7: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_7_1779018175504.jpg',
  atm_8: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_8_1779018177875.jpg',
  atm_9: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_9_1779018237977.jpg',
  atm_10: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_10_1779018239268.jpg'
};

const outputDir = 'C:\\Users\\Ritha\\.gemini\\antigravity-ide\\brain\\5ee1d784-429b-4e46-876b-339b9e4807c9';

async function download() {
  for (const [name, url] of Object.entries(urls)) {
    if (!url) continue;
    try {
      console.log(`Downloading ${name}...`);
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });
      const fileType = url.split('.').pop() || 'jpg';
      const destPath = path.join(outputDir, `${name}.${fileType}`);
      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log(`Saved to ${destPath}`);
    } catch (err) {
      console.error(`Failed to download ${name}:`, err.message);
    }
  }
}

download();
