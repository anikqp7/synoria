const { Types } = require('mongoose');
const { createHash } = require('node:crypto');
const Department = require('../models/department');
const supervision = require('./supervisionService');
const defences = require('./defenceService');
const { same } = require('../utils/defenceState');
const { complete, syncArchives } = require('../utils/evaluationState');
const { validKey } = require('../utils/requestValidation');
const { publicRubric } = require('./rubricService');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const {gradeFor}=require('../utils/gradeScale');
const periods=require('./evaluationPeriodService');
const clone = value => JSON.parse(JSON.stringify(value));
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const publicRecord = (record, withHistory = false) => ({ id: String(record._id), examiner: record.examiner, revision: record.revision, status: record.status, scores: record.scores, comment: record.comment, submittedAt: record.submittedAt, updatedAt: record.updatedAt, ...(withHistory ? { versions: record.versions } : {}) });
function calculate(item) {
  const plan = item.evaluation;
  if (!plan?.rubric) supervision.fail(409, 'Select a rubric before calculating results.');
  const records = item.board.map(member => plan.records.find(record => same(record.examiner.id, member.id) && record.status === 'submitted'));
  if (!plan?.rubric || records.some(record => !record)) supervision.fail(409, 'Every assigned board member must submit a complete evaluation before publishing.');
  const criteria = plan.rubric.criteria.map(criterion => {
    const marks = records.map(record => record.scores.find(score => same(score.criterionId, criterion._id))?.marks);
    if (marks.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > criterion.maxMarks)) supervision.fail(409, 'Some submitted marks do not match the saved rubric.');
    const averageMarks = marks.reduce((sum, value) => sum + Math.round(value * 100), 0) / (100 * records.length);
    return { criterionId: criterion._id, title: criterion.title, maxMarks: criterion.maxMarks, weight: criterion.weight, averageMarks, weightedMarks: averageMarks / criterion.maxMarks * criterion.weight };
  });
  const evaluations = records.map(record => ({ examiner: record.examiner, scores: clone(record.scores), comment: record.comment, submittedAt: record.submittedAt, weightedTotal: round(plan.rubric.criteria.reduce((sum, criterion) => sum + record.scores.find(score => same(score.criterionId, criterion._id)).marks / criterion.maxMarks * criterion.weight, 0)), rawTotal: round(record.scores.reduce((sum, score) => sum + score.marks, 0)) }));
  return { ...gradeFor(round(criteria.reduce((sum, criterion) => sum + criterion.weightedMarks, 0))), criteria: criteria.map(criterion => ({ ...criterion, averageMarks: round(criterion.averageMarks), weightedMarks: round(criterion.weightedMarks) })), evaluations, weightedTotal: round(criteria.reduce((sum, criterion) => sum + criterion.weightedMarks, 0)), rawTotal: round(criteria.reduce((sum, criterion) => sum + criterion.averageMarks, 0)), rawMaximum: criteria.reduce((sum, criterion) => sum + criterion.maxMarks, 0), boardCount: records.length };
}
function view(item, role, accountId) {
  const plan = item.evaluation, active = item.status === 'scheduled' && !plan?.publication;
  const own = role === 'examiner' && plan?.records.find(record => same(record.examiner.id, accountId));
  const base = { defenceId: String(item._id), scheduleRevision: item.revision, role, revision: plan?.revision || 0, rubric: plan?.rubric ? publicRubric(plan.rubric) : null, publication: plan?.publication ? {...plan.publication,...gradeFor(plan.publication.weightedTotal)} : null, resultHistory:plan?.publicationVersions||[],
    canAssign: role === 'department' && active && !(plan?.records.length), canEdit: role === 'examiner' && active && !!plan?.rubric && own?.status !== 'submitted', canSubmit: role === 'examiner' && active && !!plan?.rubric && own?.status !== 'submitted', canPublish: role === 'examiner' && active && complete(item), preview:role==='examiner'&&active&&complete(item)?calculate(item):null };
  if (role === 'examiner') base.ownEvaluation = own ? publicRecord(own, true) : null;
  if (role === 'department') {
    base.boardProgress = item.board.map(member => { const record = plan?.records.find(entry => same(entry.examiner.id, member.id)); return { ...member, status: record?.status || 'notStarted', canReopen: false }; });
    base.submittedEvaluations = (plan?.records || []).filter(record => record.status === 'submitted').map(record => ({ ...publicRecord(record), submittedVersions: record.versions.filter(version => version.status === 'submitted') }));
    base.submittedHistory = (plan?.records || []).flatMap(record => record.versions.filter(version => version.status === 'submitted').map(version => ({ examiner: record.examiner, revision: version.revision, scores: version.scores, comment: version.comment, submittedAt: version.createdAt })));
    base.history = (plan?.history || []).map(event => ({ type: event.type, actor: event.actor, examinerId: event.examinerId, reason: event.reason, createdAt: event.createdAt }));
    base.preview = active && complete(item) ? calculate(item) : null;
  }
  return base;
}
async function read(req) {
  let context = await defences.getEntry(req);
  if (context.item.status === 'scheduled' && !context.item.evaluation?.rubric && !context.item.evaluation?.records?.length) {
    const department = await Department.findById(context.department).select('name');
    await supervision.change(context.department, ledger => {
      const item = (ledger.defences || []).find(item => same(item._id, req.params.id));
      if (item) require('./rubricService').ensureSnapshot(ledger, item, { id: department._id, name: department.name, role: 'department' });
    });
    context = await defences.getEntry(req);
  }
  const policy=periods.publicPeriod(await Department.findById(context.department).select('resultPeriod'),'result');
  return {...view(context.item, context.role, context.account?._id),canCorrectByRole:!!context.item.evaluation?.publication&&context.role==='supervisor',canCorrect:!!context.item.evaluation?.publication&&context.role==='supervisor'&&policy.accepting,resultPeriod:policy};
}
function scoresFor(body, rubric, submitting) {
  if (!Array.isArray(body.scores) || body.scores.length > rubric.criteria.length || new Set(body.scores.map(item => String(item?.criterionId).toLowerCase())).size !== body.scores.length || typeof body.comment !== 'string' || body.comment.trim().length > 2000) supervision.fail(400, 'Enter distinct rubric scores and overall comments up to 2000 characters.');
  const scores = body.scores.map(item => {
    const criterion = validId(item?.criterionId) && rubric.criteria.find(entry => same(entry._id, item.criterionId));
    const marks = item?.marks ?? null;
    if (!criterion || (marks !== null && (typeof marks !== 'number' || !Number.isFinite(marks) || marks < 0 || marks > criterion.maxMarks || Math.abs(marks * 100 - Math.round(marks * 100)) > 0.000001)) || typeof item.comment !== 'string' || item.comment.trim().length > 1000) supervision.fail(400, 'Use rubric criteria with marks from zero to their maximum (up to two decimals) and comments up to 1000 characters.');
    return { criterionId: criterion._id, marks, comment: item.comment.trim() };
  });
  if (submitting && (scores.length !== rubric.criteria.length || scores.some(item => item.marks === null))) supervision.fail(400, 'Complete every rubric criterion before submitting the evaluation.');
  return scores;
}
async function mutate(req, kind) {
  if(kind==='reopen')supervision.fail(403,'Submitted evaluations cannot be reopened. Only the assigned supervisor can correct a published result during the open update period.');
  if(kind==='correct')return correct(req);
  const ctx = await defences.getEntry(req), { role, department, account } = ctx, body = req.body || {};
  if (['assign', 'reopen'].includes(kind) ? role !== 'department' : role !== 'examiner') supervision.fail(403, 'This account cannot perform this evaluation action.');
  if (!validKey(body.requestKey) || !Number.isSafeInteger(body.revision) || body.revision < 0) supervision.fail(400, 'Send a valid retry key and current evaluation revision.');
  if (kind === 'assign' && !validId(body.rubricId)) supervision.fail(400, 'Choose a saved rubric version.');
  if (kind === 'reopen' && (!validId(body.examinerId) || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 500)) supervision.fail(400, 'Select an examiner and give a reopen reason (up to 500 characters).');
  if (kind === 'publish' && (body.confirmDefenceHeld !== true || typeof body.note !== 'string' || body.note.trim().length > 2000)) supervision.fail(400, 'Confirm the defence has taken place and enter a publication note up to 2000 characters.');
  const actor = role === 'department' ? await Department.findById(department).select('name') : account;
  const fingerprint = createHash('sha256').update(JSON.stringify({ kind, defenceId: req.params.id, actor: String(actor._id), body })).digest('hex');
  await supervision.change(department, ledger => {
    const item = (ledger.defences || []).find(entry => same(entry._id, req.params.id));
    if (!item || (role === 'examiner' && !item.board.some(member => same(member.id, account._id)))) supervision.fail(404, 'Assigned defence not found.');
    item.evaluation ||= { revision: 0, records: [], history: [], publication: null };
    const plan = item.evaluation, repeated = plan.history.find(event => event.requestKey === body.requestKey);
    if (repeated) { if (repeated.fingerprint !== fingerprint) supervision.fail(409, 'This evaluation retry key belongs to different content.'); return; }
    if (item.status !== 'scheduled' || plan.publication) supervision.fail(409, 'This defence evaluation is locked or cancelled. Published results cannot be changed.');
    const now = new Date(), author = { id: actor._id, name: actor.name, role };
    if (['assign', 'publish', 'reopen'].includes(kind) && plan.revision !== body.revision) supervision.fail(409, 'The evaluation changed. Refresh before continuing.');
    if (kind === 'assign') {
      if (plan.records.length) supervision.fail(409, 'The rubric snapshot is locked once an examiner saves an evaluation.');
      const rubric = (ledger.rubricVersions || []).find(entry => same(entry._id, body.rubricId));
      if (!rubric) supervision.fail(404, 'Rubric version not found.');
      plan.rubric = { id: rubric._id, version: rubric.version, name: rubric.name, description: rubric.description, criteria: clone(rubric.criteria) };
    } else if (kind === 'save' || kind === 'submit') {
      if (!plan.rubric || !same(plan.rubric.id, body.rubricId) || body.scheduleRevision !== item.revision) supervision.fail(409, 'The rubric or schedule changed. Refresh before evaluating.');
      let record = plan.records.find(entry => same(entry.examiner.id, account._id));
      if ((record?.revision || 0) !== body.revision || record?.status === 'submitted') supervision.fail(409, 'This evaluation changed or has already been submitted. Submitted examiner grades are final.');
      const scores = scoresFor(body, plan.rubric, kind === 'submit');
      if (!record) { record = { _id: new Types.ObjectId(), examiner: author, revision: 0, versions: [] }; plan.records.push(record); }
      Object.assign(record, { scores, comment: body.comment.trim(), status: kind === 'submit' ? 'submitted' : 'draft', submittedAt: kind === 'submit' ? now : null, updatedAt: now, revision: record.revision + 1 });
      record.versions.push({ revision: record.revision, status: record.status, scores: clone(scores), comment: record.comment, type: kind, actor: author, createdAt: now });
    } else if (kind === 'reopen') {
      const record = plan.records.find(entry => same(entry.examiner.id, body.examinerId));
      if (!record || record.status !== 'submitted' || !item.board.some(member => same(member.id, body.examinerId))) supervision.fail(409, 'Only a current board member’s submitted evaluation can be reopened.');
      record.status = 'draft'; record.revision += 1; record.submittedAt = null; record.updatedAt = now;
      record.versions.push({ revision: record.revision, status: 'draft', scores: clone(record.scores), comment: record.comment, type: 'reopened', reason: body.reason.trim(), actor: author, createdAt: now });
    } else if (kind === 'publish') {
      if (!complete(item)) supervision.fail(409, 'All required board evaluations must be submitted before publishing.');
      plan.publication = { ...calculate(item), rubric: clone(plan.rubric), note: body.note.trim(), publishedBy: author, publishedAt: now };
      item.status = 'published'; item.revision += 1; item.updatedAt = now;
      const { history, evaluation, ...snapshot } = item;
      history.push({ ...snapshot, _id: new Types.ObjectId(), type: 'published', version: item.revision + 1, actor: { id: author.id, name: author.name }, reason: body.note.trim(), createdAt: now });
    }
    plan.revision += 1;
    plan.history.push({ _id: new Types.ObjectId(), type: kind, actor: author, examinerId: kind === 'reopen' ? body.examinerId : role === 'examiner' ? account._id : null, reason: kind === 'reopen' ? body.reason.trim() : '', createdAt: now, requestKey: body.requestKey, fingerprint });
  });
  // The ledger publication is authoritative. Retrying publish or reading schedules
  // repairs the workspace archive projection if a process stopped after commit.
  if (kind === 'publish') await syncArchives(await supervision.readLedger(department));
  return read(req);
}
async function correct(req){
 const {role,department,account}=await defences.getEntry(req),body=req.body||{};
 if(role!=='supervisor')supervision.fail(403,'Only the assigned supervisor can change a published result. Examiners cannot change submitted results.');
 if(!validKey(body.requestKey)||!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.marks!=='number'||!Number.isFinite(body.marks)||body.marks<0||body.marks>100||Math.abs(body.marks*100-Math.round(body.marks*100))>0.000001||typeof body.reason!=='string'||!body.reason.trim()||body.reason.trim().length>500)supervision.fail(400,'Enter marks from 0 to 100 (up to two decimals), a reason up to 500 characters and the current revision.');
 const fingerprint=createHash('sha256').update(JSON.stringify({kind:'correct',defenceId:req.params.id,actor:account.id,body})).digest('hex');
 return require('./proposalPeriodService').withGate(department,async departmentAccount=>{
  periods.assertOpen(departmentAccount,'result');
  await supervision.change(department,ledger=>{
   const item=(ledger.defences||[]).find(entry=>same(entry._id,req.params.id));
   if(!item||(role==='examiner'?!item.board.some(member=>same(member.id,account._id)):!ledger.assignments.some(entry=>same(entry.workspace,item.workspace)&&same(entry.supervisor,account._id))))supervision.fail(404,'Assigned evaluation not found.');
   const plan=item.evaluation;if(!plan?.publication||item.status!=='published')supervision.fail(409,'Publish the initial result before changing it.');
   const repeated=plan.history.find(event=>event.requestKey===body.requestKey);if(repeated){if(repeated.fingerprint!==fingerprint)supervision.fail(409,'This retry key belongs to another update.');return;}
   if(plan.revision!==body.revision)supervision.fail(409,'The result changed. Refresh before updating it.');
   const now=new Date(),author={id:account._id,name:account.name,role};
   plan.publicationVersions||=[];plan.publicationVersions.push({revision:plan.revision,publication:clone(plan.publication),reason:body.reason.trim(),replacedBy:author,createdAt:now});
   plan.publication={...plan.publication,weightedTotal:body.marks,...gradeFor(body.marks),note:body.reason.trim(),publishedBy:author,publishedAt:now};
   plan.revision++;item.revision++;item.updatedAt=now;
   plan.history.push({_id:new Types.ObjectId(),type:'correct',actor:author,reason:body.reason.trim(),createdAt:now,requestKey:body.requestKey,fingerprint});
  });return read(req);
 });
}
module.exports = { read, mutate, view, calculate };
