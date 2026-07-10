const url = 'https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT2pOdmNqRkxOamxwTmtseWNsTnVORXRxUkc1a2IyYxAB!2m1!1s0x0:0x1893337008a5a779!3m1!1s2@1:CAIQACodChtycF9oOjNvcjFLNjlpNklyclNuNEtqRG5kb2c||?entry=tts';
fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => {
        console.error(err);
    });
