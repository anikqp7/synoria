const Workspace = require('../models/workspace');
const Student = require('../models/student');
const Supervisor = require('../models/supervisor');
const supervision = require('./supervisionService');
const { withGate } = require('./proposalPeriodService');
const { fail } = supervision;
const {cancellationsFor,cancellationFor}=require('../utils/supervisorRequestState');
const same = (a, b) => String(a) === String(b);
const validId = id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const locked = (workspace, ledger) => !workspace.isActive || workspace.status === 'archived' || (ledger.defences || []).some(item => same(item.workspace, workspace._id) && (item.board?.length || item.history?.some(event => event.board?.length)));
function view(workspace, ledger, supervisors) {
  const assignment = ledger.assignments.find(item => same(item.workspace, workspace._id));
  const current = assignment && supervisors.find(item => same(item.id, assignment.supervisor));
  const cancelled = cancellationFor(ledger,workspace);
  const history = cancellationsFor(ledger,workspace).map(event=>({id:String(event._id),note:event.reason,cancelledAt:event.createdAt,revision:event.requestCancellation.revision,choices:event.requestCancellation.choices})).reverse();
  return {
    status: assignment?'assigned':cancelled?'cancelled':workspace.supervisorRequest?.submittedAt?'pending':'draft',
    cancellation:cancelled?{note:cancelled.reason,cancelledAt:cancelled.createdAt}:null,cancellationHistory:history,
    workspaceId: workspace.id, workspaceName: workspace.name, leaderId: String(workspace.leader),
    memberCount: workspace.members.length, revision: workspace.supervisorRequest?.revision || 0,
    choices: (workspace.supervisorRequest?.choices || []).map((choice, index) => {
      const account = supervisors.find(item => same(item.id, choice.supervisor));
      return { id: String(choice.supervisor), name: account?.name || choice.name, rank: index + 1, isActive: !!account?.isActive, available: account?.available ?? 0 };
    }),
    submittedAt: workspace.supervisorRequest?.submittedAt || null,
    assignment: assignment ? { supervisorId: String(assignment.supervisor), name: current?.name || 'Unavailable Supervisor', assignedAt: assignment.assignedAt } : null,
    locked: locked(workspace, ledger),
  };
}
async function read(req) {
  const department = req.defenceDepartment;
  const [ledger, supervisors] = await Promise.all([supervision.readLedger(department), supervision.loads(department)]);
  if (req.defenceRole === 'department') {
    const teams = await Workspace.find({ department, 'supervisorRequest.submittedAt': { $ne: null, $exists: true } }).sort({ 'supervisorRequest.submittedAt': -1 });
    const students = await Student.find({ department, _id: { $in: teams.map(item => item.leader) } }).select('name studentId email');
    const leaders = new Map(students.map(student => [student.id, { name: student.name, studentId: student.studentId, email: student.email }]));
    return { supervisors, requests: teams.flatMap(team => {
      const current={...view(team,ledger,supervisors),leader:leaders.get(String(team.leader))||{name:'Unavailable Student'}};
      const previous=current.cancellationHistory.filter(event=>event.revision!==current.revision).map(event=>({
        ...current,status:'cancelled',revision:event.revision,assignment:null,cancellation:{note:event.note,cancelledAt:event.cancelledAt},
        choices:event.choices.map((choice,index)=>{const account=supervisors.find(item=>same(item.id,choice.supervisor));return {id:String(choice.supervisor),name:choice.name,rank:index+1,isActive:!!account?.isActive,available:account?.available||0};}),
      }));
      return [current,...previous];
    }) };

  }
  const workspace = await Workspace.findOne({ department, members: req.student._id }).sort({ isActive: -1, createdAt: -1 });
  if (!workspace) return { request: null, supervisors: supervisors.filter(item => item.isActive) };
  const request = view(workspace, ledger, supervisors);
  return { request: { ...request, isLeader: same(workspace.leader, req.student._id), canEdit: same(workspace.leader, req.student._id) && !request.locked && !request.assignment }, supervisors: supervisors.filter(item => item.isActive) };
}
async function submit(req) {
  if (req.defenceRole !== 'student') fail(403, 'Only a team leader can submit supervisor choices.');
  const body = req.body || {};
  if (!Array.isArray(body.choices) || body.choices.length !== 3 || !body.choices.every(validId) || new Set(body.choices.map(id => id.toLowerCase())).size !== 3 || !Number.isSafeInteger(body.revision) || body.revision < 0) fail(400, 'Choose three different supervisors in preference order.');
  body.choices = body.choices.map(id => id.toLowerCase());
  return withGate(req.defenceDepartment, async account => {
    require('./supervisorPeriodService').assertOpen(account);
    const workspace = await Workspace.findOne({ department: req.defenceDepartment, members: req.student._id, isActive: true });
    if (!workspace) fail(409, 'Create or join a team before requesting a supervisor.');
    if (!same(workspace.leader, req.student._id)) fail(403, 'Only the team leader can submit supervisor choices.');
    const ledger = await supervision.readLedger(req.defenceDepartment);
    if (locked(workspace, ledger) || ledger.assignments.some(item => same(item.workspace, workspace._id))) fail(409, 'Supervisor choices are locked after assignment or project completion.');
    if ((workspace.supervisorRequest?.revision || 0) !== body.revision) fail(409, 'The supervisor request changed. Refresh and try again.');
    const supervisors = await Supervisor.find({ department: req.defenceDepartment, _id: { $in: body.choices }, isActive: { $ne: false }, deletedAt: null });
    if (supervisors.length !== 3) fail(400, 'Choose three active supervisors from your department.');
    workspace.chatActivities = require('./chatActivityService').workspaceActivities(workspace);
    workspace.supervisorRequest = { choices: body.choices.map(id => { const account = supervisors.find(item => same(item._id, id)); return { supervisor: account._id, name: account.name }; }), revision: body.revision + 1, submittedAt: new Date(), submittedBy: req.student._id };
    workspace.chatActivities = require('./chatActivityService').workspaceActivities(workspace);
    workspace.increment();
    await workspace.save();
    return read(req);
  });
}
async function assign(req) {
  if (req.defenceRole !== 'department') fail(403, 'Only your department can assign supervisors.');
  const body = req.body || {};
  if (!validId(req.params.id) || !(body.supervisorId === null || validId(body.supervisorId)) || !(body.expectedSupervisorId === null || validId(body.expectedSupervisorId)) || !Number.isSafeInteger(body.revision) || body.revision < 0) fail(400, 'Choose a supervisor and refresh the request before assigning.');
  if(body.supervisorId===null && (typeof body.note!=='string'||!body.note.trim()||body.note.trim().length>500))fail(400,'Enter a cancellation note up to 500 characters.');
  if(body.supervisorId)body.supervisorId = body.supervisorId.toLowerCase();
  if(body.expectedSupervisorId)body.expectedSupervisorId = body.expectedSupervisorId.toLowerCase();
  return withGate(req.defenceDepartment, async () => {
    const workspace = await Workspace.findOne({ _id: req.params.id, department: req.defenceDepartment });
    if (!workspace?.supervisorRequest?.submittedAt) fail(404, 'Supervisor request not found.');
    const ledger = await supervision.readLedger(req.defenceDepartment);
    if (locked(workspace, ledger)) fail(409, 'Supervisor assignment is locked after examiner assignment or completion.');
    if (workspace.supervisorRequest.revision !== body.revision) fail(409, 'The supervisor choices changed. Refresh and try again.');
    if(body.supervisorId && cancellationFor(ledger,workspace))fail(409,'This request was cancelled. Wait for a new request from the team.');
    if (body.supervisorId && !workspace.supervisorRequest.choices.some(choice => same(choice.supervisor, body.supervisorId))) fail(400, 'Choose one of the team’s three supervisor preferences.');
    await supervision.assign(req.defenceDepartment, workspace, body.supervisorId, body.expectedSupervisorId, body.supervisorId ? 'Assigned from ranked supervisor choices.' : body.note.trim(), req.defenceDepartment);
    return read(req);
  });
}
module.exports = { read, submit, assign };
