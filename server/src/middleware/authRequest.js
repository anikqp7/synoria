module.exports = function authRequest(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ message: 'Send requests as application/json.' });
  }
  next();
};
