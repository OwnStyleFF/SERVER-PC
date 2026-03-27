import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

(async () => {
  try {
    const result = await callTaecelAdmin('getBalance', { body: {}, httpMethod: 'POST' });
    prettyPrint('getBalance', result);
  } catch (error) {
    console.error('Error getBalance:', error.message || error);
    process.exit(1);
  }
})();
