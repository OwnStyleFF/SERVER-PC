import { callTaecelAdmin, prettyPrint } from './taecel-admin-client.js';

const [,, fecha='2026-01-01', lastid='0'] = process.argv;

(async () => {
  try {
    const result = await callTaecelAdmin('getReports', { body: { fecha, lastid } });
    prettyPrint('getReports', result);
  } catch (error) {
    console.error('Error getReports:', error.message || error);
    process.exit(1);
  }
})();
