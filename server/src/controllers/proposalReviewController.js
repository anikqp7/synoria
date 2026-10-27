const Workspace = require('../models/workspace');
const service = require('../services/proposalReviewService');
const supervision = require('../services/supervisionService');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const action = handler => async (req, res) => { try { await handler(req, res); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
const reviewProposal = action(async (req, res) => {
  const workspace = validId(req.params.id) && await Workspace.findOne({ _id: req.params.id, department: req.supervisor.department, 'proposalVersions.0': { $exists: true } });
  const ledger = await supervision.readLedger(req.supervisor.department);
  if (!workspace || !ledger.assignments.some(item => String(item.workspace) === workspace.id && String(item.supervisor) === req.supervisor.id)) return res.status(404).json({ message: 'Assigned project not found.' });
  await service.review(workspace, req.supervisor, req.body?.version, req.body?.decision, req.body?.comment ?? '');
  // Cache the project lifecycle; the atomic review ledger remains authoritative.
  if (req.body.decision === 'approved') await Workspace.updateOne({ _id: workspace._id, isActive: true, status: { $ne: 'archived' } }, { $set: { status: 'active' }, $inc: { __v: 1 } });
  res.json({ message: 'Proposal review saved.' });
});
const scopeChange = action(async (req, res) => {
  const workspace = validId(req.params.id) && await Workspace.findOne({ _id: req.params.id, department: req.student.department, members: req.student._id });
  if (!workspace) return res.status(404).json({ message: 'Proposal workspace not found.' });
  if (String(workspace.leader) !== req.student.id) return res.status(403).json({ message: 'Only the team leader can start a scope change.' });
  if (!Number.isSafeInteger(req.body?.revision) || req.body.revision !== (workspace.proposalRevision || 0)) return res.status(409).json({ message: 'The proposal changed. Reload before continuing.' });
  await service.requestScopeChange(workspace, req.student, req.body?.reason);
  res.json({ message: 'Scope-change draft opened. The approved scope stays in effect until a new version is approved.' });
});
module.exports = { reviewProposal, scopeChange };
