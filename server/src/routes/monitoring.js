const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/monitoringController');
router.use(require('../middleware/requireDepartment')('project monitoring'));
router.get('/', validateRequest, controller.list);
router.get('/overview', validateRequest, controller.overview);
router.get('/:id', validateRequest, controller.detail);
module.exports = router;
