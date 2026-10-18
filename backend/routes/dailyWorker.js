const router = require('express').Router();
// Import the new `authorize` middleware. The global `protect` middleware handles authentication.
const { authorize } = require('../middleware/auth');
const { 
  createOrUpdate, 
  addPayment, 
  getRecords, 
  getPayments, 
  getTodaySummary,
  getStoredGroups,
  createStoredGroup,
  updateStoredGroup,
  deleteStoredGroup
} = require('../controllers/dailyWorkerController');

// Routes in this file are for owners and admins
router.use(authorize('owner', 'admin'));
router.get('/groups', getStoredGroups);
router.post('/groups', createStoredGroup);
router.put('/groups/:id', updateStoredGroup);
router.delete('/groups/:id', deleteStoredGroup);

router.post('/', createOrUpdate);
router.post('/payment', addPayment);
router.get('/payments', getPayments);
router.get('/', getRecords);
router.get('/today', getTodaySummary);

module.exports = router;
