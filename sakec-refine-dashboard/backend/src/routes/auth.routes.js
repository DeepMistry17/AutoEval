const { Router } = require('express');
const pool = require('../config/db');
const { FIND_TEACHER_BY_EMAIL, UPDATE_TEACHER_MS_ID } = require('../utils/queries');

const router = Router();

// ─── BACKGROUND AUTO-HEALER ──────────────────────────────────────────────────
// This function runs independently so it doesn't slow down the user's login.
async function autoHealMsIdInBackground(email) {
  try {
    const tokenParams = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET, 
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return;

    const userRes = await fetch(`https://graph.microsoft.com/v1.0/users/${email}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const userData = await userRes.json();
    
    if (userData.id) {
      await pool.query(UPDATE_TEACHER_MS_ID, [userData.id, email]);
      console.log(`[AUTH] Background Auto-healed ms_id for ${email}: ${userData.id}`);
    }
  } catch (err) {
    console.warn(`[AUTH] Background MS_ID heal failed for ${email}:`, err.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    // Fire the auto-healer in the background (Notice there is no 'await' here!)
    autoHealMsIdInBackground(req.user.email);

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
 */
router.get('/me', async (req, res, next) => {
  try {
  // ─── NEW: Auto-heal on page refresh/reopen too! ───
    autoHealMsIdInBackground(req.user.email);
    
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