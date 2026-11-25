const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getAuthUserId(req) {
  return req.user.id ?? req.user.userId;
}

function isCaptainOrAdmin(team, req) {
  return team.captain_id === getAuthUserId(req) || req.user.role === 'admin';
}

async function getTeamById(teamId) {
  const { rows } = await db.query(
    `SELECT
       t.id,
       t.name,
       t.description,
       t.created_at,
       t.captain_id,
       cp.nickname AS captain_nickname,
       cp.avatar_url AS captain_avatar_url,
       t.discipline_id,
       d.name AS discipline_name,
       d.category,
       t.looking_for_role_id,
       lfr.name AS looking_for_role_name
     FROM teams t
     JOIN profiles cp ON cp.user_id = t.captain_id
     JOIN disciplines d ON d.id = t.discipline_id
     LEFT JOIN discipline_roles lfr ON lfr.id = t.looking_for_role_id
     WHERE t.id = $1`,
    [teamId]
  );
  return rows[0] || null;
}

// 1. Список команд с фильтрами
router.get('/', async (req, res, next) => {
  try {
    const { discipline_id, looking_for_role_id, search } = req.query;
    const values = [];
    const conditions = [];

    if (discipline_id !== undefined && discipline_id !== '') {
      const id = Number(discipline_id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный discipline_id' });
      }
      values.push(id);
      conditions.push(`t.discipline_id = $${values.length}`);
    }

    if (looking_for_role_id !== undefined && looking_for_role_id !== '') {
      const id = Number(looking_for_role_id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный looking_for_role_id' });
      }
      values.push(id);
      conditions.push(`t.looking_for_role_id = $${values.length}`);
    }

    if (typeof search === 'string' && search.trim() !== '') {
      values.push(`%${search.trim()}%`);
      conditions.push(`(t.name ILIKE $${values.length} OR t.description ILIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: teams } = await db.query(
      `SELECT
         t.id,
         t.name,
         t.description,
         t.created_at,
         t.captain_id,
         cp.nickname AS captain_nickname,
         t.discipline_id,
         d.name AS discipline_name,
         d.category,
         t.looking_for_role_id,
         lfr.name AS looking_for_role_name,
         (
           SELECT COUNT(*)::int
           FROM team_members tm
           WHERE tm.team_id = t.id AND tm.status = 'accepted'
         ) AS members_count
       FROM teams t
       JOIN profiles cp ON cp.user_id = t.captain_id
       JOIN disciplines d ON d.id = t.discipline_id
       LEFT JOIN discipline_roles lfr ON lfr.id = t.looking_for_role_id
       ${whereClause}
       ORDER BY t.created_at DESC`,
      values
    );

    res.json({ teams });
  } catch (err) {
    next(err);
  }
});

// 2. Мои команды и активные заявки (строго ДО /:id)
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);

    const { rows: teams } = await db.query(
      `SELECT
         t.id,
         t.name,
         t.description,
         t.created_at,
         t.captain_id,
         (t.captain_id = $1) AS is_captain,
         tm.status AS membership_status,
         tm.role_id AS my_role_id,
         mr.name AS my_role_name,
         t.discipline_id,
         d.name AS discipline_name,
         t.looking_for_role_id,
         lfr.name AS looking_for_role_name,
         (
           SELECT COUNT(*)::int
           FROM team_members m
           WHERE m.team_id = t.id AND m.status = 'accepted'
         ) AS members_count
       FROM teams t
       JOIN disciplines d ON d.id = t.discipline_id
       LEFT JOIN discipline_roles lfr ON lfr.id = t.looking_for_role_id
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
       LEFT JOIN discipline_roles mr ON mr.id = tm.role_id
       WHERE t.captain_id = $1 OR (tm.user_id = $1 AND tm.status IN ('accepted', 'pending'))
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({ teams });
  } catch (err) {
    next(err);
  }
});

// 3. Детали команды и принятый состав
router.get('/:id', async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Некорректный id команды' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }

    const { rows: members } = await db.query(
      `SELECT
         tm.user_id,
         p.nickname,
         p.avatar_url,
         p.trust_score,
         tm.role_id,
         dr.name AS role_name,
         tm.status,
         tm.joined_at,
         (tm.user_id = $2) AS is_captain
       FROM team_members tm
       JOIN profiles p ON p.user_id = tm.user_id
       LEFT JOIN discipline_roles dr ON dr.id = tm.role_id
       WHERE tm.team_id = $1 AND tm.status = 'accepted'
       ORDER BY is_captain DESC, tm.joined_at ASC`,
      [teamId, team.captain_id]
    );

    res.json({ team: { ...team, members } });
  } catch (err) {
    next(err);
  }
});

// 4. Входящие заявки в команду (только капитан или админ)
router.get('/:id/requests', requireAuth, async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Некорректный id команды' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }
    if (!isCaptainOrAdmin(team, req)) {
      return res.status(403).json({ error: 'Просматривать заявки может только капитан команды' });
    }

    const { rows: requests } = await db.query(
      `SELECT
         tm.user_id,
         p.nickname,
         p.avatar_url,
         p.trust_score,
         p.prime_time,
         p.bio,
         tm.role_id,
         dr.name AS role_name,
         tm.joined_at AS applied_at
       FROM team_members tm
       JOIN profiles p ON p.user_id = tm.user_id
       LEFT JOIN discipline_roles dr ON dr.id = tm.role_id
       WHERE tm.team_id = $1 AND tm.status = 'pending'
       ORDER BY tm.joined_at ASC`,
      [teamId]
    );

    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// 5. Создать команду
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
    const disciplineId = Number(req.body.discipline_id);
    const lookingForRoleId =
      req.body.looking_for_role_id != null ? Number(req.body.looking_for_role_id) : null;
    const captainRoleId =
      req.body.captain_role_id != null ? Number(req.body.captain_role_id) : null;

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Название команды должно быть от 2 до 100 символов' });
    }
    if (!Number.isInteger(disciplineId) || disciplineId <= 0) {
      return res.status(400).json({ error: 'Укажите корректный discipline_id' });
    }

    const { rows: discCheck } = await db.query(
      'SELECT id FROM disciplines WHERE id = $1',
      [disciplineId]
    );
    if (discCheck.length === 0) {
      return res.status(404).json({ error: 'Дисциплина не найдена' });
    }

    if (lookingForRoleId !== null) {
      const { rows: roleCheck } = await db.query(
        'SELECT id FROM discipline_roles WHERE id = $1 AND discipline_id = $2',
        [lookingForRoleId, disciplineId]
      );
      if (roleCheck.length === 0) {
        return res.status(400).json({ error: 'looking_for_role_id не относится к этой дисциплине' });
      }
    }

    if (captainRoleId !== null) {
      const { rows: roleCheck } = await db.query(
        'SELECT id FROM discipline_roles WHERE id = $1 AND discipline_id = $2',
        [captainRoleId, disciplineId]
      );
      if (roleCheck.length === 0) {
        return res.status(400).json({ error: 'captain_role_id не относится к этой дисциплине' });
      }
    }

    const { rows: created } = await db.query(
      `INSERT INTO teams (captain_id, discipline_id, name, description, looking_for_role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, disciplineId, name, description, lookingForRoleId]
    );

    const teamId = created[0].id;

    // Добавляем капитана в состав как accepted
    await db.query(
      `INSERT INTO team_members (team_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'accepted')
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [teamId, userId, captainRoleId]
    );

    // Повышаем обычного игрока до капитана (админов/организаторов не трогаем)
    await db.query(
      `UPDATE users SET role = 'captain' WHERE id = $1 AND role = 'player'`,
      [userId]
    );

    const team = await getTeamById(teamId);
    res.status(201).json({ team });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Команда с таким названием уже существует' });
    }
    next(err);
  }
});

// 6. Обновить команду (только капитан или админ)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Некорректный id команды' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }
    if (!isCaptainOrAdmin(team, req)) {
      return res.status(403).json({ error: 'Редактировать команду может только капитан' });
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'Название команды должно быть от 2 до 100 символов' });
      }
      values.push(name);
      updates.push(`name = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      const desc = req.body.description === null ? null : String(req.body.description).trim();
      values.push(desc);
      updates.push(`description = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'looking_for_role_id')) {
      const roleId = req.body.looking_for_role_id != null ? Number(req.body.looking_for_role_id) : null;
      if (roleId !== null) {
        const { rows: roleCheck } = await db.query(
          'SELECT id FROM discipline_roles WHERE id = $1 AND discipline_id = $2',
          [roleId, team.discipline_id]
        );
        if (roleCheck.length === 0) {
          return res.status(400).json({ error: 'Указанная роль не относится к дисциплине команды' });
        }
      }
      values.push(roleId);
      updates.push(`looking_for_role_id = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    values.push(teamId);
    await db.query(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = $${values.length}`,
      values
    );

    const updated = await getTeamById(teamId);
    res.json({ team: updated });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Команда с таким названием уже существует' });
    }
    next(err);
  }
});

// 7. Удалить команду (только капитан или админ)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Некорректный id команды' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }
    if (!isCaptainOrAdmin(team, req)) {
      return res.status(403).json({ error: 'Удалить команду может только капитан' });
    }

    await db.query('DELETE FROM teams WHERE id = $1', [teamId]);
    res.json({ message: 'Команда удалена' });
  } catch (err) {
    next(err);
  }
});

// 8. Подать заявку на вступление в команду
router.post('/:id/apply', requireAuth, async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const userId = getAuthUserId(req);
    const roleId = req.body.role_id != null ? Number(req.body.role_id) : null;

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Некорректный id команды' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }
    if (team.captain_id === userId) {
      return res.status(400).json({ error: 'Вы капитан этой команды' });
    }

    if (roleId !== null) {
      const { rows: roleCheck } = await db.query(
        'SELECT id FROM discipline_roles WHERE id = $1 AND discipline_id = $2',
        [roleId, team.discipline_id]
      );
      if (roleCheck.length === 0) {
        return res.status(400).json({ error: 'Указанная роль не относится к дисциплине команды' });
      }
    }

    const { rows: existing } = await db.query(
      'SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (existing.length > 0) {
      const currentStatus = existing[0].status;
      if (currentStatus === 'accepted') {
        return res.status(409).json({ error: 'Вы уже состоите в этой команде' });
      }
      if (currentStatus === 'pending') {
        return res.status(409).json({ error: 'Заявка уже отправлена' });
      }
      if (currentStatus === 'kicked') {
        return res.status(403).json({ error: 'Вы были исключены из этой команды' });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO team_members (team_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING team_id, user_id, role_id, status, joined_at`,
      [teamId, userId, roleId]
    );

    res.status(201).json({ message: 'Заявка отправлена', application: rows[0] });
  } catch (err) {
    next(err);
  }
});

// 9. Принять / исключить участника или поменять его роль (капитан или админ)
router.patch('/:id/members/:userId', requireAuth, async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const { status } = req.body;
    const hasRole = Object.prototype.hasOwnProperty.call(req.body, 'role_id');
    const roleId = hasRole && req.body.role_id != null ? Number(req.body.role_id) : null;

    if (!Number.isInteger(teamId) || teamId <= 0 || !Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Некорректные id команды или пользователя' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }
    if (!isCaptainOrAdmin(team, req)) {
      return res.status(403).json({ error: 'Управлять составом может только капитан команды' });
    }

    const updates = [];
    const values = [];

    if (status !== undefined) {
      if (status !== 'accepted' && status !== 'kicked') {
        return res.status(400).json({ error: 'status должен быть accepted или kicked' });
      }
      if (targetUserId === team.captain_id && status === 'kicked') {
        return res.status(400).json({ error: 'Нельзя исключить капитана команды' });
      }
      values.push(status);
      updates.push(`status = $${values.length}`);
    }

    if (hasRole) {
      if (roleId !== null) {
        const { rows: roleCheck } = await db.query(
          'SELECT id FROM discipline_roles WHERE id = $1 AND discipline_id = $2',
          [roleId, team.discipline_id]
        );
        if (roleCheck.length === 0) {
          return res.status(400).json({ error: 'Указанная роль не относится к дисциплине команды' });
        }
      }
      values.push(roleId);
      updates.push(`role_id = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Передайте status и/или role_id' });
    }

    values.push(teamId, targetUserId);
    const { rows } = await db.query(
      `UPDATE team_members
       SET ${updates.join(', ')}
       WHERE team_id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING team_id, user_id, role_id, status, joined_at`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Участник или заявка не найдены' });
    }

    res.json({ member: rows[0] });
  } catch (err) {
    next(err);
  }
});

// 10. Выйти из команды или отозвать свою заявку
router.delete('/:id/leave', requireAuth, async (req, res, next) => {
  try {
    const teamId = Number(req.params.id);
    const userId = getAuthUserId(req);

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return res.status(400).json({ error: 'Некорректный id команды' });
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Команда не найдена' });
    }
    if (team.captain_id === userId) {
      return res.status(400).json({ error: 'Капитан не может выйти — удалите команду' });
    }

    const { rowCount } = await db.query(
      `DELETE FROM team_members
       WHERE team_id = $1 AND user_id = $2 AND status IN ('accepted', 'pending')`,
      [teamId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Вы не состоите в этой команде и не подавали заявку' });
    }

    res.json({ message: 'Вы покинули команду' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;