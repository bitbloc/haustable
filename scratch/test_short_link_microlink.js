const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true`;

console.log('Querying Microlink for short URL with prerender=true...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => {
        console.error(err);
    });
