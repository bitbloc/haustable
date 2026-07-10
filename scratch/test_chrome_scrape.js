import fs from 'fs';

const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';

console.log('Fetching Google Maps review HTML using Chrome User-Agent...');
fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(async res => {
    console.log('Resolved URL:', res.url);
    console.log('Status:', res.status);
    const html = await res.text();
    fs.writeFileSync('scratch/chrome_ra6w_page.html', html);
    console.log('Saved HTML, length:', html.length);
    
    // Check if it redirected to consent page
    console.log('Is consent page:', res.url.includes('consent.google.com') || html.includes('consent.google.com'));

    // Search for Nakhon Phanom
    console.log('Contains "นครพนม":', html.includes('นครพนม'));
})
.catch(err => console.error(err));
