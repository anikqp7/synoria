const service = require('../services/monitoringService');
const action = handler => async (req, res) => { try { res.set('Cache-Control', 'private, no-store'); await handler(req, res); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
module.exports = {
  overview: action(async (req, res) => res.json(await service.overview(req.session.departmentId))),
  list: action(async (req, res) => res.json(await service.list(req.session.departmentId, req.query))),
  detail: action(async (req, res) => res.json(await service.detail(req.session.departmentId, req.params.id))),
};
