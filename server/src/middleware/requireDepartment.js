const { can } = require('../utils/permissions');
const Department = require('../models/department');

module.exports = function requireDepartment(resource) {
  return async function departmentAccess(req, res, next) {
    if (req.session.role && !can(req.session.role, 'manageAccounts')) return res.status(403).json({ message: `Only departments can manage ${resource}.` });
    if (!req.session.departmentId) return res.status(401).json({ message: 'Department sign in is required.' });
    if (!await Department.exists({ _id: req.session.departmentId })) return res.status(401).json({ message: 'Please sign in again.' });
    next();
  };
};
