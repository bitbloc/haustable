import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\Ritha\\.gemini\\antigravity-ide\\brain\\5c02659e-56db-4009-a51b-84e537d99ad3';
const outputDir = path.resolve('public/assets');

async function removeWhiteBackground(inputPath, outputPath) {
    console.log(`Removing white background and optimizing ${path.basename(inputPath)}...`);
    
    // First resize the image to maximum 800px width/height before reading raw pixel data
    const resizedImage = sharp(inputPath).resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true });
    const { data, info } = await resizedImage.raw().toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    
    const outBuffer = Buffer.alloc(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
        const srcIdx = i * channels;
        const destIdx = i * 4;
        
        let r, g, b, a = 255;
        if (channels === 3) {
            r = data[srcIdx];
            g = data[srcIdx + 1];
            b = data[srcIdx + 2];
        } else {
            r = data[srcIdx];
            g = data[srcIdx + 1];
            b = data[srcIdx + 2];
            a = data[srcIdx + 3];
        }
        
        // Calculate distance from white (255, 255, 255)
        const dist = (255 - r) + (255 - g) + (255 - b);
        
        let alpha = a;
        const minThresh = 20; // very close to white -> transparent
        const maxThresh = 45; // slight grey/shadow -> semi-transparent to opaque
        
        if (dist < minThresh) {
            alpha = 0;
        } else if (dist < maxThresh) {
            const ratio = (dist - minThresh) / (maxThresh - minThresh);
            alpha = Math.round(ratio * a);
        }
        
        outBuffer[destIdx] = r;
        outBuffer[destIdx + 1] = g;
        outBuffer[destIdx + 2] = b;
        outBuffer[destIdx + 3] = alpha;
    }
    
    await sharp(outBuffer, {
        raw: {
            width: width,
            height: height,
            channels: 4
        }
    })
    .webp({ quality: 75, effort: 6 })
    .toFile(outputPath);
    
    console.log(`Saved transparent WebP to ${outputPath}`);
    console.log(`Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

async function run() {
    try {
        const jobs = [
            { src: 'food_chicken_curry_1781863175822.png', dest: 'food-chicken-curry.webp' },
            { src: 'food_pouring_curry_1781863205148.png', dest: 'food-pouring-curry.webp' },
            { src: 'food_fried_garlic_pork_1781863233657.png', dest: 'food-fried-garlic-pork.webp' },
            { src: 'food_tai_pla_curry_1781863253442.png', dest: 'food-tai-pla-curry.webp' }
        ];

        for (const job of jobs) {
            const inputPath = path.join(brainDir, job.src);
            const outputPath = path.join(outputDir, job.dest);
            await removeWhiteBackground(inputPath, outputPath);
        }
        console.log('All new food images processed successfully!');
    } catch (err) {
        console.error('Error processing generated food images:', err);
    }
}

run();
