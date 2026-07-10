const url = 'https://maps.app.goo.gl/iezqeoFYojkaob9i7';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true`;

console.log('Querying microlink to inspect keys...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log('Top-level keys:', Object.keys(json));
        if (json.data) {
            console.log('data keys:', Object.keys(json.data));
            console.log('data.title:', json.data.title);
            console.log('data.description:', json.data.description);
        }
    })
    .catch(err => {
        console.error(err);
    });
