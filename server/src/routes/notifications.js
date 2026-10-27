const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
const controller = require('../controllers/notificationController');
router.use(require('../middleware/requireAccount')('notifications'));
router.get('/', validateRequest, controller.list);
router.patch('/:id/read', validateRequest, controller.readOne);
router.post('/readAll', validateRequest, controller.readAll);
module.exports = router;
