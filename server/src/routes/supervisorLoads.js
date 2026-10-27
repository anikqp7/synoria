const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/assignmentController');
router.use(require('../middleware/requireDepartment')('supervisor capacity'));
router.get('/', validateRequest, controller.listLoads);
router.patch('/:id', validateRequest, controller.updateCapacity);
module.exports = router;
