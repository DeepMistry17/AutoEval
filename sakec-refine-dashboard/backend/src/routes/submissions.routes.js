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

module.exports = router;
