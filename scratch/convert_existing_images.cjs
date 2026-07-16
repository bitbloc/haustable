const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function convertAndUpload(buffer, bucketName, originalPath) {
    // 1. Get raw filename from URL/path
    const parts = originalPath.split('/');
    const originalFileName = parts[parts.length - 1];
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    const newFileName = `${baseName}_opt_${Date.now()}.webp`;

    console.log(`  Compressing with sharp to webp: ${newFileName}...`);
    
    // 2. Resize to max width 800px and compress to webp
    const webpBuffer = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

    console.log(`  Uploading ${newFileName} to Supabase bucket: ${bucketName}...`);

    // 3. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(newFileName, webpBuffer, {
            contentType: 'image/webp',
            cacheControl: '15552000',
            upsert: true
        });

    if (uploadError) {
        console.error(`  Storage upload failed:`, uploadError);
        throw uploadError;
    }

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(newFileName);
    return publicUrl;
}

async function processStockItems() {
    console.log('\n--- Processing Stock Items ---');
    const { data: items, error } = await supabase
        .from('stock_items')
        .select('id, name, image_url')
        .not('image_url', 'is', null);

    if (error) {
        console.error('Error fetching stock items:', error);
        return;
    }

    console.log(`Found ${items.length} stock items with images.`);

    for (const item of items) {
        const url = item.image_url;
        if (!url || url.endsWith('.webp') || !url.includes('supabase.co')) {
            console.log(`Skipping: ${item.name} (${url})`);
            continue;
        }

        console.log(`Processing: ${item.name}`);
        try {
            const buffer = await downloadImage(url);
            const newUrl = await convertAndUpload(buffer, 'stock-images', url);
            
            console.log(`  Updating database URL to: ${newUrl}`);
            const { error: updateError } = await supabase
                .from('stock_items')
                .update({ image_url: newUrl })
                .eq('id', item.id);

            if (updateError) {
                console.error(`  Database update failed:`, updateError);
                throw updateError;
            }
            console.log(`  Successfully updated ${item.name}!`);
        } catch (err) {
            console.error(`  Error processing ${item.name}:`, err);
        }
    }
}

async function processMenuItems() {
    console.log('\n--- Processing Menu Items ---');
    const { data: items, error } = await supabase
        .from('menu_items')
        .select('id, name, image_url')
        .not('image_url', 'is', null);

    if (error) {
        console.error('Error fetching menu items:', error);
        return;
    }

    console.log(`Found ${items.length} menu items with images.`);

    for (const item of items) {
        const url = item.image_url;
        if (!url || url.endsWith('.webp') || !url.includes('supabase.co')) {
            console.log(`Skipping: ${item.name} (${url})`);
            continue;
        }

        console.log(`Processing: ${item.name}`);
        try {
            const buffer = await downloadImage(url);
            const newUrl = await convertAndUpload(buffer, 'public-assets', url);
            
            console.log(`  Updating database URL to: ${newUrl}`);
            const { error: updateError } = await supabase
                .from('menu_items')
                .update({ image_url: newUrl })
                .eq('id', item.id);

            if (updateError) throw updateError;
            console.log(`  Successfully updated ${item.name}!`);
        } catch (err) {
            console.error(`  Error processing ${item.name}:`, err.message);
        }
    }
}

async function run() {
    try {
        await processStockItems();
        await processMenuItems();
        console.log('\nMigration complete! 🎉');
    } catch (e) {
        console.error('Migration failed:', e);
    }
}

run();
