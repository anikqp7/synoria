const service = require('../services/supervisorRequestService');
const handle = action => async (req, res) => {
  try { res.json(await action(req)); }
  catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; }
};
module.exports = { read: handle(service.read), submit: handle(service.submit), assign: handle(service.assign) };
