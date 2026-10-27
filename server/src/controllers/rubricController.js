const service = require('../services/rubricService');
const action = writing => async (req, res) => { try { res.set('Cache-Control', 'private, no-store'); res.json(writing ? await service.save(req) : await service.read(req.session.departmentId)); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
module.exports = { read: action(false), save: action(true) };
