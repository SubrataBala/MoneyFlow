const express = require('express');
const router = express.Router();
const labourController = require('../controllers/labourController');
const { authorize } = require('../middleware/auth');

// All routes here are protected and require a logged-in user.

// GET /api/labour - Get labours for the logged-in owner or a specified owner (admin)
router.get('/', labourController.getLabours);
// POST /api/labour - Add a new labour for the logged-in owner
router.post('/', labourController.addLabour);
// POST /api/labour/attendance - Mark daily attendance for a labour
router.post('/attendance', labourController.markAttendance);
// GET /api/labour/wages - Get wage summary for all labours of an owner
router.get('/wages', labourController.getAllWageSummary);
// GET /api/labour/:labourId/wages - Get detailed wage summary for a single labour
router.get('/:labourId/wages', labourController.getWageSummary);
// POST /api/labour/payments - Record a new lump-sum payment for a labour
router.post('/payments', labourController.addLabourPayment);

// Admin-only routes
router.put('/attendance/admin', authorize('admin'), labourController.adminUpdateAttendance);
router.put('/:id', authorize('admin'), labourController.adminUpdateLabour);
router.delete('/:id', authorize('admin'), labourController.deleteLabour);
router.put('/:id/reactivate', authorize('admin'), labourController.adminReactivateLabour);
router.delete('/:id/permanent', authorize('admin'), labourController.adminPermanentlyDeleteLabour);

module.exports = router;
