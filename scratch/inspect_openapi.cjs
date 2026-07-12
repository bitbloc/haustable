const https = require('https');

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';

const url = `${supabaseUrl}/rest/v1/`;

const options = {
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    }
};

https.get(url, options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            const tables = Object.keys(parsedData.definitions || {});
            console.log("Tables found in database:", tables);
            if (parsedData.definitions?.profiles) {
                console.log("Profiles properties:", Object.keys(parsedData.definitions.profiles.properties || {}));
            }
        } catch (e) {
            console.error("Error parsing OpenAPI response:", e.message);
            console.log("Raw response prefix:", rawData.slice(0, 500));
        }
    });
}).on('error', (e) => {
    console.error("Error fetching OpenAPI:", e.message);
});
