require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const service = require('../src/services/backupService');
async function main() {
  const [operation, ...args] = process.argv.slice(2);
  if (!['backup', 'restore', 'verify'].includes(operation)) throw new Error('Use backup, restore or verify.');
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--offline') options.offline = true;
    else if (['--database', '--file'].includes(key) && args[index + 1] && !args[index + 1].startsWith('--')) options[key.slice(2)] = args[++index];
    else throw new Error(`Unknown or missing option: ${key}`);
  }
  if (!options.file) throw new Error('Provide --file /path/to/backup.jsonl.gz.');
  const result = operation === 'verify' ? await service.verify(options.file) : await service[operation]({ uri: process.env.MONGODB_URI, database: options.database, offline: options.offline, ...(operation === 'backup' ? { output: options.file } : { input: options.file }) });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
