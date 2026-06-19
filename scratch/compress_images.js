import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = 'c:/Users/Ritha/inthehaus-booking/public/assets';

const filesToCompress = [
    'food-beef-curry-2.webp',
    'food-chicken-curry.webp',
    'food-fried-garlic-pork.webp',
    'food-pouring-curry.webp',
    'food-tai-pla-curry.webp'
];

async function compress() {
    for (const file of filesToCompress) {
        const filePath = path.join(assetsDir, file);
        if (!fs.existsSync(filePath)) {
            console.log(`File not found: ${filePath}`);
            continue;
        }

        // Restore file from git first to get original image before compressing
        try {
            import('child_process').then(({ execSync }) => {
                execSync(`git restore "${filePath}"`);
            });
        } catch (e) {
            // ignore
        }

        // Wait a tiny bit for restore to complete
        await new Promise(r => setTimeout(r, 200));

        const fileBuffer = fs.readFileSync(filePath);
        const metadata = await sharp(fileBuffer).metadata();
        console.log(`Original ${file}: width=${metadata.width}, height=${metadata.height}, size=${fileBuffer.length} bytes`);

        let quality = 80;
        let resizeWidth = 450;
        let buffer;
        let newSize = Infinity;

        while (newSize > 54 * 1024 && quality >= 30) {
            buffer = await sharp(fileBuffer)
                .resize(resizeWidth, resizeWidth, { fit: 'inside' })
                .webp({ quality })
                .toBuffer();
            
            newSize = buffer.length;
            if (newSize > 54 * 1024) {
                quality -= 5;
                if (quality < 50) {
                    resizeWidth -= 50; // shrink resolution if quality alone isn't enough
                }
            }
        }

        console.log(`Final Compressed ${file}: width/height=${resizeWidth}, quality=${quality}, size=${newSize} bytes`);
        fs.writeFileSync(filePath, buffer);
    }
}

compress().catch(console.error);
