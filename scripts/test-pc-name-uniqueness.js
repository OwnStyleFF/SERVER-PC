const assert = require('assert');
const fetch = global.fetch || require('node-fetch');

const SERVER_URL = process.env.PC_SERVER_URL || 'http://localhost:4000';

const randomId = () => `pc-test-${Math.random().toString(36).slice(2, 10)}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  console.log('Server base', SERVER_URL);

  const pcA = randomId();
  const pcB = randomId();
  const nameA = `pc-one-${Math.random().toString(36).slice(2, 5)}`;
  const nameB = `pc-other-${Math.random().toString(36).slice(2, 5)}`;

  console.log('Creating test agents', pcA, pcB);

  const pairA = await request('/api/pc/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: pcA, pc_name: nameA })
  });
  assert(pairA.res.ok && pairA.body.success, 'pair A failed: ' + JSON.stringify(pairA.body));

  const pairB = await request('/api/pc/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: pcB, pc_name: nameB })
  });
  assert(pairB.res.ok && pairB.body.success, 'pair B failed: ' + JSON.stringify(pairB.body));

  const registerA = await request('/api/pc/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: pcA, pc_name: nameA })
  });
  assert(registerA.res.ok && registerA.body.success, 'register A failed: ' + JSON.stringify(registerA.body));

  const registerB = await request('/api/pc/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: pcB, pc_name: nameB })
  });
  assert(registerB.res.ok && registerB.body.success, 'register B failed: ' + JSON.stringify(registerB.body));

  console.log('Try setting pcB name equal to pcA name (should fail with 409)');
  const updateDuplicate = await request('/api/pc/update-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: pcB, pc_name: nameA })
  });
  assert(!updateDuplicate.res.ok && updateDuplicate.res.status === 409, 'Duplicate name accepted unexpectedly: ' + JSON.stringify(updateDuplicate));

  console.log('Set unique name for pcB');
  const updateSuccess = await request('/api/pc/update-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: pcB, pc_name: `${nameB}-nuevo` })
  });
  assert(updateSuccess.res.ok && updateSuccess.body.success, 'update unique failed: ' + JSON.stringify(updateSuccess.body));

  console.log('Check discovered list contains updated names');
  await sleep(500);
  const discovered = await request('/api/pc/discovered?freshnessMinutes=-1');
  assert(discovered.res.ok && Array.isArray(discovered.body.data), 'discovered failed: ' + JSON.stringify(discovered.body));

  const foundA = discovered.body.data.find((item) => item.pc_id === pcA);
  const foundB = discovered.body.data.find((item) => item.pc_id === pcB);

  assert(foundA, 'pcA not discovered');
  assert(foundB, 'pcB not discovered');
  assert(foundA.pc_name === nameA, 'pcA name mismatch');
  assert(foundB.pc_name === `${nameB}-nuevo`, 'pcB name mismatch');

  console.log('Test passed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});