const Workspace = require('../models/workspace');
const Supervisor = require('../models/supervisor');
const supervision = require('./supervisionService');
const { workflow } = require('./proposalReviewService');
const same = (a, b) => String(a) === String(b);
async function list(req) {
  const department = req.examiner.department;
  const [projects, ledger, supervisors] = await Promise.all([
    Workspace.find({ department }).select('name workType status isActive createdAt members proposalVersions.version proposalVersions.title proposalVersions.researchArea').sort({ createdAt: -1, _id: -1 }).lean(),
    supervision.readLedger(department),
    Supervisor.find({ department }).select('name').lean(),
  ]);
  const names = new Map(supervisors.map(item => [String(item._id), item.name]));
  return { projects: projects.filter(project=>(ledger.defences||[]).some(item=>same(item.workspace,project._id)&&item.status!=='cancelled'&&item.board.some(member=>same(member.id,req.examiner._id)))).map(project => {
    const assignment = ledger.assignments.find(item => same(item.workspace, project._id));
    const defence = (ledger.defences || []).filter(item => same(item.workspace, project._id) && item.status !== 'cancelled' && item.board.some(member => same(member.id, req.examiner._id))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const proposal = project.proposalVersions.at(-1), flow = workflow(project, ledger);
    return { id: String(project._id), name: project.name, title: proposal?.title || project.name, workType: project.workType, researchArea: proposal?.researchArea || '', memberCount: project.members.length, supervisorName: assignment ? names.get(String(assignment.supervisor)) || 'Unavailable Supervisor' : null, status: flow.status, proposalStatus: flow.proposalStatus, defenceId: defence ? String(defence._id) : null, evaluationStatus: defence?.evaluation?.publication ? 'published' : defence ? defence.evaluation?.records?.find(item => same(item.examiner.id, req.examiner._id))?.status || 'notStarted' : 'unassigned' };
  }) };
}
module.exports = { list };
