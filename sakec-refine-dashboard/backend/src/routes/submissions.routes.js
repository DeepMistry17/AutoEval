const schema = process.env.DB_SCHEMA || 'sakec';
const { Router } = require('express');
const pool = require('../config/db');
const { SYNC_FINAL_MARKS } = require('../utils/queries');

const router = Router();

/**
 * PATCH /api/submissions/:id/sync
 * Body: { finalMarks }
 * Updates final_marks and sets status='Synced' for the given submission
 */
router.patch('/:id/sync', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { finalMarks } = req.body;

    if (finalMarks === undefined || finalMarks === null) {
      return res.status(400).json({ error: 'finalMarks is required' });
    }

    await pool.query(SYNC_FINAL_MARKS, [finalMarks, id]);
    res.json({ message: 'Marks synced successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/submissions/webhook/system-sync-all
 * SECURE N8N ENDPOINT: 
 * Phase 1: Sweeps all DB teams, syncs student rosters, and auto-discovers assignments.
 * Phase 2: Sweeps every active assignment and syncs all submissions globally.
 */
router.post('/webhook/system-sync-all', async (req, res, next) => {
  try {
    // 1. Verify n8n Secret (Bypass standard Auth)
    const n8nSecret = req.headers['x-n8n-secret'];
    if (n8nSecret !== 'sakec_n8n_secret_2026') {
      console.warn('[SECURITY WARNING] Unauthorized attempt to trigger system-sync-all');
      return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }

    console.log('\n--- STARTING GLOBAL SYSTEM SYNC (Triggered by n8n) ---');

    // 2. Generate Master Application Token
    console.log('[SYNC] Requesting MS Graph Application Token...');
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
    if (!tokenData.access_token) {
      throw new Error('Failed to get Global MS Graph token. Check App Registration permissions.');
    }

    // =========================================================================
    // PHASE 1: AUTO-DISCOVER ROSTERS & ASSIGNMENTS IN DB TEAMS
    // =========================================================================
    console.log('[SYNC] Phase 1: Scanning active teams for rosters and new assignments...');
    
    const teamsWithTeachers = await pool.query(`
      SELECT 
        t.team_id, 
        ARRAY_AGG(th.ms_id) AS teacher_ms_ids
      FROM ${schema}.teams t
      JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
      JOIN ${schema}.teachers th ON tt.teacher_id = th.teacher_id
      WHERE t.status = 'active' AND th.ms_id IS NOT NULL
      GROUP BY t.team_id
    `);

    let newOrUpdatedAssignments = 0;
    let studentsSynced = 0;

    for (const teamRow of teamsWithTeachers.rows) {
      const { team_id, teacher_ms_ids } = teamRow;
      const teacherSet = new Set(teacher_ms_ids);

      try {
        // --- STEP 1A: SYNC STUDENTS (THE SHIELD) ---
        // Fetch owners to shield them from the database
        const ownersRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/teachers`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const ownersData = await ownersRes.json();
        
        const ownerIds = new Set();
        if (ownersData.value) {
          ownersData.value.forEach(owner => ownerIds.add(owner.id));
        }

        // Fetch full roster
        const membersRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/members`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const membersData = await membersRes.json();

        if (membersData.value && membersData.value.length > 0) {
          for (const student of membersData.value) {
            // Block if they are an Owner or a registered teacher
            if (ownerIds.has(student.id) || teacherSet.has(student.id)) {
              continue;
            }
            
            const tempPrn = `MS_${student.id.substring(0,8)}`; 
            const msEmail = (student.userPrincipalName || student.mail || '').toLowerCase();
            
            // Upsert Student Profile
            await pool.query(`
              INSERT INTO ${schema}.students (prn, microsoft_id, full_name, ms_email)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (microsoft_id) DO UPDATE SET 
                full_name = EXCLUDED.full_name,
                ms_email = EXCLUDED.ms_email;
            `, [tempPrn, student.id, student.displayName, msEmail]);

            // Map Student to Team
            await pool.query(`
              INSERT INTO ${schema}.team_students (team_id, microsoft_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING;
            `, [team_id, student.id]);
            
            studentsSynced++;
          }
        }

        // --- STEP 1B: SYNC ASSIGNMENTS ---
        const assignRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments?$expand=rubric`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const assignData = await assignRes.json();

        if (assignData.value && assignData.value.length > 0) {
          const validAssignments = assignData.value.filter(msAssignment => 
            teacherSet.has(msAssignment.createdBy?.user?.id)
          );

          for (const msAssignment of validAssignments) {
            const rubricData = msAssignment.rubric ? JSON.stringify(msAssignment.rubric) : null;
            const totalMarks = msAssignment.grading?.maxPoints || 10;

            await pool.query(`
              INSERT INTO ${schema}.assignments (assignment_id, team_id, ms_assignment_id, title, description, due_date, is_archived, rubric_context, total_marks)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (assignment_id) DO UPDATE SET 
                title = EXCLUDED.title, 
                due_date = EXCLUDED.due_date,
                rubric_context = EXCLUDED.rubric_context,
                total_marks = EXCLUDED.total_marks;
            `, [
              msAssignment.id, 
              team_id, 
              msAssignment.id, 
              msAssignment.displayName || 'Untitled', 
              msAssignment.instructions?.content || '', 
              msAssignment.dueDateTime || null, 
              false,
              rubricData,
              totalMarks 
            ]);
            newOrUpdatedAssignments++;
          }
        }
      } catch (teamErr) {
        console.error(`[WARN] Failed to auto-discover for team ${team_id}:`, teamErr.message);
      }
    }
    console.log(`[SYNC] Phase 1 Complete: Synced ${studentsSynced} students & ${newOrUpdatedAssignments} valid assignments.`);

    // =========================================================================
    // PHASE 2: FETCH SUBMISSIONS FOR ALL ASSIGNMENTS
    // =========================================================================
    console.log('[SYNC] Phase 2: Fetching active assignments from database...');
    const assignmentsQuery = await pool.query(`
      SELECT assignment_id, team_id, ms_assignment_id, due_date 
      FROM ${schema}.assignments 
      WHERE is_archived = false
    `);
    
    const activeAssignments = assignmentsQuery.rows;
    console.log(`[SYNC] Found ${activeAssignments.length} active assignments to scan for submissions.`);

    let totalSyncedSubmissions = 0;

    for (const assignment of activeAssignments) {
      const { assignment_id, team_id, ms_assignment_id, due_date } = assignment;
      const dueDateObj = due_date ? new Date(due_date) : null;

      try {
        const subRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${ms_assignment_id}/submissions`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const subData = await subRes.json();

        if (subData.error || !subData.value) {
          console.warn(`[WARN] Failed to fetch submissions for Assignment ${assignment_id}:`, subData.error?.message);
          continue;
        }

        for (const submission of subData.value) {
          if (submission.status === 'submitted' || submission.status === 'returned') {
            const studentMsId = submission.recipient?.userId; 
            
            if (!studentMsId) continue;

            // Failsafe: Ensure student exists in DB (Should rarely be hit now due to Phase 1)
            const tempPrn = `MS_${studentMsId.substring(0,8)}`;
            const uniqueDummyEmail = `pending_${studentMsId.substring(0,8)}@${schema}.edu`;
            
            await pool.query(`
              INSERT INTO ${schema}.students (prn, microsoft_id, full_name, ms_email)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (microsoft_id) DO NOTHING;
            `, [tempPrn, studentMsId, 'Student (Pending Roster)', uniqueDummyEmail]);

            // Fetch Real PRN
            const studentLookup = await pool.query(
              `SELECT prn FROM ${schema}.students WHERE microsoft_id = $1`, 
              [studentMsId]
            );
            
            if (studentLookup.rows.length === 0) continue; 
            const actualPrn = studentLookup.rows[0].prn;

            // Extract File URL
            let fileUrl = null;
            const resourcesRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${ms_assignment_id}/submissions/${submission.id}/submittedResources`, {
              headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const resourcesData = await resourcesRes.json();

            if (resourcesData.value && resourcesData.value.length > 0) {
              for (const item of resourcesData.value) {
                if (item.resource && item.resource.fileUrl) {
                  fileUrl = item.resource.fileUrl;
                  break; 
                }
              }
            }

            // Calculate Lateness
            const submissionTimeStr = submission.submittedDateTime || new Date().toISOString();
            const submissionTime = new Date(submissionTimeStr);
            let isLate = dueDateObj ? (submissionTime > dueDateObj) : false;

            // Safe Upsert (Overrides AI grades if student resubmits)
            await pool.query(`
              INSERT INTO ${schema}.submissions (submission_id, assignment_id, prn, submission_time, status, file_path, is_late)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (submission_id) 
              DO UPDATE SET 
                status = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN 'Pending' 
                  ELSE ${schema}.submissions.status 
                END,
                file_path = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN EXCLUDED.file_path 
                  ELSE ${schema}.submissions.file_path 
                END,
                ai_suggested_marks = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN NULL 
                  ELSE ${schema}.submissions.ai_suggested_marks 
                END,
                final_marks = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN NULL 
                  ELSE ${schema}.submissions.final_marks 
                END,
                ai_feedback = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN NULL 
                  ELSE ${schema}.submissions.ai_feedback 
                END,
                local_converted_path = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN NULL 
                  ELSE ${schema}.submissions.local_converted_path 
                END,
                is_late = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN EXCLUDED.is_late 
                  ELSE ${schema}.submissions.is_late 
                END,
                submission_time = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN EXCLUDED.submission_time 
                  ELSE ${schema}.submissions.submission_time 
                END;
            `, [
              submission.id,
              assignment_id,
              actualPrn, 
              submissionTime,
              'Pending', 
              fileUrl,
              isLate 
            ]);
            
            totalSyncedSubmissions++;
          }
        }
      } catch (innerErr) {
        console.error(`[ERROR] Failed processing assignment ${assignment_id}:`, innerErr.message);
      }
    }

    console.log(`\n--- GLOBAL SYNC COMPLETE: Processed ${totalSyncedSubmissions} total submissions ---\n`);
    
    // Respond back to n8n so it can continue to the CTE node and start grading
    res.status(200).json({ 
      success: true, 
      message: 'Global sync complete', 
      synced_count: totalSyncedSubmissions 
    });

  } catch (err) {
    console.error('[FATAL ERROR] Global System Sync crashed:', err);
    res.status(500).json({ error: 'Internal server error during global sync' });
  }
});

module.exports = router;
