const { Types } = require('mongoose');
const { createHash } = require('node:crypto');
const Department = require('../models/department');
const supervision = require('./supervisionService');
const { validKey } = require('../utils/requestValidation');
const defaultCriteria = [ ['Problem Understanding', 15], ['Methodology', 20], ['Implementation / Research Quality', 30], ['Report Quality', 20], ['Presentation And Viva', 15] ].map(([title, weight]) => ({ title, description: '', maxMarks: 100, weight }));
function publicRubric(item) { return { id: String(item._id || item.id), version: item.version, name: item.name, description: item.description, criteria: item.criteria.map(entry => ({ id: String(entry._id || entry.id), title: entry.title, description: entry.description, maxMarks: entry.maxMarks, weight: entry.weight })), ...(item.createdBy ? { createdBy: item.createdBy, createdAt: item.createdAt } : {}) }; }
async function read(department) { const ledger = await supervision.readLedger(department); return { revision: (ledger.rubricVersions || []).length, rubrics: (ledger.rubricVersions || []).map(publicRubric).reverse(), defaultCriteria }; }
async function save(req) {
  const body = req.body || {};
  if (!validKey(body.requestKey) || !Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120 || typeof body.description !== 'string' || body.description.trim().length > 1000 || !Array.isArray(body.criteria) || !body.criteria.length || body.criteria.length > 20) supervision.fail(400, 'Enter a rubric name, description and 1–20 criteria with the current revision and retry key.');
  const titles = new Set();
  for (const criterion of body.criteria) {
    if (typeof criterion?.title !== 'string' || !criterion.title.trim() || criterion.title.trim().length > 100 || typeof criterion.description !== 'string' || criterion.description.trim().length > 500 || !Number.isSafeInteger(criterion.maxMarks) || criterion.maxMarks < 1 || criterion.maxMarks > 1000 || !Number.isSafeInteger(criterion.weight) || criterion.weight < 1 || criterion.weight > 100) supervision.fail(400, 'Each criterion needs a title, maximum marks 1–1000 and integer weight 1–100.');
    const key = criterion.title.trim().toLowerCase(); if (titles.has(key)) supervision.fail(400, 'Criterion titles must be distinct.'); titles.add(key);
  }
  if (body.criteria.reduce((sum, item) => sum + item.weight, 0) !== 100) supervision.fail(400, 'Rubric weights must total exactly 100%.');
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const actor = await Department.findById(req.session.departmentId).select('name');
  await supervision.change(req.session.departmentId, ledger => {
    ledger.rubricVersions ||= [];
    const prior = ledger.rubricVersions.find(item => item.requestKey === body.requestKey);
    if (prior) { if (prior.fingerprint !== fingerprint) supervision.fail(409, 'This rubric retry key belongs to different content.'); return; }
    if (ledger.rubricVersions.length !== body.revision) supervision.fail(409, 'The rubric list changed. Refresh before saving a new version.');
    ledger.rubricVersions.push({ _id: new Types.ObjectId(), version: ledger.rubricVersions.length + 1, name: body.name.trim(), description: body.description.trim(), criteria: body.criteria.map(item => ({ _id: new Types.ObjectId(), title: item.title.trim(), description: item.description.trim(), maxMarks: item.maxMarks, weight: item.weight })), createdBy: { id: actor._id, name: actor.name, role: 'department' }, createdAt: new Date(), requestKey: body.requestKey, fingerprint });
  });
  return read(req.session.departmentId);
}
function ensureSnapshot(ledger, item, actor) {
  if (item.evaluation?.rubric || item.evaluation?.records?.length || item.evaluation?.publication || item.status !== 'scheduled') return false;
  const now = new Date();
  ledger.rubricVersions ||= [];
  if (!ledger.rubricVersions.length) ledger.rubricVersions.push({ _id: new Types.ObjectId(), version: 1, name: 'Default Evaluation Rubric', description: 'Department project and thesis evaluation.', criteria: defaultCriteria.map(criterion => ({ _id: new Types.ObjectId(), ...criterion })), createdBy: actor, createdAt: now, requestKey: 'default-evaluation-rubric' });
  const rubric = ledger.rubricVersions.at(-1), previous = item.evaluation || {};
  item.evaluation = { ...previous, revision: (previous.revision || 0) + 1, rubric: { id: rubric._id, version: rubric.version, name: rubric.name, description: rubric.description, criteria: JSON.parse(JSON.stringify(rubric.criteria)) }, records: previous.records || [], history: [...(previous.history || []), { _id: new Types.ObjectId(), type: 'assign', actor, createdAt: now }], publication: null };
  return true;
}
module.exports = { read, save, publicRubric, defaultCriteria, ensureSnapshot };
