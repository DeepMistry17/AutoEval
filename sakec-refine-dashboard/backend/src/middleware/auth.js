const schema = process.env.DB_SCHEMA || 'sakec';
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const { FIND_TEACHER_BY_EMAIL } = require('../utils/queries');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Express middleware that:
 * 1. Validates the Google ID Token from the Authorization header
 * 2. Checks if the teacher's MS_email exists in ${schema}.teachers
 * 3. Attaches req.user = { email, name, teacherId, msId }
 */
async function authMiddleware(req, res, next) {
  // ── Bulletproof n8n Webhook Bypass ───────────────────────────────────────
  if (req.path.includes('/webhook/') || req.headers['x-n8n-secret'] === 'sakec_n8n_secret_2026') {
    console.log(`[AUTH BYPASS] Letting n8n through for path: ${req.path}`);
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // ── Development Bypass for Local Testing ──────────────────────────────────
  if (process.env.NODE_ENV === 'development' && token === 'dev-bypass-token') {
    const devEmail = process.env.DEV_TEACHER_EMAIL || `dev@${schema}.ac.in`;

    try {
      const result = await pool.query(FIND_TEACHER_BY_EMAIL, [devEmail]);
      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden: Your account is not registered as a teacher.',
        });
      }
      req.user = {
        email: result.rows[0].ms_email,
        name: result.rows[0].full_name,
        teacherId: result.rows[0].teacher_id,
        msId: result.rows[0].ms_id,
      };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  // ── Production: Verify Google ID Token ─────────────────────────────────────
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      console.warn('[AUTH 401] Invalid Google token payload.');
      return res.status(401).json({ error: 'Invalid Google token payload' });
    }

    const email = payload.email.toLowerCase();

    // ── Check Teacher Exists in DB ──────────────────────────────────────────
    const result = await pool.query(FIND_TEACHER_BY_EMAIL, [email]);

    if (result.rows.length === 0) {
      console.warn(`[AUTH 403] Teacher NOT FOUND in database for email: ${email}`);
      return res.status(403).json({
        error: 'Forbidden: Your account is not registered as a teacher. Contact your administrator.',
      });
    }

    const teacher = result.rows[0];

    req.user = {
      email: teacher.ms_email,
      name: teacher.full_name,
      teacherId: teacher.teacher_id,
      msId: teacher.ms_id,
    };

    next();
  } catch (err) {
    console.error('[AUTH 401] Google token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired Google token' });
  }
}

module.exports = authMiddleware;