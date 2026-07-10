import fs from 'fs';

const html = fs.readFileSync('scratch/google_review.html', 'utf8');

// Check if specific keywords are in the HTML
const keywords = [
    'in the haus',
    'ในบ้าน',
    'จริตจัด',
    'รสชัดเจน',
    'Review',
    '★★★★★',
    'Google review',
    'Maps'
];

console.log('--- Keyword Search ---');
keywords.forEach(kw => {
    const found = html.toLowerCase().includes(kw.toLowerCase());
    console.log(`Keyword "${kw}":`, found ? 'FOUND' : 'NOT FOUND');
});

// Let's search for matches of any Thai characters or words
const thaiMatch = html.match(/[\u0e00-\u0e7f]/);
console.log('Contains Thai characters:', thaiMatch ? 'YES' : 'NO');
