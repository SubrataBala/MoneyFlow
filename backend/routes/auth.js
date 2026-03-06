const router = require('express').Router();
const { login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public route for user login.
router.post('/login', login);

// Protected route to fetch the current user's data based on their token.
router.get('/me', protect, getMe);

module.exports = router;