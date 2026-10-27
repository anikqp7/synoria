const validateRequest = require('../middleware/validateRequest');
const router=require('express').Router(),c=require('../controllers/resourceController');
router.use(require('../middleware/requireDefenceUser'));router.get('/', validateRequest,c.list);router.get('/:id', validateRequest,c.read);router.post('/:id', validateRequest,c.save);router.get('/:id/files/:itemId', validateRequest,c.download);module.exports=router;
