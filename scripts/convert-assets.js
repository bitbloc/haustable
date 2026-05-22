import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve('public/assets');

async function convertToWebp(filename) {
    const inputPath = path.join(assetsDir, filename);
    const outputFilename = filename.replace(/\.[^.]+$/, '.webp');
    const outputPath = path.join(assetsDir, outputFilename);

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        return;
    }

    try {
        console.log(`Converting ${filename} to WebP...`);
        const info = await sharp(inputPath)
            .webp({ quality: 80, effort: 6 })
            .toFile(outputPath);
        
        const oldSize = (fs.statSync(inputPath).size / 1024).toFixed(2);
        const newSize = (info.size / 1024).toFixed(2);
        console.log(`Successfully converted to ${outputFilename}`);
        console.log(`Size reduced from ${oldSize} KB to ${newSize} KB (${Math.round((1 - info.size / fs.statSync(inputPath).size) * 100)}% saving)`);
    } catch (err) {
        console.error(`Error converting ${filename}:`, err);
    }
}

async function run() {
    await convertToWebp('logo-script.png');
    await convertToWebp('background-mood.png');
}

run();
