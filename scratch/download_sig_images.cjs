const fs = require('fs');
const path = require('path');
const axios = require('axios');

const urls = {
  hero: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_hero_url_1778316469375.jpg',
  sig_1: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_1_1778318077216.jpg',
  sig_2: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_2_1778318113107.png',
  sig_3: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_3_1778318194352.jpg'
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
