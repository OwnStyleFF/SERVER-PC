// Script para ejercitar RequestTXN con todos los productos Taecel disponibles en la API local.
// Uso:
//   TAECEL_API_URL=http://localhost:3000/api/taecel node scripts/sell-all-taecel-products.js [--limit=100] [--dry-run] [--start=0] [--skip-failed]

import fetch from 'node-fetch';

const argv = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value === undefined ? true : value];
}));

const API_URL = process.env.TAECEL_API_URL || 'http://localhost:3000/api/taecel';
const LIMIT = Number(argv.limit || 0);
const START = Number(argv.start || 0);
const DRY_RUN = argv['dry-run'] || argv.dryrun || false;
const SKIP_FAILED = argv['skip-failed'] || false;
const CONCURRENCY = Number(argv.concurrency || 4);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomReference(index) {
  const base = String(Date.now()).slice(-6) + String(index).padStart(4, '0');
  return base.padStart(10, '0').slice(0, 32);
}

async function fetchCatalog() {
  const url = `${API_URL}/codes`;
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to fetch codes: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.success || !Array.isArray(data.codes)) throw new Error(`Invalid codes response: ${JSON.stringify(data)}`);
  return data.codes;
}

async function requestTxn(producto, referencia, monto) {
  const url = `${API_URL}/transaction`;
  const body = { producto, referencia };
  if (monto !== undefined && monto !== null && monto !== '' && !Number.isNaN(Number(monto))) {
    body.monto = String(monto);
  }

  if (DRY_RUN) {
    return { success: true, dryRun: true, request: body };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (e) { throw new Error(`Bad JSON response: ${text}`); }

  if (!res.ok && !data?.success) {
    throw new Error(`HTTP ${res.status} : ${JSON.stringify(data)}`);
  }
  if (data?.success === false) {
    throw new Error(`Taecel failed: ${JSON.stringify(data)}`);
  }

  return data;
}

async function run() {
  console.log('=> Sell all Taecel products test script');
  console.log('API URL:', API_URL);
  console.log('Options:', { LIMIT, START, DRY_RUN, SKIP_FAILED, CONCURRENCY });

  const codes = await fetchCatalog();
  const selected = codes.slice(START, LIMIT > 0 ? START + LIMIT : undefined);

  console.log(`Loaded ${codes.length} products; executing ${selected.length} items from index ${START}`);

  const results = [];
  let active = 0;
  let index = 0;

  async function processOne(item, i) {
    const producto = item.codigo || item.idProducto || item.codigo || item.Codigo || item.id || item.Code;
    const monto = item.monto || item.Monto || item.price || item.precio;
    const referencia = randomReference(i + START);

    if (!producto) {
      return { product: item, success: false, error: 'missing product code' };
    }

    try {
      const result = await requestTxn(producto, referencia, monto);
      return { product: item, success: true, referencia, result };
    } catch (error) {
      return { product: item, success: false, referencia, error: (error.message || String(error)) };
    }
  }

  const flush = async () => {
    while (active < CONCURRENCY && index < selected.length) {
      const item = selected[index];
      const currentIndex = index;
      index += 1;
      active += 1;

      processOne(item, currentIndex)
        .then(res => {
          results.push(res);
          if (!res.success && !SKIP_FAILED) {
            console.warn(`FAIL [${currentIndex}] ${res.product?.codigo || res.product?.idProducto || 'unknown'}: ${res.error}`);
          }
          if (res.success) {
            console.log(`OK   [${currentIndex}] ${res.product?.codigo || 'unknown'} -> transid=${res.result?.transid || 'n/a'}`);
          }
        })
        .catch(err => {
          results.push({ product: item, success: false, error: err.message || String(err) });
        })
        .finally(() => {
          active -= 1;
          flush();
        });
    }

    if (active === 0 && index >= selected.length) {
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      console.log('=== Completed ===');
      console.log('Success:', successCount, 'Failures:', failureCount);
      process.exit(failureCount === 0 ? 0 : 1);
    }
  };

  await flush();
}

run().catch(err => {
  console.error('Fatal script error:', err.message || err);
  process.exit(1);
});
