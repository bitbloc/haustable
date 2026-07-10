import fs from 'fs';

const html = fs.readFileSync('scratch/ra6w_page.html', 'utf8');

// Find all matches for Unicode Thai escapes (like \u0e01 to \u0e7f)
const unicodeRegex = /\\u0e[0-9a-f]{2}/gi;
const matches = html.match(unicodeRegex) || [];

console.log('Number of Unicode Thai escapes found:', matches.length);

if (matches.length > 0) {
    // Let's find some blocks of unicode characters and decode them
    const blockRegex = /(?:\\u0e[0-9a-f]{2})+/gi;
    const blocks = html.match(blockRegex) || [];
    console.log('Found unicode blocks:', blocks.length);
    
    console.log('Decoded sample blocks:');
    const uniqueBlocks = Array.from(new Set(blocks)).slice(0, 20);
    uniqueBlocks.forEach(block => {
        // Decode the block
        const decoded = block.replace(/\\u([0-9a-f]{4})/gi, (match, grp) => {
            return String.fromCharCode(parseInt(grp, 16));
        });
        console.log(`- ${decoded}`);
    });
}
