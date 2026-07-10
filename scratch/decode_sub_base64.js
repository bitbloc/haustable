const encoded = 'CAIQACodChtycF9oOjNvcjFLNjlpNklyclNuNEtqRG5kb2c';
const decoded = Buffer.from(encoded, 'base64').toString('utf8');
console.log('Decoded Sub UTF-8:', decoded);
console.log('Decoded Sub hex:', Buffer.from(encoded, 'base64').toString('hex'));
