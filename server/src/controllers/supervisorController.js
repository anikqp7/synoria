const bcrypt = require('bcryptjs');
const Supervisor = require('../models/supervisor');
const { validateMemberInput } = require('../utils/memberValidation');

function publicSupervisor(supervisor) {
  return { id: supervisor.id, name: supervisor.name, email: supervisor.email, phone: supervisor.phone, designation: supervisor.designation, researchInterests: supervisor.researchInterests, createdAt: supervisor.createdAt, isActive: supervisor.isActive !== false };
}


async function listSupervisors(req, res) {
  const supervisors = await Supervisor.find({ department: req.session.departmentId, deletedAt: null }).sort({ createdAt: -1 });
  res.json({ supervisors: supervisors.map(publicSupervisor) });
}

async function getSupervisor(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Supervisor not found.' });
  const supervisor = await Supervisor.findOne({ _id: req.params.id, department: req.session.departmentId, deletedAt: null });
  if (!supervisor) return res.status(404).json({ message: 'Supervisor not found.' });
  res.json({ supervisor: publicSupervisor(supervisor) });
}


async function createSupervisor(req, res) {
  const { fields, password, error } = validateMemberInput(req.body || {}, 'supervisor');
  if (error) return res.status(400).json({ message: error });
  try {
    const account = await Supervisor.create({ ...fields, department: req.session.departmentId, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ supervisor: publicSupervisor(account) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A supervisor with this email already exists.' });
    throw error;
  }
}

async function updateSupervisor(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Supervisor not found.' });
  const account = await Supervisor.findOne({ _id: req.params.id, department: req.session.departmentId, deletedAt: null });
  if (!account) return res.status(404).json({ message: 'Supervisor not found.' });
  const { fields, password, error } = validateMemberInput({ ...account.toObject(), ...req.body }, 'supervisor', { requirePassword: false });
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
    res.json({ supervisor: publicSupervisor(account) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A supervisor with this email already exists.' });
    throw error;
  }
}

async function deleteSupervisor(req, res) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Supervisor not found.' });
  const account = await Supervisor.findOneAndUpdate({ _id: req.params.id, department: req.session.departmentId, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false }, $inc: { authVersion: 1 } });
  if (!account) return res.status(404).json({ message: 'Supervisor not found.' });
  res.json({ message: 'Supervisor deleted.' });
}

module.exports = { listSupervisors, getSupervisor, createSupervisor, updateSupervisor, deleteSupervisor };
