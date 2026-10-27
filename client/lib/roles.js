export const roleDefinitions = {
  department: { label: 'Coordinator', dashboard: '/department/dashboard', canManageAccounts: true },
  supervisor: { label: 'Supervisor', dashboard: '/supervisor/dashboard' },
  student: { label: 'Student', dashboard: '/student/dashboard' },
  examiner: { label: 'Examiner', dashboard: '/examiner/dashboard' },
};
export function dashboardForRole(role) {
  return roleDefinitions[role]?.dashboard || '/';
}
export function canManageAccounts(role) {
  return roleDefinitions[role]?.canManageAccounts === true;
}
