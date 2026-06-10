const { Router } = require('express');
const pool = require('../config/db');
const { FIND_TEACHER_BY_EMAIL } = require('../utils/queries');

const router = Router();

/**
 * POST /api/auth/login
 * Body: { token } — the Azure AD access token from the frontend
 * Returns: { user } if teacher exists, 403 if not
 *
 * NOTE: In production, the frontend sends the Azure AD token.
 *       The auth middleware validates it and attaches req.user.
 *       This endpoint simply returns the user profile.
 */
router.post('/login', async (req, res, next) => {
  try {
    // req.user is already set by the auth middleware
    res.json({
      user: {
        email: req.user.email,
        name: req.user.name,
        teacherId: req.user.teacherId,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile
 */
router.get('/me', async (req, res, next) => {
  try {
    res.json({
      user: {
        email: req.user.email,
        name: req.user.name,
        teacherId: req.user.teacherId,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
