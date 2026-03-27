// scripts/fetch-taecel-codes.js
// Ejecutar: node scripts/fetch-taecel-codes.js
// Asegúrate de tener el backend en marcha (por ejemplo en localhost:3000). 

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_FILE = process.env.OUT_FILE || 'taecel-codes.json';

async function fetchCodes() {
  const url = `${BASE_URL}/api/taecel/codes`;

  console.log(`Consultando Taecel codes en: ${url}`);
  const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();

  if (!payload.success) {
    throw new Error(`Error Taecel: ${JSON.stringify(payload)}`);
  }

  const codes = payload.codes || [];
  console.log(`Recibidos ${codes.length} registros de códigos Taecel`);

  const fs = await import('fs');
  fs.writeFileSync(OUT_FILE, JSON.stringify({ source: payload.source || 'unknown', count: codes.length, codes }, null, 2));

  console.log(`Guardado en: ${OUT_FILE}`);
}

fetchCodes()
  .then(() => console.log('Proceso completado.'))
  .catch(err => {
    console.error('Error al obtener códigos Taecel:', err.message || err);
    process.exit(1);
  });
