import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, tipo_bolsa='1', tipo='1', folio='AUTO', monto='10', nota='Test', clienteID='123'] = process.argv;

(async () => {
  try {
    const result = await callTaecelAdmin('traspasoPago', {
      body: { tipo_bolsa, tipo, folio, monto, nota, clienteID }
    });
    prettyPrint('traspasoPago', result);
  } catch (error) {
    console.error('Error traspasoPago:', error.message || error);
    process.exit(1);
  }
})();
