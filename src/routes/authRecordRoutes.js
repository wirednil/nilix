const express = require('express');
const router = express.Router();
const authRecordController = require('../controllers/authRecordController');

router.get('/:table/navigate', authRecordController.navigateRecord);
router.get('/:table', authRecordController.getRecord);
router.post('/:table', authRecordController.createRecord);
router.post('/:table/:id', authRecordController.upsertRecord);
router.put('/:table/:id', authRecordController.updateRecord);
router.delete('/:table/:id', authRecordController.deleteRecord);

module.exports = router;
