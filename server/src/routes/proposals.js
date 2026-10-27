const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/proposalController');
router.use(require('../middleware/requireDepartment')('submitted proposals'));
router.get('/', validateRequest, controller.listSubmitted);
router.get('/:id/assignment', validateRequest, require('../controllers/assignmentController').getAssignment);
router.put('/:id/assignment', validateRequest, require('../controllers/assignmentController').assignSupervisor);
router.get('/:id', validateRequest, controller.getSubmitted);
module.exports = router;
