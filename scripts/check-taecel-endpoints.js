// scripts/check-taecel-endpoints.js
import { setTimeout as wait } from "timers/promises";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TIMEOUT_MS = 15000;
const PAUSE_MS = 500; // para no saturar

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { ok: response.ok, status: response.status, headers: Object.fromEntries(response.headers), body };
  } finally {
    clearTimeout(id);
  }
}

async function r(name, path, opts = {}) {
  console.log(`\n==> ${name}: ${opts.method || "GET"} ${path}`);
  try {
    const res = await fetchWithTimeout(`${BASE_URL}${path}`, opts);
    console.log(`   status=${res.status}` + (res.ok ? " ✅" : " ❌"));
    if (typeof res.body === "object") console.log("   body:", JSON.stringify(res.body, null, 2));
    else console.log("   body:", String(res.body).slice(0, 1024));
  } catch (err) {
    console.log("   ERROR:", err?.message || err);
  }
  await wait(PAUSE_MS);
}

async function main() {
  console.log("=== Taecel smoke test no bloqueante ===");

  await r("status", "/api/taecel/status");
  await r("data", "/api/taecel/data");
  await r("operators", "/api/taecel/operators");
  await r("codes", "/api/taecel/codes");
  await r("products[sample operator?]", "/api/taecel/products/1");

  const adminHeaders = { "Content-Type": "application/json" };

  await r("getBalance", "/api/taecel/admin/getBalance", { method: "POST", headers: adminHeaders, body: JSON.stringify({ force: false }) });
  await r("getProducts", "/api/taecel/admin/getProducts", { method: "POST", headers: adminHeaders, body: JSON.stringify({ force: false }) });
  await r("consultarSaldo", "/api/taecel/admin/consultarSaldo", { method: "POST", headers: adminHeaders, body: JSON.stringify({ idOperador: "1", idProducto: "B300", codigo: "B300" }) });
  await r("getSales", "/api/taecel/admin/getSales", { method: "POST", headers: adminHeaders, body: JSON.stringify({ fecha: "2026-03-01", bolsa: 1 }) });
  await r("getReports", "/api/taecel/admin/getReports", { method: "POST", headers: adminHeaders, body: JSON.stringify({ fecha: "2026-03-01", lastid: 0 }) });
  await r("getBancosCte", "/api/taecel/admin/getBancosCte", { method: "POST", headers: adminHeaders, body: JSON.stringify({}) });
  await r("urlReporteCompra", "/api/taecel/admin/urlReporteCompra", { method: "POST", headers: adminHeaders, body: JSON.stringify({ key: process.env.TAECEL_KEY || "test", nip: process.env.TAECEL_NIP || "test", idOperador: "1" }) });

  await r("RequestTXN", "/api/taecel/admin/RequestTXN", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ key: process.env.TAECEL_KEY || "test", nip: process.env.TAECEL_NIP || "test", operacion: "0", idOperador: "1", idProducto: "1", monto: "1", clave: "000000", idCliente: "CLI-1", referencia: "TEST" })
  });

  await r("StatusTXN", "/api/taecel/admin/StatusTXN", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ transid: "test-transid-123" })
  });

  await r("ProgRequestTXN", "/api/taecel/admin/ProgRequestTXN", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ key: process.env.TAECEL_KEY || "test", nip: process.env.TAECEL_NIP || "test", operacion: "0", idOperador: "1", idProducto: "1", monto: "1", clave: "000000", idCliente: "CLI-1", referencia: "TEST", fecha: (new Date(Date.now() + 3600*1000)).toISOString() })
  });

  // traspasoPago: si no tienes monto real, prueba con monto pequeño y validación de saldo para no bloquear.
  await r("traspasoPago", "/api/taecel/admin/traspasoPago", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      tipo_bolsa: 1,
      tipo: 2,
      folio: "TRANS-TEST-123",
      monto: 1,
      nota: "Testing",
      clienteID: "TEST123"
    })
  });

  console.log("\n=== Fin del paseo de verificación ===");
}

main().catch(err => {
  console.error("Fallo del script:", err);
  process.exit(1);
});