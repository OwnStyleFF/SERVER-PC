const fetch = require('node-fetch');

// IPs de ejemplo para el entorno real (simulación interna también funciona con 127.0.0.1)
const POS_API_URL = process.env.POS_API_URL || 'http://127.0.0.1:4000';
const PC_API_URL = process.env.PC_API_URL || 'http://127.0.0.1:4000';
const PC_ID = process.env.PC_ID || 'pc-01';

(async () => {
  try {
    console.log('=== Simulador POS/PC ===');
    console.log('POS:', POS_API_URL);
    console.log('PC:', PC_API_URL);
    console.log('PC_ID:', PC_ID);

    // 1) Simula PC que pide emparejamiento
    console.log('\n-- PC solicita emparejamiento --');
    let resp = await fetch(`${PC_API_URL}/api/pc/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pc_id: PC_ID })
    });
    let data = await resp.json();
    console.log('pair res', resp.status, data);
    if (!resp.ok) throw new Error('pair failed');

    // 2) Simula la vista POS pidiendo PCs pendientes y detectadas
    console.log('\n-- POS consulta PCs pendientes --');
    resp = await fetch(`${POS_API_URL}/api/pc/pending-pair-codes`);
    data = await resp.json();
    console.log('pending res', resp.status, data);
    if (!resp.ok) throw new Error('pending failed');

    console.log('\n-- POS consulta PCs detectadas --');
    resp = await fetch(`${POS_API_URL}/api/pc/discovered`);
    data = await resp.json();
    console.log('discovered res', resp.status, data);
    if (!resp.ok) throw new Error('discovered failed');

    // 3) POS reclama la PC en inventario
    console.log('\n-- POS reclama PC al inventario --');
    resp = await fetch(`${POS_API_URL}/api/pc/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pc_id: PC_ID })
    });
    data = await resp.json();
    console.log('claim res', resp.status, data);
    if (!resp.ok) throw new Error('claim failed');

    // 4) PC se registra (actualiza token/paired) con la misma PC_ID
    console.log('\n-- PC register --');
    resp = await fetch(`${PC_API_URL}/api/pc/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pc_id: PC_ID })
    });
    data = await resp.json();
    console.log('register res', resp.status, data);
    if (!resp.ok) throw new Error('register failed');

    const token = data.token;

    // 5) PC heartbeat
    console.log('\n-- PC heartbeat --');
    resp = await fetch(`${PC_API_URL}/api/pc/${encodeURIComponent(PC_ID)}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status: 'online' })
    });
    data = await resp.json();
    console.log('heartbeat res', resp.status, data);
    if (!resp.ok) throw new Error('heartbeat failed');

    // 6) Verificar estado PC en servidor
    console.log('\n-- Verificar status PC --');
    resp = await fetch(`${POS_API_URL}/api/pc/${encodeURIComponent(PC_ID)}/status`);
    data = await resp.json();
    console.log('status res', resp.status, data);

    console.log('\n=== Simulación completada OK ===');
  } catch (err) {
    console.error('Simulación falló:', err.message || err);
    process.exit(1);
  }
})();