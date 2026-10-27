const validateRequest = require('../middleware/validateRequest');
const express = require('express');
const supervisorController = require('../controllers/supervisorController');
const requireDepartment = require('../middleware/requireDepartment');

const router = express.Router();

router.use(requireDepartment('supervisors'));

router.get('/', validateRequest, supervisorController.listSupervisors);
router.get('/:id', validateRequest, supervisorController.getSupervisor);
router.post('/', validateRequest, supervisorController.createSupervisor);

router.patch('/:id', validateRequest, supervisorController.updateSupervisor);
router.delete('/:id', validateRequest, supervisorController.deleteSupervisor);

module.exports = router;
