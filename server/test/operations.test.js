const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
test('isolated demo seed and verified BSON backup/restore preserve indexes, notifications and published results', { timeout: 60000 }, async () => {
  const database = `synoria_ops_${randomBytes(6).toString('hex')}_demo`, restored = `synoria_restore_${randomBytes(6).toString('hex')}`;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synoria-operations-')); let db;
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 5000 }); db = mongoose.connection.db;
    const seed = require('../src/services/demoSeedService'), archives = require('../src/services/backupService');
    const result = await seed.seedDemo({ password: 'DemoTestPassword!2026' }); assert.equal(result.created, true); assert.equal(result.projects.length, 6);
    const again = await seed.seedDemo({ password: 'AnotherPassword!2026' }); assert.equal(again.created, false); assert.equal(await db.collection('students').countDocuments(), 8);
    const ledger = await db.collection('supervisionledgers').findOne(); const published = ledger.defences.find(item => item.status === 'published'); assert.equal(published.evaluation.publication.weightedTotal, 82);
    assert.equal((await db.collection('workspaces').findOne({ _id: published.workspace })).isActive, false);
    const Notification = require('../src/models/notification'); await Notification.init();
    const noticeRecipient = await db.collection('students').findOne();
    const notice = await Notification.create({ department: ledger._id, recipient: noticeRecipient._id, role: 'student', eventKey: 'backup-notice', category: 'account', title: 'Saved Notice', message: 'Read state should survive restore.', href: '/student/account', scope: 'personal', occurredAt: new Date(), receivedAt: new Date(), readAt: new Date() });
    await db.collection('sessions').insertOne({ _id: 'DO_NOT_RESTORE_SESSION', expires: new Date() });
    const output = path.join(dir, 'demo.jsonl.gz');
    await assert.rejects(archives.backup({ uri: process.env.MONGODB_URI, database, output }), /Stop all application writers/);
    const backup = await archives.backup({ uri: process.env.MONGODB_URI, database, output, offline: true }); assert.ok(backup.documents > 20);
    assert.equal((await fs.stat(output)).mode & 0o777, 0o600);
    const verified = await archives.verify(output); assert.equal(verified.documents, backup.documents);
    await assert.rejects(archives.backup({ uri: process.env.MONGODB_URI, database, output, offline: true }), /EEXIST/);
    const restoredResult = await archives.restore({ uri: process.env.MONGODB_URI, database: restored, input: output, offline: true }); assert.equal(restoredResult.documents, backup.documents);
    const target = mongoose.connection.getClient().db(restored);
    assert.equal(await target.collection('sessions').countDocuments(), 0);
    const restoredLedger = await target.collection('supervisionledgers').findOne(); assert.equal(restoredLedger.defences.find(item => item.status === 'published').evaluation.publication.weightedTotal, 82);
    const restoredNotice = await target.collection('notifications').findOne({ _id: notice._id }); assert.ok(restoredNotice.readAt instanceof Date); assert.equal(restoredNotice.readAt.toISOString(), notice.readAt.toISOString());
    const indexes = await target.collection('workspaces').indexes(); assert.ok(indexes.find(item => item.name === 'oneActiveTeamPerStudent').unique);
    await assert.rejects(archives.restore({ uri: process.env.MONGODB_URI, database: restored, input: output, offline: true }), /new, empty database/);
    const corrupt = path.join(dir, 'corrupt.gz'); await fs.writeFile(corrupt, (await fs.readFile(output)).subarray(0, 100));
    await assert.rejects(archives.restore({ uri: process.env.MONGODB_URI, database: `${restored}_bad`, input: corrupt, offline: true }));
    assert.equal((await mongoose.connection.getClient().db(`${restored}_bad`).listCollections().toArray()).length, 0);
    assert.equal(await target.collection('students').countDocuments(), 8);
  } finally {
    if (db) { await db.dropDatabase(); await mongoose.connection.getClient().db(restored).dropDatabase(); await mongoose.connection.getClient().db(`${restored}_bad`).dropDatabase(); }
    await mongoose.disconnect(); await fs.rm(dir, { recursive: true, force: true });
  }
});
