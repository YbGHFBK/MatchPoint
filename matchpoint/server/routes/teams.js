const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function getAuthUserId(req) {
  return req.user.id ?? req.user.userId;
}

router.post('/', requireAuth, requireRole('captain'), async (req, res, next) => {
  try {

    const userId = getAuthUserId(req);
    const { name, discipline_id } = req.body;

    if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Укажите корректное название команды' });
    }
    if (!Number.isInteger(discipline_id) || discipline_id <= 0) {
      return res.status(400).json({error: 'Некорректный discipline_id'});
    }

    const client = await db.pool.connect();

    try {

      await client.query('BEGIN');
      const teamRes = await client.query(
        `INSERT INTO teams (captain_id, discipline_id, name)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [userId, discipline_id, name.trim()]
      );

      const team = teamRes.rows[0];

      await client.query(
        `INSERT INTO team_members (team_id, user_id, status)
        VALUES ($1, $2, 'accepted')`,
        [team.id, userId]
      );

      await client.query('COMMIT');

      return res.status(200).json({ team });

    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(201).json({team});
    } finally {
      client.release();
    }

  } catch (err) {
    next(err);
  } 
});

module.exports = router;