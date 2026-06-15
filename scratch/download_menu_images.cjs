const fs = require('fs');
const path = require('path');
const axios = require('axios');

const urls = {
  menu_1: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_menu_1_1778316424194.png',
  menu_2: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_menu_2_1778316425996.png',
  menu_3: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_menu_3_1778316427461.png',
  menu_4: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_menu_4_1778318025648.png',
  menu_5: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_menu_5_1778318730153.png',
  menu_6: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_menu_6_1779017067242.jpg'
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
      const fileType = url.split('.').pop() || 'png';
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
