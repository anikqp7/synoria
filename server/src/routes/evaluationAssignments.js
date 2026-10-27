const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/evaluationAssignmentController');
router.use(require('../middleware/requireSupervisor'));
router.get('/:id', validateRequest, controller.read); router.put('/:id', validateRequest, controller.assign);
module.exports = router;
