const validateRequest = require('../middleware/validateRequest');
const router=require('express').Router();
const controller=require('../controllers/defenceNoticeController');
router.use(require('../middleware/requireDefenceUser'));
router.get('/', validateRequest,controller.list);router.post('/', validateRequest,controller.save);router.patch('/:id', validateRequest,controller.save);router.delete('/:id', validateRequest,controller.remove);
module.exports=router;
