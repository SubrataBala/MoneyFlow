const router = require('express').Router();
// Import the new `authorize` middleware. `protect` is handled globally in server.js.
const { authorize } = require('../middleware/auth');
const {
  addLabour,
  getLabours,
  deleteLabour,
  markAttendance,
  getWageSummary,
  getAllWageSummary,
  adminUpdateAttendance,
  adminReactivateLabour,
  adminPermanentlyDeleteLabour
} = require('../controllers/labourController');

// This route is used by both Owners and Admins. The global `protect` middleware is sufficient.
// The controller itself differentiates logic based on `req.user.role`.
router.get('/', getLabours);

// These routes are for Owners only
router.post('/', authorize('owner'), addLabour);
router.post('/attendance', authorize('owner'), markAttendance);
router.get('/wages', authorize('owner'), getAllWageSummary);

// This route is for Admins to update attendance records
router.put('/admin/attendance', authorize('admin'), adminUpdateAttendance);

// Parameterized routes. More specific ones must come before generic ones.
router.put('/:id/reactivate', authorize('admin'), adminReactivateLabour);
router.delete('/:id/permanent', authorize('admin'), adminPermanentlyDeleteLabour);
router.get('/:labourId/wages', authorize('owner'), getWageSummary);

// This generic route for soft-deleting must be last to avoid capturing more specific routes.
router.delete('/:id', authorize('admin'), deleteLabour);

module.exports = router;
