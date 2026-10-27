const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

test('department-owned supervisors, validation and role-based login', { timeout: 30000 }, async () => {
  process.env.SESSION_SECRET = randomBytes(48).toString('hex');
  let app;
  let server;
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: `thesis_supervisor_test_${randomBytes(8).toString('hex')}`, serverSelectionTimeoutMS: 5000 });
    const Department = require('../src/models/department');
    const Supervisor = require('../src/models/supervisor');
    await Promise.all([Department.init(), Supervisor.init()]);
    app = require('../src');
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const request = (route, body, cookie, method) => fetch(`${base}/${route}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const password = 'department-password-123';
    const departments = await Department.create([
      { name: 'CSE', university: 'Test University', email: 'cse@example.edu', passwordHash: await bcrypt.hash(password, 12) },
      { name: 'EEE', university: 'Other University', email: 'eee@example.edu', passwordHash: await bcrypt.hash(password, 12) },
    ]);
    const cookieFor = response => response.headers.get('set-cookie').split(';')[0];
    const deptCookie = cookieFor(await request('login', { email: departments[0].email, password }));
    const otherCookie = cookieFor(await request('login', { email: departments[1].email, password }));
    const fields = { name: 'Dr. Ayesha', email: 'AYESHA@example.edu', phone: '+880 1712 345678', designation: 'Professor', researchInterests: 'Machine learning', password: 'supervisor-password-123', department: departments[1].id };
    assert.equal((await request('supervisors')).status, 401);
    assert.equal((await request('supervisors', fields)).status, 401);
    assert.equal((await request('supervisors', { ...fields, phone: 'abc' }, deptCookie)).status, 400);
    assert.equal((await request('supervisors', { ...fields, password: 'short' }, deptCookie)).status, 400);
    assert.equal((await request('supervisors', { ...fields, email: { $ne: null } }, deptCookie)).status, 400);
    const created = await request('supervisors', fields, deptCookie);
    assert.equal(created.status, 201);
    const supervisor = (await created.json()).supervisor;
    assert.equal(supervisor.email, 'ayesha@example.edu');
    assert.equal(supervisor.passwordHash, undefined);
    const profile = await request(`supervisors/${supervisor.id}`, null, deptCookie);
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).supervisor.email, 'ayesha@example.edu');
    assert.equal((await request(`supervisors/${supervisor.id}`, null, otherCookie)).status, 404);
    assert.equal((await request(`supervisors/${supervisor.id}`)).status, 401);
    assert.equal((await request('supervisors/not-an-id', null, deptCookie)).status, 404);
    assert.equal((await request('supervisors/000000000000000000000000', null, deptCookie)).status, 404);
    const saved = await Supervisor.findById(supervisor.id).select('+passwordHash');
    assert.equal(String(saved.department), departments[0].id);
    assert.notEqual(saved.passwordHash, fields.password);
    assert.equal(await bcrypt.compare(fields.password, saved.passwordHash), true);
    assert.equal((await request('supervisors', fields, deptCookie)).status, 409);
    assert.equal((await (await request('supervisors', null, deptCookie)).json()).supervisors.length, 1);
    assert.equal((await (await request('supervisors', null, otherCookie)).json()).supervisors.length, 0);
    assert.equal((await request('login', { email: fields.email, password: fields.password, role: 'department' })).status, 401);
    assert.equal((await request('login', { email: fields.email, password: 'wrong', role: 'supervisor' })).status, 401);
    assert.equal((await request('register', { ...fields, role: 'supervisor' })).status, 400);
    const login = await request('login', { email: fields.email, password: fields.password, role: 'supervisor' });
    assert.equal(login.status, 200);
    const user = (await login.json()).user;
    assert.equal(user.role, 'supervisor');
    assert.equal(user.departmentId, departments[0].id);
    assert.equal(user.university, 'Test University');
    assert.equal(user.passwordHash, undefined);
    const supervisorCookie = cookieFor(login);
    assert.equal((await (await request('me', null, supervisorCookie)).json()).user.email, 'ayesha@example.edu');
    assert.equal((await request('supervisors', null, supervisorCookie)).status, 403);
    assert.equal((await request(`supervisors/${supervisor.id}`, null, supervisorCookie)).status, 403);
    assert.equal((await request('supervisors', fields, supervisorCookie)).status, 403);

    const accountPath = `supervisors/${supervisor.id}`;
    assert.equal((await request(accountPath, { name: 'Intruder' }, otherCookie, 'PATCH')).status, 404);
    assert.equal((await request(accountPath, {}, otherCookie, 'DELETE')).status, 404);
    assert.equal((await request(accountPath, { name: 'Intruder' }, null, 'PATCH')).status, 401);
    assert.equal((await request(accountPath, { name: 'Intruder' }, supervisorCookie, 'PATCH')).status, 403);
    assert.equal((await request(accountPath, {}, supervisorCookie, 'DELETE')).status, 403);
    assert.equal((await request(accountPath, { email: { $ne: null } }, deptCookie, 'PATCH')).status, 400);
    assert.equal((await request(accountPath, { password: 'short' }, deptCookie, 'PATCH')).status, 400);
    const secondFields = { ...fields, email: 'second@example.edu' };
    assert.equal((await request('supervisors', secondFields, deptCookie)).status, 201);
    assert.equal((await request(accountPath, { email: secondFields.email }, deptCookie, 'PATCH')).status, 409);
    
    const updated = await request(accountPath, { name: 'Updated Member', phone: '+8801999999999', password: '', department: departments[1].id, passwordHash: 'injected' }, deptCookie, 'PATCH');
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).supervisor.name, 'Updated Member');
    const afterUpdate = await Supervisor.findById(supervisor.id).select('+passwordHash');
    assert.equal(String(afterUpdate.department), departments[0].id);
    assert.equal(afterUpdate.passwordHash, saved.passwordHash);
    const newPassword = 'updated-password-123';
    assert.equal((await request(accountPath, { password: newPassword }, deptCookie, 'PATCH')).status, 200);
    assert.equal((await request('login', { email: fields.email, password: fields.password, role: 'supervisor' })).status, 401);
    const newLogin = await request('login', { email: fields.email, password: newPassword, role: 'supervisor' });
    assert.equal(newLogin.status, 200);
    const newCookie = cookieFor(newLogin);
    assert.equal((await request(accountPath, {}, deptCookie, 'DELETE')).status, 200);
    assert.equal((await request(accountPath, null, deptCookie)).status, 404);
    assert.equal((await request('me', null, newCookie)).status, 401);
    assert.equal((await request('login', { email: fields.email, password: newPassword, role: 'supervisor' })).status, 401);
    assert.equal((await request(accountPath, {}, deptCookie, 'DELETE')).status, 404);
    await request('logout', {}, supervisorCookie);
    assert.equal((await request('me', null, supervisorCookie)).status, 401);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    if (app?.locals.sessionStore) await app.locals.sessionStore.close();
    await mongoose.disconnect();
  }
});
