const url = 'https://maps.app.goo.gl/iezqeoFYojkaob9i7';

// We specify a list of selectors that Google commonly uses for reviewer name
const selectors = [
    'div.d4rla',
    'div.TSqp5',
    'span.ea07fc',
    '.X5OiWd',
    '.gws-localreviews__google-review',
    'div.W5vU0e',
    'div.wi2Z4',
    'span.fontTitleMedium'
];

const dataParam = {
    reviewer_name: {
        selector: selectors.join(', ')
    }
};

const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true&data=${encodeURIComponent(JSON.stringify(dataParam))}`;

console.log('Querying microlink with custom data selector...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log('Response status:', json.status);
        console.log('Scraped custom data:', json.data.reviewer_name);
    })
    .catch(err => {
        console.error(err);
    });
