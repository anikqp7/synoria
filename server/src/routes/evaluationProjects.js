const validateRequest = require('../middleware/validateRequest');
const router = require('express').Router();
router.use(require('../middleware/requireExaminer'));
router.get('/', validateRequest, require('../controllers/evaluationProjectController').list);
module.exports = router;
