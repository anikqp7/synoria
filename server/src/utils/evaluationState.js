const { same } = require('./defenceState');
const publishedFor = (ledger, workspaceId) => (ledger?.defences || []).find(item => same(item.workspace, workspaceId) && item.evaluation?.publication);
const complete = item => !!item.evaluation?.rubric && item.board.length > 0 && item.board.every(member => item.evaluation.records.some(record => same(record.examiner.id, member.id) && record.status === 'submitted'));
function assertWritable(ledger, workspaceId) {
  if (publishedFor(ledger, workspaceId)) { const error = new Error('This project has a published result and is archived. Its history is read-only.'); error.status = 409; throw error; }
}
async function syncArchives(ledger) {
  const ids = (ledger?.defences || []).filter(item => item.evaluation?.publication).map(item => item.workspace);
  if (ids.length) await require('../models/workspace').updateMany({ _id: { $in: ids }, department: ledger._id, $or: [{ status: { $ne: 'archived' } }, { isActive: { $ne: false } }] }, { $set: { status: 'archived', isActive: false }, $inc: { __v: 1 } });
}
module.exports = { publishedFor, complete, assertWritable, syncArchives };
