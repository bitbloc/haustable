import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\Ritha\\.gemini\\antigravity-ide\\brain\\5c02659e-56db-4009-a51b-84e537d99ad3';
const outputDir = path.resolve('public/assets');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Function to remove black background from an image
async function removeBlackBackground(inputPath, outputPath) {
    console.log(`Removing black background from ${path.basename(inputPath)}...`);
    const image = sharp(inputPath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    
    // Create new buffer for RGBA
    const outBuffer = Buffer.alloc(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
        const srcIdx = i * channels;
        const destIdx = i * 4;
        
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        
        // Calculate intensity or distance from black
        const intensity = r + g + b;
        
        let alpha = 255;
        // Thresholds for smooth transparency edge
        const minThresh = 15;
        const maxThresh = 35;
        
        if (intensity < minThresh) {
            alpha = 0;
        } else if (intensity < maxThresh) {
            alpha = Math.round(((intensity - minThresh) / (maxThresh - minThresh)) * 255);
        }
        
        outBuffer[destIdx] = r;
        outBuffer[destIdx + 1] = g;
        outBuffer[destIdx + 2] = b;
        outBuffer[destIdx + 3] = alpha;
    }
    
    // Convert the raw RGBA buffer to WebP with target size constraints
    await sharp(outBuffer, {
        raw: {
            width: width,
            height: height,
            channels: 4
        }
    })
    .webp({ quality: 80, effort: 6 })
    .toFile(outputPath);
    
    console.log(`Saved transparent WebP to ${outputPath}`);
    console.log(`Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

async function convertToWebP(inputPath, outputPath) {
    console.log(`Converting ${path.basename(inputPath)} to WebP...`);
    
    // For PNGs that already have alpha, we just load them, resize if needed, and convert to WebP with high compression
    await sharp(inputPath)
        .webp({ quality: 80, effort: 6 })
        .toFile(outputPath);
        
    console.log(`Saved WebP to ${outputPath}`);
    console.log(`Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

async function run() {
    try {
        const jobs = [
            { src: 'media__1781861250346.png', dest: 'food-green-curry.webp', transparent: false },
            { src: 'media__1781861250374.png', dest: 'food-beef-curry-1.webp', transparent: false },
            { src: 'media__1781861250477.png', dest: 'food-pork-belly.webp', transparent: false },
            { src: 'media__1781861250507.png', dest: 'food-beef-rice.webp', transparent: false },
            { src: 'media__1781861250534.jpg', dest: 'food-beef-curry-2.webp', transparent: true }
        ];

        for (const job of jobs) {
            const inputPath = path.join(brainDir, job.src);
            const outputPath = path.join(outputDir, job.dest);
            
            if (job.transparent) {
                await removeBlackBackground(inputPath, outputPath);
            } else {
                await convertToWebP(inputPath, outputPath);
            }
        }
        console.log('All food images processed successfully!');
    } catch (err) {
        console.error('Error processing food images:', err);
    }
}

run();
