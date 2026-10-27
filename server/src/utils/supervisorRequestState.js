const cancellationsFor = (ledger, workspace) => (ledger.history || []).filter(event => String(event.workspace) === String(workspace._id) && event.requestCancellation);
const cancellationFor = (ledger, workspace) => cancellationsFor(ledger, workspace).find(event => event.requestCancellation.revision === (workspace.supervisorRequest?.revision || 0));
module.exports = { cancellationsFor, cancellationFor };
