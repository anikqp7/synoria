const { Types } = require('mongoose');
const { createHash } = require('node:crypto');
const Workspace = require('../models/workspace');
const Department = require('../models/department');
const Student = require('../models/student');
const Examiner = require('../models/examiner');
const supervision = require('./supervisionService');
const proposalReview = require('./proposalReviewService');
const { syncArchives } = require('../utils/evaluationState');
const { same, activeFor } = require('../utils/defenceState');
const { validKey } = require('../utils/requestValidation');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const mutable = workspace => workspace.isActive && !['archived', 'evaluated'].includes(workspace.status);
function fields(body) {
  const at = typeof body.startsAt === 'string' && new Date(body.startsAt);
  if (!at || !Number.isFinite(at.getTime()) || at.toISOString() !== body.startsAt || at <= new Date()) supervision.fail(400, 'Choose a future defence time as an exact UTC ISO timestamp.');
  if (!Number.isSafeInteger(body.durationMinutes) || body.durationMinutes < 15 || body.durationMinutes > 480) supervision.fail(400, 'Duration must be a whole number from 15 to 480 minutes.');
  if (typeof body.venue !== 'string' || body.venue.trim().length > 150 || typeof body.meetingLink !== 'string' || body.meetingLink.trim().length > 1000) supervision.fail(400, 'Use a venue up to 150 characters and a meeting link up to 1000 characters.');
  const venue = body.venue.trim().replace(/\s+/g, ' '), venueKey = venue.normalize('NFKC').toLowerCase();
  let meetingLink = '', linkKey = '';
  if (body.meetingLink.trim()) {
    let link; try { link = new URL(body.meetingLink.trim()); } catch { supervision.fail(400, 'Enter a valid HTTP or HTTPS meeting link.'); }
    if (!['https:', 'http:'].includes(link.protocol) || link.username || link.password) supervision.fail(400, 'Enter a valid HTTP or HTTPS meeting link without embedded credentials.');
    meetingLink = link.href; linkKey = `${link.origin}${link.pathname.replace(/\/+$/, '')}`;
  }
  if (!venue && !meetingLink) supervision.fail(400, 'Enter a venue, a meeting link, or both.');
  if (!Array.isArray(body.examinerIds) || body.examinerIds.length < 1 || body.examinerIds.length > 10 || body.examinerIds.some(id => !validId(id)) || new Set(body.examinerIds.map(id => id.toLowerCase())).size !== body.examinerIds.length) supervision.fail(400, 'Choose 1–10 distinct active examiners from your department.');
  if (!Number.isSafeInteger(body.proposalVersion) || body.proposalVersion < 1) supervision.fail(400, 'Choose the approved proposal version.');
  const endsAt = new Date(at.getTime() + body.durationMinutes * 60000);
  if (!Number.isFinite(endsAt.getTime())) supervision.fail(400, 'Choose a valid defence end time.');
  return { startsAt: at, endsAt, durationMinutes: body.durationMinutes, venue, venueKey, meetingLink, linkKey };
}
function conflicts(ledger, candidate, ignoreId) {
  for (const other of ledger.defences || []) {
    if (other.status !== 'scheduled' || same(other._id, ignoreId) || !(new Date(candidate.startsAt) < new Date(other.endsAt) && new Date(candidate.endsAt) > new Date(other.startsAt))) continue;
    if (candidate.noticeId && other.noticeId && same(candidate.noticeId, other.noticeId)) continue;
    if ((candidate.venueKey && candidate.venueKey === other.venueKey) || (candidate.linkKey && candidate.linkKey === other.linkKey)) supervision.fail(409, 'The venue or meeting room already has an overlapping defence in this department.');
    if (candidate.board.some(member => other.board.some(item => same(item.id, member.id)))) supervision.fail(409, 'An assigned examiner already has an overlapping defence.');
    if (candidate.team.some(member => other.team.some(item => same(item.id, member.id)))) supervision.fail(409, 'A team member already has an overlapping defence.');
  }
}
function publicSchedule(item) {
  return { id: String(item._id), workspaceId: String(item.workspace), workspaceName: item.workspaceName, title: item.title, workType: item.workType, status: item.status,
    startsAt: item.startsAt, endsAt: item.endsAt, durationMinutes: item.durationMinutes, venue: item.venue, meetingLink: item.meetingLink,
    noticeId: item.noticeId ? String(item.noticeId) : null, noticeRevision: item.noticeRevision, batch: item.batch, stream: item.stream,
    board: item.board, team: item.team, proposalVersion: item.proposalVersion, proposalApprovedAt: item.proposalApprovedAt,
    result: item.evaluation?.publication ? { ...require('../utils/gradeScale').gradeFor(item.evaluation.publication.weightedTotal), weightedTotal: item.evaluation.publication.weightedTotal, publishedAt: item.evaluation.publication.publishedAt } : null, revision: item.revision, createdAt: item.createdAt, updatedAt: item.updatedAt };
}
function visible(item, context, workspace) {
  if (context.role === 'department') return true;
  if (context.role === 'examiner') return item.board.some(member => same(member.id, context.account._id));
  if (context.role === 'student') return workspace.members.some(id => same(id, context.account._id));
  return context.ledger.assignments.some(entry => same(entry.workspace, workspace._id) && same(entry.supervisor, context.account._id));
}
async function context(req) { return { role: req.defenceRole, account: req.defenceAccount, department: req.defenceDepartment, ledger: await supervision.readLedger(req.defenceDepartment) }; }
async function getEntry(req) {
  const ctx = await context(req);
  await syncArchives(ctx.ledger);
  const item = validId(req.params.id) && (ctx.ledger.defences || []).find(entry => same(entry._id, req.params.id));
  const workspace = item && await Workspace.findOne({ _id: item.workspace, department: ctx.department });
  if (workspace && !item.proposalVersion) item.proposalVersion = proposalSnapshot(item,workspace,ctx.ledger)?.version;
  if (!workspace || !visible(item, ctx, workspace)) supervision.fail(404, 'Defence schedule not found.');
  return { ...ctx, item, workspace };
}
async function list(req) {
  const ctx = await context(req), query = req.query;
  await syncArchives(ctx.ledger);
  if (Object.keys(query).some(key => !['search', 'status', 'page', 'sort'].includes(key)) || Object.values(query).some(value => typeof value !== 'string') || (query.search?.length > 200) || (query.status && !['scheduled', 'cancelled', 'published'].includes(query.status)) || (query.sort && (query.sort !== 'latestPublished' || query.status !== 'published')) || (query.page && !/^[1-9]\d{0,5}$/.test(query.page))) supervision.fail(400, 'Choose valid defence schedule filters.');
  const workspaces = await Workspace.find({ department: ctx.department });
  const byId = new Map(workspaces.map(item => [item.id, item]));
  const all = (ctx.ledger.defences || []).filter(item => byId.has(String(item.workspace)) && visible(item, ctx, byId.get(String(item.workspace))));
  for (const item of all) if (!item.proposalVersion) item.proposalVersion = proposalSnapshot(item,byId.get(String(item.workspace)),ctx.ledger)?.version;
  const search = (query.search || '').trim().toLowerCase();
  const filtered = all.filter(item => (!query.status || item.status === query.status) && (!search || [item.workspaceName, item.title, item.venue, ...item.board.map(member => member.name)].some(value => value?.toLowerCase().includes(search)))).sort((a, b) => (query.sort === 'latestPublished' ? new Date(b.evaluation.publication.publishedAt) - new Date(a.evaluation.publication.publishedAt) : new Date(a.startsAt) - new Date(b.startsAt)) || String(b._id).localeCompare(String(a._id)));
  const page = Number(query.page || 1), pageSize = 20;
  const response = { role: ctx.role, schedules: filtered.slice((page - 1) * pageSize, page * pageSize).map(publicSchedule), total: filtered.length, page, pageSize, summary: { scheduled: all.filter(item => item.status === 'scheduled').length, cancelled: all.filter(item => item.status === 'cancelled').length, published: all.filter(item => item.status === 'published').length, upcoming: all.filter(item => item.status === 'scheduled' && new Date(item.startsAt) >= new Date()).length }, conflictScope: 'Department venues/meeting rooms, assigned examiners and team members. Adjacent slots may touch without overlapping.', serverNow: new Date() };
  if (ctx.role === 'department') {
    const examiners = await Examiner.find({ department: ctx.department, isActive: { $ne: false }, deletedAt: null }).sort({ name: 1 }).select('name designation');
    response.examiners = examiners.map(item => ({ id: item.id, name: item.name, designation: item.designation }));
    response.projects = workspaces.filter(item => mutable(item) && proposalReview.workflow(item, ctx.ledger).defenceReady && !activeFor(ctx.ledger, item._id)).map(item => ({ id:item.id, name:item.name, title:item.proposalVersions.at(-1)?.title || item.name, proposalVersion:proposalReview.workflow(item,ctx.ledger).approvedScope.submission.version }));
  }
  return response;
}
function proposalSnapshot(item, workspace, ledger) {
  const review = (ledger.reviews || []).find(entry => same(entry.workspace, workspace._id) && entry.decision === 'approved' && (item.proposalVersion ? entry.version === item.proposalVersion : entry.approvedScope?.title === item.title));
  return review ? { ...review.approvedScope, approvedAt:review.createdAt, approvedBy:review.reviewer } : null;
}
async function detail(req) {
  const ctx = await getEntry(req), { item, workspace, ledger, role } = ctx;
  return { role, supervisor:await supervision.currentAssignment(ctx.department,workspace.id),schedule: publicSchedule(item), canManage: role === 'department' && !item.submittedForEvaluationAt && item.status === 'scheduled' && mutable(workspace), canReschedule: role === 'department' && !item.submittedForEvaluationAt && item.status === 'scheduled' && mutable(workspace) && !(item.evaluation?.records.length),
    history: item.history.map(entry => ({ ...publicSchedule({ ...entry, revision: entry.version - 1 }), version: entry.version, type: entry.type, reason: entry.reason, actor: entry.actor, savedAt: entry.createdAt })),
    approvedProposal: (item.status !== 'cancelled' || role === 'department') ? proposalSnapshot(item, workspace, ledger) : null };
}
async function mutate(req, kind) {
  if (req.defenceRole !== 'department') supervision.fail(403, 'Only the coordinator can schedule, reschedule or cancel a defence.');
  const body = req.body || {}, department = req.defenceDepartment;
  if (!validKey(body.requestKey) || (kind !== 'create' && (!validId(req.params.id) || !Number.isSafeInteger(body.revision) || body.revision < 0))) supervision.fail(400, 'Send a valid retry key and current schedule revision.');
  if (kind === 'create' && !validId(body.workspaceId)) supervision.fail(400, 'Choose a defence-ready project.');
  if (kind !== 'create' && (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 500)) supervision.fail(400, 'Give a reschedule/cancellation reason with up to 500 characters.');
  // Date validation remains inside CAS after retry detection: a successful retry is
  // idempotent even if its originally future slot has since started.
  const fingerprint = createHash('sha256').update(JSON.stringify({ kind, target: req.params.id || body.workspaceId, body })).digest('hex');
  const actorAccount = await Department.findById(department).select('name');
  let scheduleId;
  await supervision.change(department, async ledger => {
    ledger.defences ||= [];
    const prior = ledger.defences.flatMap(item => item.history.map(event => ({ item, event }))).find(entry => entry.event.requestKey === body.requestKey);
    if (prior) { if (prior.event.fingerprint !== fingerprint) supervision.fail(409, 'This defence retry key already belongs to another change.'); scheduleId = String(prior.item._id); return; }
    if(kind==='update'&&Array.isArray(body.examinerIds)){const existing=ledger.defences.find(entry=>same(entry._id,req.params.id));if(existing&&body.examinerIds.map(String).sort().join(',')!==existing.board.map(member=>String(member.id)).sort().join(','))supervision.fail(403,'Only the assigned supervisor can assign an examiner.');}
    let item = kind === 'create' ? null : ledger.defences.find(entry => same(entry._id, req.params.id));
    if (kind !== 'create' && !item) supervision.fail(404, 'Defence schedule not found.');
    if(item?.submittedForEvaluationAt)supervision.fail(403,'Submitted evaluations cannot be rescheduled or cancelled through the department schedule API.');
    const workspace = await Workspace.findOne({ _id: kind === 'create' ? body.workspaceId : item.workspace, department });
    if (!workspace) supervision.fail(404, 'Project not found.');
    require('../utils/evaluationState').assertWritable(ledger, workspace._id);
    if (!mutable(workspace)) supervision.fail(409, 'Archived or evaluated projects cannot change their defence schedule.');
    if (item && (item.revision !== body.revision || item.status !== 'scheduled')) supervision.fail(409, 'The schedule changed or was cancelled. Refresh before continuing.');
    if (kind === 'update' && item?.evaluation?.records.length) supervision.fail(409, 'Evaluation has started. Cancel this defence and create a replacement schedule if the date or board must change.');
    const now = new Date(), actor = { id: actorAccount._id, name: actorAccount.name };
    if (kind === 'cancel') { item.status = 'cancelled'; item.revision += 1; item.updatedAt = now; }
    else {
      const metadata = fields(body), flow = proposalReview.workflow(workspace, ledger);
      if (!flow.approvedScope || flow.proposalStatus !== 'approved' || flow.approvedScope.submission.version !== body.proposalVersion) supervision.fail(409, 'The current proposal must be approved. Refresh the project selection.');
      if (kind === 'create' && activeFor(ledger, workspace._id)) supervision.fail(409, 'This project already has an active defence schedule. Reschedule it instead.');
      const [board, team] = await Promise.all([
        Examiner.find({ _id: { $in: body.examinerIds }, department, isActive: { $ne: false }, deletedAt: null }).select('name designation'),
        Student.find({ _id: { $in: workspace.members }, department, isActive: { $ne: false }, deletedAt: null }).select('name studentId'),
      ]);
      if (board.length !== body.examinerIds.length || team.length !== workspace.members.length) supervision.fail(400, 'Use active examiners and team members from this department.');
      const candidate = { ...metadata, workspace: workspace._id, workspaceName: workspace.name, title: workspace.proposalVersions.at(-1)?.title || workspace.name,
        workType: workspace.workType, status: 'scheduled', board: body.examinerIds.map(id => { const member = board.find(entry => same(entry._id, id)); return { id: member._id, name: member.name, designation: member.designation }; }), team: team.map(member => ({ id: member._id, name: member.name, studentId: member.studentId })),
        proposalVersion: flow.approvedScope.submission.version, proposalApprovedAt: flow.approvedScope.approvedAt };
      candidate.title = flow.approvedScope.submission.title;
      conflicts(ledger, candidate, item?._id);
      if (!item) { item = { _id: new Types.ObjectId(), revision: 0, history: [], createdAt: now, updatedAt: now, ...candidate }; ledger.defences.push(item); }
      else { Object.assign(item, candidate); item.revision += 1; item.updatedAt = now; }
    }
    const { history, ...snapshot } = item;
    item.history.push({ ...snapshot, _id: new Types.ObjectId(), version: item.revision + 1, type: kind === 'create' ? 'scheduled' : kind === 'cancel' ? 'cancelled' : 'rescheduled', reason: kind === 'create' ? '' : body.reason.trim(), actor, createdAt: now, requestKey: body.requestKey, fingerprint });
    scheduleId = String(item._id);
  });
  return detail({ ...req, params: { ...req.params, id: scheduleId } });
}
module.exports = { list, detail, mutate: (req,kind)=>require('./proposalPeriodService').withGate(req.defenceDepartment,()=>mutate(req,kind)), conflicts, publicSchedule, getEntry };
