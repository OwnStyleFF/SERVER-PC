import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, fecha='2026-01-01', bolsa='1'] = process.argv;

(async () => {
  try {
    const result = await callTaecelAdmin('getSales', { body: { fecha, bolsa }, httpMethod: 'POST' });
    prettyPrint('getSales', result);
  } catch (error) {
    console.error('Error getSales:', error.message || error);
    process.exit(1);
  }
})();
