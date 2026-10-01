const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('SUPPLIER', 'READ'), supplierController.list);

router.post('/', requirePermission('SUPPLIER', 'CREATE'), supplierController.create);

router.get('/:id', requirePermission('SUPPLIER', 'READ'), supplierController.get);

router.put('/:id', requirePermission('SUPPLIER', 'UPDATE'), supplierController.update);

router.delete('/:id', requirePermission('SUPPLIER', 'DELETE'), supplierController.remove);

router.post('/:id/restore', requirePermission('SUPPLIER', 'RESTORE'), supplierController.restore);

module.exports = router;
