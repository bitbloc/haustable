import fs from 'fs';
const html = fs.readFileSync('scratch/ra6w_page.html', 'utf8');
console.log(html.substring(0, 1500));
