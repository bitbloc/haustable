const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';
const jsonlinkUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;

console.log('Querying jsonlink.io...');
fetch(jsonlinkUrl)
.then(async res => {
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('JSON Output:', JSON.stringify(json, null, 2));
})
.catch(err => console.error(err));
