const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const activeFor = (ledger, workspaceId) => (ledger?.defences || []).find(item => same(item.workspace, workspaceId) && item.status === 'scheduled');
function assertNotScheduled(ledger, workspaceId) {
  if (activeFor(ledger, workspaceId)) { const error = new Error('Cancel the scheduled defence before changing the approved proposal.'); error.status = 409; throw error; }
}
module.exports = { same, activeFor, assertNotScheduled };
