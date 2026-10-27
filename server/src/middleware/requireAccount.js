const guards = { supervisor: require('./requireSupervisor'), student: require('./requireStudent'), examiner: require('./requireExaminer') };
module.exports = function requireAccount(resource) {
  return async (req, res, next) => {
    const role = req.session.role || (req.session.departmentId ? 'department' : null);
    const guard = role === 'department' ? require('./requireDepartment')(resource) : guards[role];
    if (!guard) return res.status(401).json({ message: 'Please sign in to continue.' });
    await guard(req, res, error => {
      if (error) return next(error);
      const account = req.student || req.supervisor || req.examiner;
      req.accountContext = { role, id: role === 'department' ? String(req.session.departmentId) : account.id, department: role === 'department' ? req.session.departmentId : account.department, account };
      next();
    });
  };
};
