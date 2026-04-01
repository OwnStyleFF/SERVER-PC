import fetch from 'node-fetch';

const args = process.argv.slice(2);
const getArg = (name, defaultValue = undefined) => {
  const idx = args.findIndex((v) => v === name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
};

const SERVER_URL = getArg('--server', 'https://server-pc-fq7x.onrender.com');
const PC_ID = getArg('--pc', 'pc-one');
const PC_TOKEN = getArg('--token', '');

if (!PC_TOKEN) {
  console.log('Advertencia: PC_TOKEN no definido. Se hará un heartbeat sin token para validar `pc not found`.');
}

async function heartbeat() {
  try {
    const res = await fetch(`${SERVER_URL}/api/pc/${encodeURIComponent(PC_ID)}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ token: PC_TOKEN || 'invalid', status: 'alive', timestamp: new Date().toISOString() }),
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const json = await res.json();
    console.log(`Heartbeat PC ${PC_ID} -> HTTP ${res.status}`, json);
    if (!res.ok) process.exit(1);
  } catch (err) {
    console.error('Heartbeat error:', err.message || err);
    process.exit(1);
  }
}

async function run() {
  console.log(`CPU Agent connectivity check -> server=${SERVER_URL} pc=${PC_ID}`);
  await heartbeat();
  console.log('Si se recibe `success:true` y action con unlock/lock, la conexión desde el agente está OK');
}

run().catch((err) => {
  console.error('Error general:', err.message || err);
  process.exit(1);
});
