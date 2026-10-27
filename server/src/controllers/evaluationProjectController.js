const service = require('../services/evaluationProjectService');
async function list(req, res) { res.set('Cache-Control', 'private, no-store'); res.json(await service.list(req)); }
module.exports = { list };
