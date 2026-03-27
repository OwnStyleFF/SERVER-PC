import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, transid] = process.argv;
if (!transid) {
  console.error('Uso: node scripts/taecel-CancelProgRequestTXN.js <transid>');
  process.exit(1);
}

(async () => {
  try {
    const result = await callTaecelAdmin('CancelProgRequestTXN', { body: { transid } });
    prettyPrint('CancelProgRequestTXN', result);
  } catch (error) {
    console.error('Error CancelProgRequestTXN:', error.message || error);
    process.exit(1);
  }
})();
