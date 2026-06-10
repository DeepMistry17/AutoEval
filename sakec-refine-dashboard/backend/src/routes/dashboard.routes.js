const { Router } = require('express');
const pool = require('../config/db');
const {
  KPI_PENDING,
  KPI_SYNCED,
  KPI_AWAITING_EVAL,
  KPI_MISSING,
  GET_PENDING_GRADES,
  GET_ALIGNMENT_DATA,
  GET_STUDENT_SUMMARY,
  GET_STUDENT_CLEARANCE,
  GET_TEAM_ROSTER_CLEARANCE,
  GET_EXPORT_DATA
} = require('../utils/queries');

const router = Router();

/**
 * GET /api/dashboard/kpis
 * Returns all four KPI counts in a single response
 */
router.get('/kpis', async (req, res, next) => {
  try {
    const email = req.user.email;
    const assignmentId = req.query.assignmentId || null;

    const [pending, synced, awaiting, missing] = await Promise.all([
      pool.query(KPI_PENDING, [email, assignmentId]),
      pool.query(KPI_SYNCED, [email, assignmentId]),
      pool.query(KPI_AWAITING_EVAL, [email, assignmentId]),
      pool.query(KPI_MISSING, [email, assignmentId]),
    ]);

    res.json({
      pending: parseInt(pending.rows[0]?.total || 0, 10),
      synced: parseInt(synced.rows[0]?.total || 0, 10),
      awaiting: parseInt(awaiting.rows[0]?.total || 0, 10),
      overdue: Math.max(0, parseInt(missing.rows[0]?.total || 0, 10)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/pending-grades?assignmentId=
 * Returns submissions needing teacher review
 */
router.get('/pending-grades', async (req, res, next) => {
  try {
    const email = req.user.email;
    const assignmentId = req.query.assignmentId || null;
    const result = await pool.query(GET_PENDING_GRADES, [email, assignmentId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/alignment?assignmentId=
 * Returns AI vs Teacher grading alignment data for charting
 */
router.get('/alignment', async (req, res, next) => {
  try {
    const email = req.user.email;
    const assignmentId = req.query.assignmentId || null;
    const result = await pool.query(GET_ALIGNMENT_DATA, [email, assignmentId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/student-summary?assignmentId=
 * Returns per-student submission status for a specific assignment
 */
router.get('/student-summary', async (req, res, next) => {
  try {
    const assignmentId = req.query.assignmentId;
    
    // FIX: If no assignment is selected, gracefully return an empty array
    // This stops the 400 Bad Request error loop on the frontend!
    if (!assignmentId || assignmentId === 'undefined') {
      return res.json([]); 
    }
    
    const result = await pool.query(GET_STUDENT_SUMMARY, [assignmentId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/student-clearance
 * Query Params: ?prn=MS_12345678&teamId=team-uuid
 */
router.get('/student-clearance', async (req, res, next) => {
  try {
    const { prn, teamId } = req.query;
    
    if (!prn || !teamId) {
      return res.status(400).json({ error: 'Missing prn or teamId' });
    }

    const result = await pool.query(GET_STUDENT_CLEARANCE, [prn, teamId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/team-roster
 * Query Params: ?teamId=team-uuid
 */
router.get('/team-roster', async (req, res, next) => {
  try {
    const { teamId } = req.query;
    
    if (!teamId || teamId === 'undefined') {
      return res.json([]); 
    }

    const result = await pool.query(GET_TEAM_ROSTER_CLEARANCE, [teamId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});


/**
 * POST /api/dashboard/export
 * Body: { teamId: string, assignmentIds: string[] }
 */
router.post('/export', async (req, res, next) => {
  try {
    const { teamId, assignmentIds } = req.body;
    
    if (!teamId || !assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid teamId/assignmentIds' });
    }

    const result = await pool.query(GET_EXPORT_DATA, [teamId, assignmentIds]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
