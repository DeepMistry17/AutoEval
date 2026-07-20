const schema = process.env.DB_SCHEMA || 'sakec';
const { Router } = require('express');
const pool = require('../config/db');
const {
  GET_TEACHER_TEAMS,
  GET_DROPDOWN_TEAMS,
  ARCHIVE_TEAM,
} = require('../utils/queries');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(GET_TEACHER_TEAMS, [req.user.email]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/dropdown', async (req, res, next) => {
  try {
    const result = await pool.query(GET_DROPDOWN_TEAMS, [req.user.email]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * NEW: GET /api/teams/preview-sync
 * Fetches MS Teams so the frontend can display them in a checklist BEFORE saving.
 */
router.get('/preview-sync', async (req, res, next) => {
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
    if (!tokenData.access_token) throw new Error('Failed to get MS Graph token');

    const graphRes = await fetch(`https://graph.microsoft.com/v1.0/education/users/${req.user.email}/classes`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const graphData = await graphRes.json();
    
    // Graceful Fail
    if (graphData.error) {
      console.warn(`[MS Graph Warning for ${req.user.email}]:`, graphData.error.message);
      return res.status(200).json([]); // Send empty array back
    }

    res.status(200).json(graphData.value || []);
  } catch (err) {
    console.error('MS Graph Preview Error:', err);
    next(err);
  }
});

/**
 * UPDATED: POST /api/teams/sync
 * Now accepts a 'selectedTeamIds' array in the body to only save checked items!
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { selectedTeamIds } = req.body; // Array of IDs the teacher checked

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
    const graphRes = await fetch(`https://graph.microsoft.com/v1.0/education/users/${req.user.email}/classes`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const graphData = await graphRes.json();
    
    if (graphData.error) {
      return res.status(200).json({ message: 'No active teacher classes found.', count: 0 });
    }

    const msTeams = graphData.value || [];
    
    // THE FILTER: Only keep the teams that the user checked in the UI
    const teamsToSave = selectedTeamIds && selectedTeamIds.length > 0
      ? msTeams.filter(cls => selectedTeamIds.includes(cls.id))
      : msTeams;

    if (teamsToSave.length === 0) {
      return res.status(200).json({ message: 'No teams selected for sync.', count: 0 });
    }

    const teacherRecord = await pool.query(`SELECT teacher_id FROM ${schema}.teachers WHERE ms_email = $1`, [req.user.email]);
    if (teacherRecord.rowCount === 0) {
      return res.status(404).json({ error: 'Your account is not properly registered.' });
    }
    const trueTeacherId = teacherRecord.rows[0].teacher_id;

    let syncedCount = 0;
    for (const cls of teamsToSave) {
      // 1. Insert or Update the Team itself (Removed teacher_id)
      await pool.query(`
        INSERT INTO ${schema}.teams (team_id, subject_name, semester, academic_year, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (team_id) 
        DO UPDATE SET 
          subject_name = EXCLUDED.subject_name,
          status = 'active';
      `, [
        cls.id, cls.displayName, 'Auto-detected', '2025-2026', 'active'
      ]);

      // 2. Link the Teacher to the Team in the junction table
      await pool.query(`
        INSERT INTO ${schema}.teacher_teams (teacher_id, team_id)
        VALUES ($1, $2)
        ON CONFLICT (teacher_id, team_id) DO NOTHING;
      `, [trueTeacherId, cls.id]);

      syncedCount++;
    }

    res.status(200).json({ message: 'Teams synced successfully', count: syncedCount });
  } catch (err) {
    console.error('MS Graph Sync Error:', err);
    next(err);
  }
});

router.patch('/:teamId/archive', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    await pool.query(ARCHIVE_TEAM, [teamId]);
    res.json({ message: 'Team archived successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
