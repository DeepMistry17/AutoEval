const { Router } = require('express');
const pool = require('../config/db');
const {
  KPI_PENDING,
  KPI_SYNCED,
  KPI_AWAITING_EVAL,
  KPI_MISSING,
  KPI_PROCESSING, // <-- Add this right here!
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
 * Returns all five KPI counts in a single response
 */
router.get('/kpis', async (req, res, next) => {
  try {
    const email = req.user.email;
    const assignmentId = req.query.assignmentId || null;

    const [pending, synced, awaiting, missing, processing] = await Promise.all([
      pool.query(KPI_PENDING, [email, assignmentId]),
      pool.query(KPI_SYNCED, [email, assignmentId]),
      pool.query(KPI_AWAITING_EVAL, [email, assignmentId]),
      pool.query(KPI_MISSING, [email, assignmentId]),
      pool.query(KPI_PROCESSING, [email, assignmentId]), // Added processing query
    ]);

    res.json({
      pending: parseInt(pending.rows[0]?.total || 0, 10),
      synced: parseInt(synced.rows[0]?.total || 0, 10),
      awaiting: parseInt(awaiting.rows[0]?.total || 0, 10),
      overdue: Math.max(0, parseInt(missing.rows[0]?.total || 0, 10)),
      processing: parseInt(processing.rows[0]?.total || 0, 10), // Map processing to JSON
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

/**
 * GET /api/dashboard/ai-override?assignmentId=
 * Returns the count of accepted vs overridden AI grades
 */
router.get('/ai-override', async (req, res, next) => {
  try {
    const assignmentId = req.query.assignmentId;
    
    // We check if final_marks is NULL (not reviewed yet) or matches AI marks exactly.
    const query = `
      SELECT 
        COUNT(CASE WHEN final_marks IS NULL OR final_marks = ai_suggested_marks THEN 1 END) AS accepted,
        COUNT(CASE WHEN final_marks IS NOT NULL AND final_marks != ai_suggested_marks THEN 1 END) AS overridden
      FROM ${process.env.DB_SCHEMA || 'sakec'}.submissions
      WHERE status IN ('Graded', 'Synced')
        AND ($1::text IS NULL OR assignment_id = $1);
    `;

    const result = await pool.query(query, [assignmentId]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("? AI OVERRIDE SQL ERROR:", err.message); 
    res.status(500).json({ error: 'Failed to fetch override data' });
  }
});

/**
 * GET /api/dashboard/submission-timeline?assignmentId=
 * Returns compliance trajectory (On-Time, Late, Missing) for a stacked column chart
 */
router.get('/submission-timeline', async (req, res, next) => {
  try {
    const assignmentId = req.query.assignmentId;
    
    if (!assignmentId || assignmentId === 'undefined') {
      return res.json({}); 
    }

    // Calculates On-time, Late, and Missing students for the whole cohort
    const query = `
      SELECT 
        COUNT(CASE WHEN sub.is_late = false THEN 1 END) AS on_time,
        COUNT(CASE WHEN sub.is_late = true THEN 1 END) AS late,
        (SELECT COUNT(*) FROM ${process.env.DB_SCHEMA || 'sakec'}.team_students ts WHERE ts.team_id = a.team_id) - COUNT(sub.submission_id) AS missing
      FROM ${process.env.DB_SCHEMA || 'sakec'}.assignments a
      LEFT JOIN ${process.env.DB_SCHEMA || 'sakec'}.submissions sub ON a.assignment_id = sub.assignment_id
      WHERE a.assignment_id = $1
      GROUP BY a.team_id;
    `;

    const result = await pool.query(query, [assignmentId]);
    
    // Fallback safely to 0 if the query returns nothing
    res.json(result.rows[0] || { on_time: 0, late: 0, missing: 0 });
  } catch (err) {
    console.error("? COMPLIANCE SQL ERROR:", err.message); 
    res.status(500).json({ error: 'Failed to fetch compliance data' });
  }
});

/**
 * GET /api/dashboard/alert-readiness?assignmentId=
 */
router.get('/alert-readiness', async (req, res, next) => {
  try {
    const assignmentId = req.query.assignmentId;
    
    if (!assignmentId || assignmentId === 'undefined') {
      return res.json({ linked: 0, total: 0 }); 
    }

    // FIX: NULLIF ensures empty strings aren't accidentally counted as linked accounts
    const query = `
      SELECT 
        COUNT(NULLIF(TRIM(s.telegram_id), '')) AS linked,
        COUNT(s.microsoft_id) AS total
      FROM ${process.env.DB_SCHEMA || 'sakec'}.assignments a
      JOIN ${process.env.DB_SCHEMA || 'sakec'}.team_students ts ON a.team_id = ts.team_id
      JOIN ${process.env.DB_SCHEMA || 'sakec'}.students s ON ts.microsoft_id = s.microsoft_id
      WHERE a.assignment_id = $1;
    `;

    const result = await pool.query(query, [assignmentId]);
    res.json(result.rows[0] || { linked: 0, total: 0 });
  } catch (err) {
    console.error("? ALERT READINESS SQL ERROR:", err.message); 
    res.status(500).json({ error: 'Failed to fetch alert readiness data' });
  }
});

module.exports = router;
