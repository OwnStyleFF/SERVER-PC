// scripts/sync-taecel-products.js
// Ejecutar: node scripts/sync-taecel-products.js
// - Llama primero a /api/taecel/admin/syncProducts
// - Luego llama a /api/taecel/admin/getProducts para validar que se cargó correctamente

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_FILE = process.env.OUT_FILE || 'taecel-sync-results.json';

async function fetchJson(url, opts = {}) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} - ${url}`);
  }
  return response.json();
}

async function runSync() {
  const syncUrl = `${BASE_URL}/api/taecel/admin/syncProducts`;
  const getProductsUrl = `${BASE_URL}/api/taecel/admin/getProducts`;

  console.log(`1) Sincronizando catálogo Taecel: ${syncUrl}`);
  const syncResult = await fetchJson(syncUrl);
  console.log('syncProducts result:', syncResult);

  console.log('2) Obteniendo catálogo actualizado con getProducts');
  const productsResult = await fetchJson(getProductsUrl, { body: JSON.stringify({ force: true }) });
  console.log('getProducts result OK. Productos:', (productsResult.data?.productos ?? productsResult.data ?? []).length || 0);

  const fs = await import('fs');
  fs.writeFileSync(OUT_FILE, JSON.stringify({ syncResult, productsResult, timestamp: new Date().toISOString() }, null, 2), 'utf8');

  console.log(`Resultados guardados en ${OUT_FILE}`);
}

runSync().then(() => console.log('Proceso completado.')).catch(err => {
  console.error('Error en sync-taecel-products:', err);
  process.exit(1);
});