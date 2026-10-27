const validateRequest = require('../middleware/validateRequest');
const express = require('express');
const authController = require('../controllers/authController');
const authRequest = require('../middleware/authRequest');
const authLimiter = require('../middleware/authLimiter');

const router = express.Router();

router.use(authRequest);

router.post('/register', authLimiter, validateRequest, authController.register);
router.post('/login', authLimiter, validateRequest, authController.login);
router.get('/me', validateRequest, authController.getCurrentUser);
router.post('/logout', validateRequest, authController.logout);

router.use('/evaluationPeriod', require('./evaluationPeriods')('evaluation'));
router.use('/resultPeriod', require('./evaluationPeriods')('result'));
router.use('/resourcePeriod', require('./resourcePeriod'));
router.use('/proposalPeriod', require('./proposalPeriod'));
router.use('/resources', require('./resources'));
router.use('/notifications', require('./notifications'));
router.use('/rubrics', require('./rubrics'));
router.use('/defenceNotices', require('./defenceNotices'));
router.use('/defences', require('./defences'));
router.use('/chat', require('./chat'));
router.use('/monitoring', require('./monitoring'));
router.use('/supervisorPeriod', require('./supervisorPeriod'));
router.use('/supervisorRequests', require('./supervisorRequests'));
router.use('/supervisors', require('./supervisors'));
router.use('/supervisorLoads', require('./supervisorLoads'));
router.use('/supervision', require('./supervision'));
router.use('/proposals', require('./proposals'));
router.use('/workspaces', require('./workspaces'));
router.use('/evaluationAssignments', require('./evaluationAssignments'));
router.use('/evaluationProjects', require('./evaluationProjects'));
router.use('/examiners', require('./examiners'));
router.use('/students', require('./students'));

module.exports = router;
