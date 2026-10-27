const bcrypt = require('bcryptjs');
const Department = require('../models/department');
const Supervisor = require('../models/supervisor');
const Student = require('../models/student');
const Examiner = require('../models/examiner');
const { roles, memberRoles } = require('../utils/permissions');
const models = { department: Department, supervisor: Supervisor, student: Student, examiner: Examiner };

function publicMember(account, department, role) {
  return {
    id: account.id, name: account.name, email: account.email, phone: account.phone,
    isActive: account.isActive !== false, departmentId: department.id, departmentName: department.name, university: department.university, role,
    ...(role === 'student'
      ? { studentId: account.studentId, batch: account.batch, academicSession: account.academicSession }
      : { designation: account.designation, researchInterests: account.researchInterests }),
  };
}

function publicDepartment(department) {
  return { id: department.id, name: department.name, university: department.university, email: department.email, role: 'department' };
}

async function signIn(req, department) {
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.departmentId = department.id;
  req.session.role = 'department';
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}


async function register(req, res) {
  if (req.body?.role && req.body.role !== 'department') return res.status(400).json({ message: 'Member accounts must be created by a department.' });
  const { name, university, email, password } = req.body || {};
  if (![name, university, email, password].every(value => typeof value === 'string')) {
    return res.status(400).json({ message: 'Please fill in every field.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!name.trim() || name.trim().length > 120 || !university.trim() || university.trim().length > 160) {
    return res.status(400).json({ message: 'Enter a department name (up to 120 characters) and university (up to 160 characters).' });
  }
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and at most 72 bytes.' });
  }
  try {
    const department = await Department.create({ name, university, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12) });
    await signIn(req, department);
    res.status(201).json({ department: publicDepartment(department) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists. Please sign in.' });
    throw error;
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  const role = req.body?.role || 'department';
  if (!roles.includes(role)) return res.status(400).json({ message: 'Select a valid account type.' });
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Enter your email and password.' });
  }
  const Model = models[role];
  const department = await Model.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  // Compare even for unknown accounts to keep password checks consistent.
  const hash = department?.passwordHash || '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
  const valid = await bcrypt.compare(password, hash);
  if (!department || !valid || department.isActive === false || department.deletedAt) return res.status(401).json({ message: 'Email or password is incorrect.' });
  if (role !== 'department') {
    const owner = await Department.findById(department.department);
    if (!owner) return res.status(401).json({ message: 'Department account is unavailable.' });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session[`${role}Id`] = department.id;
    req.session.role = role;
    req.session.authVersion = department.authVersion || 0;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return res.json({ user: publicMember(department, owner, role) });
  }
  await signIn(req, department);
  res.json({ department: publicDepartment(department) });
}

async function getCurrentUser(req, res) {
  if (memberRoles.includes(req.session.role)) {
    const role = req.session.role;
    const Model = models[role];
    const account = await Model.findById(req.session[`${role}Id`]).populate('department');
    if (!account?.department || account.isActive === false || account.deletedAt || (account.authVersion || 0) !== (req.session.authVersion || 0)) {
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      return res.status(401).json({ message: 'Please sign in again.' });
    }
    return res.json({ user: publicMember(account, account.department, role) });
  }
  if (!req.session.departmentId) return res.status(401).json({ message: 'Please sign in.' });
  const department = await Department.findById(req.session.departmentId);
  if (!department) return res.status(401).json({ message: 'Please sign in again.' });
  res.json({ department: publicDepartment(department) });
}

async function logout(req, res) {
  await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  res.clearCookie('department.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Signed out.' });
}

module.exports = { register, login, getCurrentUser, logout };
