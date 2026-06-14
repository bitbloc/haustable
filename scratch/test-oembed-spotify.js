async function run() {
  const url = 'https://open.spotify.com/track/4Li2WHPv7gaIPnZyaIInJ9';
  const oembedUrl = `https://embed.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  console.log('Fetching:', oembedUrl);

  try {
    const resp = await fetch(oembedUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', resp.status, resp.statusText);
    const text = await resp.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
