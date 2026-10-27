const service = require('../services/chatMeetingService');
const action = method => async (req, res) => { try { res.set('Cache-Control', 'private, no-store'); res.status(req.method === 'POST' ? 201 : 200).json(await service[method](req)); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
module.exports = { read: action('read'), save: action('mutate') };
