import fs from 'fs';

const url = 'https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2pOdmNqRkxOamxwTmtseWNsTnVORXRxUkc1a2IyYxAB!2m1!1s0x0:0x1893337008a5a779!3m1!1s2@1:CAIQACodChtycF9oOjNvcjFLNjlpNklyclNuNEtqRG5kb2c||?entry=tts';

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(res => res.text())
.then(html => {
    fs.writeFileSync('scratch/google_review.html', html);
    console.log('Saved HTML, length:', html.length);
})
.catch(err => console.error(err));
