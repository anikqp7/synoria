const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/chatController');
router.use((req, res, next) => {
  if (!req.session.role) return res.status(401).json({ message: 'Sign in to use project chat.' });
  if (req.session.role === 'student') return require('../middleware/requireStudent')(req, res, next);
  if (req.session.role === 'supervisor') return require('../middleware/requireSupervisor')(req, res, next);
  res.status(403).json({ message: 'Project chat is private to team members and their supervisor.' });
});
router.get('/', validateRequest, controller.inbox);
router.get('/unread', validateRequest, controller.unread);
module.exports = router;
