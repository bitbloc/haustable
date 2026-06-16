async function run() {
  const query = 'dawn';
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5&country=TH`;
  console.log('Fetching:', url);

  try {
    const resp = await fetch(url);
    console.log('Status:', resp.status, resp.statusText);
    const data = await resp.json();
    console.log('Results count:', data.resultCount);
    if (data.results && data.results.length > 0) {
      console.log('First result:', {
        id: data.results[0].trackId,
        name: data.results[0].trackName,
        artists: data.results[0].artistName,
        albumName: data.results[0].collectionName,
        albumImage: data.results[0].artworkUrl100?.replace('100x100', '300x300'),
        duration_ms: data.results[0].trackTimeMillis,
        previewUrl: data.results[0].previewUrl
      });
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
