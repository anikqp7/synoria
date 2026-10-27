const service = require('../services/chatService');
const action = handler => async (req, res) => { try { await handler(req, res); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
module.exports = {
  inbox: action(async (req, res) => res.json(await service.inbox(req))),
  unread: action(async (req, res) => { const result = await service.inbox(req); res.json({ totalUnread: result.totalUnread, rooms: result.rooms.map(item => ({ workspaceId: item.workspaceId, unreadCount: item.unreadCount })) }); }),
  messages: action(async (req, res) => res.json(await service.messages(req))),
  send: action(async (req, res) => res.status(201).json({ message: await service.send(req) })),
  read: action(async (req, res) => res.json(await service.markRead(req))),
};
