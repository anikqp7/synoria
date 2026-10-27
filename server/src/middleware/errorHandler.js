module.exports = function errorHandler(error, req, res, next) {
  if (error.type === 'request.aborted') return;
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON request.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
};
