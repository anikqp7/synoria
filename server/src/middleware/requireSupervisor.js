const Supervisor = require('../models/supervisor');
const Department = require('../models/department');
module.exports = async function requireSupervisor(req, res, next) {
  if (!req.session.role) return res.status(401).json({ message: 'Supervisor sign in is required.' });
  if (req.session.role !== 'supervisor') return res.status(403).json({ message: 'Only supervisors can access assigned projects.' });
  const account = await Supervisor.findById(req.session.supervisorId);
  if (!account || account.isActive === false || account.deletedAt || (account.authVersion || 0) !== (req.session.authVersion || 0) || !await Department.exists({ _id: account.department })) {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    return res.status(401).json({ message: 'Please sign in again.' });
  }
  req.supervisor = account;
  next();
};
