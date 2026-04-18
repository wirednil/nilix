'use strict';

const express = require('express');
const router  = express.Router();
const { getStatus, initSetup } = require('../controllers/setupController');

router.get('/status', getStatus);
router.post('/init',  initSetup);

module.exports = router;
