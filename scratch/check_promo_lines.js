import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.toLowerCase().includes('promo')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
