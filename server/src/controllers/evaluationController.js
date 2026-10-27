const service = require('../services/evaluationService');
const action = kind => async (req, res) => { try { res.set('Cache-Control', 'private, no-store'); res.json(kind === 'read' ? await service.read(req) : await service.mutate(req, kind)); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
module.exports = { read: action('read'), assign: action('assign'), save: action('save'), submit: action('submit'), reopen: action('reopen'), publish: action('publish'), correct:action('correct') };
