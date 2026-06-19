import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

console.log("Checking for 'Signature Dish' (old block title):");
lines.forEach((line, index) => {
    if (line.includes('Signature Dish') && !line.includes('Signature Dishes')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});

console.log("\nChecking for 'ดูรูปเล่มเมนูฉบับดั้งเดิม (Booklet)' (old booklet button):");
lines.forEach((line, index) => {
    if (line.includes('ดูรูปเล่มเมนูฉบับดั้งเดิม (Booklet)')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
