import fetch from 'node-fetch';

(async () => {
  try {
    const endpoints = [
      {url: 'http://localhost:3000/api/taecel/admin/getProductsCount', method: 'POST', body: {}},
      {url: 'http://localhost:3000/api/taecel/status', method: 'GET'},
      {url: 'http://localhost:3000/api/taecel/admin/getProducts', method: 'POST', body: {}}
    ];

    for (const ep of endpoints) {
      const options = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
      if (ep.method === 'POST') options.body = JSON.stringify(ep.body || {});
      const res = await fetch(ep.url, options);
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.warn('Non-JSON response for', ep.url, 'text:', text.slice(0, 800));
        data = null;
      }
      console.log('===', ep.url, '===');
      console.log('ok', res.ok, 'status', res.status, 'text length', text.length);
      if (data) {
        console.log('success', data.success);
        console.log(JSON.stringify(data, null, 2).slice(0, 1200));
      }
    }
  } catch (err) {
    console.error('error', err);
  }
})();