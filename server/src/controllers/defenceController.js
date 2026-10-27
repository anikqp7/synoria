const service = require('../services/defenceService');
const action = handler => async (req, res) => { try { res.set('Cache-Control', 'private, no-store'); await handler(req, res); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
module.exports = {
  list: action(async (req, res) => res.json(await service.list(req))),
  detail: action(async (req, res) => res.json(await service.detail(req))),
  create: action(async (req, res) => res.status(403).json({message:'Only assigned supervisors can submit projects to an examiner.'})),
  update: action(async (req, res) => res.json(await service.mutate(req, 'update'))),
  cancel: action(async (req, res) => res.json(await service.mutate(req, 'cancel'))),
};
