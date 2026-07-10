const url = 'https://maps.app.goo.gl/7pvsxtJccsf6tcQk8';
fetch(url, { redirect: 'manual' })
    .then(res => {
        console.log('Status:', res.status);
        console.log('Location:', res.headers.get('location'));
    })
    .catch(err => console.error(err));
