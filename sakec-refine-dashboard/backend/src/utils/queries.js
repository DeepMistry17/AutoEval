// ─── All SQL queries explicitly target the sakec schema ───────────────────────

const schema = process.env.DB_SCHEMA || 'sakec';
module.exports = {
  // ─── Dashboard KPIs ──────────────────────────────────────────────────────────
  KPI_PENDING: `
    SELECT COUNT(*) AS total
    FROM ${schema}.submissions sub
    JOIN ${schema}.assignments a ON sub.assignment_id = a.assignment_id
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Graded'
      AND ($2::text IS NULL OR a.assignment_id = $2);
  `,

  KPI_SYNCED: `
    SELECT COUNT(*) AS total
    FROM ${schema}.submissions sub
    JOIN ${schema}.assignments a ON sub.assignment_id = a.assignment_id
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Synced'
      AND ($2::text IS NULL OR a.assignment_id = $2);
  `,

  KPI_AWAITING_EVAL: `
    SELECT COUNT(*) AS total
    FROM ${schema}.submissions sub
    JOIN ${schema}.assignments a ON sub.assignment_id = a.assignment_id
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Pending'
      AND ($2::text IS NULL OR a.assignment_id = $2);
  `,

  KPI_MISSING: `
    SELECT COALESCE(SUM(missing_per_assignment), 0) AS total
    FROM (
      SELECT
        (SELECT COUNT(*) FROM ${schema}.team_students ts WHERE ts.team_id = a.team_id) -
        (SELECT COUNT(*) FROM ${schema}.submissions sub WHERE sub.assignment_id = a.assignment_id) AS missing_per_assignment
      FROM ${schema}.assignments a
      JOIN ${schema}.teacher_teams tt ON a.team_id = tt.team_id
      JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
      WHERE tr.MS_email = $1
        AND ($2::text IS NULL OR a.assignment_id = $2)
    ) subquery;
  `,
  // ─── Dashboard Data ──────────────────────────────────────────────────────────
  GET_PENDING_GRADES: `
    SELECT
      sub.submission_id,
      stu.roll_no,
      stu.full_name,
      a.title AS assignment_title,
      sub.ai_suggested_marks,
      sub.ai_feedback,
      sub.final_marks,
      sub.status,
      sub.file_path,
      sub.local_converted_path
    FROM ${schema}.submissions sub
    JOIN ${schema}.students stu ON sub.prn = stu.prn
    JOIN ${schema}.assignments a ON sub.assignment_id = a.assignment_id
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Graded'
      AND ($2::text IS NULL OR a.assignment_id = $2)
      AND a.is_archived = FALSE;
  `,

  GET_ALIGNMENT_DATA: `
    SELECT
      a.title AS assignment,
      AVG(sub.ai_suggested_marks) AS avg_ai,
      AVG(sub.final_marks) AS avg_teacher
    FROM ${schema}.submissions sub
    JOIN ${schema}.assignments a ON sub.assignment_id = a.assignment_id
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND (sub.status = 'Synced' OR sub.status = 'Graded')
      AND ($2::text IS NULL OR a.assignment_id = $2)
    GROUP BY a.title;
  `,

  GET_STUDENT_SUMMARY: `
    SELECT
      st.telegram_id,
      st.roll_no,
      st.prn,
      st.full_name,
      sub.submission_time,
      COALESCE(sub.status, 'Not Submitted') AS status,
      sub.is_late,
      sub.ai_suggested_marks,
      sub.final_marks,
      sub.local_converted_path
    FROM ${schema}.assignments a
    JOIN ${schema}.team_students ts ON a.team_id = ts.team_id
    JOIN ${schema}.students st ON ts.microsoft_id = st.microsoft_id
    LEFT JOIN ${schema}.submissions sub 
      ON st.prn = sub.prn 
      AND sub.assignment_id = a.assignment_id
    WHERE a.assignment_id = $1
    ORDER BY st.roll_no ASC NULLS LAST, st.full_name ASC;
  `,

  // ─── Assignments ─────────────────────────────────────────────────────────────
  GET_ASSIGNMENTS: `
    SELECT DISTINCT a.title, a.assignment_id
    FROM ${schema}.assignments a
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    JOIN ${schema}.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1;
  `,

  // ─── Submissions ─────────────────────────────────────────────────────────────
  SYNC_FINAL_MARKS: `
    UPDATE ${schema}.submissions
    SET final_marks = $1,
        status = 'Synced'
    WHERE submission_id = $2;
  `,

  // ─── Teams ───────────────────────────────────────────────────────────────────
  GET_TEACHER_TEAMS: `
    SELECT
      t.subject_name AS "Subject",
      t.semester AS "Semester",
      t.academic_year AS "Academic Year",
      t.team_id AS "MS Team ID"
    FROM ${schema}.teams t
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    WHERE tt.teacher_id = (SELECT teacher_id FROM ${schema}.teachers WHERE MS_email = $1)
      AND t.status = 'active';
  `,

  GET_DROPDOWN_TEAMS: `
    SELECT
      t.subject_name AS label,
      t.team_id AS value
    FROM ${schema}.teams t
    JOIN ${schema}.teacher_teams tt ON t.team_id = tt.team_id
    WHERE tt.teacher_id = (SELECT teacher_id FROM ${schema}.teachers WHERE MS_email = $1)
      AND t.status = 'active';
  `,

  INSERT_TEAM: `
    INSERT INTO ${schema}.teams (team_id, subject_name, semester, academic_year, status)
    VALUES ($1, $2, $3, $4, 'active')
    ON CONFLICT (team_id) DO UPDATE SET 
      subject_name = EXCLUDED.subject_name,
      status = 'active';
  `,

  ARCHIVE_TEAM: `
    UPDATE ${schema}.teams
    SET status = 'archived'
    WHERE team_id = $1;
  `,

  // ─── Auth ────────────────────────────────────────────────────────────────────
  FIND_TEACHER_BY_EMAIL: `
    SELECT teacher_id, full_name, MS_email, google_email, ms_id
    FROM ${schema}.teachers
    WHERE LOWER(MS_email) = LOWER($1) OR LOWER(google_email) = LOWER($1);
  `,
  
  UPDATE_TEACHER_MS_ID: `
    UPDATE ${schema}.teachers
    SET ms_id = $1
    WHERE LOWER(MS_email) = LOWER($2);
  `,
  
  // ─── Clearance ───────────────────────────────────────────────────────────────
  
  GET_STUDENT_CLEARANCE: `
    SELECT 
      a.assignment_id,
      a.title AS assignment_title,
      a.due_date,
      sub.submission_id,
      COALESCE(sub.status, 'Missing') AS status,
      sub.final_marks,
      sub.ai_suggested_marks,
      sub.submission_time,
      sub.is_late
    FROM ${schema}.assignments a
    LEFT JOIN ${schema}.submissions sub 
      ON a.assignment_id = sub.assignment_id 
      AND sub.prn = $1
    WHERE a.team_id = $2
      AND a.is_archived = FALSE
    ORDER BY a.due_date ASC;
  `,
  
  GET_TEAM_ROSTER_CLEARANCE: `
    WITH AssignmentCount AS (
      SELECT COUNT(*) AS total_assignments 
      FROM ${schema}.assignments 
      WHERE team_id = $1 AND is_archived = FALSE
    )
    SELECT 
      s.roll_no,
      s.full_name AS name,
      s.prn,
      CONCAT(
        COUNT(sub.submission_id), 
        '/', 
        MAX(ac.total_assignments)
      ) AS completion
    FROM ${schema}.students s
    JOIN ${schema}.team_students ts ON s.microsoft_id = ts.microsoft_id
    CROSS JOIN AssignmentCount ac
    LEFT JOIN ${schema}.assignments a ON a.team_id = ts.team_id AND a.is_archived = FALSE
    LEFT JOIN ${schema}.submissions sub ON sub.prn = s.prn AND sub.assignment_id = a.assignment_id
    WHERE ts.team_id = $1
    GROUP BY s.roll_no, s.full_name, s.prn
    ORDER BY s.roll_no ASC;
  `,
  
  GET_EXPORT_DATA: `
    SELECT 
      s.roll_no,
      s.full_name AS name,
      a.title AS assignment_title,
      COALESCE(sub.final_marks::text, 'Missing') AS marks
    FROM ${schema}.students s
    JOIN ${schema}.team_students ts ON s.microsoft_id = ts.microsoft_id
    JOIN ${schema}.assignments a ON a.team_id = ts.team_id
    LEFT JOIN ${schema}.submissions sub 
      ON sub.prn = s.prn AND sub.assignment_id = a.assignment_id
    WHERE ts.team_id = $1
      AND a.assignment_id = ANY($2::text[])
    ORDER BY s.roll_no ASC, a.title ASC;
  `,
  // ─── Dynamic Assignment Export ────────────────────────────────────────────────
  EXPORT_ASSIGNMENT_DATA: `
    SELECT 
      st.full_name, 
      st.ms_email,
      st.roll_no,
      st.prn,
      s.status, 
      s.ai_suggested_marks, 
      s.final_marks, 
      s.ai_feedback,
      s.is_late,
      a.title as assignment_name, 
      a.total_marks, 
      a.due_date,
      t.subject_name as team_name
    FROM ${schema}.submissions s
    JOIN ${schema}.students st ON s.prn = st.prn
    JOIN ${schema}.assignments a ON s.assignment_id = a.assignment_id
    JOIN ${schema}.teams t ON a.team_id = t.team_id
    WHERE s.assignment_id = $1
    ORDER BY st.roll_no ASC NULLS LAST, st.full_name ASC;
  `
};
