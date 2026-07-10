import fs from 'fs';

const url = 'https://maps.app.goo.gl/7pvsxtJccsf6tcQk8';

console.log('Fetching second review URL as Googlebot...');

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(async res => {
    console.log('Resolved URL:', res.url);
    const html = await res.text();
    fs.writeFileSync('scratch/google_review_2.html', html);
    console.log('Saved HTML, length:', html.length);
    
    const nameMatch = html.includes('ไอยรินทร์');
    const textMatch = html.includes('อาหารอร่อยถูกปาก');
    
    console.log('Search for Name (ไอยรินทร์):', nameMatch ? 'FOUND' : 'NOT FOUND');
    console.log('Search for Review Text (อาหารอร่อยถูกปาก):', textMatch ? 'FOUND' : 'NOT FOUND');
})
.catch(err => console.error(err));
