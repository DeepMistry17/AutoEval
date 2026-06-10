const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// JWKS client for Azure AD token signature verification
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Express middleware that:
 * 1. Validates the Azure AD JWT from the Authorization header
 * 2. Verifies the token's tenant ID (tid) matches AZURE_TENANT_ID
 * 3. Checks the email exists in sakec.teachers (NO auto-provisioning)
 * 4. Attaches req.user = { email, name, teacherId }
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // ── Development bypass for local testing ──────────────────────────────────
  if (process.env.NODE_ENV === 'development' && token === 'dev-bypass-token') {
    const pool = require('../config/db');
    const { FIND_TEACHER_BY_EMAIL } = require('../utils/queries');
    const devEmail = process.env.DEV_TEACHER_EMAIL || 'dev@sakec.ac.in';

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
      };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  // ── Production: Verify Azure AD JWT ───────────────────────────────────────
  jwt.verify(
    token,
    getSigningKey,
    {
      audience: process.env.AZURE_AUDIENCE || process.env.AZURE_CLIENT_ID,
      
      algorithms: ['RS256'],
    },
    async (err, decoded) => {
      if (err) {
        console.error('JWT verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // ── Strict Tenant ID validation ─────────────────────────────────────
      if (decoded.tid !== process.env.AZURE_TENANT_ID) {
        return res.status(403).json({
          error: 'Forbidden: Token is not from the SAKEC tenant.',
        });
      }

      // ── Extract email from Azure AD claims ──────────────────────────────
      const email = (
        decoded.preferred_username ||
        decoded.email ||
        decoded.upn ||
        ''
      ).toLowerCase();

      if (!email) {
        return res.status(401).json({ error: 'No email claim found in token' });
      }

      // ── Check teacher exists in DB ───────────────────────────────
      try {
        const pool = require('../config/db');
        const { FIND_TEACHER_BY_EMAIL } = require('../utils/queries');
        const result = await pool.query(FIND_TEACHER_BY_EMAIL, [email]);

        if (result.rows.length === 0) {
          return res.status(403).json({
            error: 'Forbidden: Your account is not registered as a teacher. Contact your administrator.',
          });
        }

        // ── THE AUTO-HEALER: Save the MS UUID directly from the login token ──
        let currentMsId = result.rows[0].ms_id;
        const trueUuid = decoded.oid; // Extract Microsoft Object ID from the token

        if (!currentMsId && trueUuid) {
          await pool.query('UPDATE sakec.teachers SET ms_id = $1 WHERE ms_email = $2', [trueUuid, email]);
          currentMsId = trueUuid;
          console.log(`[AUTH] Auto-healed ms_id for ${email} during login.`);
        }

        req.user = {
          email: result.rows[0].ms_email, 
          name: result.rows[0].full_name,
          teacherId: result.rows[0].teacher_id,
          msId: currentMsId // Pass it along for routes to use
        };
        next();
      } catch (dbErr) {
        next(dbErr);
      }
    }
  );
}

module.exports = authMiddleware;
