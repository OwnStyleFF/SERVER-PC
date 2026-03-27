import fs from 'fs';
import fetch from 'node-fetch';
const envFile = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(envFile.split('\n').map(line => line.trim()).filter(Boolean).map(line => line.split('=')));
const url = 'https://app.taecel.com/api/getProducts';
const form = new URLSearchParams({ key: env.TAECEL_KEY, nip: env.TAECEL_NIP });

async function main() {
  const tries = [
    { name: 'Default', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form },
    { name: 'Modern', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, body: form },
    { name: 'DirectJSON', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ key: env.TAECEL_KEY, nip: env.TAECEL_NIP }) }
  ];

  for (const t of tries) {
    try {
      const res = await fetch(url, { method: 'POST', headers: t.headers, body: t.body });
      const txt = await res.text();
      console.log('---', t.name, res.status, res.statusText, 'len', txt.length);
      console.log(txt.slice(0, 300));
    } catch (err) {
      console.log('ERR', t.name, err.message);
    }
  }
}

main().catch(err => console.error(err));