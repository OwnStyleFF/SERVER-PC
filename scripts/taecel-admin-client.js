// Helper para invocar los endpoints taecel admin en node.
// Uso:
//   node scripts/<script>.js  (configura TAECEL_API_URL opcional)

const API_BASE = process.env.TAECEL_API_URL || 'http://localhost:3000/api/taecel/admin';

async function callTaecelAdmin(method, {body = {}, httpMethod = 'POST', query = {}} = {}) {
  const url = new URL(`${API_BASE}/${method}`);

  if (query && Object.keys(query).length > 0) {
    for (const [k,v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    method: httpMethod,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: httpMethod === 'GET' ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    throw new Error(`Taecel admin ${method} returned non JSON: ${text}`);
  }

  if (!response.ok || !data?.success) {
    const err = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(`Taecel admin ${method} failed: ${err}`);
  }

  return data;
}

function prettyPrint(label, data) {
  console.log('---', label, '---');
  console.log(JSON.stringify(data, null, 2));
}

export { callTaecelAdmin, prettyPrint };
