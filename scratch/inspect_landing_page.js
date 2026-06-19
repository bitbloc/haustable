import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Print lines around "จริตจัด รสชัดเจน"
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('จริตจัด รสชัดเจน')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        // print 3 lines before and after
        for (let i = Math.max(0, index - 3); i <= Math.min(lines.length - 1, index + 3); i++) {
            console.log(`  [${i + 1}] ${lines[i]}`);
        }
    }
});
