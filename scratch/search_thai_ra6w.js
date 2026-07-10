import fs from 'fs';

const html = fs.readFileSync('scratch/ra6w_page.html', 'utf8');

// Find all sequences of 4 or more Thai characters
const thaiRegex = /[\u0e00-\u0e7f]{4,}/g;
const matches = html.match(thaiRegex) || [];

console.log('Number of Thai words found:', matches.length);
console.log('Sample Thai words:');
console.log(Array.from(new Set(matches)).slice(0, 50));
