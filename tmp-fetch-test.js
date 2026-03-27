(async () => {
  const urls = [
    'http://localhost:3000/api/taecel/operators',
    'http://localhost:3000/api/taecel/operators?category=recharge',
    'http://localhost:3000/api/taecel/products/1'
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u);
      const text = await res.text();
      console.log('url:', u);
      console.log('status:', res.status);
      console.log('text length:', text.length);
      console.log('first 256 chars:', text.slice(0, 256));
    } catch (err) {
      console.error('fetch error', u, err);
    }
    console.log('---');
  }
})();
