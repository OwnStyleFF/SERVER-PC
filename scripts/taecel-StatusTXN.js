import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, transid] = process.argv;
if (!transid) {
  console.error('Uso: node scripts/taecel-StatusTXN.js <transid>');
  process.exit(1);
}

(async () => {
  try {
    const result = await callTaecelAdmin('StatusTXN', { body: { transid } });
    prettyPrint('StatusTXN', result);
  } catch (error) {
    console.error('Error StatusTXN:', error.message || error);
    process.exit(1);
  }
})();
