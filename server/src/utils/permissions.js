// Department accounts perform the coordinator role. Never accept permissions from request bodies.
const roles = Object.freeze(['department', 'supervisor', 'student', 'examiner']);
const memberRoles = Object.freeze(roles.filter(role => role !== 'department'));
function can(role, permission) {
  return (permission === 'manageAccounts' && role === 'department') || (permission === 'manageWorkspace' && role === 'student');
}
module.exports = { roles, memberRoles, can };
