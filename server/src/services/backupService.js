const fs = require('node:fs');
const { once } = require('node:events');
const { createHash } = require('node:crypto');
const { createGzip, createGunzip } = require('node:zlib');
const { createInterface } = require('node:readline');
const { MongoClient, BSON } = require('mongoose').mongo;
const { EJSON } = BSON;
const reserved = new Set(['admin', 'local', 'config']);
function checkDatabase(name) { if (typeof name !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,62}$/.test(name) || reserved.has(name)) throw new Error('Choose an explicit application database name (not admin/local/config).'); }
const safeCollection = name => typeof name === 'string' && name.length <= 200 && !name.startsWith('system.') && !name.includes('\0') && name !== 'sessions';
async function backup({ uri, database, output, offline = false }) {
  checkDatabase(database);
  if (!offline) throw new Error('Stop all application writers, then pass --offline for a consistent backup.');
  if (!output) throw new Error('Choose an output file. Existing files are never overwritten.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  let destination, gzip;
  try {
    await client.connect(); const db = client.db(database);
    const collections = (await db.listCollections().toArray()).filter(item => item.type === 'collection' && safeCollection(item.name));
    if (!collections.length) throw new Error('The source database has no application collections.');
    destination = fs.createWriteStream(output, { flags: 'wx', mode: 0o600 });
    await once(destination, 'open'); gzip = createGzip();
    let failure;
    destination.on('error', error => { failure = error; gzip.destroy(error); });
    gzip.on('error', error => { failure = error; destination.destroy(error); });
    gzip.pipe(destination);
    const hash = createHash('sha256'); let documents = 0;
    async function write(record, hashed = true) { if (failure) throw failure; const line = `${JSON.stringify(record)}\n`; if (hashed) hash.update(line); if (!gzip.write(line)) await once(gzip, 'drain'); }
    await write({ type: 'header', format: 'synoria-backup', version: 1, database, createdAt: new Date().toISOString(), excludedCollections: ['sessions'] });
    for (const collection of collections) {
      const indexes = await db.collection(collection.name).indexes();
      await write({ type: 'collection', name: collection.name, options: EJSON.stringify(collection.options || {}, { relaxed: false }), indexes: EJSON.stringify(indexes, { relaxed: false }) });
      for await (const document of db.collection(collection.name).find({})) { await write({ type: 'document', name: collection.name, document: EJSON.stringify(document, { relaxed: false }) }); documents++; }
    }
    await write({ type: 'footer', collections: collections.length, documents, sha256: hash.digest('hex') }, false);
    const finished = once(destination, 'finish'); gzip.end(); await finished;
    if (failure) throw failure;
    return { database, collections: collections.length, documents, output, sessionsExcluded: true };
  } catch (error) {
    gzip?.destroy(); destination?.destroy();
    // An interrupted backup remains distinguishable from a valid one: no footer.
    throw error;
  } finally { await client.close(); }
}
async function readArchive(input, callback) {
  const source = fs.createReadStream(input), gunzip = createGunzip();
  source.on('error', error => gunzip.destroy(error)); source.pipe(gunzip);
  const lines = createInterface({ input: gunzip, crlfDelay: Infinity });
  const hash = createHash('sha256'), names = new Set(); let header, footer, documents = 0, current;
  const errorPromise = new Promise((_, reject) => { gunzip.on('error', reject); source.on('error', reject); });
  async function consume() {
    for await (const line of lines) {
      if (!line || line.length > 64 * 1024 * 1024 || footer) throw new Error('Invalid backup record.');
      const record = JSON.parse(line);
      if (!header) {
        if (record.type !== 'header' || record.format !== 'synoria-backup' || record.version !== 1) throw new Error('Unsupported backup format.'); header = record;
      } else if (record.type === 'collection') {
        if (!safeCollection(record.name) || names.has(record.name)) throw new Error('Invalid backup collection.');
        names.add(record.name); current = record.name; EJSON.parse(record.options); EJSON.parse(record.indexes);
      } else if (record.type === 'document') {
        if (record.name !== current || !names.has(record.name)) throw new Error('A document has no matching collection.');
        const document = EJSON.parse(record.document); if (!document || typeof document !== 'object' || Array.isArray(document) || document._id == null) throw new Error('Invalid backup document.'); documents++;
      } else if (record.type === 'footer') {
        footer = record; if (footer.documents !== documents || footer.collections !== names.size || footer.sha256 !== hash.digest('hex')) throw new Error('Backup integrity check failed.');
      } else throw new Error('Invalid backup record type.');
      if (record.type !== 'footer') hash.update(`${line}\n`);
      if (callback) await callback(record);
    }
    if (!header || !footer) throw new Error('Incomplete backup: no verified footer.');
    return { sourceDatabase: header.database, collections: names.size, documents };
  }
  try { return await Promise.race([consume(), errorPromise]); } finally { lines.close(); source.destroy(); gunzip.destroy(); }
}
async function restore({ uri, database, input, offline = false }) {
  checkDatabase(database);
  if (!offline) throw new Error('Stop all application writers, then pass --offline before restoring.');
  const verified = await readArchive(input); // Validate before connecting or writing to the target.
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect(); const db = client.db(database);
    if ((await db.listCollections({}, { nameOnly: true }).toArray()).length) throw new Error('Restore target must be a new, empty database. Nothing was overwritten.');
    const indexPlans = [];
    await readArchive(input, async record => {
      if (record.type === 'collection') {
        await db.createCollection(record.name, EJSON.parse(record.options));
        indexPlans.push({ name: record.name, indexes: EJSON.parse(record.indexes).filter(index => index.name !== '_id_').map(index => { const { v, ns, ...options } = index; return options; }) });
      } else if (record.type === 'document') await db.collection(record.name).insertOne(EJSON.parse(record.document));
    });
    for (const plan of indexPlans) if (plan.indexes.length) await db.collection(plan.name).createIndexes(plan.indexes);
    return { ...verified, targetDatabase: database, sessionsExcluded: true };
  } finally { await client.close(); }
}
module.exports = { backup, restore, verify: readArchive };
