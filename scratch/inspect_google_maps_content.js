import fs from 'fs';

const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';

console.log('Fetching Google Maps review HTML...');
fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(async res => {
    const html = await res.text();
    fs.writeFileSync('scratch/ra6w_page.html', html);
    console.log('HTML saved, length:', html.length);
    
    // Find all script blocks or JSON data
    console.log('Searching for review patterns...');
    const ratingMatches = html.match(/class="[^"]*star[^"]*"/gi) || [];
    console.log('Found star classes:', ratingMatches.length);
})
.catch(err => console.error(err));
