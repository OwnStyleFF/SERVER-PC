import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const force = process.argv.includes('--force');

(async () => {
  try {
    const result = await callTaecelAdmin('getProducts', { body: { force }, httpMethod: 'POST' });
    prettyPrint('getProducts', result);
  } catch (error) {
    console.error('Error getProducts:', error.message || error);
    process.exit(1);
  }
})();
