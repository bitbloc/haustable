const resolvedUrl = 'https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvT21OVllYVlFVMlJIVWxNNWRVcHRjRzVtZEUxSVNVRRAB!2m1!1s0x0:0x1893337008a5a779!3m1!1s2@1:CAIQACodChtycF9oOmNVYXVQU2RHUlM5dUptcG5mdE1ISUE%7C%7C?entry=tts';
const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(resolvedUrl)}&prerender=true`;

console.log('Querying microlink for resolved URL with prerender=true...');
fetch(microlinkUrl)
    .then(res => res.json())
    .then(json => {
        console.log(JSON.stringify(json, null, 2));
    })
    .catch(err => {
        console.error(err);
    });
