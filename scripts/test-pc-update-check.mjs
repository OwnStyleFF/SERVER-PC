import assert from 'assert';

const SERVER_URL = process.env.PC_SERVER_URL || 'http://localhost:4000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  console.log('Testing PC update flow against', SERVER_URL);

  const updateInfo = await request('/api/pc/update-info');
  assert(updateInfo.res.ok, 'Failed /api/pc/update-info status');
  assert(updateInfo.body.success, 'Success flag false');
  assert(updateInfo.body.data?.version, 'No version in response');
  assert(updateInfo.body.data?.url, 'No url in response');
  assert('hash' in updateInfo.body.data, 'No hash en response');

  const semverParts = String(updateInfo.body.data.version).split('.').map(Number);
  assert(semverParts.length === 3, 'Version no semver');


  console.log('update info OK', updateInfo.body.data);

  const fakePc = `pc-test-update-${Date.now()}`;
  const version = '0.0.0-test';

  const report = await request('/api/pc/report-version', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pc_id: fakePc, current_version: version })
  });
  assert(report.res.ok, 'Failed /api/pc/report-version status');
  assert(report.body.success, 'Report response unsuccessful');

  console.log('report-version OK');

  console.log('PAUSE for strategy check (use this log as pulse).');
  await sleep(300);

  console.log('Test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed', err);
  process.exit(1);
});