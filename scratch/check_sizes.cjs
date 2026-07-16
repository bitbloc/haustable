const urls = [
  'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/stock-images/1775728191569-02yfhv7vleoh.jpg',
  'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/stock-images/1775906344433-ixsfx6jkzvk.jpg',
  'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/stock-images/1768218350193-f4pyd3ya1e.jpg',
  'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/stock-images/1775907998456-7g2q9qd9mnl.jpg'
];

async function check() {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const size = res.headers.get('content-length');
      const type = res.headers.get('content-type');
      console.log(`${url}\n  Size: ${(size / 1024).toFixed(2)} KB, Type: ${type}`);
    } catch (e) {
      console.error(url, e.message);
    }
  }
}
check();
