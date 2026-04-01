import fetch from 'node-fetch';

const args = process.argv.slice(2);
const getArg = (name, defaultValue = undefined) => {
  const idx = args.findIndex((v) => v === name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
};

const SERVER_URL = getArg('--server', 'https://server-pc-fq7x.onrender.com');
const PC_ID = getArg('--pc', 'pc-one');

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('Verificando servidor POS:', SERVER_URL);

  try {
    const health = await fetch(`${SERVER_URL}/api/health`, { timeout: 15000 });
    if (!health.ok) throw new Error(`health failed ${health.status}`);
    const healthJson = await health.json();
    console.log('Health OK:', healthJson);
  } catch (err) {
    console.error('Error health check:', err.message || err);
    process.exit(1);
  }

  const discovered = await fetch(`${SERVER_URL}/api/pc/discovered?freshnessMinutes=-1`, { timeout: 15000 });
  const discoveredData = await discovered.json();
  console.log(`PCs descubiertas (${(discoveredData.data || []).length}):`, (discoveredData.data || []).map((p) => `${p.pc_id}${p.assigned ? ' (assigned)' : ''}`));

  const unassigned = await fetch(`${SERVER_URL}/api/pc/unassigned`, { timeout: 15000 });
  const unassignedData = await unassigned.json();
  console.log(`PCs no asignadas (${(unassignedData.data || []).length}):`, (unassignedData.data || []).map((p) => p.pc_id));

  const status = await fetch(`${SERVER_URL}/api/pc/${encodeURIComponent(PC_ID)}/status`, { timeout: 15000 });
  if (status.ok) {
    const statusJson = await status.json();
    console.log(`Status de PC ${PC_ID}:`, statusJson);
  } else {
    console.warn(`No se encontró status para PC ${PC_ID}. (HTTP ${status.status})`);
  }

  console.log('Prueba de conectividad completa. Si hay PCs listadas, puedes reclamarlas en inventario.');
}

run().catch((err) => {
  console.error('Error general:', err.message || err);
  process.exit(1);
});
