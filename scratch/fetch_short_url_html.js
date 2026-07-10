const url = 'https://maps.app.goo.gl/iezqeoFYojkaob9i7';

fetch(url, { redirect: 'manual' })
    .then(res => {
        console.log('Status:', res.status);
        console.log('Headers:', JSON.stringify([...res.headers.entries()], null, 2));
        return res.text();
    })
    .then(html => {
        console.log('HTML length:', html.length);
        console.log('HTML contents:');
        console.log(html);
    })
    .catch(err => console.error(err));
