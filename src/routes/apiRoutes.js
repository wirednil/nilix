const express = require('express');
const router = express.Router();
const filesystemController = require('../controllers/filesystemController');
const catalogRoutes = require('./catalogRoutes');

router.get('/files', filesystemController.getTree);
router.get('/menu', filesystemController.getMenu);
router.get('/files/content', filesystemController.getContent);
router.get('/reports', filesystemController.getReports);
router.use('/catalogs', catalogRoutes);

module.exports = router;
