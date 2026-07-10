import fs from 'fs';

const url = 'https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2pOdmNqRkxOamxwTmtseWNsTnVORXRxUkc1a2IyYxAB!2m1!1s0x0:0x1893337008a5a779!3m1!1s2@1:CAIQACodChtycF9oOjNvcjFLNjlpNklyclNuNEtqRG5kb2c||?entry=tts';

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(res => res.text())
.then(html => {
    fs.writeFileSync('scratch/google_review_bot.html', html);
    console.log('Saved Googlebot HTML, length:', html.length);
    
    // Check if name is inside
    const name = 'Natthawipa';
    const found = html.includes(name);
    console.log(`Search for "${name}" in Googlebot HTML:`, found ? 'FOUND' : 'NOT FOUND');
    
    if (found) {
        const idx = html.indexOf(name);
        console.log('Snippet:', html.substring(idx - 150, idx + 150));
    }
})
.catch(err => console.error(err));
