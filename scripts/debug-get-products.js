import fetch from 'node-fetch';

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/taecel/admin/getProducts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    console.log('ok', res.ok, 'status', res.status, 'success', data.success);
    console.log('root keys', Object.keys(data));
    if (data.data) console.log('data keys', Object.keys(data.data));

    const productsFromData = Array.isArray(data.data?.productos) ? data.data.productos : [];
    const productsFromData2 = Array.isArray(data.data?.data) ? data.data.data : [];
    const productsFromTop = Array.isArray(data.productos) ? data.productos : [];

    console.log('productsFromData len', productsFromData.length);
    console.log('productsFromData2 len', productsFromData2.length);
    console.log('productsFromTop len', productsFromTop.length);

    const products = productsFromData.length ? productsFromData : (productsFromData2.length ? productsFromData2 : productsFromTop);

    console.log('final selected products len', products.length);
    console.log('sample 1', products.slice(0,5));
    if (products.length > 0) {
      const p = products[0];
      console.log('keys first', Object.keys(p));
      console.log('first object', p);
    }
  } catch (err) {
    console.error('error', err);
  }
})();
