/**
 * @file handlerRoutes.js
 * @description Routes for handler execution
 * @module routes/handlerRoutes
 */

const express = require('express');
const router = express.Router();
const handlerController = require('../controllers/handlerController');

router.post('/:handler/after', handlerController.after);
router.post('/:handler/after-field', handlerController.afterField);
router.post('/:handler/before', handlerController.before);

module.exports = router;
