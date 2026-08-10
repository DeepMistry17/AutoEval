const { Router } = require('express');
const pool = require('../config/db');
const { FIND_TEACHER_BY_EMAIL, UPDATE_TEACHER_MS_ID } = require('../utils/queries');

const router = Router();

// ─── BACKGROUND AUTO-HEALER (WITH DEEP DEBUGGING) ────────────────────────────
async function autoHealMsIdInBackground(email) {
  console.log(`[AUTH-DEBUG] Starting auto-heal for: ${email}`);
  console.log(`[AUTH-DEBUG] Azure Tenant ID configured? ${!!process.env.AZURE_TENANT_ID}`);

  try {
    const tokenParams = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET, 
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    // 1. Fetch MS Graph Token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Token request HTTP error: ${tokenRes.status} - ${errText}`);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Microsoft did not return an access token.');

    // 2. Fetch User Profile
    const userRes = await fetch(`https://graph.microsoft.com/v1.0/users/${email}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    if (!userRes.ok) {
      const errText = await userRes.text();
      throw new Error(`Graph API HTTP error: ${userRes.status} - ${errText}`);
    }

    const userData = await userRes.json();
    
    // 3. Update Database
    if (userData.id) {
      await pool.query(UPDATE_TEACHER_MS_ID, [userData.id, email]);
      console.log(`✅ [AUTH] Background Auto-healed ms_id for ${email}: ${userData.id}`);
    } else {
      console.warn(`⚠️ [AUTH] MS Graph responded, but no 'id' field was found for ${email}`);
    }

  } catch (err) {
    console.error(`❌ [AUTH] Background MS_ID heal failed for ${email}:`, err.message);
    // This will reveal the exact system error causing 'fetch failed'
    if (err.cause) {
      console.error(`[AUTH-DEBUG] Fetch system cause:`, err.cause.message || err.cause);
    }
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