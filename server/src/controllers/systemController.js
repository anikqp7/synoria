function getStatus(req, res) {
  res.json({ message: 'Express server is running' });
}

module.exports = { getStatus };
