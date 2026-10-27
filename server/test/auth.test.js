const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

test('department registration, validation, login, session persistence and logout', { timeout: 30000 }, async () => {
  process.env.SESSION_SECRET = randomBytes(48).toString('hex');
  const dbName = `thesis_auth_test_${randomBytes(8).toString('hex')}`;
  let server;
  let app;
  try {
    // An isolated database is used; application records are never modified.
    await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
    const Department = require('../src/models/department');
    await Department.init();
    app = require('../src');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const request = (route, body, cookie) => fetch(`${base}/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const account = { name: 'Computer Science', university: 'Test University', email: 'DEPARTMENT@example.edu', password: 'test-password-123' };
    assert.equal((await request('me')).status, 401);
    assert.equal((await request('register', { ...account, name: '   ' })).status, 400);
    assert.equal((await request('register', { ...account, email: { $ne: null } })).status, 400);
    assert.equal((await request('register', { ...account, password: 'short' })).status, 400);
    const registered = await request('register', account);
    assert.equal(registered.status, 201);
    const department = (await registered.json()).department;
    assert.equal(department.email, 'department@example.edu');
    assert.equal(department.passwordHash, undefined);
    const record = await Department.findById(department.id).select('+passwordHash');
    assert.notEqual(record.passwordHash, account.password);
    assert.equal(await require('bcryptjs').compare(account.password, record.passwordHash), true);
    assert.equal((await request('register', account)).status, 409);
    const cookie = registered.headers.get('set-cookie').split(';')[0];
    assert.match(registered.headers.get('set-cookie'), /HttpOnly/i);
    assert.equal((await request('me', null, cookie)).status, 200);
    assert.equal((await request('login', { email: account.email, password: 'wrong' })).status, 401);
    const login = await request('login', { email: account.email.toLowerCase(), password: account.password }, cookie);
    assert.equal(login.status, 200);
    const loginCookie = login.headers.get('set-cookie').split(';')[0];
    assert.notEqual(loginCookie, cookie);
    assert.equal((await request('me', null, cookie)).status, 401);
    const restored = await request('me', null, loginCookie);
    assert.deepEqual((await restored.json()).department, department);
    assert.equal((await request('logout', {}, loginCookie)).status, 200);
    assert.equal((await request('me', null, loginCookie)).status, 401);
    const formPost = await fetch(`${base}/login`, { method: 'POST', body: 'email=test' });
    assert.equal(formPost.status, 415);
    let last;
    for (let index = 0; index < 20; index++) last = await request('login', {});
    assert.equal(last.status, 429);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    if (app?.locals.sessionStore) await app.locals.sessionStore.close();
    await mongoose.disconnect();
  }
});
