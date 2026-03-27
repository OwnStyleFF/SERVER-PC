import fetch from 'node-fetch';

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/taecel/admin/getProducts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    console.log('ok', res.ok, 'status', res.status);
    console.log('success', data.success);
    console.log('status', data.status, 'isVerified', data.isVerified, 'fromBackup', data.fromBackup);
    const products = Array.isArray(data.data?.productos) ? data.data.productos : [];
    console.log('products', products.length);
    console.log('first 3 products', products.slice(0,3));
  } catch (err) {
    console.error(err);
  }
})();
