const supervision = require('./supervisionService');
const same = (left, right) => String(left) === String(right);
function workflow(workspace, ledger) {
  const versions = workspace.proposalVersions || [];
  const latest = versions.at(-1);
  const reviews = (ledger?.reviews || []).filter(item => same(item.workspace, workspace._id));
  const changes = (ledger?.scopeChanges || []).filter(item => same(item.workspace, workspace._id));
  const review = latest && reviews.find(item => item.version === latest.version);
  const approval = [...reviews].reverse().find(item => item.decision === 'approved');
  const scopeChange = latest && changes.find(item => item.version === latest.version);
  const canRevise = review?.decision === 'revisionRequested' || (review?.decision === 'approved' && !!scopeChange);
  const defence = require('../utils/defenceState').activeFor(ledger, workspace._id);
  const result = require('../utils/evaluationState').publishedFor(ledger, workspace._id);
  return {
    // Review decisions are authoritative in the same atomic ledger as assignments.
    // The last approved scope stays active while a scope-change proposal is reviewed.
    status: result ? 'archived' : ['archived', 'evaluated', 'defenceScheduled'].includes(workspace.status) ? workspace.status : defence ? (require('../utils/evaluationState').complete(defence) ? 'evaluated' : 'defenceScheduled') : approval ? 'active' : workspace.status,
    defenceReady: !!approval && review?.decision === 'approved' && !scopeChange && !result && !defence && !!workspace.isActive && !['archived', 'evaluated', 'defenceScheduled'].includes(workspace.status),
    proposalStatus: !latest ? 'draft' : scopeChange && review?.decision === 'approved' ? 'revisionRequested' : review?.decision || 'submitted',
    canRevise: !!canRevise, versions, reviews, scopeChanges: changes,
    approvedScope: approval ? { submission: approval.approvedScope, approvedAt: approval.createdAt, approvedBy: approval.reviewer } : null,
  };
}
async function state(workspace) {
  return workflow(workspace, workspace.proposalVersions?.length ? await supervision.readLedger(workspace.department) : null);
}
async function review(workspace, supervisor, version, decision, comment) {
  if (!workspace.isActive || workspace.status === 'archived') supervision.fail(409, 'This project is no longer open for proposal review.');
  if (!Number.isSafeInteger(version) || version !== workspace.proposalVersions.at(-1)?.version) supervision.fail(409, 'The proposal version changed. Reload before reviewing.');
  if (!['approved', 'rejected', 'revisionRequested'].includes(decision) || typeof comment !== 'string' || comment.trim().length > 2000 || (decision !== 'approved' && !comment.trim())) supervision.fail(400, 'Choose a review decision. Rejection or revision requests require a reason (up to 2000 characters).');
  await supervision.change(supervisor.department, ledger => {
    if (!ledger.assignments.some(item => same(item.workspace, workspace._id) && same(item.supervisor, supervisor._id))) supervision.fail(404, 'Assigned project not found.');
    require('../utils/evaluationState').assertWritable(ledger, workspace._id);
    require('../utils/defenceState').assertNotScheduled(ledger, workspace._id);
    ledger.reviews ||= [];
    if (ledger.reviews.some(item => same(item.workspace, workspace._id) && item.version === version)) supervision.fail(409, 'This proposal version has already been reviewed. Reload to see the decision.');

    ledger.reviews.push({ workspace: workspace._id, version, decision, comment: comment.trim(), reviewer: { id: supervisor._id, name: supervisor.name }, createdAt: new Date(), approvedScope: decision === 'approved' ? workspace.proposalVersions.at(-1).toObject() : null });
  });
}
async function requestScopeChange(workspace, student, reason) {
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) supervision.fail(400, 'Enter a scope-change reason with up to 1000 characters.');
  if (!workspace.isActive || workspace.status === 'archived') supervision.fail(409, 'This project is no longer open for scope changes.');
  await supervision.change(student.department, ledger => {
    require('../utils/evaluationState').assertWritable(ledger, workspace._id);
    require('../utils/defenceState').assertNotScheduled(ledger, workspace._id);
    const current = workflow(workspace, ledger);
    if (current.proposalStatus !== 'approved') supervision.fail(409, 'Only an approved proposal can start a scope change.');
    ledger.scopeChanges ||= [];
    ledger.scopeChanges.push({ workspace: workspace._id, version: workspace.proposalVersions.at(-1).version, reason: reason.trim(), requestedBy: student._id, createdAt: new Date() });
  });
}
module.exports = { workflow, state, review, requestScopeChange };
