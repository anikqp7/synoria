const { Types } = require('mongoose');
const { createHash } = require('node:crypto');
const Workspace = require('../models/workspace');
const Department = require('../models/department');
const Student = require('../models/student');
const Examiner = require('../models/examiner');
const Notice = require('../models/defenceNotice');
const supervision = require('./supervisionService');
const review = require('./proposalReviewService');
const defences = require('./defenceService');
const { same } = require('../utils/defenceState');
const { validKey } = require('../utils/requestValidation');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const currentFor = (ledger, id) => (ledger.defences || []).find(item => same(item.workspace, id) && item.status === 'scheduled') || (ledger.defences || []).find(item => same(item.workspace, id) && item.evaluation?.publication);
async function workspaceFor(req) {
  const workspace = validId(req.params.id) && await Workspace.findOne({ _id: req.params.id, department: req.supervisor.department });
  if (!workspace) supervision.fail(404, 'Project not found.');
  const ledger=await supervision.readLedger(req.supervisor.department);
  if(!ledger.assignments.some(item=>same(item.workspace,workspace._id)&&same(item.supervisor,req.supervisor._id)))supervision.fail(404,'Assigned project not found.');
  return workspace;
}
async function read(req) {
  const workspace = await workspaceFor(req), department = req.supervisor.department;
  const [ledger, notices, examiners] = await Promise.all([
    supervision.readLedger(department), Notice.find({ department, startsAt: { $gt: new Date() } }).sort({ startsAt: 1, _id: 1 }).lean(),
    Examiner.find({ department, isActive: { $ne: false }, deletedAt: null }).select('name designation').sort({ name: 1 }).lean(),
  ]);
  const flow = review.workflow(workspace, ledger), current = currentFor(ledger, workspace._id);
  const started = !!current?.evaluation?.records?.length;
  return { workspaceId: workspace.id, workspaceName: workspace.name, proposalVersion: flow.approvedScope?.submission.version || null,
    canAssign: !!workspace.isActive && !['archived','evaluated'].includes(flow.status) && flow.proposalStatus === 'approved' && !!flow.approvedScope && !current && !started && require('./evaluationPeriodService').publicPeriod(await Department.findById(department).select('evaluationPeriod'),'evaluation').accepting,
    evaluationStarted: started,
    current: current ? { ...defences.publicSchedule(current), rubricName: current.evaluation?.rubric?.name || null } : null,
    notices: notices.map(item => ({ id: String(item._id), batch: item.batch, stream: item.stream, startsAt: item.startsAt, venue: item.venue, revision: item.revision })),
    examiners: examiners.map(item => ({ id: String(item._id), name: item.name, designation: item.designation })),
    rubricName: current?.evaluation?.rubric?.name || ledger.rubricVersions?.at(-1)?.name || 'Default Evaluation Rubric',
  };
}
async function assign(req) {
  const workspace = await workspaceFor(req), department = req.supervisor.department, body = req.body || {};
  if (!validKey(body.requestKey) || !validId(body.noticeId) || !Number.isSafeInteger(body.noticeRevision) || body.noticeRevision < 0 || !Number.isSafeInteger(body.proposalVersion) || body.proposalVersion < 1 || !Number.isSafeInteger(body.revision) || body.revision < 0 || !(body.expectedDefenceId === null || validId(body.expectedDefenceId))) supervision.fail(400, 'Choose a current defence notice and refresh the assignment before saving.');
  if (!Array.isArray(body.examinerIds) || body.examinerIds.length !== 1 || body.examinerIds.some(id => !validId(id)) || new Set(body.examinerIds.map(id => id.toLowerCase())).size !== body.examinerIds.length) supervision.fail(400, 'Choose one active examiner.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ workspace: workspace.id, body })).digest('hex');
  const account = req.supervisor;
  await supervision.change(department, async ledger => {
    if(!ledger.assignments.some(item=>same(item.workspace,workspace._id)&&same(item.supervisor,req.supervisor._id)))supervision.fail(404,'Assigned project not found.');
    ledger.defences ||= [];
    const repeated = ledger.defences.flatMap(item => item.history).find(event => event.requestKey === body.requestKey);
    if (repeated) { if (repeated.fingerprint !== fingerprint) supervision.fail(409, 'This retry key belongs to another assignment.'); return; }
    require('../utils/evaluationState').assertWritable(ledger, workspace._id);
    const flow = review.workflow(workspace, ledger);
    if (!workspace.isActive || ['archived','evaluated'].includes(flow.status) || flow.proposalStatus !== 'approved' || !flow.approvedScope || flow.approvedScope.submission.version !== body.proposalVersion) supervision.fail(409, 'The current proposal must be approved before assigning examiners.');
    let item = currentFor(ledger, workspace._id);
    if ((item ? String(item._id) : null) !== body.expectedDefenceId || (item?.revision || 0) !== body.revision) supervision.fail(409, 'The assignment changed. Refresh before continuing.');
    if(item)supervision.fail(409,'This project has already been submitted for evaluation.');
    if (item?.evaluation?.records?.length) supervision.fail(409, 'Evaluation has started. Existing examiner work cannot be replaced.');
    const [notice, board, team] = await Promise.all([
      Notice.findOne({ _id: body.noticeId, department, revision: body.noticeRevision, startsAt: { $gt: new Date() } }).lean(),
      Examiner.find({ _id: { $in: body.examinerIds }, department, isActive: { $ne: false }, deletedAt: null }).select('name designation'),
      Student.find({ _id: { $in: workspace.members }, department, isActive: { $ne: false }, deletedAt: null }).select('name studentId'),
    ]);
    if (!notice) supervision.fail(409, 'The selected defence notice changed, expired or was removed. Refresh the date options.');
    if (board.length !== body.examinerIds.length || team.length !== workspace.members.length) supervision.fail(400, 'Choose active examiners and team members from your department.');
    const now = new Date(), actor = { id: account._id, name: account.name, role:'supervisor' }, durationMinutes = 30;
    const candidate = { workspace: workspace._id, workspaceName: workspace.name, title: flow.approvedScope.submission.title, workType: workspace.workType, status: 'scheduled',
      submittedForEvaluationAt:now,submittedBy:actor,noticeId: notice._id, noticeRevision: notice.revision, batch: notice.batch, stream: notice.stream,
      startsAt: notice.startsAt, endsAt: new Date(notice.startsAt.getTime() + durationMinutes * 60000), durationMinutes,
      venue: notice.venue, venueKey: notice.venue.trim().replace(/\s+/g, ' ').normalize('NFKC').toLowerCase(), meetingLink: '', linkKey: '',
      board: body.examinerIds.map(id => { const member = board.find(item => same(item._id, id)); return { id: member._id, name: member.name, designation: member.designation }; }),
      team: team.map(member => ({ id: member._id, name: member.name, studentId: member.studentId })),
      proposalVersion: flow.approvedScope.submission.version, proposalApprovedAt: flow.approvedScope.approvedAt };
    defences.conflicts(ledger, candidate, item?._id);
    const updating = !!item;
    if (!item) { item = { _id: new Types.ObjectId(), revision: 0, history: [], createdAt: now, updatedAt: now, ...candidate }; ledger.defences.push(item); }
    else { Object.assign(item, candidate); item.revision += 1; item.updatedAt = now; }
    require('./rubricService').ensureSnapshot(ledger, item, actor);
    const { history, evaluation, ...snapshot } = item;
    history.push({ ...snapshot, _id: new Types.ObjectId(), version: item.revision + 1, type: updating ? 'rescheduled' : 'scheduled', reason: updating ? 'Examiner assignment updated by supervisor.' : '', actor, createdAt: now, requestKey: body.requestKey, fingerprint });
  });
  return read(req);
}
module.exports = { read, assign: req=>require('./proposalPeriodService').withGate(req.supervisor.department,account=>{require('./evaluationPeriodService').assertOpen(account,'evaluation');return assign(req);}) };
