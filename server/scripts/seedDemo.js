require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { seedDemo } = require('../src/services/demoSeedService');
async function main() {
  const database = process.env.DEMO_DB_NAME || 'synoria_demo', password = process.env.DEMO_PASSWORD || 'SynoriaDemo!2026';
  if (!/^[a-z][a-z0-9_]{0,50}_demo$/.test(database)) throw new Error('DEMO_DB_NAME must end in _demo.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 5000 });
  const result = await seedDemo({ password });
  console.log(JSON.stringify(result, null, 2));
  console.log(result.created ? `Fresh local demo account password: ${password}` : 'Existing demo data and passwords were left unchanged.');
  console.log(`Point a separate server at database ${database} to use this demo. Your application database was not changed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
