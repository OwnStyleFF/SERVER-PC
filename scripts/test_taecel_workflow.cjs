/*
  E2E Test script para workflow Taecel en gc-web
  - Llama getProducts
  - Selecciona un producto válido
  - Realiza RequestTXN
  - Realiza StatusTXN sobre el transid
  Usa: node scripts/test_taecel_workflow.cjs
*/

const BASE_URL = process.env.TAECEL_LOCAL_URL || 'http://localhost:3000';

async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, ok: res.ok, text, json };
}

async function run() {
  console.log('Taecel workflow E2E test using', BASE_URL);

  // 1) getProducts
  const getProductsUrl = `${BASE_URL}/api/taecel/admin/getProducts`;
  let gpRes;
  let attempts = 0;
  let catalog = [];

  while (attempts < 6) {
    attempts += 1;
    gpRes = await safeFetch(getProductsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!gpRes.ok || !gpRes.json) {
      console.error('getProducts transport failed', gpRes.status, gpRes.json || gpRes.text);
      return process.exit(1);
    }

    // 429-like behavior in payload
    const rateLimitInfo = gpRes.json?.data?.error || gpRes.json?.error;
    if (rateLimitInfo && rateLimitInfo.category === 'RATE_LIMIT') {
      console.warn('Taecel rate-limit from getProducts, waiting 15s and retry', rateLimitInfo.details);
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }

    if (gpRes.json.success === false || gpRes.json.data?.success === false) {
      console.error('getProducts failed logically', gpRes.json);
      if (attempts < 6) {
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }
      return process.exit(1);
    }

    catalog = gpRes.json.data?.data || gpRes.json.data?.productos || gpRes.json.data || gpRes.json;
    if (Array.isArray(catalog) && catalog.length > 0) break;

    // In case we got structured event with isFallback and nested data
    const nested = gpRes.json.data?.data || gpRes.json.data?.data?.data;
    if (Array.isArray(nested) && nested.length > 0) {
      catalog = nested;
      break;
    }

    console.warn('getProducts returned no products, retrying', attempts);
    await new Promise(r => setTimeout(r, 15000));
  }

  if (!Array.isArray(catalog) || catalog.length === 0) {
    console.error('getProducts returned no products', gpRes.json);
    return process.exit(1);
  }
  if (!Array.isArray(catalog) || catalog.length === 0) {
    console.error('getProducts returned no products', gpRes.json);
    return process.exit(1);
  }

  const product = catalog.find(p => p.idProducto || p.Codigo || p.codigo || p.producto);
  if (!product) {
    console.error('No valid product found in catalog');
    return process.exit(1);
  }

  const productCode = String(product.idProducto || product.Codigo || product.codigo || product.producto).trim();
  const amount = Number(product.precio || product.Precio || product.monto || product.Monto || 10);
  if (!productCode) {
    console.error('Product code is empty', product);
    return process.exit(1);
  }

  console.log('Selected product', { productCode, amount });

  // 2) RequestTXN
  const requestTxnUrl = `${BASE_URL}/api/taecel/admin/RequestTXN`;
  const payload = {
    producto: productCode,
    referencia: `AUTOTEST-${Date.now()}`,
    monto: amount,
    // valida numero fijo; remplazar por número real de pruebas si es necesario
    numero: '2411980520',
    numeroRecarga: '2411980520',
    numeroReferencia: '2411980520'
  };

  const rRes = await safeFetch(requestTxnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('RequestTXN response', rRes.status, rRes.json);

  if (!rRes.ok || !rRes.json || rRes.json.success === false) {
    console.error('RequestTXN failed, stop workflow.');
    return process.exit(1);
  }

  const transid = rRes.json.data?.transid || rRes.json.transid || rRes.json.data?.TransID || rRes.json.transid;
  if (!transid) {
    console.error('RequestTXN did not return transid', rRes.json);
    return process.exit(1);
  }

  console.log('Got transid:', transid);

  // 3) StatusTXN
  const statusUrl = `${BASE_URL}/api/taecel/admin/StatusTXN`;
  const sRes = await safeFetch(statusUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transid })
  });

  console.log('StatusTXN response', sRes.status, sRes.json);

  if (!sRes.ok || !sRes.json || sRes.json.success === false) {
    console.error('StatusTXN failed');
    return process.exit(1);
  }

  console.log('Workflow completed successfully');
  console.log('RequestTXN payload used', payload);
  console.log('RequestTXN output', rRes.json);
  console.log('StatusTXN output', sRes.json);
  process.exit(0);
}

run().catch(err => {
  console.error('E2E script uncaught error', err);
  process.exit(1);
});