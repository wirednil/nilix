/**
 * @file recordRoutes.js
 * @description REST routes for CRUD operations
 * @module routes/recordRoutes
 */

const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');

router.get('/tables', recordController.getTables);
router.get('/:table/navigate', recordController.navigateRecord);
router.get('/:table', recordController.getRecord);
router.post('/:table', recordController.createRecord);
router.post('/:table/:id', recordController.upsertRecord);
router.put('/:table/:id', recordController.updateRecord);
router.delete('/:table/:id', recordController.deleteRecord);

module.exports = router;
