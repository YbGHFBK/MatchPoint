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
      const {
        name,
        discipline_id,
        description = null,
        looking_for_role_id = null,
      } = req.body;

      if (
        typeof name !== "string" ||
        name.trim().length < 3 ||
        name.trim().length > 50
      ) {
        return res
          .status(400)
          .json({ error: "Укажите корректное название команды" });
      }
      if (
        !Number.isInteger(discipline_id) ||
        discipline_id <= 0 ||
        discipline_id > 2147483647
      ) {
        return res.status(400).json({ error: "Некорректный discipline_id" });
      }
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({ error: "Описание должно быть строкой" });
      }
      if (
        looking_for_role_id !== null &&
        (!Number.isInteger(looking_for_role_id) ||
          looking_for_role_id <= 0 ||
          looking_for_role_id > 2147483647)
      ) {
        return res.status(400).json({ error: "Некорректный ID роли" });
      }

      const client = await db.pool.connect();

      try {
        await client.query("BEGIN");
        const teamRes = await client.query(
          `INSERT INTO teams (captain_id, discipline_id, name, description, looking_for_role_id)
           SELECT $1, $2, $3, $4, $5::integer
           WHERE $5::integer IS NULL OR EXISTS (
             SELECT 1 FROM discipline_roles WHERE id = $5 AND discipline_id = $2
           )
           RETURNING *`,
          [
            userId,
            discipline_id,
            name.trim(),
            description?.trim() || null,
            looking_for_role_id,
          ],
        );

        const team = teamRes.rows[0];
        if (!team) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Роль не найдена в дисциплине команды" });
        }

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
        if (
          err.code === "23503" &&
          err.constraint === "teams_discipline_id_fkey"
        ) {
          return res.status(400).json({ error: "Дисциплина не найдена" });
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
            .status(400)
            .json({ error: "Капитан не может исключить себя" });
        }

        const result = await db.query(
          `UPDATE team_members
          SET status = 'kicked'
          WHERE team_id = $1 AND user_id = $2 AND status = 'accepted'
          RETURNING team_id, user_id, status`,
          [teamId, userId],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Такого игрока нет в команде" });
        }

        return res.status(200).json({ member: result.rows[0] });
      }
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/vacancy",
  requireAuth,
  requireRole("captain"),
  async (req, res, next) => {
    const teamId = Number(req.params.id);
    const roleId = req.body?.looking_for_role_id;
    const captainId = getAuthUserId(req);

    if (!Number.isInteger(teamId) || teamId <= 0 || teamId > 2147483647) {
      return res.status(400).json({ error: "Некорректный ID команды" });
    }
    if (
      roleId !== null &&
      (!Number.isInteger(roleId) || roleId <= 0 || roleId > 2147483647)
    ) {
      return res
        .status(400)
        .json({ error: "Укажите ID роли или null для закрытия вакансии" });
    }

    try {
      const { rows } = await db.query(
        `UPDATE teams AS t
         SET looking_for_role_id = $3
         WHERE t.id = $1 AND t.captain_id = $2
           AND ($3::integer IS NULL OR EXISTS (
             SELECT 1 FROM discipline_roles AS r
             WHERE r.id = $3 AND r.discipline_id = t.discipline_id
           ))
         RETURNING t.*`,
        [teamId, captainId, roleId],
      );
      if (rows.length) {
        return res.json({ team: rows[0] });
      }

      const { rows: teams } = await db.query(
        "SELECT captain_id FROM teams WHERE id = $1",
        [teamId],
      );
      if (!teams.length) {
        return res.status(404).json({ error: "Команда не найдена" });
      }
      if (teams[0].captain_id !== captainId) {
        return res
          .status(403)
          .json({ error: "Только капитан этой команды может менять вакансию" });
      }
      return res
        .status(400)
        .json({ error: "Роль не найдена в дисциплине команды" });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/:id/applications", requireAuth, async (req, res, next) => {
  const teamId = Number(req.params.id);
  if (!Number.isInteger(teamId) || teamId <= 0 || teamId > 2147483647) {
    return res.status(400).json({ error: "Некорректный ID команды" });
  }

  try {
    const { rows } = await db.query(
      `WITH team AS (
         SELECT id, looking_for_role_id FROM teams WHERE id = $1 FOR SHARE
       ), application AS (
         INSERT INTO team_members (team_id, user_id, role_id, status)
         SELECT id, $2, looking_for_role_id, 'pending'
         FROM team WHERE looking_for_role_id IS NOT NULL
         ON CONFLICT (team_id, user_id) DO UPDATE
           SET status = 'pending', role_id = EXCLUDED.role_id, joined_at = NOW()
           WHERE team_members.status = 'kicked'
         RETURNING team_id, user_id, role_id, status
       )
       SELECT team.looking_for_role_id, to_json(application) AS application
       FROM team LEFT JOIN application ON application.team_id = team.id`,
      [teamId, getAuthUserId(req)],
    );

    const team = rows[0];
    if (!team) {
      return res.status(404).json({ error: "Команда не найдена" });
    }
    if (team.looking_for_role_id === null) {
      return res.status(409).json({ error: "Набор в команду закрыт" });
    }
    if (!team.application) {
      return res
        .status(409)
        .json({ error: "Вы уже подали заявку или состоите в команде" });
    }
    return res.status(201).json({ application: team.application });
  } catch (err) {
    next(err);
  }
});

async function getTeamMembers(teamId, status) {
  const { rows } = await db.query(
    `SELECT m.user_id, p.nickname, m.role_id, r.name AS role_name
     FROM team_members m
     LEFT JOIN profiles p ON p.user_id = m.user_id
     LEFT JOIN discipline_roles r ON r.id = m.role_id
     WHERE m.team_id = $1 AND m.status = $2
     ORDER BY m.joined_at, m.user_id`,
    [teamId, status],
  );
  return rows;
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.name, t.captain_id, t.discipline_id, d.name AS discipline_name,
              t.looking_for_role_id, r.name AS looking_for_role_name,
              (SELECT COUNT(*)::int FROM team_members m
               WHERE m.team_id = t.id AND m.status = 'accepted') AS members_count
       FROM teams t
       JOIN disciplines d ON d.id = t.discipline_id
       LEFT JOIN discipline_roles r ON r.id = t.looking_for_role_id
       ORDER BY t.name, t.id`,
    );
    return res.json({ teams: rows });
  } catch (err) {
    next(err);
  }
});

function validateTeamId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return res.status(400).json({ error: "Некорректный ID команды" });
  }
  res.locals.teamId = id;
  next();
}

router.get("/:id", validateTeamId, async (req, res, next) => {
  const { teamId } = res.locals;
  try {
    const { rows } = await db.query(
      `SELECT t.*, d.name AS discipline_name, r.name AS looking_for_role_name,
              p.nickname AS captain_nickname,
              ARRAY(SELECT er.event_id FROM event_registrations er WHERE er.team_id = t.id) AS registered_event_ids
       FROM teams t
       JOIN disciplines d ON d.id = t.discipline_id
       LEFT JOIN discipline_roles r ON r.id = t.looking_for_role_id
       LEFT JOIN profiles p ON p.user_id = t.captain_id
       WHERE t.id = $1`,
      [teamId],
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Команда не найдена" });
    }
    const members = await getTeamMembers(teamId, "accepted");
    return res.json({ team: { ...rows[0], members } });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id/applications",
  requireAuth,
  requireRole("captain"),
  validateTeamId,
  async (req, res, next) => {
    const { teamId } = res.locals;
    try {
      const { rows } = await db.query(
        "SELECT captain_id FROM teams WHERE id = $1",
        [teamId],
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Команда не найдена" });
      }
      if (rows[0].captain_id !== getAuthUserId(req)) {
        return res
          .status(403)
          .json({ error: "Только капитан этой команды может смотреть заявки" });
      }
      const applications = await getTeamMembers(teamId, "pending");
      return res.json({ applications });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
