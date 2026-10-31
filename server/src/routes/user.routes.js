const express = require('express');
const userController = require('../controllers/user.controller');
const { adminOnly, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');
const { accountChangeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(adminOnly);
router.param('id', validateIdParam('Supervisor not found'));

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

router.put(
  '/supervisors/:id/password',
  requirePermission('USERS', 'CHANGE_SUPERVISOR_PASSWORD'),
  userController.changeSupervisorPassword
);

router.put(
  '/me',
  requirePermission('USERS', 'UPDATE_OWN_PROFILE'),
  accountChangeLimiter,
  userController.updateOwnProfile
);

router.put(
  '/me/password',
  requirePermission('USERS', 'CHANGE_OWN_PASSWORD'),
  accountChangeLimiter,
  userController.changeOwnPassword
);

module.exports = router;
