import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, producto='TEL010', referencia='REF123'] = process.argv;

(async () => {
  try {
    const result = await callTaecelAdmin('RequestTXN', {
      body: { producto, referencia }
    });
    prettyPrint('RequestTXN', result);
  } catch (error) {
    console.error('Error RequestTXN:', error.message || error);
    process.exit(1);
  }
})();
