const encoded = 'Ci9DQUlRQUNvZENodHljRjlvT21OVllYVlFVMlJIVWxNNWRVcHRjRzVtZEUxSVNVRRAB';
const decoded = Buffer.from(encoded, 'base64').toString('utf8');
console.log('Decoded UTF-8:', decoded);
console.log('Decoded hex:', Buffer.from(encoded, 'base64').toString('hex'));
