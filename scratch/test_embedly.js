const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';
const embedlyUrl = `https://api.embed.ly/1/oembed?url=${encodeURIComponent(url)}`;

console.log('Querying Embedly...');
fetch(embedlyUrl)
.then(async res => {
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('JSON Output:', JSON.stringify(json, null, 2));
})
.catch(err => console.error(err));
