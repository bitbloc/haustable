const url = 'https://maps.app.goo.gl/WM4vGsGxg3MTCmEt8';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true`;

console.log('Querying microlink for text-only review...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => {
        console.error(err);
    });
