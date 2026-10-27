const validateRequest = require('../middleware/validateRequest');
const router=require('express').Router(),c=require('../controllers/supervisorPeriodController');
router.use(require('../middleware/requireDefenceUser'));router.get('/', validateRequest,c.read);router.put('/', validateRequest,c.save);module.exports=router;
