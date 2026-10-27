const Examiner = require('../models/examiner');
const Department = require('../models/department');
module.exports = async function requireExaminer(req, res, next) {
  if (!req.session.role) return res.status(401).json({ message: 'Examiner sign in is required.' });
  if (req.session.role !== 'examiner') return res.status(403).json({ message: 'Only assigned examiners can access this resource.' });
  const account = await Examiner.findById(req.session.examinerId);
  if (!account || account.isActive === false || account.deletedAt || (account.authVersion || 0) !== (req.session.authVersion || 0) || !await Department.exists({ _id: account.department })) {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    return res.status(401).json({ message: 'Please sign in again.' });
  }
  req.examiner = account; next();
};
