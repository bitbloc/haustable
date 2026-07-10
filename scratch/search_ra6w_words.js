import fs from 'fs';

const html = fs.readFileSync('scratch/ra6w_page.html', 'utf8');

console.log('In the haus / inthehaus:', html.includes('In the haus') || html.includes('inthehaus') || html.includes('In the Haus'));
console.log('ในบ้าน:', html.includes('ในบ้าน'));
console.log('นครพนม:', html.includes('นครพนม'));

// Let's search for script tags containing these target keywords
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
    const js = match[1];
    if (js.includes('ในบ้าน') || js.includes('นครพนม') || js.includes('inthehaus')) {
        console.log(`Script ${count} matches! Length:`, js.length);
        fs.writeFileSync(`scratch/matching_script_${count}.js`, js);
    }
    count++;
}
