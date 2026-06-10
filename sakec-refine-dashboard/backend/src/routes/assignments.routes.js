const { Router } = require('express');
const pool = require('../config/db');

const router = Router();

/**
 * GET /api/assignments
 */
router.get('/', async (req, res, next) => {
  try {
    const { teamId } = req.query;
    const email = req.user.email;

    let queryText = `
      SELECT DISTINCT a.assignment_id, a.title, a.team_id
      FROM sakec.assignments a
      JOIN sakec.teams t ON a.team_id = t.team_id
      JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
      JOIN sakec.teachers th ON tt.teacher_id = th.teacher_id
      WHERE th.ms_email = $1 AND a.is_archived = false
    `;
    let queryValues = [email];

    if (teamId) {
      queryText += ` AND a.team_id = $2`;
      queryValues.push(teamId);
    }

    const result = await pool.query(queryText, queryValues);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/assignments/sync
 * Master Engine: Auto-Heals ms_id, Syncs filtered Assignments, and Syncs Students.
 * UPGRADE: Now supports Targeted Sync via req.body.teamId AND filters Team Owners
 */
router.post('/sync', async (req, res, next) => {
  try {
    console.log(`\n--- STARTING MASTER SYNC FOR: ${req.user.email} ---`);
    const email = req.user.email;
    const targetTeamId = req.body.teamId || null;

    // 1. Fetch Active Teams
    const teamsRes = await pool.query(`
      SELECT t.team_id, t.subject_name FROM sakec.teams t
      JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
      JOIN sakec.teachers th ON tt.teacher_id = th.teacher_id
      WHERE th.MS_email = $1 
      AND t.status = 'active'
      AND ($2::text IS NULL OR t.team_id = $2)
    `, [email, targetTeamId]);

    const activeTeams = teamsRes.rows;
    console.log(`[SYNC] Found ${activeTeams.length} active teams in database matching criteria.`);
    
    if (activeTeams.length === 0) {
      return res.status(200).json({ message: 'No active teams found. Please import teams first.', count: 0 });
    }

    // 2. Get Master Token
    console.log(`[SYNC] Requesting MS Graph Master Token...`);
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
      throw new Error('Failed to get MS Graph token');
    }

    // 3. Retrieve True MS ID
    const teacherCheck = await pool.query(`SELECT ms_id FROM sakec.teachers WHERE ms_email = $1`, [email]);
    const trueMsId = teacherCheck.rows[0]?.ms_id;

    if (!trueMsId) {
      throw new Error('Missing Microsoft UUID. Please log out and log back in to refresh your identity profile.');
    }

    let assignmentsSynced = 0;
    let studentsSynced = 0;

    for (const team of activeTeams) {
      console.log(`\n---> Processing Team: ${team.subject_name} (${team.team_id})`);
      
      // PART A: SYNC ASSIGNMENTS
      console.log(`    Fetching Assignments...`);
      
      // FIX 1: Add ?$expand=rubric to force MS Graph to attach the rubric payload
      const assignRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team.team_id}/assignments?$expand=rubric`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const assignData = await assignRes.json();

      if (assignData.error) {
         console.warn(`    [WARNING] MS Graph rejected assignments request:`, assignData.error.message);
      } else if (assignData.value && assignData.value.length > 0) {
        const myAssignments = assignData.value.filter(msAssignment => 
            msAssignment.createdBy?.user?.id === trueMsId
        );

        if (myAssignments.length === 0) {
            console.log(`    [INFO] No assignments created by you in ${team.subject_name} - Skipping.`);
        } else {
            console.log(`    Found ${myAssignments.length} assignments belonging to you.`);
            for (const msAssignment of myAssignments) {
              
              // FIX 2: Extract the rubric. It's a complex JSON object, so we stringify it.
              // (Large Language Models are excellent at reading raw JSON strings!)
              const rubricData = msAssignment.rubric ? JSON.stringify(msAssignment.rubric) : null;

              // FIX 3: Add your rubric column to the INSERT query (Assuming your DB column is named `rubric` or `rubric_content`)
              await pool.query(`
                INSERT INTO sakec.assignments (assignment_id, team_id, ms_assignment_id, title, description, due_date, is_archived, rubric)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (assignment_id) DO UPDATE SET 
                  title = EXCLUDED.title, 
                  due_date = EXCLUDED.due_date,
                  rubric = EXCLUDED.rubric;
              `, [
                msAssignment.id, 
                team.team_id, 
                msAssignment.id, 
                msAssignment.displayName || 'Untitled', 
                msAssignment.instructions?.content || '', 
                msAssignment.dueDateTime || null, 
                false,
                rubricData // <-- Pushing the stringified rubric to the DB!
              ]);
              assignmentsSynced++;
            }
        }
      }

      // =========================================================
      // PART B: SYNC STUDENTS (THE ULTIMATE SHIELD)
      // =========================================================
      
      // STEP B1: Build the VIP Bouncer List (Fetch Team Owners)
      console.log(`    Fetching Team Owners (Shielding Teachers)...`);
      const ownersRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team.team_id}/teachers`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const ownersData = await ownersRes.json();
      
      const ownerIds = new Set();
      if (ownersData.value) {
        ownersData.value.forEach(owner => ownerIds.add(owner.id));
      } else if (ownersData.error) {
        console.warn(`    [WARNING] Could not fetch team owners. Failsafe active.`, ownersData.error.message);
      }
      console.log(`    Found ${ownerIds.size} owner(s) to shield from the database.`);

      // STEP B2: Fetch the full Roster
      console.log(`    Fetching Full Roster...`);
      const membersRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${team.team_id}/members`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const membersData = await membersRes.json();

      if (membersData.error) {
        console.error(`    [CRITICAL ERROR] MS Graph blocked Roster access:`, membersData.error);
      } else if (membersData.value && membersData.value.length > 0) {
        const students = membersData.value;
        console.log(`    Scanning ${students.length} people in this class.`);
        
        for (const student of students) {
          
          // ?? THE DOUBLE SHIELD: Block if they are an Owner OR if it's your own ID
          if (ownerIds.has(student.id) || student.id === trueMsId) {
            console.log(`    Skipping ${student.displayName} (Identified as Teacher/Owner)`);
            continue;
          }
          
          const tempPrn = `MS_${student.id.substring(0,8)}`; 
          
          await pool.query(`
            INSERT INTO sakec.students (prn, microsoft_id, full_name, ms_email)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (microsoft_id) DO UPDATE SET 
              full_name = EXCLUDED.full_name,
              ms_email = EXCLUDED.ms_email;
          `, [
            tempPrn, 
            student.id, 
            student.displayName, 
            (student.userPrincipalName || student.mail || '').toLowerCase()
          ]);

          await pool.query(`
            INSERT INTO sakec.team_students (team_id, microsoft_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING;
          `, [team.team_id, student.id]);
          
          studentsSynced++;
        }
      }
    }

    console.log(`\n--- SYNC COMPLETE: ${assignmentsSynced} Assignments | ${studentsSynced} Students ---\n`);
    res.status(200).json({ message: 'Sync complete!', count: assignmentsSynced, studentsCount: studentsSynced });

  } catch (err) {
    console.error('\n[FATAL ERROR] Master Sync crashed:', err);
    next(err);
  }
});

/**
 * POST /api/assignments/:assignmentId/sync-submissions
 */
router.post('/:assignmentId/sync-submissions', async (req, res, next) => {
  try {
    const { assignmentId } = req.params;

    // CHANGE 1: Fetch both team_id AND due_date from the assignments table
    const assignRes = await pool.query(
      `SELECT team_id, due_date FROM sakec.assignments WHERE assignment_id = $1`,
      [assignmentId]
    );

    if (assignRes.rowCount === 0) {
      return res.status(404).json({ error: 'Assignment not found in database.' });
    }
    
    const teamId = assignRes.rows[0].team_id;
    const dueDateStr = assignRes.rows[0].due_date;
    const dueDate = dueDateStr ? new Date(dueDateStr) : null; // Parse the due date

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

    console.log(`\n[SYNC] Fetching submissions for Assignment: ${assignmentId}`);
    const subRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${teamId}/assignments/${assignmentId}/submissions`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const subData = await subRes.json();

    if (subData.error) {
      console.error(`[ERROR] MS Graph rejected submissions request:`, subData.error);
      return res.status(500).json({ error: 'Failed to fetch submissions from MS Graph.' });
    }

    let syncedCount = 0;

    if (subData.value && subData.value.length > 0) {
      for (const submission of subData.value) {
        if (submission.status === 'submitted' || submission.status === 'returned') {
          const studentMsId = submission.recipient?.userId; 
          
          if (studentMsId) {
            const tempPrn = `MS_${studentMsId.substring(0,8)}`;
            const uniqueDummyEmail = `pending_${studentMsId.substring(0,8)}@sakec.edu`;
            
            await pool.query(`
              INSERT INTO sakec.students (prn, microsoft_id, full_name, ms_email)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (microsoft_id) DO NOTHING;
            `, [tempPrn, studentMsId, 'Student (Pending Roster)', uniqueDummyEmail]);

            // === THE FIX: Fetch the REAL PRN from the database ===
            const studentLookup = await pool.query(
              `SELECT prn FROM sakec.students WHERE microsoft_id = $1`, 
              [studentMsId]
            );
            
            if (studentLookup.rows.length === 0) {
              console.log(`[WARN] Skipping submission. Student with MS ID ${studentMsId} not found.`);
              continue; // Skip to the next student gracefully
            }
            
            const actualPrn = studentLookup.rows[0].prn;
            // =======================================================

            let fileUrl = null;
            
            const resourcesRes = await fetch(`https://graph.microsoft.com/v1.0/education/classes/${teamId}/assignments/${assignmentId}/submissions/${submission.id}/submittedResources`, {
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

            // CHANGE 2: Calculate if the submission is late
            const submissionTimeStr = submission.submittedDateTime || new Date().toISOString();
            const submissionTime = new Date(submissionTimeStr);
            
            let isLate = false;
            if (dueDate) {
              isLate = submissionTime > dueDate;
            }

            // CHANGE 3: Inject is_late and strictly protect the status column from overwrites
            await pool.query(`
              INSERT INTO sakec.submissions (submission_id, assignment_id, prn, submission_time, status, file_path, is_late)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (submission_id) 
              DO UPDATE SET 
                submission_time = EXCLUDED.submission_time,
                file_path = EXCLUDED.file_path,
                is_late = EXCLUDED.is_late,
                status = CASE 
                            WHEN sakec.submissions.status IN ('Graded', 'Synced') 
                            Then sakec.submissions.status 
                            ELSE EXCLUDED.status 
                         END;
            `, [
              submission.id,
              assignmentId,
              actualPrn, 
              submissionTime,
              'Pending', 
              fileUrl,
              isLate 
            ]);
            
            syncedCount++;
          }
        }
      }
    }

    // --- NEW: FIRE THE n8n STARTING GUN ---------------------------------------
    // We intentionally do not 'await' this fetch. We want n8n to start grading
    // in the background while the Node server instantly responds to the React UI.
    if (syncedCount > 0) {
      console.log('?? Firing n8n starting gun for grading queue...');
      // Using your local IP and n8n's default port 5678
      fetch('http://172.16.151.3:5678/webhook/trigger-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_queue' })
      }).catch(err => console.error('?? Failed to ping n8n webhook:', err.message));
    }
    // ----------------------------------------------------------------------------

    res.status(200).json({ message: `Synced ${syncedCount} submissions`, count: syncedCount });

  } catch (err) {
    console.error('Submission Sync Error:', err);
    next(err);
  }
});

/**
 * GET /api/assignments/view-file
 */
router.get('/view-file', async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('No file URL provided.');

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

    const targetUrl = url.endsWith('/content') ? url : `${url}/content`;

    const initialRes = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      redirect: 'manual' 
    });

    let finalResponse = initialRes;

    if (initialRes.status === 302 || initialRes.status === 301) {
      const sharePointUrl = initialRes.headers.get('location');
      finalResponse = await fetch(sharePointUrl); 
    }

    if (!finalResponse.ok) throw new Error('Microsoft rejected the file request.');

    const contentType = finalResponse.headers.get('content-type') || 'application/pdf';
    res.setHeader('Content-Type', contentType);
    
    const arrayBuffer = await finalResponse.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (err) {
    console.error('File Proxy Error:', err);
    res.status(500).send('Failed to load document preview.');
  }
});
// --- NEW: Local PDF Server Route ---
const path = require('path');
const fs = require('fs');

router.get('/local-pdf', (req, res) => {
  try {
    const { filePath } = req.query; 
    
    if (!filePath) {
      return res.status(400).send('No file path provided.');
    }

    // Step 1: Clean the path string that came from the database
    // n8n saves it as "/home/node/.n8n-files/temp_pdfs/filename.pdf"
    // We only want the filename: "filename.pdf"
    const fileName = filePath.split('/').pop();

    // Step 2: Build the path to the shared volume in the backend container
    const actualFilePath = path.join('/', 'shared_n8n_files', 'temp_pdfs', fileName);

    // Step 3: Check if it exists and send it
    if (!fs.existsSync(actualFilePath)) {
      return res.status(404).send('Local PDF not found.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(actualFilePath);
  } catch (error) {
    console.error('Error serving local PDF:', error);
    res.status(500).send('Failed to serve local PDF.');
  }
});

module.exports = router;