const { Types } = require('mongoose');
const ChatPage = require('../models/chatPage');
const { forWorkspace } = require('./chatActivityService');
const { decode, encode } = require('../utils/chatCursor');
const compare = (a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const SIZE = 50;
async function read(workspace, ledger, query) {
  const before = decode(query.timelineBefore), after = decode(query.timelineAfter), cursor = before || after;
  const order = after ? 1 : -1;
  let filter = {};
  if (cursor) {
    const date = new Date(cursor.at), operator = after ? '$gt' : '$lt';
    const branches = [{ 'messages.createdAt': { [operator]: date } }];
    if (cursor.id.startsWith('message:')) branches.push({ 'messages.createdAt': date, 'messages._id': { [operator]: new Types.ObjectId(cursor.id.slice(8)) } });
    else if (before) branches.push({ 'messages.createdAt': date });
    filter = { $or: branches };
  }
  const rows = await ChatPage.aggregate([
    { $match: { workspace: workspace._id, department: workspace.department } },
    { $unwind: { path: '$messages', includeArrayIndex: 'messageIndex' } },
    ...(cursor ? [{ $match: filter }] : []),
    { $sort: { 'messages.createdAt': order, 'messages._id': order } }, { $limit: SIZE + 1 },
    { $project: { page: 1, messageIndex: 1, messages: 1 } },
  ]);
  const messages = rows.map(row => ({ id: `message:${row.messages._id}`, type: 'message', seq: row.page * 100 + row.messageIndex + 1, text: row.messages.text, sender: { id: String(row.messages.senderId), role: row.messages.senderRole, name: row.messages.senderName }, createdAt: new Date(row.messages.createdAt).toISOString() }));
  const sharedActivities = forWorkspace(workspace, ledger);
  const activities = sharedActivities.filter(entry => !cursor || (after ? compare(entry, { id: cursor.id, createdAt: cursor.at }) > 0 : compare(entry, { id: cursor.id, createdAt: cursor.at }) < 0));
  const all = [...messages, ...activities].sort(compare), more = all.length > SIZE;
  const entries = after ? all.slice(0, SIZE) : all.slice(-SIZE);
  return { entries, recentActivities: after ? sharedActivities.filter(entry => new Date(entry.createdAt) >= new Date(new Date(after.at).getTime() - 120000) && new Date(entry.createdAt) <= new Date(after.at)).sort(compare).slice(-50) : [], oldestCursor: entries.length ? encode(entries[0]) : null, newestCursor: entries.length ? encode(entries.at(-1)) : null, hasOlder: !after && more, hasMore: !!after && more };
}
module.exports = { read };
