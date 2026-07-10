const url = 'https://maps.app.goo.gl/iezqeoFYojkaob9i7';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true&headers.accept-language=th-TH,th;q=0.9`;

fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => {
        console.error(err);
    });
