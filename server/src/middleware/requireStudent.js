const Student = require('../models/student');
const Department = require('../models/department');
const { can } = require('../utils/permissions');
module.exports = async function requireStudent(req, res, next) {
  if (!req.session.role) return res.status(401).json({ message: 'Student sign in is required.' });
  if (!can(req.session.role, 'manageWorkspace')) return res.status(403).json({ message: 'Only students can access this workspace.' });
  const student = await Student.findById(req.session.studentId);
  if (!student || student.isActive === false || student.deletedAt || (student.authVersion || 0) !== (req.session.authVersion || 0) || !await Department.exists({ _id: student.department })) {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    return res.status(401).json({ message: 'Please sign in again.' });
  }
  req.student = student;
  next();
};
