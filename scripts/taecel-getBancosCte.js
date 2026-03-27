import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

(async () => {
  try {
    const result = await callTaecelAdmin('getBancosCte');
    prettyPrint('getBancosCte', result);
  } catch (error) {
    console.error('Error getBancosCte:', error.message || error);
    process.exit(1);
  }
})();
