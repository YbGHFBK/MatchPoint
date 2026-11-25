const express = require("express");
const db = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function getAuthUserId(req) {
  return req.user.id ?? req.user.userId;
}

router.post(
  "/",
  requireAuth,
  requireRole("captain"),
  async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const { name, discipline_id } = req.body;

      if (
        typeof name !== "string" ||
        name.trim().length < 3 ||
        name.trim().length > 50
      ) {
        return res
          .status(400)
          .json({ error: "Укажите корректное название команды" });
      }
      if (!Number.isInteger(discipline_id) || discipline_id <= 0) {
        return res.status(400).json({ error: "Некорректный discipline_id" });
      }

      const client = await db.pool.connect();

      try {
        await client.query("BEGIN");
        const teamRes = await client.query(
          `INSERT INTO teams (captain_id, discipline_id, name)
        VALUES ($1, $2, $3)
        RETURNING *`,
          [userId, discipline_id, name.trim()],
        );

        const team = teamRes.rows[0];

        await client.query(
          `INSERT INTO team_members (team_id, user_id, status)
        VALUES ($1, $2, 'accepted')`,
          [team.id, userId],
        );

        await client.query("COMMIT");

        return res.status(201).json({ team });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
          return res.status(409).json({ error: "Название команды уже занято" });
        }
        next(err);
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/members",
  requireAuth,
  requireRole("captain"),
  async (req, res, next) => {
    try {
      const teamId = Number(req.params.id);
      const userId = req.body.user_id;
      const { action = "accept" } = req.body;

      if (!["accept", "kick"].includes(action)) {
        return res.status(400).json({ error: "Неизвестный тип действия" });
      }

      if (!Number.isInteger(teamId) || teamId <= 0) {
        return res.status(400).json({ error: "Некорректный ID команды" });
      }

      const { rows } = await db.query(
        "SELECT captain_id FROM teams WHERE id = $1",
        [teamId],
      );

      const team = rows[0];
      if (!team) {
        return res.status(404).json({ error: "Команда не найдена" });
      }

      if (team.captain_id !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Только капитан этой команды может менять состав" });
      }

      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "Некорректный id пользователя" });
      }

      if (action === "accept") {
        const result = await db.query(
          `UPDATE team_members
        SET status = 'accepted'
        WHERE team_id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING team_id, user_id, status`,
          [teamId, userId],
        );

        if (result.rowCount === 0) {
          return res
            .status(404)
            .json({ error: "У игрока нет заявки для этой команды" });
        }

        return res.status(200).json({ member: result.rows[0] });
      } else if (action === "kick") {
        if (userId === team.captain_id) {
          return res
            .status(404)
            .json({ error: "Капитан не может исключить себя" });
        }

        const result = await db.query(
          `UPDATE team_members
          SET status = 'kicked'
          WHERE team_id = $1 AND user_id = $2 AND status = 'accepted'
          RETURNING team_id, user_id`,
          [teamId, userId],
        );

        if (result.rowCount === 0) {
          return res.status(400).json({ error: "Такого игрока нет в команде" });
        }

        return res.status(200).json({ member: result.rows[0] });
      }
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
