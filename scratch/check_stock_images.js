const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    const { data: items, error } = await supabase.from('stock_items').select('id, name, image_url');
    if (error) {
        console.error('Error fetching stock items:', error);
        return;
    }
    console.log(`Total stock items: ${items.length}`);
    const withImages = items.filter(item => item.image_url);
    console.log(`Items with images: ${withImages.length}`);
    withImages.slice(0, 20).forEach(item => {
        console.log(`- ${item.name}: ${item.image_url}`);
    });
}
run();
