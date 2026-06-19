import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("FloatingPlate usage:");
lines.forEach((line, index) => {
    if (line.includes('FloatingPlate') && !line.includes('function FloatingPlate')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
