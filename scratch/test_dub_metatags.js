const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';
const dubUrl = `https://api.dub.co/metatags?url=${encodeURIComponent(url)}`;

console.log('Fetching via dub.co/metatags...');
fetch(dubUrl)
.then(async res => {
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('JSON:', JSON.stringify(json, null, 2));
})
.catch(err => console.error(err));
