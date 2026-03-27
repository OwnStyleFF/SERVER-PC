// count-taecel-services.js
// Ejecutar: node scripts/count-taecel-services.js
// Asegúrate de que el servidor esté corriendo en http://localhost:3000

const API_URL = process.env.TAECEL_API_URL || 'http://localhost:3000/api/taecel/admin/getProductsCount';

async function countServices() {
  try {
    const res = await fetch(`${API_URL}?force=true`, { method: 'GET' });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Error HTTP ${res.status}: ${text}`);
      process.exit(1);
    }

    const payload = await res.json();

    if (!payload.success) {
      console.error('API responded without success:', payload);
      process.exit(1);
    }

    const totalItems = typeof payload.totalItems === 'number'
      ? payload.totalItems
      : payload.items?.productos ?? payload.items?.productos ?? 0;

    const uniqueItems = typeof payload.uniqueItems === 'number'
      ? payload.uniqueItems
      : payload.items?.productosUnicos ?? 0;

    console.log('--- Conteo de servicios Taecel (API getProductsCount) ---');
    console.log('Total de elementos devueltos por la API:', totalItems);
    console.log('Total de elementos únicos (ID):', uniqueItems);
    console.log('Conteo por categoría:', payload.byCategory || {});
    if (payload.sampleProducts) {
      console.log('Muestra de primeros servicios (5):', payload.sampleProducts);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error al ejecutar conteo de servicios:', err);
    process.exit(1);
  }
}

countServices();