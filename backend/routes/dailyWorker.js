const router = require('express').Router();
// Import the new `authorize` middleware. The global `protect` middleware handles authentication.
const { authorize } = require('../middleware/auth');
const { createOrUpdate, addPayment, getRecords, getPayments, getTodaySummary } = require('../controllers/dailyWorkerController');

// All routes in this file are for owners only.
router.use(authorize('owner'));
router.post('/', createOrUpdate);
router.post('/payment', addPayment);
router.get('/payments', getPayments);
router.get('/', getRecords);
router.get('/today', getTodaySummary);

module.exports = router;
