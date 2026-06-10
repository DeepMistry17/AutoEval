// ─── All SQL queries explicitly target the sakec schema ───────────────────────

module.exports = {
  // ─── Dashboard KPIs ──────────────────────────────────────────────────────────
  KPI_PENDING: `
    SELECT COUNT(*) AS total
    FROM sakec.submissions sub
    JOIN sakec.assignments a ON sub.assignment_id = a.assignment_id
    JOIN sakec.teams t ON a.team_id = t.team_id
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Graded'
      AND ($2::text IS NULL OR a.assignment_id = $2);
  `,

  KPI_SYNCED: `
    SELECT COUNT(*) AS total
    FROM sakec.submissions sub
    JOIN sakec.assignments a ON sub.assignment_id = a.assignment_id
    JOIN sakec.teams t ON a.team_id = t.team_id
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Synced'
      AND ($2::text IS NULL OR a.assignment_id = $2);
  `,

  KPI_AWAITING_EVAL: `
    SELECT COUNT(*) AS total
    FROM sakec.submissions sub
    JOIN sakec.assignments a ON sub.assignment_id = a.assignment_id
    JOIN sakec.teams t ON a.team_id = t.team_id
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1
      AND sub.status = 'Pending'
      AND ($2::text IS NULL OR a.assignment_id = $2);
  `,

  KPI_MISSING: `
    SELECT COALESCE(SUM(missing_per_assignment), 0) AS total
    FROM (
      SELECT
        (SELECT COUNT(*) FROM sakec.team_students ts WHERE ts.team_id = a.team_id) -
        (SELECT COUNT(*) FROM sakec.submissions sub WHERE sub.assignment_id = a.assignment_id) AS missing_per_assignment
      FROM sakec.assignments a
      JOIN sakec.teacher_teams tt ON a.team_id = tt.team_id
      JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
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
    FROM sakec.submissions sub
    JOIN sakec.students stu ON sub.prn = stu.prn
    JOIN sakec.assignments a ON sub.assignment_id = a.assignment_id
    JOIN sakec.teams t ON a.team_id = t.team_id
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
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
    FROM sakec.submissions sub
    JOIN sakec.assignments a ON sub.assignment_id = a.assignment_id
    JOIN sakec.teams t ON a.team_id = t.team_id
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
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
    FROM sakec.assignments a
    JOIN sakec.team_students ts ON a.team_id = ts.team_id
    JOIN sakec.students st ON ts.microsoft_id = st.microsoft_id
    LEFT JOIN sakec.submissions sub 
      ON st.prn = sub.prn 
      AND sub.assignment_id = a.assignment_id
    WHERE a.assignment_id = $1
    ORDER BY st.roll_no ASC NULLS LAST, st.full_name ASC;
  `,

  // ─── Assignments ─────────────────────────────────────────────────────────────
  GET_ASSIGNMENTS: `
    SELECT DISTINCT a.title, a.assignment_id
    FROM sakec.assignments a
    JOIN sakec.teams t ON a.team_id = t.team_id
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    JOIN sakec.teachers tr ON tt.teacher_id = tr.teacher_id
    WHERE tr.MS_email = $1;
  `,

  // ─── Submissions ─────────────────────────────────────────────────────────────
  SYNC_FINAL_MARKS: `
    UPDATE sakec.submissions
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
    FROM sakec.teams t
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    WHERE tt.teacher_id = (SELECT teacher_id FROM sakec.teachers WHERE MS_email = $1)
      AND t.status = 'active';
  `,

  GET_DROPDOWN_TEAMS: `
    SELECT
      t.subject_name AS label,
      t.team_id AS value
    FROM sakec.teams t
    JOIN sakec.teacher_teams tt ON t.team_id = tt.team_id
    WHERE tt.teacher_id = (SELECT teacher_id FROM sakec.teachers WHERE MS_email = $1)
      AND t.status = 'active';
  `,

  INSERT_TEAM: `
    INSERT INTO sakec.teams (team_id, subject_name, semester, academic_year, status)
    VALUES ($1, $2, $3, $4, 'active')
    ON CONFLICT (team_id) DO UPDATE SET 
      subject_name = EXCLUDED.subject_name,
      status = 'active';
  `,

  ARCHIVE_TEAM: `
    UPDATE sakec.teams
    SET status = 'archived'
    WHERE team_id = $1;
  `,

  // ─── Auth ────────────────────────────────────────────────────────────────────
  FIND_TEACHER_BY_EMAIL: `
    SELECT teacher_id, full_name, MS_email, ms_id
    FROM sakec.teachers
    WHERE MS_email = $1;
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
    FROM sakec.assignments a
    LEFT JOIN sakec.submissions sub 
      ON a.assignment_id = sub.assignment_id 
      AND sub.prn = $1
    WHERE a.team_id = $2
      AND a.is_archived = FALSE
    ORDER BY a.due_date ASC;
  `,
  
  GET_TEAM_ROSTER_CLEARANCE: `
    WITH AssignmentCount AS (
      SELECT COUNT(*) AS total_assignments 
      FROM sakec.assignments 
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
    FROM sakec.students s
    JOIN sakec.team_students ts ON s.microsoft_id = ts.microsoft_id
    CROSS JOIN AssignmentCount ac
    LEFT JOIN sakec.assignments a ON a.team_id = ts.team_id AND a.is_archived = FALSE
    LEFT JOIN sakec.submissions sub ON sub.prn = s.prn AND sub.assignment_id = a.assignment_id
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
    FROM sakec.students s
    JOIN sakec.team_students ts ON s.microsoft_id = ts.microsoft_id
    JOIN sakec.assignments a ON a.team_id = ts.team_id
    LEFT JOIN sakec.submissions sub 
      ON sub.prn = s.prn AND sub.assignment_id = a.assignment_id
    WHERE ts.team_id = $1
      AND a.assignment_id = ANY($2::text[])
    ORDER BY s.roll_no ASC, a.title ASC;
  `
};