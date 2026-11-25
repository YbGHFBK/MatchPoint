const express = require('express');
const db = require('../db/database');
const { requireAuth, forbidGuest } = require('../middleware/auth');

const router = express.Router();

function getAuthUserId(req) {
  return req.user.id ?? req.user.userId;
}

const EXTERNAL_LINK_RULES = {
  steam: {
    label: 'Steam',
    hosts: ['steamcommunity.com', 'www.steamcommunity.com', 's.team'],
  },
  faceit: {
    label: 'Faceit',
    hosts: ['faceit.com', 'www.faceit.com'],
  },
  github: {
    label: 'GitHub',
    hosts: ['github.com', 'www.github.com'],
  },
  gitlab: {
    label: 'GitLab',
    hosts: ['gitlab.com', 'www.gitlab.com'],
  },
};

function validateExternalLinks(links) {
  if (links === null || typeof links !== 'object' || Array.isArray(links)) {
    return 'Поле external_links должно быть JSON-объектом';
  }

  for (const [key, rawVal] of Object.entries(links)) {
    if (key === 'verified_organizer') continue;
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') continue;

    const str = String(rawVal).trim();
    let parsed;
    try {
      parsed = new URL(str);
    } catch (_) {
      return `Некорректная ссылка в поле "${key}" — укажите полный URL (https://...)`;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return `Ссылка "${key}" должна начинаться с http:// или https://`;
    }

    const rule = EXTERNAL_LINK_RULES[key];
    if (rule && !rule.hosts.includes(parsed.hostname.toLowerCase())) {
      return `Ссылка ${rule.label} должна вести на домен ${rule.hosts[0]}`;
    }
  }

  return null;
}

async function getFullProfile(userId, includePrivate = false) {
  const { rows: profileRows } = await db.query(
    `SELECT
       u.id,
       ${includePrivate ? 'u.email,' : ''}
       u.role,
       u.status,
       u.ban_until,
       u.created_at,
       p.nickname,
       p.avatar_url,
       p.prime_time,
       p.bio,
       p.contacts,
       p.external_links,
       p.trust_score,
       (SELECT COUNT(*)::int FROM trust_ratings tr WHERE tr.to_user_id = u.id) AS ratings_count
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (profileRows.length === 0) {
    return null;
  }

  const { rows: disciplines } = await db.query(
    `SELECT
       pd.id,
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
     WHERE pd.profile_id = $1
     ORDER BY d.category, d.name`,
    [userId]
  );

  return {
    ...profileRows[0],
    trust_score: Number(profileRows[0].trust_score),
    disciplines,
  };
}

//Справочник дисциплин, ролей и рангов
router.get('/catalog', async (req, res, next) => {
  try {
    const [discRes, rolesRes, ranksRes] = await Promise.all([
      db.query('SELECT id, name, category FROM disciplines ORDER BY category, name'),
      db.query('SELECT id, discipline_id, name FROM discipline_roles ORDER BY id'),
      db.query('SELECT id, discipline_id, name, sort_order FROM ranks ORDER BY sort_order, id'),
    ]);

    const catalog = discRes.rows.map((d) => ({
      ...d,
      roles: rolesRes.rows.filter((r) => r.discipline_id === d.id),
      ranks: ranksRes.rows.filter((r) => r.discipline_id === d.id),
    }));

    res.json({ disciplines: catalog });
  } catch (err) {
    next(err);
  }
});

//Получить свой профиль
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await getFullProfile(getAuthUserId(req), true);
    if (!profile) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

//Обновить свой профиль
router.put('/me', requireAuth, forbidGuest, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const allowedFields = [
      'nickname',
      'avatar_url',
      'prime_time',
      'bio',
      'contacts',
      'external_links',
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;

      let value = req.body[field];

      if (field === 'nickname') {
        if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 100) {
          return res.status(400).json({ error: 'Никнейм должен быть от 2 до 100 символов' });
        }
        value = value.trim();
      }

      if (field === 'avatar_url' && value !== null && String(value).trim() !== '') {
        try {
          const parsedAvatar = new URL(String(value).trim());
          if (parsedAvatar.protocol !== 'https:' && parsedAvatar.protocol !== 'http:') {
            return res.status(400).json({ error: 'avatar_url должен начинаться с http:// или https://' });
          }
          value = parsedAvatar.href;
        } catch (_) {
          return res.status(400).json({ error: 'Укажите корректный URL для аватара' });
        }
      }

      if (field === 'contacts') {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          return res.status(400).json({ error: 'Поле contacts должно быть JSON-объектом' });
        }
        value = JSON.stringify(value);
      }

      if (field === 'external_links') {
        const linkError = validateExternalLinks(value);
        if (linkError) {
          return res.status(400).json({ error: linkError });
        }
        const sanitized = { ...value };
        delete sanitized.verified_organizer;
        const { rows: curRows } = await db.query(
          'SELECT external_links FROM profiles WHERE user_id = $1',
          [userId]
        );
        if (curRows[0]?.external_links?.verified_organizer) {
          sanitized.verified_organizer = true;
        }
        value = JSON.stringify(sanitized);
      }

      values.push(value);
      const cast = field === 'contacts' || field === 'external_links' ? '::jsonb' : '';
      updates.push(`${field} = $${values.length}${cast}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    values.push(userId);
    await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${values.length}`,
      values
    );

    const profile = await getFullProfile(userId, true);
    res.json({ profile });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Этот никнейм уже занят' });
    }
    next(err);
  }
});

//Добавить или обновить дисциплину в своём профиле (upsert)
router.put('/me/disciplines', requireAuth, forbidGuest, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const disciplineId = Number(req.body.discipline_id);
    const roleId = req.body.role_id != null && req.body.role_id !== '' ? Number(req.body.role_id) : null;
    const rankId = req.body.rank_id != null && req.body.rank_id !== '' ? Number(req.body.rank_id) : null;

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

    if (roleId !== null) {
      const { rows: roleCheck } = await db.query(
        'SELECT id FROM discipline_roles WHERE id = $1 AND discipline_id = $2',
        [roleId, disciplineId]
      );
      if (roleCheck.length === 0) {
        return res.status(400).json({ error: 'Указанная роль не относится к этой дисциплине' });
      }
    }

    if (rankId !== null) {
      const { rows: rankCheck } = await db.query(
        'SELECT id FROM ranks WHERE id = $1 AND discipline_id = $2',
        [rankId, disciplineId]
      );
      if (rankCheck.length === 0) {
        return res.status(400).json({ error: 'Указанный ранг не относится к этой дисциплине' });
      }
    }

    await db.query(
      `INSERT INTO profile_disciplines (profile_id, discipline_id, role_id, rank_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_id, discipline_id)
       DO UPDATE SET role_id = EXCLUDED.role_id, rank_id = EXCLUDED.rank_id`,
      [userId, disciplineId, roleId, rankId]
    );

    const profile = await getFullProfile(userId, true);
    res.json({ disciplines: profile.disciplines });
  } catch (err) {
    next(err);
  }
});

//Удалить дисциплину из своего профиля
router.delete('/me/disciplines/:disciplineId', requireAuth, forbidGuest, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const disciplineId = Number(req.params.disciplineId);

    if (!Number.isInteger(disciplineId) || disciplineId <= 0) {
      return res.status(400).json({ error: 'Некорректный disciplineId' });
    }

    const { rowCount } = await db.query(
      'DELETE FROM profile_disciplines WHERE profile_id = $1 AND discipline_id = $2',
      [userId, disciplineId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Дисциплина не найдена в профиле' });
    }

    res.json({ message: 'Дисциплина удалена из профиля' });
  } catch (err) {
    next(err);
  }
});

//Список игроков из мэтчей/команд
router.get('/me/teammates', requireAuth, async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { rows } = await db.query(
      `WITH related AS (
         SELECT CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END AS other_id,
                'match' AS relation
         FROM matches m
         WHERE m.user1_id = $1 OR m.user2_id = $1
         UNION
         SELECT tm2.user_id AS other_id, 'team' AS relation
         FROM team_members tm1
         JOIN team_members tm2 ON tm1.team_id = tm2.team_id
         WHERE tm1.user_id = $1 AND tm2.user_id <> $1
           AND tm1.status = 'accepted' AND tm2.status = 'accepted'
       )
       SELECT DISTINCT ON (u.id)
         u.id,
         u.role,
         u.status,
         p.nickname,
         p.avatar_url,
         p.trust_score,
         r.relation,
         tr.score AS my_score,
         tr.comment AS my_comment
       FROM related r
       JOIN users u ON u.id = r.other_id
       JOIN profiles p ON p.user_id = u.id
       LEFT JOIN trust_ratings tr ON tr.from_user_id = $1 AND tr.to_user_id = u.id
       ORDER BY u.id`,
      [userId]
    );

    res.json({
      teammates: rows.map((row) => ({
        ...row,
        trust_score: Number(row.trust_score),
      })),
    });
  } catch (err) {
    next(err);
  }
});

//отзывы и распределение Trust Factor пользователя
router.get('/:id/ratings', async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Некорректный id пользователя' });
    }

    const { rows: ratings } = await db.query(
      `SELECT
         tr.id,
         tr.from_user_id,
         tr.to_user_id,
         tr.score,
         tr.comment,
         tr.created_at,
         p.nickname AS from_nickname,
         p.avatar_url AS from_avatar_url
       FROM trust_ratings tr
       JOIN profiles p ON p.user_id = tr.from_user_id
       WHERE tr.to_user_id = $1
       ORDER BY tr.created_at DESC`,
      [targetId]
    );

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of ratings) {
      distribution[item.score] = (distribution[item.score] || 0) + 1;
    }

    res.json({
      ratings,
      total: ratings.length,
      distribution,
    });
  } catch (err) {
    next(err);
  }
});

//Посмотреть чужую анкету по user_id
router.get('/:id', async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Некорректный id пользователя' });
    }

    const profile = await getFullProfile(targetId, false);
    if (!profile) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

//Оценить игрока (Trust Factor)
router.post('/:id/rate', requireAuth, async (req, res, next) => {
  try {
    const fromUserId = getAuthUserId(req);
    const toUserId = Number(req.params.id);
    const score = Number(req.body.score);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : null;

    if (req.user.role === 'guest') {
      return res.status(403).json({ error: 'Гостям недоступна оценка игроков' });
    }
    if (!Number.isInteger(toUserId) || toUserId <= 0) {
      return res.status(400).json({ error: 'Некорректный id пользователя' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Нельзя оценить самого себя' });
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Оценка должна быть целым числом от 1 до 5' });
    }

    const { rows: targetCheck } = await db.query(
      'SELECT user_id FROM profiles WHERE user_id = $1',
      [toUserId]
    );
    if (targetCheck.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await db.query(
      `INSERT INTO trust_ratings (from_user_id, to_user_id, score, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (from_user_id, to_user_id)
       DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, created_at = NOW()`,
      [fromUserId, toUserId, score, comment]
    );

    const { rows: updated } = await db.query(
      `UPDATE profiles
       SET trust_score = (
         SELECT COALESCE(ROUND(AVG(score)::numeric, 2), 5.00)
         FROM trust_ratings
         WHERE to_user_id = $1
       )
       WHERE user_id = $1
       RETURNING trust_score`,
      [toUserId]
    );

    res.json({
      message: 'Оценка сохранена',
      trust_score: Number(updated[0].trust_score),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.validateExternalLinks = validateExternalLinks;
