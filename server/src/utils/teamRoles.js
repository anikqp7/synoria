const TEAM_ROLES = Object.freeze({
  TEAM_LEAD: 'Team Lead',
  RESEARCHER: 'Researcher',
  LITERATURE_REVIEWER: 'Literature Reviewer',
  METHODOLOGY_LEAD: 'Methodology Lead',
  DATA_COLLECTOR: 'Data Collector',
  DATA_ANALYST: 'Data Analyst',
  EXPERIMENT_LEAD: 'Experiment Lead',
  FRONTEND_DEVELOPER: 'Frontend Developer',
  BACKEND_DEVELOPER: 'Backend Developer',
  FULL_STACK_DEVELOPER: 'Full Stack Developer',
  UI_UX_DESIGNER: 'UI/UX Designer',
  QA_TESTER: 'QA Tester',
  DOCUMENTATION_LEAD: 'Documentation Lead',
  PRESENTATION_LEAD: 'Presentation Lead',
  MEMBER: 'Member',
});
const ROLE_VALUES = Object.freeze(Object.values(TEAM_ROLES));
const legacyAliases = {Designer: TEAM_ROLES.UI_UX_DESIGNER, 'UX Designer': TEAM_ROLES.UI_UX_DESIGNER, Tester: TEAM_ROLES.QA_TESTER, Analyst: TEAM_ROLES.DATA_ANALYST, Leader: TEAM_ROLES.TEAM_LEAD};
function existingRole(value, fallback=TEAM_ROLES.MEMBER) {return ROLE_VALUES.includes(value)?value:(Object.hasOwn(legacyAliases,value)?legacyAliases[value]:fallback);}
module.exports = {TEAM_ROLES, ROLE_VALUES, existingRole};
