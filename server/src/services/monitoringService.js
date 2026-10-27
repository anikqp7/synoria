const Workspace = require('../models/workspace');
const Student = require('../models/student');
const supervision = require('./supervisionService');
const proposalReview = require('./proposalReviewService');
const same = (a, b) => String(a) === String(b);
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const policy = { unassignedProposalDays: 7 };
function projectView(workspace, ledger, supervisors, now = new Date()) {
  const flow = proposalReview.workflow(workspace, ledger);
  const assignment = ledger.assignments.find(item => same(item.workspace, workspace._id));
  const supervisor = assignment && supervisors.find(item => item.id === String(assignment.supervisor));
  const riskReasons = [];
  if (workspace.isActive && !['archived', 'evaluated'].includes(flow.status)) {
    if (flow.proposalStatus === 'revisionRequested') riskReasons.push({ code: 'revisionPending', text: 'The proposal requires revision.' });
    const submittedAt = workspace.proposalVersions?.[0]?.submittedAt;
    if (!assignment && submittedAt && now - new Date(submittedAt) >= policy.unassignedProposalDays * 86400000) riskReasons.push({ code: 'unassigned', text: 'The submitted proposal is awaiting supervisor assignment.' });
  }
  return { id: String(workspace._id), name: workspace.name, workType: workspace.workType, status: flow.status, proposalStatus: flow.proposalStatus, title: workspace.proposalVersions?.at(-1)?.title || workspace.proposalDraft?.title || '', researchArea: workspace.proposalVersions?.at(-1)?.researchArea || workspace.proposalDraft?.researchArea || '', memberCount: workspace.members.length, supervisor: supervisor || null, defenceReady: flow.defenceReady, isActive: workspace.isActive, createdAt: workspace.createdAt, atRisk: !!riskReasons.length, riskReasons };
}
async function snapshot(department) {
  const [workspaces, ledger, supervisors] = await Promise.all([Workspace.find({ department }).lean(), supervision.readLedger(department), supervision.loads(department)]);
  const generatedAt = new Date();
  return { projects: workspaces.map(item => projectView(item, ledger, supervisors, generatedAt)), supervisors, generatedAt, policy };
}
async function list(department, query) {
  if (Object.keys(query).some(key => !['search', 'status', 'workType', 'risk', 'supervisorId', 'page'].includes(key)) || Object.values(query).some(value => typeof value !== 'string') || query.search?.length > 200 || (query.status && !['draft','submitted','active','defenceScheduled','evaluated','archived'].includes(query.status)) || (query.workType && !['project','thesis','research'].includes(query.workType)) || (query.risk && !['atRisk','onTrack','defenceReady'].includes(query.risk)) || (query.supervisorId && query.supervisorId !== 'unassigned' && !validId(query.supervisorId)) || (query.page && !/^[1-9]\d{0,5}$/.test(query.page))) supervision.fail(400, 'Choose valid project filters.');
  const data = await snapshot(department), summary = { total: data.projects.length, atRisk: 0, defenceReady: 0, revisionPending: 0, byStatus: {} };
  for (const item of data.projects) { summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1; summary.atRisk += Number(item.atRisk); summary.defenceReady += Number(item.defenceReady); summary.revisionPending += Number(item.riskReasons.some(reason => reason.code === 'revisionPending')); }
  const search = (query.search || '').trim().toLowerCase();
  const filtered = data.projects.filter(item => (!search || [item.name,item.title,item.researchArea,item.supervisor?.name].some(value => value?.toLowerCase().includes(search))) && (!query.status || item.status === query.status) && (!query.workType || item.workType === query.workType) && (!query.risk || (query.risk === 'defenceReady' ? item.defenceReady : item.atRisk === (query.risk === 'atRisk'))) && (!query.supervisorId || (query.supervisorId === 'unassigned' ? !item.supervisor : item.supervisor?.id === query.supervisorId))).sort((a,b) => Number(b.atRisk)-Number(a.atRisk) || a.name.localeCompare(b.name));
  const page = Number(query.page || 1), pageSize = 20;
  return { ...data, summary, projects: filtered.slice((page-1)*pageSize,page*pageSize), total: filtered.length, page, pageSize };
}
async function detail(department, id) {
  const workspace = validId(id) && await Workspace.findOne({ _id:id, department });
  if (!workspace) supervision.fail(404,'Project not found.');
  const [ledger,supervisors,members] = await Promise.all([supervision.readLedger(department),supervision.loads(department),Student.find({ _id:{$in:workspace.members},department }).select('name studentId isActive deletedAt')]);
  const flow = proposalReview.workflow(workspace,ledger), timeline = [];
  const event = (type,title,at,description='') => { if(at) timeline.push({type,title,at,description}); };
  event('workspace','Workspace Created',workspace.createdAt,workspace.name);
  for(const version of flow.versions) event('proposal',`Proposal Version ${version.version} Submitted`,version.submittedAt,version.title);
  for(const review of flow.reviews) event('review',`Proposal ${review.decision}`,review.createdAt,review.comment);
  for(const assignment of ledger.history) if(same(assignment.workspace,id)) event('assignment','Supervisor Assignment Changed',assignment.createdAt,`${assignment.from?.name || 'Unassigned'} → ${assignment.to?.name || 'Unassigned'}`);
  const defences = (ledger.defences || []).filter(item=>same(item.workspace,id));
  for(const defence of defences) for(const change of defence.history) event('defence',`Defence ${change.type}`,change.createdAt,change.reason);
  return {project:projectView(workspace,ledger,supervisors),members:members.map(item=>({id:item.id,name:item.name,studentId:item.studentId,isLeader:same(item._id,workspace.leader),isActive:item.isActive!==false&&!item.deletedAt})),proposal:{...flow,draft:workspace.proposalDraft},defences:defences.map(require('./defenceService').publicSchedule),timeline:timeline.sort((a,b)=>new Date(b.at)-new Date(a.at)),policy,generatedAt:new Date()};
}
async function overview(department) {
  const data = await snapshot(department);
  const active = data.projects.filter(item => item.isActive && !['archived', 'evaluated'].includes(item.status));
  const awaitingAssignment = active.filter(item => item.proposalStatus !== 'draft' && !item.supervisor);
  const attention = active.flatMap(item => {
    let reason, action, priority;
    if (item.proposalStatus !== 'draft' && (!item.supervisor || !item.supervisor.isActive)) {
      reason = item.supervisor ? 'Assigned supervisor is inactive' : 'Supervisor not assigned';
      action = item.supervisor ? 'Reassign Supervisor' : 'Assign Supervisor'; priority = 0;
    } else if (item.proposalStatus === 'revisionRequested') {
      reason = 'Proposal revision requested'; action = 'View Proposal'; priority = 1;
    } else if (item.proposalStatus === 'submitted') {
      reason = 'Awaiting supervisor review'; action = 'View Proposal'; priority = 2;

    } else return [];
    return [{ id: item.id, name: item.name, createdAt: item.createdAt, reason, action, priority, href: `/department/proposals/${item.id}` }];
  }).sort((a, b) => a.priority - b.priority || new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.name.localeCompare(b.name));
  const upcoming = await require('../models/defenceNotice').find({ department, startsAt: { $gte: data.generatedAt } }).sort({ startsAt: 1, _id: 1 }).lean();
  const supervisors = data.supervisors.filter(item => item.isActive).sort((a, b) => b.currentLoad / Math.max(1, b.maxLoad) - a.currentLoad / Math.max(1, a.maxLoad) || a.name.localeCompare(b.name));
  return {
    summary: { total: data.projects.length, awaitingAssignment: awaitingAssignment.length, active: data.projects.filter(item => item.isActive && ['active', 'defenceScheduled', 'evaluated'].includes(item.status)).length, upcoming: upcoming.length },
    attention: attention.slice(0, 5), attentionCount: attention.length,
    supervisors: supervisors.slice(0, 4), supervisorCount: supervisors.length,
    availablePlaces: supervisors.reduce((sum, item) => sum + item.available, 0),
    upcoming: upcoming.slice(0, 3).map(item => ({ id: String(item._id), batch: item.batch, stream: item.stream, startsAt: item.startsAt, venue: item.venue })),
    generatedAt: data.generatedAt,
  };
}
module.exports = {list,detail,overview,projectView,policy};
