const express = require('express');
const db = require('../db/database');
const { logAdminAction } = require('../middleware/logger');
const { requireAuth, requireRole } = require('../middleware/auth');


const adminRouter = express.Router();
const reportsRouter = express.Router();

const ALLOWED_ROLES = ['guest', 'player', 'captain', 'organizer', 'moderator', 'admin'];
const ALLOWED_STATUSES = ['active', 'muted', 'temp_banned', 'perm_banned'];
const ALLOWED_ACTIONS = ['none', 'warn', 'mute', 'temp_ban', 'perm_ban'];
const ALLOWED_REPORT_STATUSES = ['open', 'resolved', 'dismissed'];

function getAuthUserId(req) {
  return req.user.id ?? req.user.userId;
}

async function writeAuditLog(req, res, action, targetType, targetId, details = {}) {
  res.locals.auditLogged = true;
  await logAdminAction({
    actorId: getAuthUserId(req),
    action,
    targetType,
    targetId,
    details,
    ip: req.ip || req.socket?.remoteAddress || null,
  });
}

async function fetchAllDictionaries() {
  const [discRes, rolesRes, ranksRes, locRes] = await Promise.all([
    db.query('SELECT id, name, category FROM disciplines ORDER BY category, name'),
    db.query(
      `SELECT dr.id, dr.discipline_id, dr.name, d.name AS discipline_name
       FROM discipline_roles dr
       JOIN disciplines d ON d.id = dr.discipline_id
       ORDER BY dr.discipline_id, dr.id`
    ),
    db.query(
      `SELECT r.id, r.discipline_id, r.name, r.sort_order, d.name AS discipline_name
       FROM ranks r
       JOIN disciplines d ON d.id = r.discipline_id
       ORDER BY r.discipline_id, r.sort_order, r.id`
    ),
    db.query(
      'SELECT id, city, venue_name, address, lat, lng, is_verified FROM locations ORDER BY is_verified DESC, city, venue_name'
    ),
  ]);

  return {
    disciplines: discRes.rows,
    discipline_roles: rolesRes.rows,
    ranks: ranksRes.rows,
    locations: locRes.rows,
  };
}

//ЖАЛОБЫ (REPORTS) — /api/reports

reportsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const reporterId = getAuthUserId(req);
    const targetUserId = Number(req.body.target_user_id);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (req.user.role === 'guest') {
      return res.status(403).json({ error: 'Гости не могут отправлять жалобы' });
    }
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: 'Укажите корректный target_user_id' });
    }
    if (reporterId === targetUserId) {
      return res.status(400).json({ error: 'Нельзя подать жалобу на самого себя' });
    }
    if (reason.length < 5 || reason.length > 1000) {
      return res.status(400).json({ error: 'Опишите причину жалобы (от 5 до 1000 символов)' });
    }

    const { rows: targetRows } = await db.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (targetRows.length === 0) {
      return res.status(404).json({ error: 'Целевой пользователь не найден' });
    }

    const { rows } = await db.query(
      `INSERT INTO reports (reporter_id, target_user_id, reason)
       VALUES ($1, $2, $3)
       RETURNING id, reporter_id, target_user_id, reason, status, moderator_id, action_taken, created_at`,
      [reporterId, targetUserId, reason]
    );

    res.status(201).json({ message: 'Жалоба отправлена модераторам', report: rows[0] });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/', requireAuth, requireRole('moderator', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const values = [];
    const conditions = [];

    if (status && status !== 'all') {
      if (!ALLOWED_REPORT_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Некорректный фильтр status' });
      }
      values.push(status);
      conditions.push(`r.status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT
         r.id,
         r.reporter_id,
         rp.nickname AS reporter_nickname,
         r.target_user_id,
         tp.nickname AS target_nickname,
         tp.bio AS target_bio,
         tp.trust_score AS target_trust_score,
         tu.role AS target_role,
         tu.status AS target_status,
         tu.ban_until AS target_ban_until,
         r.reason,
         r.status,
         r.moderator_id,
         mp.nickname AS moderator_nickname,
         r.action_taken,
         r.created_at
       FROM reports r
       JOIN profiles rp ON rp.user_id = r.reporter_id
       JOIN users tu ON tu.id = r.target_user_id
       JOIN profiles tp ON tp.user_id = r.target_user_id
       LEFT JOIN profiles mp ON mp.user_id = r.moderator_id
       ${whereClause}
       ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at DESC`,
      values
    );

    res.json({
      reports: rows.map((row) => ({
        ...row,
        target_trust_score: Number(row.target_trust_score),
      })),
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.patch('/:id', requireAuth, requireRole('moderator', 'admin'), async (req, res, next) => {
  try {
    const reportId = Number(req.params.id);
    const moderatorId = getAuthUserId(req);
    const { status, action_taken = 'none', duration_hours } = req.body;

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Некорректный id жалобы' });
    }
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Укажите status: resolved или dismissed' });
    }
    if (!ALLOWED_ACTIONS.includes(action_taken)) {
      return res.status(400).json({ error: 'Некорректное действие action_taken' });
    }
    if (action_taken === 'perm_ban' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Перманентный бан доступен только администратору' });
    }

    const { rows: existing } = await db.query(
      `SELECT r.id, r.target_user_id, u.role AS target_role
       FROM reports r
       JOIN users u ON u.id = r.target_user_id
       WHERE r.id = $1`,
      [reportId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Жалоба не найдена' });
    }

    const target = existing[0];
    if (req.user.role === 'moderator' && ['admin', 'moderator'].includes(target.target_role) && action_taken !== 'none') {
      return res.status(403).json({ error: 'Модератор не может наказывать модераторов или администраторов' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: updatedReports } = await client.query(
        `UPDATE reports
         SET status = $1, moderator_id = $2, action_taken = $3
         WHERE id = $4
         RETURNING *`,
        [status, moderatorId, action_taken, reportId]
      );

      let newUserStatus = null;
      let banUntil = null;

      if (status === 'resolved') {
        if (action_taken === 'mute') {
          const hours = Math.min(Math.max(Number(duration_hours) || 24, 1), 720);
          newUserStatus = 'muted';
          banUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        } else if (action_taken === 'temp_ban') {
          const hours = Math.min(Math.max(Number(duration_hours) || 72, 1), 2160);
          newUserStatus = 'temp_banned';
          banUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        } else if (action_taken === 'perm_ban') {
          newUserStatus = 'perm_banned';
          banUntil = null;
        }

        if (newUserStatus) {
          await client.query(
            'UPDATE users SET status = $1, ban_until = $2 WHERE id = $3',
            [newUserStatus, banUntil, target.target_user_id]
          );
        }
      }

      await client.query('COMMIT');

      await writeAuditLog(req, res, `report_${status}`, 'report', reportId, {
        target_user_id: target.target_user_id,
        action_taken,
        new_status: newUserStatus,
        ban_until: banUntil,
      });

      res.json({
        message: 'Жалоба обработана',
        report: updatedReports[0],
        user_status: newUserStatus,
        ban_until: banUntil,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

//УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ — /api/admin/users

adminRouter.get('/users', requireAuth, requireRole('moderator', 'admin'), async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const values = [];
    const conditions = [];

    if (role && role !== 'all') {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Некорректная роль' });
      }
      values.push(role);
      conditions.push(`u.role = $${values.length}`);
    }

    if (status && status !== 'all') {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
      }
      values.push(status);
      conditions.push(`u.status = $${values.length}`);
    }

    if (search && String(search).trim() !== '') {
      values.push(`%${String(search).trim().toLowerCase()}%`);
      conditions.push(`(LOWER(p.nickname) LIKE $${values.length} OR LOWER(u.email) LIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT
         u.id,
         u.email,
         u.role,
         u.status,
         u.ban_until,
         u.created_at,
         p.nickname,
         p.avatar_url,
         p.trust_score,
         p.external_links,
         (SELECT COUNT(*)::int FROM reports r WHERE r.target_user_id = u.id) AS reports_count,
         (SELECT COUNT(*)::int FROM reports r WHERE r.target_user_id = u.id AND r.status = 'open') AS open_reports_count
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       ${whereClause}
       ORDER BY u.id ASC`,
      values
    );

    res.json({
      users: rows.map((u) => ({
        ...u,
        trust_score: Number(u.trust_score),
        verified_organizer: Boolean(u.external_links?.verified_organizer),
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/users/:id', requireAuth, requireRole('moderator', 'admin'), async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    const actorId = getAuthUserId(req);
    const { role, status, duration_hours, verified_organizer } = req.body;

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Некорректный id пользователя' });
    }

    const { rows: targetRows } = await db.query(
      `SELECT u.id, u.role, u.status, u.ban_until, p.nickname, p.external_links
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [targetId]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const target = targetRows[0];

    if (targetId === actorId && ((role && role !== target.role) || (status && status !== 'active'))) {
      return res.status(400).json({ error: 'Нельзя изменить собственную роль или заблокировать себя' });
    }

    if (req.user.role === 'moderator') {
      if (role !== undefined || verified_organizer !== undefined) {
        return res.status(403).json({ error: 'Смена ролей и верификация доступны только администратору' });
      }
      if (status === 'perm_banned') {
        return res.status(403).json({ error: 'Перманентный бан доступен только администратору' });
      }
      if (['admin', 'moderator'].includes(target.role)) {
        return res.status(403).json({ error: 'Модератор не может менять статус модераторов и администраторов' });
      }
    }

    const updates = [];
    const values = [];
    const auditDetails = {};

    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Некорректная роль' });
      }
      values.push(role);
      updates.push(`role = $${values.length}`);
      auditDetails.role = { from: target.role, to: role };
    }

    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
      }
      let banUntil = null;
      if (status === 'muted' || status === 'temp_banned') {
        const defaultHours = status === 'muted' ? 24 : 72;
        const hours = Math.min(Math.max(Number(duration_hours) || defaultHours, 1), 2160);
        banUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      }
      values.push(status);
      updates.push(`status = $${values.length}`);
      values.push(banUntil);
      updates.push(`ban_until = $${values.length}`);
      auditDetails.status = { from: target.status, to: status, ban_until: banUntil };
    }

    if (updates.length > 0) {
      values.push(targetId);
      await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
    }

    if (verified_organizer !== undefined) {
      const nextLinks = { ...(target.external_links || {}) };
      if (verified_organizer) {
        nextLinks.verified_organizer = true;
      } else {
        delete nextLinks.verified_organizer;
      }
      await db.query(
        'UPDATE profiles SET external_links = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(nextLinks), targetId]
      );
      auditDetails.verified_organizer = Boolean(verified_organizer);
    }

    if (Object.keys(auditDetails).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    await writeAuditLog(req, res, 'user_updated', 'user', targetId, auditDetails);

    const { rows: updatedRows } = await db.query(
      `SELECT u.id, u.email, u.role, u.status, u.ban_until, p.nickname, p.trust_score, p.external_links
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [targetId]
    );

    res.json({
      message: 'Пользователь обновлён',
      user: {
        ...updatedRows[0],
        trust_score: Number(updatedRows[0].trust_score),
        verified_organizer: Boolean(updatedRows[0].external_links?.verified_organizer),
      },
    });
  } catch (err) {
    next(err);
  }
});

//СПРАВОЧНИКИ — /api/admin/dictionaries

adminRouter.get('/dictionaries', async (req, res, next) => {
  try {
    const data = await fetchAllDictionaries();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/dictionaries', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const actorId = getAuthUserId(req);
    const { type } = req.body;

    if (type === 'discipline') {
      const name = String(req.body.name || '').trim();
      const category = req.body.category;
      if (!name || !['esports', 'it'].includes(category)) {
        return res.status(400).json({ error: 'Укажите name и category (esports / it)' });
      }
      const { rows } = await db.query(
        'INSERT INTO disciplines (name, category) VALUES ($1, $2) RETURNING *',
        [name, category]
      );
      await writeAuditLog(req, res, 'dictionary_created', 'discipline', rows[0].id, rows[0]);
      return res.status(201).json({ item: rows[0] });
    }

    if (type === 'role') {
      const disciplineId = Number(req.body.discipline_id);
      const name = String(req.body.name || '').trim();
      if (!Number.isInteger(disciplineId) || !name) {
        return res.status(400).json({ error: 'Укажите discipline_id и name' });
      }
      const { rows } = await db.query(
        'INSERT INTO discipline_roles (discipline_id, name) VALUES ($1, $2) RETURNING *',
        [disciplineId, name]
      );
      await writeAuditLog(req, res, 'dictionary_created', 'discipline_role', rows[0].id, rows[0]);
      return res.status(201).json({ item: rows[0] });
    }

    if (type === 'rank') {
      const disciplineId = Number(req.body.discipline_id);
      const name = String(req.body.name || '').trim();
      const sortOrder = Number(req.body.sort_order) || 1;
      if (!Number.isInteger(disciplineId) || !name) {
        return res.status(400).json({ error: 'Укажите discipline_id и name' });
      }
      const { rows } = await db.query(
        'INSERT INTO ranks (discipline_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
        [disciplineId, name, sortOrder]
      );
      await writeAuditLog(req, res, 'dictionary_created', 'rank', rows[0].id, rows[0]);
      return res.status(201).json({ item: rows[0] });
    }

    if (type === 'location') {
      const city = String(req.body.city || '').trim();
      const venueName = String(req.body.venue_name || '').trim();
      const address = String(req.body.address || '').trim();
      const lat = req.body.lat !== undefined && req.body.lat !== '' ? Number(req.body.lat) : null;
      const lng = req.body.lng !== undefined && req.body.lng !== '' ? Number(req.body.lng) : null;
      const isVerified = Boolean(req.body.is_verified);

      if (!city || !venueName || !address) {
        return res.status(400).json({ error: 'Укажите city, venue_name и address' });
      }
      const { rows } = await db.query(
        `INSERT INTO locations (city, venue_name, address, lat, lng, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [city, venueName, address, lat, lng, isVerified]
      );
      await writeAuditLog(req, res, 'dictionary_created', 'location', rows[0].id, rows[0]);
      return res.status(201).json({ item: rows[0] });
    }

    return res.status(400).json({ error: 'Неподдерживаемый type справочника (discipline, role, rank, location)' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Такая запись уже существует в справочнике' });
    }
    next(err);
  }
});

adminRouter.patch('/dictionaries/location/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const isVerified = Boolean(req.body.is_verified);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный id локации' });
    }

    const { rows } = await db.query(
      'UPDATE locations SET is_verified = $1 WHERE id = $2 RETURNING *',
      [isVerified, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }

    await writeAuditLog(req, res, 'location_verified', 'location', id, {
      venue_name: rows[0].venue_name,
      is_verified: isVerified,
    });

    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/dictionaries/:type/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { type } = req.params;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Некорректный id' });
    }

    const tableMap = {
      discipline: 'disciplines',
      role: 'discipline_roles',
      rank: 'ranks',
      location: 'locations',
    };
    const table = tableMap[type];
    if (!table) {
      return res.status(400).json({ error: 'Некорректный тип справочника' });
    }

    const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    await writeAuditLog(req, res, 'dictionary_deleted', type, id, {});
    res.json({ message: 'Запись удалена из справочника' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Нельзя удалить запись, пока она используется в командах или ивентах' });
    }
    next(err);
  }
});

// ============================================================================
// 4. АНАЛИТИКА И ЛОГИ АУДИТА — /api/admin/stats, /api/admin/logs
// ============================================================================

adminRouter.get('/stats', requireAuth, requireRole('moderator', 'admin'), async (req, res, next) => {
  try {
    const [
      usersCountRes,
      rolesRes,
      statusesRes,
      reportsRes,
      activityRes,
      trustRes,
    ] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS total FROM users'),
      db.query('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC'),
      db.query('SELECT status, COUNT(*)::int AS count FROM users GROUP BY status'),
      db.query('SELECT status, COUNT(*)::int AS count FROM reports GROUP BY status'),
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM matches) AS matches_count,
          (SELECT COUNT(*)::int FROM teams) AS teams_count,
          (SELECT COUNT(*)::int FROM events) AS events_count,
          (SELECT COUNT(*)::int FROM trust_ratings) AS ratings_count
      `),
      db.query(`
        SELECT
          COALESCE(ROUND(AVG(trust_score)::numeric, 2), 5.00) AS avg_trust_score,
          COUNT(*) FILTER (WHERE trust_score < 3.50)::int AS low_trust_count
        FROM profiles
      `),
    ]);

    const byRole = {};
    rolesRes.rows.forEach((r) => { byRole[r.role] = r.count; });

    const byStatus = {};
    statusesRes.rows.forEach((r) => { byStatus[r.status] = r.count; });

    const reportsByStatus = { open: 0, resolved: 0, dismissed: 0 };
    reportsRes.rows.forEach((r) => { reportsByStatus[r.status] = r.count; });

    res.json({
      users_total: usersCountRes.rows[0].total,
      users_by_role: byRole,
      users_by_status: byStatus,
      reports: reportsByStatus,
      matches_count: activityRes.rows[0].matches_count,
      teams_count: activityRes.rows[0].teams_count,
      events_count: activityRes.rows[0].events_count,
      ratings_count: activityRes.rows[0].ratings_count,
      avg_trust_score: Number(trustRes.rows[0].avg_trust_score),
      low_trust_count: trustRes.rows[0].low_trust_count,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/logs', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         al.id,
         al.actor_id,
         p.nickname AS actor_nickname,
         al.action,
         al.target_type,
         al.target_id,
         al.details,
         al.ip_address,
         al.created_at
       FROM audit_logs al
       LEFT JOIN profiles p ON p.user_id = al.actor_id
       ORDER BY al.created_at DESC
       LIMIT 50`
    );
    res.json({ logs: rows });
  } catch (_) {
    res.json({ logs: [] });
  }
});

module.exports = {
  adminRouter,
  reportsRouter,
  fetchAllDictionaries,
};