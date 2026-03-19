const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');

router.get('/tables', catalogController.getAllowedTables);
router.get('/:table', catalogController.getTable);
router.get('/:table/:keyField/:value', catalogController.validateKey);

module.exports = router;
