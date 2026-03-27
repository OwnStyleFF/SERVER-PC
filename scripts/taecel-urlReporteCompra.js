import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

(async () => {
  try {
    const result = await callTaecelAdmin('urlReporteCompra');
    prettyPrint('urlReporteCompra', result);
  } catch (error) {
    console.error('Error urlReporteCompra:', error.message || error);
    process.exit(1);
  }
})();
