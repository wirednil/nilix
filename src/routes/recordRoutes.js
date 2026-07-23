const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');

router.get('/tables', recordController.getTables);
router.get('/app/:table/navigate', recordController.navigateRecord);
router.get('/app/:table', recordController.getRecord);
router.post('/app/:table', recordController.createRecord);
router.post('/app/:table/:id', recordController.upsertRecord);
router.put('/app/:table/:id', recordController.updateRecord);
router.delete('/app/:table/:id', recordController.deleteRecord);

module.exports = router;
