const b64 = 'CAIQACodChtycF9oOjg0QXBWeHp0c242cm9LOVU2MHM1c0E';
console.log('Decoded UTF-8:', Buffer.from(b64, 'base64').toString('utf8'));
console.log('Decoded Hex:', Buffer.from(b64, 'base64').toString('hex'));
