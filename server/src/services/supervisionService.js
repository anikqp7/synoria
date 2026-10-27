const Ledger = require('../models/supervisionLedger');
const Workspace = require('../models/workspace');
const Supervisor = require('../models/supervisor');
const DEFAULT_MAX_LOAD = 5;
const idOf = value => value == null ? null : String(value);
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
async function readLedger(departmentId) {
  try {
    return await Ledger.findOneAndUpdate({ _id: departmentId }, { $setOnInsert: { revision: 0, limits: [], assignments: [], history: [] } }, { upsert: true, returnDocument: 'after' }).lean();
  } catch (error) { if (error.code === 11000) return Ledger.findById(departmentId).lean(); throw error; }
}
async function activeIds(ledger) {
  const workspaces = await Workspace.find({ _id: { $in: ledger.assignments.map(item => item.workspace) }, department: ledger._id, isActive: true, status: { $ne: 'archived' } }).select('_id');
  const archived = new Set((ledger.defences || []).filter(item => item.evaluation?.publication).map(item => String(item.workspace)));
  return new Set(workspaces.map(item => item.id).filter(id => !archived.has(id)));
}
const maxLoadFor = (ledger, supervisorId) => ledger.limits.find(item => idOf(item.supervisor) === idOf(supervisorId))?.maxLoad ?? DEFAULT_MAX_LOAD;
const loadFor = (ledger, active, supervisorId) => ledger.assignments.filter(item => idOf(item.supervisor) === idOf(supervisorId) && active.has(idOf(item.workspace))).length;
const publicSupervisor = account => account && ({ id: account.id, name: account.name, email: account.email, designation: account.designation, isActive: account.isActive !== false && !account.deletedAt });
async function loads(departmentId) {
  const [ledger, supervisors] = await Promise.all([readLedger(departmentId), Supervisor.find({ department: departmentId, deletedAt: null }).sort({ name: 1 })]);
  const active = await activeIds(ledger);
  return supervisors.map(account => { const maxLoad = maxLoadFor(ledger, account.id), currentLoad = loadFor(ledger, active, account.id); return { ...publicSupervisor(account), maxLoad, currentLoad, available: Math.max(0, maxLoad - currentLoad) }; });
}
async function currentAssignment(departmentId, workspaceId) {
  const ledger = await readLedger(departmentId);
  const assignment = ledger.assignments.find(item => idOf(item.workspace) === idOf(workspaceId));
  if (!assignment) return null;
  const account = await Supervisor.findOne({ _id: assignment.supervisor, department: departmentId });
  return { supervisor: publicSupervisor(account), assignedAt: assignment.assignedAt };
}
async function context(departmentId, workspaceId) {
  const ledger = await readLedger(departmentId);
  return { assignment: await currentAssignment(departmentId, workspaceId), supervisors: await loads(departmentId), history: ledger.history.filter(item => idOf(item.workspace) === idOf(workspaceId)).map(item => ({ id: String(item._id), from: item.from?.id ? { id: idOf(item.from.id), name: item.from.name } : null, to: item.to?.id ? { id: idOf(item.to.id), name: item.to.name } : null, reason: item.reason, createdAt: item.createdAt })) };
}
async function change(departmentId, update) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const ledger = await readLedger(departmentId);
    const active = await activeIds(ledger);
    ledger.chatActivities = require('./chatActivityService').ledgerActivities(ledger);
    await update(ledger, active);
    // Source ids and timeline keys commit together, including CAS retries.
    for (const field of ['history', 'reviews', 'scopeChanges']) for (const event of ledger[field] || []) event._id ||= new (require('mongoose').Types.ObjectId)();
    ledger.chatActivities = require('./chatActivityService').ledgerActivities(ledger);
    const saved = await Ledger.findOneAndUpdate({ _id: departmentId, revision: ledger.revision }, { $set: { chatMeetings: ledger.chatMeetings || [], chatActivities: ledger.chatActivities, resources: ledger.resources || [], capacityHistory: ledger.capacityHistory || [], limits: ledger.limits, assignments: ledger.assignments, history: ledger.history, reviews: ledger.reviews || [], scopeChanges: ledger.scopeChanges || [], defences: ledger.defences || [], rubricVersions: ledger.rubricVersions || [] }, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true });
    if (saved) return;
  }
  fail(409, 'Another allocation is being updated. Please refresh and try again.');
}
async function setCapacity(departmentId, supervisorId, value, mode = 'maxLoad') {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) fail(400, `${mode === 'available' ? 'Available places' : 'Maximum load'} must be a whole number from 0 to 1000.`);
  if (!await Supervisor.exists({ _id: supervisorId, department: departmentId, deletedAt: null })) fail(404, 'Supervisor not found.');
  await change(departmentId, (ledger, active) => {
    const currentLoad = loadFor(ledger, active, supervisorId);
    const maxLoad = mode === 'available' ? currentLoad + value : value;
    if (maxLoad > 1000) fail(400, 'Assigned projects plus available places cannot exceed 1000.');
    if (maxLoad < currentLoad) fail(409, 'Maximum load cannot be lower than the current load. Reassign projects first.');
    const previous = maxLoadFor(ledger, supervisorId);
    if (previous !== maxLoad) { ledger.capacityHistory ||= []; ledger.capacityHistory.push({ supervisor: supervisorId, from: previous, to: maxLoad, actor: departmentId, createdAt: new Date() }); }
    const entry = ledger.limits.find(item => idOf(item.supervisor) === supervisorId);
    if (entry) entry.maxLoad = maxLoad; else ledger.limits.push({ supervisor: supervisorId, maxLoad });
  });
}
async function assign(departmentId, workspace, supervisorId, expectedSupervisorId, reason, actor) {
  const target = supervisorId && await Supervisor.findOne({ _id: supervisorId, department: departmentId, isActive: { $ne: false }, deletedAt: null });
  if (supervisorId && !target) fail(404, 'Choose an active supervisor from your department.');
  const cancellingRequest = !supervisorId && !!workspace.supervisorRequest?.submittedAt;
  if(cancellingRequest && (typeof reason!=='string'||!reason.trim()||reason.trim().length>500))fail(400,'Enter a cancellation note up to 500 characters.');
  await change(departmentId, async (ledger, active) => {
    if(cancellingRequest && (!workspace.isActive || (ledger.defences||[]).some(item=>String(item.workspace)===workspace.id&&(item.board?.length||item.history?.some(event=>event.board?.length)))))fail(409,'Supervisor assignment is locked after examiner assignment or completion.');
    if(supervisorId && require('../utils/supervisorRequestState').cancellationFor(ledger,workspace))fail(409,'This request was cancelled. Wait for the team to submit a new request.');
    require('../utils/evaluationState').assertWritable(ledger, workspace._id);
    const previous = ledger.assignments.find(item => idOf(item.workspace) === workspace.id);
    const previousId = idOf(previous?.supervisor);
    if (previousId !== expectedSupervisorId) fail(409, 'The assignment has changed. Reload before assigning again.');
    if(cancellingRequest && require('../utils/supervisorRequestState').cancellationFor(ledger,workspace))fail(409,'This request has already been cancelled.');
    if (previousId === supervisorId && !cancellingRequest) fail(409, 'This supervisor is already assigned.');
    if (target && loadFor(ledger, active, target.id) >= maxLoadFor(ledger, target.id)) fail(409, 'This supervisor has reached their maximum load. Choose another supervisor or increase the capacity.');
    const previousAccount = previousId && await Supervisor.findById(previousId);
    ledger.assignments = ledger.assignments.filter(item => idOf(item.workspace) !== workspace.id);
    if (target) ledger.assignments.push({ workspace: workspace._id, supervisor: target._id, assignedAt: new Date() });
    ledger.history.push({ workspace: workspace._id, from: previousId ? { id: previousId, name: previousAccount?.name || 'Unavailable Supervisor' } : null, to: target ? { id: target._id, name: target.name } : null, actor, reason: cancellingRequest ? reason.trim() : reason, ...(cancellingRequest ? {requestCancellation:{revision:workspace.supervisorRequest.revision||0,choices:workspace.supervisorRequest.choices.map(choice=>({supervisor:choice.supervisor,name:choice.name}))}} : {}), createdAt: new Date() });
  });
}
module.exports = { readLedger, loads, currentAssignment, context, setCapacity, assign, fail, change };
