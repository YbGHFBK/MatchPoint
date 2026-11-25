const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getAuthUserId(req) {
  return req.user.id ?? req.user.userId;
}

// Подгружает дисциплины для массива user_id одним запросом
async function attachDisciplines(users) {
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const { rows: discRows } = await db.query(
    `SELECT
       pd.profile_id,
       pd.discipline_id,
       d.name AS discipline_name,
       d.category,
       pd.role_id,
       dr.name AS role_name,
       pd.rank_id,
       r.name AS rank_name,
       r.sort_order AS rank_order
     FROM profile_disciplines pd
     JOIN disciplines d ON d.id = pd.discipline_id
     LEFT JOIN discipline_roles dr ON dr.id = pd.role_id
     LEFT JOIN ranks r ON r.id = pd.rank_id
     WHERE pd.profile_id = ANY($1::int[])
     ORDER BY d.category, d.name`,
    [userIds]
  );

  const byUser = new Map();
  for (const row of discRows) {
    if (!byUser.has(row.profile_id)) byUser.set(row.profile_id, []);
    const { profile_id, ...disc } = row;
    byUser.get(profile_id).push(disc);
  }

  return users.map((u) => ({
    ...u,
    disciplines: byUser.get(u.id) || [],
  }));
}

// Подгружает открытые команды капитанов для массива user_id одним запросом
async function attachTeams(users) {
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const { rows: teamRows } = await db.query(
    `SELECT
       t.id,
       t.captain_id,
       t.discipline_id,
       d.name AS discipline_name,
       d.category,
       t.name,
       t.description,
       t.looking_for_role_id,
       dr.name AS looking_for_role_name,
       (SELECT COUNT(*)::int FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'accepted') AS members_count
     FROM teams t
     JOIN disciplines d ON d.id = t.discipline_id
     LEFT JOIN discipline_roles dr ON dr.id = t.looking_for_role_id
     WHERE t.captain_id = ANY($1::int[])
       AND t.looking_for_role_id IS NOT NULL
     ORDER BY t.id ASC`,
    [userIds]
  );

  const byCaptain = new Map();
  for (const row of teamRows) {
    if (!byCaptain.has(row.captain_id)) {
      byCaptain.set(row.captain_id, row);
    }
  }

  return users.map((u) => ({
    ...u,
    team: byCaptain.get(u.id) || null,
  }));
}

// 1. Лента кандидатов для свайпов с фильтрами
router.get('/feed', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { discipline_id, role_id, rank_id, category, min_trust, card_type } = req.query;
    const rawLimit = Number(req.query.limit) || 100;
    const limit = Math.min(Math.max(rawLimit, 1), 200);

    const values = [userId];
    const conditions = [
      'u.id <> $1',
      "u.role <> 'guest'",
      "u.status NOT IN ('temp_banned', 'perm_banned')",
      'NOT EXISTS (SELECT 1 FROM swipes s WHERE s.from_user_id = $1 AND s.to_user_id = u.id)',
    ];

    if (card_type === 'team') {
      conditions.push('EXISTS (SELECT 1 FROM teams t WHERE t.captain_id = u.id AND t.looking_for_role_id IS NOT NULL)');
    } else if (card_type === 'player') {
      conditions.push('NOT EXISTS (SELECT 1 FROM teams t WHERE t.captain_id = u.id AND t.looking_for_role_id IS NOT NULL)');
    }

    if (min_trust !== undefined && min_trust !== '') {
      const trustNum = Number(min_trust);
      if (Number.isNaN(trustNum) || trustNum < 1 || trustNum > 5) {
        return res.status(400).json({ error: 'min_trust должен быть числом от 1 до 5' });
      }
      values.push(trustNum);
      conditions.push(`p.trust_score >= $${values.length}`);
    }

    const discConditions = ['pd.profile_id = u.id'];

    if (discipline_id !== undefined && discipline_id !== '') {
      const id = Number(discipline_id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный discipline_id' });
      }
      values.push(id);
      discConditions.push(`pd.discipline_id = $${values.length}`);
    }

    if (role_id !== undefined && role_id !== '') {
      const id = Number(role_id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный role_id' });
      }
      values.push(id);
      discConditions.push(`pd.role_id = $${values.length}`);
    }

    if (rank_id !== undefined && rank_id !== '') {
      const id = Number(rank_id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный rank_id' });
      }
      values.push(id);
      discConditions.push(`pd.rank_id = $${values.length}`);
    }

    if (category !== undefined && category !== '') {
      if (category !== 'esports' && category !== 'it') {
        return res.status(400).json({ error: 'category должен быть esports или it' });
      }
      values.push(category);
      discConditions.push(`d.category = $${values.length}`);
    }

    if (discConditions.length > 1) {
      const teamConditions = ['t.captain_id = u.id', 't.looking_for_role_id IS NOT NULL'];
      if (discipline_id !== undefined && discipline_id !== '') {
        teamConditions.push(`t.discipline_id = ${Number(discipline_id)}`);
      }
      if (role_id !== undefined && role_id !== '') {
        teamConditions.push(`t.looking_for_role_id = ${Number(role_id)}`);
      }
      if (category !== undefined && category !== '') {
        teamConditions.push(`td.category = '${category === 'it' ? 'it' : 'esports'}'`);
      }

      conditions.push(
        `(EXISTS (
           SELECT 1
           FROM profile_disciplines pd
           JOIN disciplines d ON d.id = pd.discipline_id
           WHERE ${discConditions.join(' AND ')}
         ) OR EXISTS (
           SELECT 1
           FROM teams t
           JOIN disciplines td ON td.id = t.discipline_id
           WHERE ${teamConditions.join(' AND ')}
         ))`
      );
    }

    values.push(limit);

    const { rows } = await db.query(
      `SELECT
         u.id,
         u.role,
         p.nickname,
         p.avatar_url,
         p.prime_time,
         p.bio,
         p.external_links,
         p.trust_score
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.trust_score DESC, u.id DESC
       LIMIT $${values.length}`,
      values
    );

    const withDiscs = await attachDisciplines(rows);
    const candidates = await attachTeams(withDiscs);
    res.json({ candidates });
  } catch (err) {
    next(err);
  }
});

// 2. Отправить свайп (like / pass) и проверить взаимный мэтч
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const fromUserId = getAuthUserId(req);
    const toUserId = Number(req.body.to_user_id);
    const isLike = req.body.is_like;

    if (!Number.isInteger(toUserId) || toUserId <= 0) {
      return res.status(400).json({ error: 'Укажите корректный to_user_id' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Нельзя свайпнуть самого себя' });
    }
    if (typeof isLike !== 'boolean') {
      return res.status(400).json({ error: 'Поле is_like должно быть boolean (true/false)' });
    }

    const { rows: targetRows } = await db.query(
      `SELECT u.id, u.status
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [toUserId]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (targetRows[0].status === 'temp_banned' || targetRows[0].status === 'perm_banned') {
      return res.status(400).json({ error: 'Нельзя свайпнуть заблокированного пользователя' });
    }

    await db.query(
      `INSERT INTO swipes (from_user_id, to_user_id, is_like)
       VALUES ($1, $2, $3)
       ON CONFLICT (from_user_id, to_user_id)
       DO UPDATE SET is_like = EXCLUDED.is_like, created_at = NOW()`,
      [fromUserId, toUserId, isLike]
    );

    if (!isLike) {
      return res.json({ swiped: true, is_like: false, is_match: false, match: null });
    }

    // Проверяем встречный лайк
    const { rows: reverseLike } = await db.query(
      `SELECT 1 FROM swipes
       WHERE from_user_id = $1 AND to_user_id = $2 AND is_like = TRUE`,
      [toUserId, fromUserId]
    );

    if (reverseLike.length === 0) {
      return res.json({ swiped: true, is_like: true, is_match: false, match: null });
    }

    // Соблюдаем CHECK (user1_id < user2_id)
    const user1Id = Math.min(fromUserId, toUserId);
    const user2Id = Math.max(fromUserId, toUserId);

    const { rows: insertedMatch } = await db.query(
      `INSERT INTO matches (user1_id, user2_id)
       VALUES ($1, $2)
       ON CONFLICT (user1_id, user2_id) DO NOTHING
       RETURNING id, created_at`,
      [user1Id, user2Id]
    );

    let matchRow = insertedMatch[0];
    if (!matchRow) {
      const { rows: existing } = await db.query(
        'SELECT id, created_at FROM matches WHERE user1_id = $1 AND user2_id = $2',
        [user1Id, user2Id]
      );
      matchRow = existing[0];
    }

    const { rows: partnerRows } = await db.query(
      `SELECT
         u.id,
         u.role,
         p.nickname,
         p.avatar_url,
         p.prime_time,
         p.bio,
         p.contacts,
         p.external_links,
         p.trust_score
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [toUserId]
    );

    const [partner] = await attachDisciplines(partnerRows);

    res.status(201).json({
      swiped: true,
      is_like: true,
      is_match: true,
      match: {
        match_id: matchRow.id,
        matched_at: matchRow.created_at,
        user: partner,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Список всех мэтчей текущего пользователя (с контактами)
router.get('/matches', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);

    const { rows } = await db.query(
      `SELECT
         m.id AS match_id,
         m.created_at AS matched_at,
         u.id,
         u.role,
         p.nickname,
         p.avatar_url,
         p.prime_time,
         p.bio,
         p.contacts,
         p.external_links,
         p.trust_score
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
       JOIN profiles p ON p.user_id = u.id
       WHERE m.user1_id = $1 OR m.user2_id = $1
       ORDER BY m.created_at DESC`,
      [userId]
    );

    const enriched = await attachDisciplines(rows);
    const matches = enriched.map(({ match_id, matched_at, ...user }) => ({
      match_id,
      matched_at,
      user,
    }));

    res.json({ matches });
  } catch (err) {
    next(err);
  }
});

// 4. Удалить мэтч (анмэтч)
router.delete('/matches/:matchId', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const matchId = Number(req.params.matchId);

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return res.status(400).json({ error: 'Некорректный matchId' });
    }

    const { rowCount } = await db.query(
      `DELETE FROM matches
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [matchId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Мэтч не найден' });
    }

    res.json({ message: 'Мэтч удалён' });
  } catch (err) {
    next(err);
  }
});

// 5. Отмена последнего свайпа (Undo)
router.delete('/:targetUserId', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const targetUserId = Number(req.params.targetUserId);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Некорректный targetUserId' });
    }

    await db.query(
      'DELETE FROM swipes WHERE from_user_id = $1 AND to_user_id = $2',
      [userId, targetUserId]
    );

    await db.query(
      'DELETE FROM matches WHERE user1_id = LEAST($1::int, $2::int) AND user2_id = GREATEST($1::int, $2::int)',
      [userId, targetUserId]
    );

    res.json({ ok: true, removed_user_id: targetUserId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;