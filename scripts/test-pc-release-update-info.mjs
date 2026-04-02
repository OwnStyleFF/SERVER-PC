import assert from 'assert';

const SERVER_URL = process.env.PC_SERVER_URL || 'http://localhost:4000';
const SECRET = process.env.UPDATE_RELEASE_SECRET || 'admin-secret';

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  console.log('Testing release endpoint...');

  const releaseBody = {
    version: '1.1.0',
    url: 'https://server-pc-fq7x.onrender.com/downloads/NewSetup.exe',
    hash: '',
    notes: 'Release test',
    secret: SECRET
  };

  const release = await request('/api/pc/update-info/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(releaseBody)
  });

  assert(release.res.ok, 'Release status not OK');
  assert(release.body.success, 'Release success false');
  assert(release.body.data?.version === releaseBody.version, 'Release version mismatch');

  const info = await request('/api/pc/update-info');
  assert(info.res.ok, 'Update-info status not OK');
  assert(info.body.success, 'Update-info success false');
  assert(info.body.data?.version === releaseBody.version, 'Info version mismatch');
  assert(info.body.data?.url === releaseBody.url, 'Info url mismatch');

  console.log('Release endpoint test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed', err);
  process.exit(1);
});