const validateRequest = require('../middleware/validateRequest');
const express = require('express');
const studentController = require('../controllers/studentController');
const requireDepartment = require('../middleware/requireDepartment');

const router = express.Router();

router.use(requireDepartment('students'));

router.get('/', validateRequest, studentController.listStudents);
router.get('/:id', validateRequest, studentController.getStudent);
router.post('/', validateRequest, studentController.createStudent);

router.patch('/:id', validateRequest, studentController.updateStudent);
router.delete('/:id', validateRequest, studentController.deleteStudent);

module.exports = router;
