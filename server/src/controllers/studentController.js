const bcrypt = require('bcryptjs');
const Student = require('../models/student');
const { validateMemberInput } = require('../utils/memberValidation');

function publicStudent(student) {
  return { id: student.id, name: student.name, email: student.email, phone: student.phone, studentId: student.studentId, batch: student.batch, academicSession: student.academicSession, createdAt: student.createdAt, isActive: student.isActive !== false };
}


async function listStudents(req, res) {
  const students = await Student.find({ department: req.session.departmentId, deletedAt: null }).sort({ createdAt: -1 });
  res.json({ students: students.map(publicStudent) });
}

async function getStudent(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Student not found.' });
  const student = await Student.findOne({ _id: req.params.id, department: req.session.departmentId, deletedAt: null });
  if (!student) return res.status(404).json({ message: 'Student not found.' });
  res.json({ student: publicStudent(student) });
}


async function createStudent(req, res) {
  const { fields, password, error } = validateMemberInput(req.body || {}, 'student');
  if (error) return res.status(400).json({ message: error });
  try {
    const account = await Student.create({ ...fields, department: req.session.departmentId, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ student: publicStudent(account) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A student with this email or student ID already exists.' });
    throw error;
  }
}

async function updateStudent(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Student not found.' });
  const account = await Student.findOne({ _id: req.params.id, department: req.session.departmentId, deletedAt: null });
  if (!account) return res.status(404).json({ message: 'Student not found.' });
  const { fields, password, error } = validateMemberInput({ ...account.toObject(), ...req.body }, 'student', { requirePassword: false });
  if (error) return res.status(400).json({ message: error });
  try {
    if (req.body?.isActive !== undefined && typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'Account status must be true or false.' });
    if (req.body?.isActive !== undefined && req.body.isActive !== (account.isActive !== false)) {
      account.isActive = req.body.isActive;
      account.authVersion = (account.authVersion || 0) + 1;
    }
    account.set(fields);
    if (password) account.passwordHash = await bcrypt.hash(password, 12);
    await account.save();
    res.json({ student: publicStudent(account) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A student with this email or student ID already exists.' });
    throw error;
  }
}

async function deleteStudent(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Student not found.' });
  const account = await Student.findOneAndUpdate({ _id: req.params.id, department: req.session.departmentId, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false }, $inc: { authVersion: 1 } });
  if (!account) return res.status(404).json({ message: 'Student not found.' });
  res.json({ message: 'Student deleted.' });
}

module.exports = { listStudents, getStudent, createStudent, updateStudent, deleteStudent };
