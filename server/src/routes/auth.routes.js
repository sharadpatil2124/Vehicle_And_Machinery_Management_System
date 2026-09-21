const express = require('express');
const authController = require('../controllers/auth.controller');
const passwordResetController = require('../controllers/passwordReset.controller');
const { authenticated } = require('../middleware/authorize');
const { authLimiter, signupLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// POST /api/auth/signup
// Public. Creates a new organization (Tenant) plus its first Admin user.
// Body: { organizationName, name, email, password }
router.post('/signup', signupLimiter, authController.signUp);

// POST /api/auth/login
// Public. Signs in. Body: { email, password } -> returns { token, user, organization }
router.post('/login', authLimiter, authController.logIn);

// POST /api/auth/forgot-password
// Public. Sends a password-reset link (printed to the server terminal in dev).
// Body: { email }
router.post('/forgot-password', authLimiter, passwordResetController.requestReset);

// GET /api/auth/reset-password?token=...
// Public. Checks whether a reset token is still valid (used by the reset-password page when it first loads).
router.get('/reset-password', authLimiter, passwordResetController.checkToken);

// POST /api/auth/reset-password
// Public. Sets a new password using the token. Body: { token, password }
router.post('/reset-password', authLimiter, passwordResetController.resetPassword);

// POST /api/auth/logout
// Requires auth. Invalidates the current session.
router.post('/logout', authenticated, authController.logOut);

// GET /api/auth/me
// Requires auth. Returns the logged-in user's own profile + organization.
router.get('/me', authenticated, authController.me);

module.exports = router;
