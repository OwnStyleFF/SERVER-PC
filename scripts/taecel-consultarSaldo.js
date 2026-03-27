import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, referencia] = process.argv;
if (!referencia) {
  console.error('Uso: node scripts/taecel-consultarSaldo.js <referencia>');
  process.exit(1);
}

(async () => {
  try {
    const result = await callTaecelAdmin('consultarSaldo', { body: { referencia } });
    prettyPrint('consultarSaldo', result);
  } catch (error) {
    console.error('Error consultarSaldo:', error.message || error);
    process.exit(1);
  }
})();
