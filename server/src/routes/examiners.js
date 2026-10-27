const validateRequest = require('../middleware/validateRequest');
const express = require('express');
const examinerController = require('../controllers/examinerController');
const requireDepartment = require('../middleware/requireDepartment');

const router = express.Router();

router.use(requireDepartment('examiners'));

router.get('/', validateRequest, examinerController.listExaminers);
router.get('/:id', validateRequest, examinerController.getExaminer);
router.post('/', validateRequest, examinerController.createExaminer);

router.patch('/:id', validateRequest, examinerController.updateExaminer);
router.delete('/:id', validateRequest, examinerController.deleteExaminer);

module.exports = router;
