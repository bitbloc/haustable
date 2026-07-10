const url = 'https://maps.app.goo.gl/7pvsxtJccsf6tcQk8';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true`;

console.log('Querying microlink for the new review...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => {
        console.error(err);
    });
