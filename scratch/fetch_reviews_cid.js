import fs from 'fs';

const cid = '1770830424535312249';
const url = `https://search.google.com/local/reviews?cid=${cid}`;

console.log('Fetching local reviews page for CID:', cid);

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
})
.then(res => res.text())
.then(html => {
    fs.writeFileSync('scratch/google_reviews_cid.html', html);
    console.log('Saved CID HTML, length:', html.length);
    
    // Check if we can find the name
    const nameMatch = html.includes('ไอยรินทร์') || html.includes('Natthawipa');
    console.log('Contains reviews data in static HTML:', nameMatch ? 'YES' : 'NO');
})
.catch(err => console.error(err));
