const schema = process.env.DB_SCHEMA || 'sakec';
const { Router } = require('express');
const pool = require('../config/db');
const { SYNC_FINAL_MARKS } = require('../utils/queries');

const router = Router();

/**
 * PATCH /api/submissions/:id/sync
 * DEBUG MODE: Extracts hidden MS Graph properties and fuzzy maps them.
 */
router.patch('/:id/sync', async (req, res, next) => {
  try {
    const { id } = req.params; 
    const { finalMarks, overallFeedback, rubricBreakdown } = req.body;

    if (finalMarks === undefined || finalMarks === null) {
      return res.status(400).json({ error: 'finalMarks is required' });
    }

    await pool.query(SYNC_FINAL_MARKS, [finalMarks, id]);

    const metaQuery = await pool.query(`
      SELECT s.assignment_id, a.team_id 
      FROM ${schema}.submissions s
      JOIN ${schema}.assignments a ON s.assignment_id = a.assignment_id
      WHERE s.submission_id = $1
    `, [id]);

    if (metaQuery.rows.length === 0) throw new Error('Submission not found');
    const { assignment_id, team_id } = metaQuery.rows[0];

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
    if (!tokenData.access_token) return res.status(200).json({ message: 'Token Error' });

    const outcomesRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${assignment_id}/submissions/${id}/outcomes`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const outcomesData = await outcomesRes.json();

    let rubricOutcomeId = null;
    let feedbackOutcomeId = null;
    let pointsOutcomeId = null;

    if (outcomesData.value) {
      outcomesData.value.forEach(outcome => {
        if (outcome['@odata.type'] === '#microsoft.graph.educationRubricOutcome') rubricOutcomeId = outcome.id;
        if (outcome['@odata.type'] === '#microsoft.graph.educationFeedbackOutcome') feedbackOutcomeId = outcome.id;
        if (outcome['@odata.type'] === '#microsoft.graph.educationPointsOutcome') pointsOutcomeId = outcome.id;
      });
    }

    if (pointsOutcomeId) {
      await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${assignment_id}/submissions/${id}/outcomes/${pointsOutcomeId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.educationPointsOutcome",
          "points": { "@odata.type": "#microsoft.graph.educationAssignmentPointsGrade", "points": parseFloat(finalMarks) }
        })
      });
    }

    console.log('\n================ RUBRIC DIAGNOSTICS START ================');
    let msRubric = null;
    try {
      const rubricFetchUrl = `https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${assignment_id}/rubric`;
      const rubricFetch = await fetch(rubricFetchUrl, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      
      if (rubricFetch.ok) {
        msRubric = await rubricFetch.json();
      }
    } catch (e) {
      console.error('[DEBUG] Exception during rubric fetch:', e);
    }

    if (!msRubric || !msRubric.qualities) {
      console.log('[DEBUG] ERROR: msRubric or msRubric.qualities is UNDEFINED.');
    } else {
      console.log(`[DEBUG] RAW MS Quality [0] Schema:`, JSON.stringify(msRubric.qualities[0]));
      console.log(`[DEBUG] RAW MS Level [0] Schema:`, JSON.stringify(msRubric.levels[0]));
      
      let mappedSelectedLevels = [];
      let mappedQualityFeedback = [];
      
      // DEEP EXTRACTOR: Rips text out of nested Microsoft objects
      const fuzzyClean = (val) => {
        if (val === null || val === undefined) return '';
        let str = val;
        if (typeof val === 'object') {
          str = val.content || val.displayName || val.title || JSON.stringify(val);
        }
        return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
      };

      rubricBreakdown.forEach(rbItem => {
        const aiCatFuzzy = fuzzyClean(rbItem.category);
        
        const quality = msRubric.qualities.find(q => {
          // Check everywhere Microsoft might be hiding the category name
          const qText = q.displayName || q.description || q.title || '';
          const msCatFuzzy = fuzzyClean(qText);
          return msCatFuzzy && aiCatFuzzy && (msCatFuzzy.includes(aiCatFuzzy) || aiCatFuzzy.includes(msCatFuzzy));
        });

        if (quality) {
          const targetLevelFuzzy = `level${rbItem.level}`; 
          
          let matchedLevel = msRubric.levels.find(l => {
            const lText = l.displayName || l.description || l.title || '';
            return fuzzyClean(lText).includes(targetLevelFuzzy);
          });

          if (!matchedLevel) {
            let levelIndex = msRubric.levels.length - rbItem.level; 
            if (levelIndex < 0 || levelIndex >= msRubric.levels.length) levelIndex = 0;
            matchedLevel = msRubric.levels[levelIndex];
          }

          if (matchedLevel) {
            mappedSelectedLevels.push({ qualityId: quality.qualityId, columnId: matchedLevel.levelId });
          }

          if (rbItem.comment) {
            const cleanComment = rbItem.comment.replace(/\[Level \d+\]\s*/i, '').trim();
            mappedQualityFeedback.push({ qualityId: quality.qualityId, feedback: { content: cleanComment, contentType: "text" } });
          }
        } else {
          console.log(`[DEBUG] FAILED to match Quality for: ${rbItem.category}`);
        }
      });

      if (mappedSelectedLevels.length > 0) {
        const rubricPayload = {
          "@odata.type": "#microsoft.graph.educationRubricOutcome",
          "rubricQualitySelectedLevels": mappedSelectedLevels,
          "rubricQualityFeedback": mappedQualityFeedback
        };
        
        const rubricPatchRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${assignment_id}/submissions/${id}/outcomes/${rubricOutcomeId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(rubricPayload)
        });
        
        if (!rubricPatchRes.ok) {
          console.error('[DEBUG] Rubric PATCH Failed Response:', await rubricPatchRes.text());
        }
      }
    }
    console.log('================ RUBRIC DIAGNOSTICS END ================\n');

    if (feedbackOutcomeId && overallFeedback) {
      await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${assignment_id}/submissions/${id}/outcomes/${feedbackOutcomeId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "@odata.type": "#microsoft.graph.educationFeedbackOutcome",
          "feedback": { "text": { "content": overallFeedback, "contentType": "text" } }
        })
      });
    }

    await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team_id}/assignments/${assignment_id}/submissions/${id}/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    res.json({ message: 'Synced and Returned successfully' });
    
  } catch (err) {
    console.error('[SYNC ERROR]:', err);
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
              INSERT INTO ${schema}.assignments (assignment_id, team_id, ms_assignment_id, title, description, due_date, is_archived, rubric_context, total_marks, created_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (assignment_id) DO UPDATE SET 
                title = EXCLUDED.title, 
                due_date = EXCLUDED.due_date,
                rubric_context = EXCLUDED.rubric_context,
                total_marks = EXCLUDED.total_marks,
                created_by = EXCLUDED.created_by;
            `, [
              msAssignment.id, 
              team_id, 
              msAssignment.id, 
              msAssignment.displayName || 'Untitled', 
              msAssignment.instructions?.content || '', 
              msAssignment.dueDateTime || null, 
              false,
              rubricData,
              totalMarks,
              msAssignment.createdBy?.user?.id
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
          if (submission.status === 'returned') {
            continue; 
          }

          if (submission.status === 'submitted') {
            const studentMsId = submission.recipient?.userId; 
            
            if (!studentMsId) continue;

            // 1. Failsafe: Ensure student exists in DB
            const tempPrn = `MS_${studentMsId.substring(0,8)}`;
            const uniqueDummyEmail = `pending_${studentMsId.substring(0,8)}@${schema}.edu`;
            
            await pool.query(`
              INSERT INTO ${schema}.students (prn, microsoft_id, full_name, ms_email)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (microsoft_id) DO NOTHING;
            `, [tempPrn, studentMsId, 'Student (Pending Roster)', uniqueDummyEmail]);

            // 2. Fetch Real PRN
            const studentLookup = await pool.query(
              `SELECT prn FROM ${schema}.students WHERE microsoft_id = $1`, 
              [studentMsId]
            );
            
            if (studentLookup.rows.length === 0) continue; 
            const actualPrn = studentLookup.rows[0].prn;

            // --- ?? THE BULLETPROOF DB CHECK WITH HEAVY DIAGNOSTICS ?? ---
            console.log(`\n[DEBUG SYNC] --- Checking Lock for PRN: ${actualPrn} | Assignment: ${assignment_id} ---`);
            const gradeCheck = await pool.query(`
              SELECT submission_id, final_marks, status 
              FROM ${schema}.submissions 
              WHERE assignment_id = $1 AND prn = $2
            `, [assignment_id, actualPrn]);

            console.log(`[DEBUG SYNC] Rows found in DB: ${gradeCheck.rows.length}`);
            if (gradeCheck.rows.length > 0) {
              console.log(`[DEBUG SYNC] Row data:`, JSON.stringify(gradeCheck.rows));
            }

            const isAlreadyGraded = gradeCheck.rows.some(row => 
              row.final_marks !== null || 
              ['Synced', 'synced', 'Returned', 'returned'].includes(row.status)
            );

            console.log(`[DEBUG SYNC] isAlreadyGraded evaluated to: ${isAlreadyGraded}`);

            if (isAlreadyGraded) {
              console.log(`[SYNC] Skipped student ${actualPrn} - Assignment already graded locally.`);
              continue; // Drop it! Do not fetch files, do not update the database.
            }
            
            console.log(`[DEBUG SYNC] Lock passed. Fetching files and updating to Pending...`);
            // -------------------------------------------------------------

            // 3. Extract File URL
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

            // 4. Calculate Lateness
            const submissionTimeStr = submission.submittedDateTime || new Date().toISOString();
            const submissionTime = new Date(submissionTimeStr);
            let isLate = dueDateObj ? (submissionTime > dueDateObj) : false;

            // 5. Standard Upsert
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