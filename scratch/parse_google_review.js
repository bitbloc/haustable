import fs from 'fs';

const html = fs.readFileSync('scratch/google_review.html', 'utf8');

// Print title
const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
console.log('Title:', titleMatch ? titleMatch[1] : 'Not found');

// Print meta tags
const metaMatches = html.match(/<meta[^>]*>/gi);
if (metaMatches) {
    console.log('Meta Tags:');
    metaMatches.forEach(tag => {
        if (tag.includes('og:') || tag.includes('twitter:') || tag.includes('description')) {
            console.log('  ', tag);
        }
    });
} else {
    console.log('No meta tags found');
}

// Find any JSON-LD or script objects
const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
console.log('Total scripts:', scriptMatches ? scriptMatches.length : 0);
