const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/rubricController');
router.use(require('../middleware/requireDepartment')('evaluation rubrics'));
router.get('/', validateRequest, controller.read);
router.post('/', validateRequest, controller.save);
module.exports = router;
