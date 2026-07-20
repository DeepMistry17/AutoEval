const schema = process.env.DB_SCHEMA || 'sakec';
const { Router } = require('express');
const pool = require('../config/db');
const ExcelJS = require('exceljs'); // <-- NEW
const path = require('path');       // <-- NEW
const { EXPORT_ASSIGNMENT_DATA } = require('../utils/queries'); // <-- NEW

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
      FROM ${schema}.assignments a
      JOIN ${schema}.teams t ON a.team_id = t.team_id
      JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
      JOIN ${schema}.teachers th ON tt.teacher_id = th.teacher_id
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
      SELECT t.team_id, t.subject_name FROM ${schema}.teams t
      JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
      JOIN ${schema}.teachers th ON tt.teacher_id = th.teacher_id
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
    const teacherCheck = await pool.query(`SELECT ms_id FROM ${schema}.teachers WHERE ms_email = $1`, [email]);
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

              // --- NEW: Extract the total maximum marks from the MS Assignment grading object ---
              const totalMarks = msAssignment.grading?.maxPoints || 10;

              // FIX 3: Add your rubric AND total_marks column to the INSERT query
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
                team.team_id, 
                msAssignment.id, 
                msAssignment.displayName || 'Untitled', 
                msAssignment.instructions?.content || '', 
                msAssignment.dueDateTime || null, 
                false,
                rubricData, // <-- Pushing the stringified rubric to the DB!
                totalMarks  // <-- Pushing the dynamic max marks to the DB!
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
            INSERT INTO ${schema}.students (prn, microsoft_id, full_name, ms_email)
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
            INSERT INTO ${schema}.team_students (team_id, microsoft_id)
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
      `SELECT team_id, due_date FROM ${schema}.assignments WHERE assignment_id = $1`,
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
            const uniqueDummyEmail = `pending_${studentMsId.substring(0,8)}@${schema}.edu`;
            
            await pool.query(`
              INSERT INTO ${schema}.students (prn, microsoft_id, full_name, ms_email)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (microsoft_id) DO NOTHING;
            `, [tempPrn, studentMsId, 'Student (Pending Roster)', uniqueDummyEmail]);

            // === THE FIX: Fetch the REAL PRN from the database ===
            const studentLookup = await pool.query(
              `SELECT prn FROM ${schema}.students WHERE microsoft_id = $1`, 
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

            // CHANGE 3: Upsert logic with Timestamp Comparison for Resubmissions
            await pool.query(`
              INSERT INTO ${schema}.submissions (submission_id, assignment_id, prn, submission_time, status, file_path, is_late)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (submission_id) 
              DO UPDATE SET 
                -- 1. Reset Status to Pending if a newer file is detected
                status = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN 'Pending' 
                  ELSE ${schema}.submissions.status 
                END,
                -- 2. Update File URLs
                file_path = CASE 
                  WHEN EXCLUDED.submission_time > ${schema}.submissions.submission_time THEN EXCLUDED.file_path 
                  ELSE ${schema}.submissions.file_path 
                END,
                -- 3. Nullify old AI data to ensure a clean slate for the new evaluation
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
                -- 4. Update the late flag and timestamp
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
    // --- GENERALIZED: FIRE THE n8n STARTING GUN ---------------------------------------
    if (syncedCount > 0) {
      console.log('?? Firing n8n starting gun for grading queue...');
      
      // Dynamically uses the N8N url from your .env file
      const n8nUrl = process.env.N8N_INTERNAL_URL || 'http://localhost:5678';
      
      fetch(`${n8nUrl}/webhook/trigger-evaluation`, {
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
/**
 * GET /api/assignments/:assignmentId/export
 * Dynamically generates a richly formatted Excel file with a logo header.
 */
router.get('/:assignmentId/export', async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const records = await pool.query(EXPORT_ASSIGNMENT_DATA, [assignmentId]);

    if (records.rowCount === 0) {
      return res.status(404).json({ error: 'No submissions found for this assignment.' });
    }

    // 1. Create a new Excel Workbook and Sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Grades');

    // 2. Parse the data and identify all dynamic parameters
    let processedRows = [];
    let dynamicColumnsSet = new Set();

    records.rows.forEach(row => {
      
      // Calculate Points and Percentage
      const points = row.final_marks !== null ? row.final_marks : row.ai_suggested_marks;
      const maxPoints = row.total_marks || 10;
      const percentage = points !== null ? Math.round((points / maxPoints) * 100) + '%' : '0%';

      // Base row data mapped to your requested columns
      let parsedRow = {
        rollNo: row.roll_no || '',
        fullName: row.full_name,
        prn: row.prn || '',
        email: row.ms_email,
        dueDate: row.due_date ? new Date(row.due_date).toLocaleDateString() : '',
        status: row.is_late ? "Late" : "On Time",
        points: points,
        maxPoints: maxPoints,
        percentage: percentage
      };

      // 3. Regex Magic: Unpack the dynamic AI parameters from the text block
      if (row.ai_feedback) {
        const paramRegex = /- (.*?) \((.*?)\/(.*?)\): \[(.*?)\] (.*)/g;
        let match;
        while ((match = paramRegex.exec(row.ai_feedback)) !== null) {
          const paramName = match[1].trim();
          const paramScore = parseFloat(match[2]);
          const paramFeedback = match[5].trim();

          dynamicColumnsSet.add(paramName); // Track this column globally
          
          parsedRow[paramName] = paramScore;
          parsedRow[`${paramName} Feedback`] = paramFeedback;
        }
      }
      processedRows.push(parsedRow);
    });

    // 4. Build the Excel Headers dynamically (New Layout & Order)
    const dynamicColumns = Array.from(dynamicColumnsSet);
    
    let excelColumns = [
      { header: 'Sr No.', key: 'rollNo', width: 10 },
      { header: 'Full Name', key: 'fullName', width: 25 },
      { header: 'PRN', key: 'prn', width: 20 },
      { header: 'Email Address', key: 'email', width: 30 },
      { header: 'Due Date', key: 'dueDate', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Points', key: 'points', width: 10 },
      { header: 'Max Points', key: 'maxPoints', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 12 },
    ];

    dynamicColumns.forEach(col => {
      excelColumns.push({ header: col, key: col, width: 15 });
      excelColumns.push({ header: `Feedback ${col}`, key: `${col} Feedback`, width: 40 });
    });

    // 5. Assign columns first 
    worksheet.columns = excelColumns; 

    // 6. Push the headers down and inject the Dynamic Title!
    const dynamicTitle = `${records.rows[0].assignment_name} - ${records.rows[0].team_name}`;
    worksheet.spliceRows(1, 0,
        [], 
        [], 
        [], 
        [dynamicTitle], // Places your dynamic title in Column A
        []
    );

    // 7. Center and Style the Title (Merge Columns A through I)
    worksheet.mergeCells('A4:I4'); // Increased to I to span the new columns nicely
    const titleCell = worksheet.getCell('A4');
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 8. Style the Header Row (now safely pushed to Row 6)
    const headerRow = worksheet.getRow(6);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Blue background

    // 9. Add the Logo (Shifted to the center)
    try {
      const logoId = workbook.addImage({
        filename: path.join(__dirname, '../assets/sakec_logo.png'), 
        extension: 'png',
      });
      
      worksheet.addImage(logoId, {
        // Change col: 0 to col: 2 or 3 to push it towards the center!
        // (col: 2 starts the image at Column C. col: 3 starts it at Column D)
        tl: { col: 2, row: 0 }, 
        ext: { width: 400, height: 80 }
      });
    } catch (imgErr) {
      console.warn("Logo not found or could not be loaded.", imgErr.message);
    }

    // 10. Add the Data Rows
    processedRows.forEach(data => {
      worksheet.addRow(data);
    });

    // 11. Send the file to the frontend
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${records.rows[0].assignment_name}_Grades.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Excel Export Error:', err);
    next(err);
  }
});

module.exports = router;
