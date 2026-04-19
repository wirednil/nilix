/**
 * @file recordRoutes.js
 * @description REST routes for CRUD operations
 * @module routes/recordRoutes
 */

const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');

router.get('/tables', recordController.getTables);
router.get('/:db/:table/navigate', recordController.navigateRecord);
router.get('/:db/:table', recordController.getRecord);
router.post('/:db/:table', recordController.createRecord);
router.post('/:db/:table/:id', recordController.upsertRecord);
router.put('/:db/:table/:id', recordController.updateRecord);
router.delete('/:db/:table/:id', recordController.deleteRecord);

module.exports = router;
