const bcrypt = require('bcryptjs');
const Examiner = require('../models/examiner');
const { validateMemberInput } = require('../utils/memberValidation');

function publicExaminer(examiner) {
  return { id: examiner.id, name: examiner.name, email: examiner.email, phone: examiner.phone, designation: examiner.designation, researchInterests: examiner.researchInterests, createdAt: examiner.createdAt, isActive: examiner.isActive !== false };
}


async function listExaminers(req, res) {
  const examiners = await Examiner.find({ department: req.session.departmentId, deletedAt: null }).sort({ createdAt: -1 });
  res.json({ examiners: examiners.map(publicExaminer) });
}

async function getExaminer(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Examiner not found.' });
  const examiner = await Examiner.findOne({ _id: req.params.id, department: req.session.departmentId, deletedAt: null });
  if (!examiner) return res.status(404).json({ message: 'Examiner not found.' });
  res.json({ examiner: publicExaminer(examiner) });
}


async function createExaminer(req, res) {
  const { fields, password, error } = validateMemberInput(req.body || {}, 'examiner');
  if (error) return res.status(400).json({ message: error });
  try {
    const account = await Examiner.create({ ...fields, department: req.session.departmentId, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ examiner: publicExaminer(account) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An examiner with this email already exists.' });
    throw error;
  }
}

async function updateExaminer(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Examiner not found.' });
  const account = await Examiner.findOne({ _id: req.params.id, department: req.session.departmentId, deletedAt: null });
  if (!account) return res.status(404).json({ message: 'Examiner not found.' });
  const { fields, password, error } = validateMemberInput({ ...account.toObject(), ...req.body }, 'examiner', { requirePassword: false });
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
    res.json({ examiner: publicExaminer(account) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An examiner with this email already exists.' });
    throw error;
  }
}

async function deleteExaminer(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Examiner not found.' });
  const account = await Examiner.findOneAndUpdate({ _id: req.params.id, department: req.session.departmentId, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false }, $inc: { authVersion: 1 } });
  if (!account) return res.status(404).json({ message: 'Examiner not found.' });
  res.json({ message: 'Examiner deleted.' });
}

module.exports = { listExaminers, getExaminer, createExaminer, updateExaminer, deleteExaminer };
