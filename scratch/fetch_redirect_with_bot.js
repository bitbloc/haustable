import fs from 'fs';

const url = 'https://maps.app.goo.gl/iezqeoFYojkaob9i7';

console.log('Fetching shortened URL following redirects as Googlebot...');

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(async res => {
    console.log('Resolved URL:', res.url);
    console.log('Status:', res.status);
    const html = await res.text();
    fs.writeFileSync('scratch/google_review_bot_redirect.html', html);
    console.log('Saved HTML, length:', html.length);
    
    const name = 'Natthawipa';
    const found = html.includes(name);
    console.log(`Search for "${name}":`, found ? 'FOUND' : 'NOT FOUND');
    
    if (found) {
        const idx = html.indexOf(name);
        console.log('Snippet:', html.substring(idx - 150, idx + 150));
    }
})
.catch(err => console.error(err));
