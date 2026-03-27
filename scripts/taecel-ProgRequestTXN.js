import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, producto='TEL010', referencia='REF123', fecha='2026-03-28'] = process.argv;

(async () => {
  try {
    const result = await callTaecelAdmin('ProgRequestTXN', {
      body: { producto, referencia, fecha }
    });
    prettyPrint('ProgRequestTXN', result);
  } catch (error) {
    console.error('Error ProgRequestTXN:', error.message || error);
    process.exit(1);
  }
})();
