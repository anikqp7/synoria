const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

test('four-role permissions, department boundaries and reversible account deactivation', { timeout: 60000 }, async () => {
  process.env.SESSION_SECRET = randomBytes(48).toString('hex');
  let app, server;
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: `synoria_lifecycle_${randomBytes(8).toString('hex')}`, serverSelectionTimeoutMS: 5000 });
    const Department = require('../src/models/department');
    const models = Object.fromEntries(['student', 'supervisor', 'examiner'].map(role => [role, require(`../src/models/${role}`)]));
    await Promise.all([Department.init(), ...Object.values(models).map(Model => Model.init())]);
    const password = 'account-password-123';
    const passwordHash = await bcrypt.hash(password, 12);
    const departments = await Department.create(['cse', 'eee'].map(name => ({ name, university: 'Test University', email: `${name}@example.edu`, passwordHash })));
    app = require('../src'); server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const request = (path, body, cookie, method) => fetch(`${base}/${path}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const cookieFor = response => response.headers.get('set-cookie').split(';')[0];
    const admin = cookieFor(await request('login', { email: departments[0].email, password }));
    const other = cookieFor(await request('login', { email: departments[1].email, password }));
    for (const [role, Model] of Object.entries(models)) {
      const resource = `${role}s`;
      const fields = { name: `${role} Name`, email: `${role}@example.edu`, phone: '+8801712345678', studentId: 'CSE-001', designation: 'Professor', password };
      assert.equal((await request(resource, fields)).status, 401);
      const created = await request(resource, { ...fields, department: departments[1].id, isActive: false }, admin);
      assert.equal(created.status, 201);
      const record = (await created.json())[role];
      assert.equal(record.isActive, true);
      assert.equal(record.passwordHash, undefined);
      const path = `${resource}/${record.id}`;
      const login = await request('login', { email: fields.email, password, role });
      assert.equal(login.status, 200);
      assert.equal((await login.json()).user.role, role);
      const memberCookie = cookieFor(login);
      for (const managedResource of ['students', 'supervisors', 'examiners']) {
        assert.equal((await request(managedResource, null, memberCookie)).status, 403);
        assert.equal((await request(managedResource, fields, memberCookie)).status, 403);
      }
      assert.equal((await request(path, null, other)).status, 404);
      assert.equal((await request(path, { isActive: false }, other, 'PATCH')).status, 404);
      assert.equal((await request(path, {}, other, 'DELETE')).status, 404);
      assert.equal((await request(path, { isActive: 'false' }, admin, 'PATCH')).status, 400);
      assert.equal((await request(path, { isActive: false }, memberCookie, 'PATCH')).status, 403);
      assert.equal((await request(path, { isActive: false }, admin, 'PATCH')).status, 200);
      assert.equal((await Model.findById(record.id)).isActive, false);
      assert.equal((await request(path, null, admin)).status, 200);
      assert.equal((await request('login', { email: fields.email, password, role })).status, 401);
      // Reactivate before checking the old session: it must never become valid again.
      assert.equal((await request(path, { isActive: true }, admin, 'PATCH')).status, 200);
      assert.equal((await request('me', null, memberCookie)).status, 401);
      const newLogin = await request('login', { email: fields.email, password, role });
      assert.equal(newLogin.status, 200);
      const freshCookie = cookieFor(newLogin);
      assert.equal((await request('me', null, freshCookie)).status, 200);
      assert.equal((await request(path, { name: 'Updated Name', department: departments[1].id, authVersion: 999 }, admin, 'PATCH')).status, 200);
      assert.equal(String((await Model.findById(record.id)).department), departments[0].id);
      // Legacy DELETE is a soft removal: references/history remain available to future projects.
      assert.equal((await request(path, {}, admin, 'DELETE')).status, 200);
      const retained = await Model.findById(record.id);
      assert.ok(retained.deletedAt);
      assert.equal(retained.isActive, false);
      assert.equal((await request(path, null, admin)).status, 404);
      assert.equal((await request('me', null, freshCookie)).status, 401);
      assert.equal((await request('login', { email: fields.email, password, role })).status, 401);
    }
    assert.equal((await request('register', { role: 'examiner' })).status, 400);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    if (app?.locals.sessionStore) await app.locals.sessionStore.close();
    await mongoose.disconnect();
  }
});
