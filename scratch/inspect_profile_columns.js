const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
    const clientContent = fs.readFileSync(path.join(__dirname, '../src/lib/supabaseClient.js'), 'utf8');
    const urlMatch = clientContent.match(/const supabaseUrl = ['"]([^'"]+)['"]/);
    const keyMatch = clientContent.match(/const supabaseAnonKey = ['"]([^'"]+)['"]/);
    
    if (urlMatch && keyMatch) {
        const client = createClient(urlMatch[1], keyMatch[1]);
        client.from('profiles').select('*').limit(1).then(({ data, error }) => {
            if (error) {
                console.error("Error fetching profile columns:", error);
            } else {
                console.log("Profile columns found:");
                if (data && data.length > 0) {
                    console.log(JSON.stringify(Object.keys(data[0]), null, 2));
                    console.log("Sample profile data:", JSON.stringify(data[0], null, 2));
                } else {
                    console.log("No profile records found to inspect.");
                }
            }
        });
    } else {
        console.log("Could not parse supabase keys");
    }
} catch (err) {
    console.error("Failed to parse supabaseClient:", err);
}
