const express = require('express');
const router = express.Router();
const { getPaymentSummary } = require('../controllers/dashboardController');

// This route is protected by the global 'protect' middleware in server.js
router.get('/summary', getPaymentSummary);

module.exports = router;    