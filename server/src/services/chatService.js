const { Types } = require('mongoose');
const ChatPage = require('../models/chatPage');
const ChatRead = require('../models/chatRead');
const Workspace = require('../models/workspace');
const Student = require('../models/student');
const Supervisor = require('../models/supervisor');
const supervision = require('./supervisionService');
const { validKey } = require('../utils/requestValidation');
const PAGE_SIZE = 100, BATCH_SIZE = 50;
const same = (a, b) => String(a) === String(b);
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const identity = req => ({ account: req.supervisor || req.student, role: req.supervisor ? 'supervisor' : 'student' });
function checkSupervisor(ledger, workspace, account) {
  if (!ledger.assignments.some(item => same(item.workspace, workspace._id) && same(item.supervisor, account._id))) supervision.fail(404, 'Project chat not found.');
}
async function access(req) {
  const { account, role } = identity(req);
  const workspace = validId(req.params.id) && await Workspace.findOne({ _id: req.params.id, department: account.department, ...(role === 'student' ? { members: account._id } : {}) });
  if (!workspace) supervision.fail(404, 'Project chat not found.');
  const ledger = await supervision.readLedger(account.department);
  if (role === 'supervisor') checkSupervisor(ledger, workspace, account);
  return { account, role, workspace, ledger, enabled: !require('../utils/evaluationState').publishedFor(ledger, workspace._id) && !!workspace.isActive && workspace.status !== 'archived' };
}
function messageView(page, item, index) {
  return { id: String(item._id), seq: page.page * PAGE_SIZE + index + 1, text: item.text, sender: { id: String(item.senderId), role: item.senderRole, name: item.senderName }, createdAt: item.createdAt };
}
async function latestSeq(workspaceId) {
  const page = await ChatPage.findOne({ workspace: workspaceId }).sort({ page: -1 }).select('page messages').lean();
  return page ? page.page * PAGE_SIZE + page.messages.length : 0;
}
async function unreadCounts(workspaces, account, role) {
  if (!workspaces.length) return new Map();
  const cursors = await ChatRead.find({ workspace: { $in: workspaces.map(item => item._id) }, userId: account._id, role }).lean();
  const reads = new Map(cursors.map(item => [String(item.workspace), item.lastReadSeq]));
  const branches = workspaces.map(item => ({ case: { $eq: ['$workspace', item._id] }, then: reads.get(item.id) || 0 }));
  const counts = await ChatPage.aggregate([
    { $match: { $or: workspaces.map(item => ({ workspace: item._id, page: { $gte: Math.max(0, Math.floor(((reads.get(item.id) || 0) - 1) / PAGE_SIZE)) } })) } },
    { $unwind: { path: '$messages', includeArrayIndex: 'messageIndex' } },
    { $set: { seq: { $add: [{ $multiply: ['$page', PAGE_SIZE] }, '$messageIndex', 1] } } },
    { $match: { $expr: { $and: [{ $gt: ['$seq', { $switch: { branches, default: 0 } }] }, { $not: [{ $and: [{ $eq: ['$messages.senderId', account._id] }, { $eq: ['$messages.senderRole', role] }] }] }] } } },
    { $group: { _id: '$workspace', count: { $sum: 1 } } },
  ]);
  return new Map(counts.map(item => [String(item._id), item.count]));
}
async function inbox(req) {
  const { account, role } = identity(req);
  const ledger = await supervision.readLedger(account.department);
  const workspaceFilter = role === 'student' ? { members: account._id } : { _id: { $in: ledger.assignments.filter(item => same(item.supervisor, account._id)).map(item => item.workspace) } };
  const workspaces = await Workspace.find({ ...workspaceFilter, department: account.department }).sort({ createdAt: -1 });
  const counts = await unreadCounts(workspaces.filter(item => item.isActive && item.status !== 'archived'), account, role);
  const rooms = await Promise.all(workspaces.map(async workspace => {
    const page = await ChatPage.findOne({ workspace: workspace._id, 'messages.0': { $exists: true } }).sort({ page: -1 }).select('page messages').lean();
    const last = page?.messages.at(-1);
    const lastMessage = last ? messageView(page, last, page.messages.length - 1) : null;
    const activity = require('./chatActivityService').forWorkspace(workspace, ledger).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return { workspaceId: workspace.id, workspaceName: workspace.name, workType: workspace.workType, enabled: workspace.isActive && workspace.status !== 'archived', unreadCount: counts.get(workspace.id) || 0, lastMessage, lastActivity: activity && (!lastMessage || new Date(activity.createdAt) >= new Date(lastMessage.createdAt)) ? activity : lastMessage };
  }));
  rooms.sort((a, b) => Number(b.enabled) - Number(a.enabled) || new Date(b.lastActivity?.createdAt || 0) - new Date(a.lastActivity?.createdAt || 0));
  return { rooms, totalUnread: rooms.reduce((sum, item) => sum + item.unreadCount, 0) };
}
async function messages(req) {
  const context = await access(req);
  const { workspace, account, role, ledger, enabled } = context;
  const parse = (value, minimum) => {
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) supervision.fail(400, 'Invalid message cursor.');
    return Number(value);
  };
  const before = parse(req.query.before, 1), after = parse(req.query.after, 0);
  if (before !== null && after !== null) supervision.fail(400, 'Choose one message cursor at a time.');
  const latest = await latestSeq(workspace._id);
  if (after !== null && after > latest) supervision.fail(400, 'The message cursor is ahead of this chat.');
  const filter = { workspace: workspace._id, ...(after !== null ? { page: { $gte: Math.floor(after / PAGE_SIZE) } } : before !== null ? { page: { $lte: Math.floor((before - 2) / PAGE_SIZE) } } : {}) };
  const pages = req.query.timeline === 'true' ? [] : await ChatPage.find(filter).sort({ page: after !== null ? 1 : -1 }).limit(2).lean();
  let result = pages.flatMap(page => page.messages.map((item, index) => messageView(page, item, index))).filter(item => (before === null || item.seq < before) && (after === null || item.seq > after)).sort((a, b) => a.seq - b.seq);
  result = after !== null ? result.slice(0, BATCH_SIZE) : result.slice(-BATCH_SIZE);
  const cursor = await ChatRead.findOne({ workspace: workspace._id, userId: account._id, role }).lean();
  const counts = await unreadCounts([workspace], account, role);
  const assigned = ledger.assignments.find(item => same(item.workspace, workspace._id));
  const [students, supervisor] = await Promise.all([
    Student.find({ _id: { $in: workspace.members }, department: account.department }).select('name studentId isActive deletedAt'),
    assigned ? Supervisor.findById(assigned.supervisor).select('name isActive deletedAt') : null,
  ]);
  const timeline = req.query.timeline === 'true' ? await require('./chatTimelineService').read(workspace, ledger, req.query) : undefined;
  // Prevent a response from exposing messages if access was revoked during its reads.
  if (role === 'supervisor') checkSupervisor(await supervision.readLedger(account.department), workspace, account);
  else if (!await Workspace.exists({ _id: workspace._id, members: account._id, department: account.department })) supervision.fail(404, 'Project chat not found.');
  return { workspaceId: workspace.id, workspaceName: workspace.name, enabled, ...(timeline ? { timeline } : {}), viewer: { id: account.id, role }, messages: result,
    latestSeq: Math.max(latest, result.at(-1)?.seq || 0), lastReadSeq: cursor?.lastReadSeq || 0, unreadCount: counts.get(workspace.id) || 0,
    hasOlder: !!result.length && result[0].seq > 1, hasMore: after !== null && !!result.length && result.at(-1).seq < latest,
    participants: [...students.map(item => ({ id: item.id, name: item.name, role: 'student', isActive: item.isActive !== false && !item.deletedAt })), ...(supervisor ? [{ id: supervisor.id, name: supervisor.name, role: 'supervisor', isActive: supervisor.isActive !== false && !supervisor.deletedAt }] : [])] };
}
async function findRetry(workspace, account, role, requestKey) {
  return ChatPage.findOne({ workspace: workspace._id, messages: { $elemMatch: { senderId: account._id, senderRole: role, requestKey } } }).lean();
}
function retryView(page, account, role, requestKey, text) {
  const index = page.messages.findIndex(item => same(item.senderId, account._id) && item.senderRole === role && item.requestKey === requestKey);
  if (page.messages[index].text !== text) supervision.fail(409, 'This message retry key belongs to different text.');
  return messageView(page, page.messages[index], index);
}
async function send(req) {
  const { workspace, account, role, enabled } = await access(req);
  if (!enabled) supervision.fail(409, 'This project chat is read-only.');
  const { text, requestKey } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000 || !validKey(requestKey)) supervision.fail(400, 'Enter a message with up to 2000 characters and a valid retry key.');
  const trimmed = text.trim();
  const existing = await findRetry(workspace, account, role, requestKey);
  if (existing) return retryView(existing, account, role, requestKey, trimmed);
  const message = { _id: new Types.ObjectId(), senderId: account._id, senderRole: role, senderName: account.name, requestKey, text: trimmed, createdAt: new Date() };
  for (let attempt = 0; attempt < 12; attempt++) {
    const latest = await ChatPage.findOne({ workspace: workspace._id }).sort({ page: -1 }).select('page messages').lean();
    const target = !latest ? 0 : latest.messages.length >= PAGE_SIZE ? latest.page + 1 : latest.page;
    try {
      await ChatPage.updateOne({ workspace: workspace._id, page: target }, { $setOnInsert: { department: account.department, messages: [] } }, { upsert: true });
      const page = await ChatPage.findOneAndUpdate({ workspace: workspace._id, page: target, [`messages.${PAGE_SIZE - 1}`]: { $exists: false }, messages: { $not: { $elemMatch: { senderId: account._id, senderRole: role, requestKey } } } }, { $push: { messages: message } }, { returnDocument: 'after', runValidators: true }).lean();
      if (page) return retryView(page, account, role, requestKey, trimmed);
    } catch (error) { if (error.code !== 11000) throw error; }
    const repeated = await findRetry(workspace, account, role, requestKey);
    if (repeated) return retryView(repeated, account, role, requestKey, trimmed);
  }
  supervision.fail(409, 'This chat is busy. Retry your message.');
}
async function markRead(req) {
  const { workspace, account, role } = await access(req);
  const seq = req.body?.upToSeq;
  if (!Number.isSafeInteger(seq) || seq < 0 || seq > await latestSeq(workspace._id)) supervision.fail(400, 'Choose a valid last-read message.');
  const filter = { workspace: workspace._id, userId: account._id, role };
  try { await ChatRead.updateOne(filter, { $max: { lastReadSeq: seq }, $setOnInsert: filter }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; await ChatRead.updateOne(filter, { $max: { lastReadSeq: seq } }); }
  const cursor = await ChatRead.findOne(filter).lean();
  const counts = await unreadCounts([workspace], account, role);
  return { lastReadSeq: cursor.lastReadSeq, unreadCount: counts.get(workspace.id) || 0 };
}
module.exports = { access, inbox, messages, send, markRead, PAGE_SIZE };
