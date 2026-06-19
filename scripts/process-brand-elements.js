import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\Ritha\\.gemini\\antigravity-ide\\brain\\5c02659e-56db-4009-a51b-84e537d99ad3';
const outputDir = path.resolve('public/assets');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function convertToWebP(inputPath, outputPath, maxWidth = 400) {
    console.log(`Converting ${path.basename(inputPath)} → ${path.basename(outputPath)}...`);
    
    const metadata = await sharp(inputPath).metadata();
    let pipeline = sharp(inputPath);
    
    // Resize if wider than maxWidth, preserving aspect ratio
    if (metadata.width > maxWidth) {
        pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    }
    
    await pipeline
        .webp({ quality: 80, effort: 6 })
        .toFile(outputPath);
        
    const stats = fs.statSync(outputPath);
    console.log(`  ✓ Saved: ${outputPath} (${(stats.size / 1024).toFixed(2)} KB)`);
}

async function run() {
    try {
        const jobs = [
            { src: 'media__1781876346740.png', dest: 'brand-star.webp', maxWidth: 300 },
            { src: 'media__1781876346757.png', dest: 'brand-thai-text.webp', maxWidth: 500 },
            { src: 'media__1781876346775.png', dest: 'brand-crescent.webp', maxWidth: 300 },
            { src: 'media__1781876346799.png', dest: 'brand-mascot.webp', maxWidth: 400 },
        ];

        for (const job of jobs) {
            const inputPath = path.join(brainDir, job.src);
            const outputPath = path.join(outputDir, job.dest);
            await convertToWebP(inputPath, outputPath, job.maxWidth);
        }
        
        console.log('\n✅ All brand elements processed successfully!');
    } catch (err) {
        console.error('Error processing brand elements:', err);
    }
}

run();
