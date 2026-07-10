const targetUrl = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&prerender=true`;
const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(microlinkUrl)}`;

console.log('Fetching Microlink via allorigins.win...');
fetch(proxyUrl)
.then(async res => {
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('JSON Output:', JSON.stringify(json, null, 2));
})
.catch(err => console.error(err));
