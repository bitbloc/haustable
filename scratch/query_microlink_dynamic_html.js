const url = 'https://maps.app.goo.gl/iezqeoFYojkaob9i7';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true&html=true`;

console.log('Querying microlink for dynamic HTML...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        const html = json.data.html || '';
        console.log('Fetched dynamic HTML length:', html.length);
        
        const name = 'Natthawipa';
        const idx = html.indexOf(name);
        console.log('Search for Name:', idx !== -1 ? 'FOUND' : 'NOT FOUND');
        
        if (idx !== -1) {
            console.log('DOM Snippet around Name:');
            console.log(html.substring(idx - 250, idx + 250));
        }
    })
    .catch(err => {
        console.error(err);
    });
