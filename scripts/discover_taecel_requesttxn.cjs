require('dotenv').config();
const fetch = globalThis.fetch || require('node-fetch');

const SERVER_URL = process.env.TAECEL_LOCAL_URL || 'http://localhost:3000';
const METHOD = 'POST';

// Configura acá tu valor conocido de producto/monto/número (de catálogo Taecel)
const sampleProducto = process.env.TAECEL_SAMPLE_PRODUCTO || 'TEL010';
const sampleMonto = process.env.TAECEL_SAMPLE_MONTO || '10';
const sampleNumero = process.env.TAECEL_SAMPLE_NUMERO || '2411980520';
const sampleReferencia = process.env.TAECEL_SAMPLE_REFERENCIA || `ORD-${Date.now()}`;

const productKeys = ['producto', 'product', 'idProducto', 'codigo', 'Codigo', 'Code'];
const numberKeys = ['numero', 'telefono', 'numeroRecarga', 'phone', 'mobilenumber'];
const referenciaKeys = ['referencia', 'ref', 'reference'];

const variants = [];

for (const pk of productKeys) {
  for (const nk of numberKeys) {
    for (const rk of referenciaKeys) {
      const body = {
        key: process.env.TAECEL_KEY,
        nip: process.env.TAECEL_NIP,
        funcion: 'RequestTXN',
        [pk]: sampleProducto,
        [nk]: sampleNumero,
        [rk]: sampleReferencia,
        monto: sampleMonto
      };
      variants.push({ pk, nk, rk, body });
    }
  }
}

(async () => {
  console.log(`=== Discover Taecel RequestTXN schema against ${SERVER_URL}/api/taecel/admin/RequestTXN`);
  console.log('sampleProducto:', sampleProducto, 'sampleNumero:', sampleNumero, 'sampleMonto:', sampleMonto);

  for (const variant of variants) {
    const url = `${SERVER_URL}/api/taecel/admin/RequestTXN`;
    const params = new URLSearchParams();
    for (const [k,v] of Object.entries(variant.body)) {
      params.append(k, String(v));
    }

    try {
      const res = await fetch(url, { method: METHOD, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = text;
      }

      console.log('---');
      console.log(`pk=${variant.pk} nk=${variant.nk} rk=${variant.rk} | status=${res.status}`);
      console.log(JSON.stringify(json, null, 2));

      if (res.status === 200 && json && json.success === true) {
        console.log('¡Éxito encontrado!');
        break;
      }
    } catch (err) {
      console.error('Error request:', variant.pk, variant.nk, variant.rk, err && err.message ? err.message : err);
    }
  }
})();