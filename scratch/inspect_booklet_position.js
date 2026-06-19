import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
for (let i = 525; i <= 585; i++) {
    if (i < lines.length) {
        console.log(`[${i + 1}] ${lines[i]}`);
    }
}
