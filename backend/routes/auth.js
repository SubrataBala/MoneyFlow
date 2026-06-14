const router = require('express').Router();
const { login, getMe, registerAdmin, loginAdminWithSupabase } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public route for user login.
router.post('/login', login);
router.post('/admin/supabase-login', loginAdminWithSupabase);

// Public route for new admin registration.
router.post('/register-admin', registerAdmin);

// Protected route to fetch the current user's data based on their token.
router.get('/me', protect, getMe);

module.exports = router;
