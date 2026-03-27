import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const force = process.argv.includes('--force');

(async () => {
  try {
    const result = await callTaecelAdmin('getProductsCount', { httpMethod: 'GET', query: { force: force ? 'true' : 'false' } });
    prettyPrint('getProductsCount', result);
  } catch (error) {
    console.error('Error getProductsCount:', error.message || error);
    process.exit(1);
  }
})();
