const { Types } = require('mongoose');
const Notification = require('../models/notification');
const Workspace = require('../models/workspace');
const Department = require('../models/department');
const ChatPage = require('../models/chatPage');
const ChatRead = require('../models/chatRead');
const supervision = require('./supervisionService');
const { buildEvents, categories } = require('./notificationEvents');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
function scoped(viewer) { return { department: viewer.department, recipient: viewer.id, role: viewer.role }; }
async function unreadChat(workspaces, viewer) {
  if (!['student', 'supervisor'].includes(viewer.role) || !workspaces.length) return [];
  const reads = await ChatRead.find({ workspace: { $in: workspaces.map(item => item._id) }, userId: viewer.id, role: viewer.role }).lean();
  const cursors = new Map(reads.map(item => [String(item.workspace), item.lastReadSeq]));
  const branches = workspaces.map(item => ({ case: { $eq: ['$workspace', item._id] }, then: cursors.get(String(item._id)) || 0 }));
  return ChatPage.aggregate([
    { $match: { department: new Types.ObjectId(String(viewer.department)), $or: workspaces.map(item => ({ workspace: item._id, page: { $gte: Math.max(0, Math.floor(((cursors.get(String(item._id)) || 0) - 1) / 100)) } })) } },
    { $unwind: { path: '$messages', includeArrayIndex: 'index' } },
    { $set: { seq: { $add: [{ $multiply: ['$page', 100] }, '$index', 1] } } },
    { $match: { $expr: { $and: [{ $gt: ['$seq', { $switch: { branches, default: 0 } }] }, { $not: [{ $and: [{ $eq: ['$messages.senderId', new Types.ObjectId(viewer.id)] }, { $eq: ['$messages.senderRole', viewer.role] }] }] }] } } },
    { $sort: { seq: -1 } }, { $group: { _id: '$workspace', message: { $first: { senderId: '$messages.senderId', senderName: '$messages.senderName', createdAt: '$messages.createdAt' } }, seq: { $first: '$seq' } } },
  ]);
}
async function project(viewer) {
  await Notification.init();
  const startedAt = new Date(), ledger = await supervision.readLedger(viewer.department);
  let ownership = {};
  if (viewer.role === 'student') ownership = { $or: [{ members: viewer.id }, { 'invitations.student': viewer.id }, { 'teamEvents.member': viewer.id }, { 'joinRequests.student': viewer.id }] };
  if (viewer.role === 'supervisor') {
    const ids = [...ledger.assignments.filter(item => String(item.supervisor) === viewer.id).map(item => item.workspace), ...(ledger.history || []).filter(item => String(item.from?.id) === viewer.id || String(item.to?.id) === viewer.id).map(item => item.workspace)];
    ownership = { _id: { $in: ids } };
  }
  if (viewer.role === 'examiner') ownership = { _id: { $in: (ledger.defences || []).filter(item => item.board.some(member => String(member.id) === viewer.id) || item.history.some(event => event.board.some(member => String(member.id) === viewer.id))).map(item => item.workspace) } };
  const [workspaces, account, proposalDepartment] = await Promise.all([
    Workspace.find({ department: viewer.department, ...ownership }).select('supervisorRequest name members leader invitations joinRequests teamEvents proposalVersions.version proposalVersions.submittedAt proposalVersions.submittedBy isActive status createdAt').lean(),
    viewer.account || Department.findById(viewer.id).select('name createdAt updatedAt').lean(),
    Department.findById(viewer.department).select('proposalNotices resourceNotices supervisorNotices evaluationNotices resultNotices').lean(),
  ]);
  const base = buildEvents({ viewer, workspaces, ledger, now: startedAt, account });
  const accessible = workspaces.filter(item => base.workspaceIds.includes(String(item._id)));
  const active = accessible.filter(item => item.isActive && item.status !== 'archived' && !(ledger.defences || []).some(defence => String(defence.workspace) === String(item._id) && defence.evaluation?.publication));
  const chats = await unreadChat(active, viewer);
  const notices = await require('../models/defenceNotice').find({ department: viewer.department, startsAt: { $gte: startedAt } }).lean();
  const projected = buildEvents({ viewer, workspaces, ledger, chats, notices, proposalNotices: proposalDepartment?.proposalNotices || [], resourceNotices: proposalDepartment?.resourceNotices || [], supervisorNotices: proposalDepartment?.supervisorNotices || [], evaluationNotices:proposalDepartment?.evaluationNotices||[],resultNotices:proposalDepartment?.resultNotices||[], now: startedAt, account });
  if (projected.events.length) {
    const existing = await Notification.find({ ...scoped(viewer), eventKey: { $in: projected.events.map(event => event.eventKey) } }).select('eventKey').lean();
    const known = new Set(existing.map(item => item.eventKey));
    const changes = projected.events.filter(event => event.dynamic || !known.has(event.eventKey));
    try {
      if (changes.length) await Notification.bulkWrite(changes.map(event => ({ updateOne: { filter: { ...scoped(viewer), eventKey: event.eventKey }, update: { $setOnInsert: { ...scoped(viewer), ...event, receivedAt: startedAt, readAt: null }, $set: { withdrawnAt: null }, $max: { checkedAt: startedAt } }, upsert: true } })), { ordered: false });
    } catch (error) {
      // Simultaneous inbox polls may both try the first upsert. The unique event
      // index selects one; all other storage failures remain visible to the API.
      if (!error.writeErrors?.length || error.writeErrors.some(item => item.code !== 11000)) throw error;
    }
  }
  const dynamicKeys = projected.events.filter(event => event.dynamic).map(event => event.eventKey);
  await Notification.updateMany({ ...scoped(viewer), dynamic: true, eventKey: { $nin: dynamicKeys }, withdrawnAt: null, checkedAt: { $lt: startedAt } }, { $set: { withdrawnAt: startedAt } });
  return { ...projected, serverNow: new Date() };
}
function accessFilter(viewer, projected, includeResolved = false) {
  return { ...scoped(viewer), category: { $in: categories }, ...(includeResolved ? {} : { withdrawnAt: null }), $and: [
    { $or: [{ category: { $ne: 'reminder' } }, { eventKey: /^reminder:defence:/ }] },
    { $or: [{ category: { $ne: 'meeting' } }, { eventKey: /^meeting:[a-f0-9]{24}:[a-f0-9]{24}$/i }] },
    { $or: [{ scope: 'personal' }, { scope: 'workspace', workspace: { $in: projected.workspaceIds } }, { scope: 'defence', defence: { $in: projected.defenceIds } }] },
    ...(includeResolved ? [] : [{ $or: [{ dynamic: false }, { eventKey: { $in: projected.events.filter(item => item.dynamic).map(item => item.eventKey) } }] }]),
  ] };
}
function options(query) {
  if (Object.keys(query).some(key => !['cursor', 'unread', 'category', 'limit'].includes(key)) || Object.values(query).some(value => typeof value !== 'string') || (query.unread && !['true', 'false'].includes(query.unread)) || (query.category && !categories.includes(query.category)) || (query.limit && !/^(?:[1-9]|[1-4]\d|50)$/.test(query.limit))) supervision.fail(400, 'Choose valid notification filters.');
  let cursor;
  if (query.cursor) {
    try {
      if (query.cursor.length > 200 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error();
      cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString());
      if (!validId(cursor.id) || typeof cursor.at !== 'string' || new Date(cursor.at).toISOString() !== cursor.at) throw new Error();
    } catch { supervision.fail(400, 'Invalid notification cursor.'); }
  }
  return { ...query, cursor, limit: Number(query.limit || 20) };
}
function view(item, viewer) {
  let href = item.href;
  if(/^\/department\/supervisors#supervisor(?:Notice|Requests)$/.test(href))href=href.replace('/department/supervisors#','/department/manageSupervision#');
  if(viewer.role==='supervisor'&&['proposal','supervision'].includes(item.category)&&/^\/supervisor\/projects\/[a-f0-9]{24}(?:#proposal)?$/i.test(href))href=href.replace('/supervisor/projects/','/supervisor/proposals/').replace(/#proposal$/,'');
  if(href === '/department/projects' || href.startsWith('/department/projects/')) href = href.replace('/department/projects','/department/proposals');
  if(href === '/student/invitations') href = '/student/team#teamInvitations';
  if (/^\/(student|supervisor)\/archives\//.test(href) && item.workspace) {
    href = viewer.role === 'supervisor' ? `/supervisor/projects/${item.workspace}` : item.category === 'proposal' ? '/student/proposal' : `/student/project/${item.workspace}`;
  }
  return { id: String(item._id), category: item.category, title: item.title, message: item.message, href, createdAt: item.occurredAt, readAt: item.readAt };
}
async function list(req) {
  const opts = options(req.query), viewer = req.accountContext, projected = await project(viewer), access = accessFilter(viewer, projected);
  const filter = { ...access, ...(opts.unread === 'true' ? { readAt: null } : {}), ...(opts.category ? { category: opts.category } : {}) };
  if (opts.cursor) filter.$and = [...access.$and, { $or: [{ occurredAt: { $lt: new Date(opts.cursor.at) } }, { occurredAt: new Date(opts.cursor.at), _id: { $lt: opts.cursor.id } }] }];
  const [items, unreadCount] = await Promise.all([Notification.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(opts.limit + 1).lean(), Notification.countDocuments({ ...access, readAt: null })]);
  const more = items.length > opts.limit, notifications = items.slice(0, opts.limit), last = notifications.at(-1);
  return { viewer: { id: viewer.id, role: viewer.role }, notifications: notifications.map(item => view(item, viewer, projected)), unreadCount, nextCursor: more ? Buffer.from(JSON.stringify({ at: last.occurredAt.toISOString(), id: String(last._id) })).toString('base64url') : null, serverNow: projected.serverNow, categories };
}
async function readOne(req) {
  if (!validId(req.params.id)) supervision.fail(404, 'Notification not found.');
  const viewer = req.accountContext, projected = await project(viewer), filter = { ...accessFilter(viewer, projected, true), _id: req.params.id };
  const updated = await Notification.updateOne({ ...filter, readAt: null }, { $set: { readAt: new Date() } });
  const item = await Notification.findOne(filter).lean();
  if (!item) supervision.fail(404, 'Notification not found.');
  return { notification: view(item, viewer, projected), markedRead: updated.modifiedCount > 0 && !item.withdrawnAt && (!item.dynamic || projected.events.some(event => event.eventKey === item.eventKey)) };
}
async function readAll(req) {
  const before = req.body?.before;
  if (typeof before !== 'string' || !Number.isFinite(new Date(before).getTime()) || new Date(before).toISOString() !== before || new Date(before) > new Date()) supervision.fail(400, 'Send the notification list’s current read timestamp.');
  const viewer = req.accountContext, projected = await project(viewer);
  const result = await Notification.updateMany({ ...accessFilter(viewer, projected), readAt: null, receivedAt: { $lte: new Date(before) } }, { $set: { readAt: new Date() } });
  return { markedRead: result.modifiedCount };
}
module.exports = { list, readOne, readAll, project };
