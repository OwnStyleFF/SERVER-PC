const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/pc/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pc_id: '1', pc_name: '1'})
    });
    console.log('status', res.status);
    const text = await res.text();
    console.log(text);
  } catch (err) {
    console.error('error', err);
    process.exit(1);
  }
})();