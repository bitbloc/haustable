import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Booklet link occurrences:");
lines.forEach((line, index) => {
    if (line.includes('ดูรูปเล่มเมนูฉบับดั้งเดิม') || line.includes('ดูเมนูเล่มเต็ม')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i++) {
            console.log(`  [${i + 1}] ${lines[i]}`);
        }
    }
});
