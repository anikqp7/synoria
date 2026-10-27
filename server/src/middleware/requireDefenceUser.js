const guards = { department: require('./requireDepartment')('defence schedules'), supervisor: require('./requireSupervisor'), student: require('./requireStudent'), examiner: require('./requireExaminer') };
module.exports = async function requireDefenceUser(req, res, next) {
  const role = req.session.role || (req.session.departmentId ? 'department' : null);
  if (!role || !guards[role]) return res.status(401).json({ message: 'Please sign in to view defence schedules.' });
  await guards[role](req, res, async error => {
    if (error) return next(error);
    req.defenceRole = role;
    req.defenceAccount = req.supervisor || req.student || req.examiner;
    req.defenceDepartment = role === 'department' ? req.session.departmentId : req.defenceAccount.department;
    next();
  });
};
