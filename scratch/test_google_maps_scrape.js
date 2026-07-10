const url = 'https://maps.app.goo.gl/ra6wPF2YPeNBx5m58';

console.log('Testing direct scrape with Googlebot User-Agent...');
fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
    }
})
.then(async res => {
    console.log('Resolved URL:', res.url);
    console.log('Status:', res.status);
    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No title';
    console.log('Scraped Title:', title);

    // Extract og:description
    const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i) || 
                      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:description["']/i);
    const description = descMatch ? descMatch[1].trim() : 'No og:description';
    console.log('Scraped Description:', description);
})
.catch(err => {
    console.error(err);
});
