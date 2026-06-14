async function run() {
  const trackId = '4Li2WHPv7gaIPnZyaIInJ9';
  const url = `https://open.spotify.com/track/${trackId}`;

  try {
    const resp = await fetch(url, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = await resp.text();
    console.log('Searching for scripts/metadata inside HTML...');
    
    // Check if there are any json-ld scripts
    const ldJsonRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = ldJsonRegex.exec(html)) !== null) {
      console.log('Found LD+JSON:', match[1].trim());
    }

    // Let's print all scripts that contain "artist" or "title" or track name or "Weeknd"
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptIdx = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1];
      if (content.includes('The Weeknd') || content.includes('Blinding Lights')) {
        console.log(`Script ${scriptIdx} matches (length: ${content.length}):`);
        console.log(content.substring(0, 500) + '...');
      }
      scriptIdx++;
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
