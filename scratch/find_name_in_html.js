import fs from 'fs';

const html = fs.readFileSync('scratch/google_review.html', 'utf8');

const nameToSearch = 'Natthawipa';
const found = html.includes(nameToSearch);
console.log(`Search for "${nameToSearch}":`, found ? 'FOUND' : 'NOT FOUND');

// Let's print some snippet of the HTML where it appears if found
if (found) {
    const idx = html.indexOf(nameToSearch);
    console.log('Snippet:', html.substring(idx - 100, idx + 100));
}
