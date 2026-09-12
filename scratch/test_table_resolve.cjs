const fs = require('fs');
let env = {};
const envFile = fs.existsSync('.env.local') ? '.env.local' : (fs.existsSync('.env') ? '.env' : null);
if (envFile) {
    env = fs.readFileSync(envFile, 'utf8').split('\n').reduce((acc, line) => {
        if (!line || !line.includes('=')) return acc;
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]+/g, '');
        if (key) acc[key] = val;
        return acc;
    }, {});
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY);

// Import tableResolver logic
async function testResolvers() {
    const inputs = ['9', 'H9', '6', 'H5', 'table-9', 'โต๊ะ 9', 'table-H9'];
    const { data: allTables } = await supabase.from('tables_layout').select('*').order('id');
    
    console.log('Tables layout:');
    allTables.forEach(t => console.log(`  id=${t.id}, table_name=${t.table_name}`));

    for (const input of inputs) {
        const cleanParam = decodeURIComponent(String(input || '')).trim();
        const isDigitsOnly = /^\d+$/.test(cleanParam);
        let resolved = null;

        // 1. Exact match
        resolved = allTables.find(t => String(t.table_name).toLowerCase() === cleanParam.toLowerCase());
        
        // 2. Digits only -> ID match
        if (!resolved && isDigitsOnly) {
            const numId = parseInt(cleanParam, 10);
            resolved = allTables.find(t => t.id === numId);
        }

        // 3. Fallback digits match against table_name digits
        if (!resolved) {
            const digits = cleanParam.replace(/\D/g, '');
            if (digits) {
                resolved = allTables.find(t => String(t.table_name).replace(/\D/g, '') === digits);
            }
        }

        console.log(`Input "${input}" -> Resolved: id=${resolved?.id}, name=${resolved?.table_name}`);
    }
}

testResolvers();
