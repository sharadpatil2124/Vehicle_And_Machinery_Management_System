const express = require('express');
const userController = require('../controllers/user.controller');
const { adminOnly, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(adminOnly);

router.get('/', requirePermission('USERS', 'LIST'), userController.list);

router.post(
  '/supervisors',
  requirePermission('USERS', 'CREATE_SUPERVISOR'),
  userController.createSupervisor
);

router.put(
  '/supervisors/:id',
  requirePermission('USERS', 'UPDATE_SUPERVISOR'),
  userController.updateSupervisor
);

router.patch(
  '/supervisors/:id/status',
  requirePermission('USERS', 'SET_SUPERVISOR_STATUS'),
  userController.setSupervisorStatus
);

module.exports = router;
