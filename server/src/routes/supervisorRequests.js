const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/supervisorRequestController');
router.use(require('../middleware/requireDefenceUser'));
router.use((req, res, next) => ['student', 'department'].includes(req.defenceRole) ? next() : res.status(403).json({ message: 'Only students and their department can access supervisor requests.' }));
router.get('/', validateRequest, controller.read);
router.put('/', validateRequest, controller.submit);
router.put('/:id/assignment', validateRequest, controller.assign);
module.exports = router;
