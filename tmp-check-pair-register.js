const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  try {
    let r = await fetch('http://localhost:4000/api/pc/pair', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pc_id: '1', pc_name: '1'})
    });
    console.log('pair', r.status, await r.text());
    r = await fetch('http://localhost:4000/api/pc/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pc_id: '1', pc_name: '1'})
    });
    console.log('register', r.status, await r.text());
  } catch (e) {
    console.error('err', e);
  }
})();