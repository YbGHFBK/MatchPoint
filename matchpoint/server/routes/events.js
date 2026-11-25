const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const organizer = [requireAuth, requireRole('organizer')];
const kinds = {
  esports: ['tournament', 'lan', 'online', 'watch_party'],
  hackathon: ['hackathon', 'programming_contest'],
};

function check(condition, status, message) {
  if (!condition) throw Object.assign(new Error(message), { status });
}

function id(value) {
  return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(value) {
  return Array.isArray(value) && value.length > 0 && value.every(text);
}

function httpUrl(value) {
  if (!text(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Mutations lock the event so registration, bracket generation and judging serialize.
function mutate(status, operation) {
  return async (req, res, next) => {
    let client;
    try {
      client = await db.pool.connect();
      await client.query('BEGIN');
      let event;
      if (req.params.id) {
        const result = await client.query('SELECT * FROM events WHERE id=$1 FOR UPDATE', [req.params.id]);
        event = result.rows[0];
        check(event, 404, 'Ивент не найден');
      }
      const body = await operation(req, client, event);
      await client.query('COMMIT');
      res.status(status).json(body);
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    } finally {
      client?.release();
    }
  };
}

function owner(req, event) {
  check(req.user.role === 'organizer' && req.user.id === event.organizer_id, 403,
    'Это действие доступно организатору данного ивента');
}

router.param('id', (req, res, next, value) => {
  if (!/^\d+$/.test(value) || !id(Number(value))) return res.status(400).json({ error: 'Некорректный ID ивента' });
  next();
});

// For legacy events without a subtype, use the stored type and venue.
const subtype = `COALESCE(e.details->>'subtype', CASE WHEN e.event_type='hackathon' THEN 'hackathon'
  WHEN e.location_id IS NULL THEN 'online' ELSE 'lan' END)`;
const eventSelect = `SELECT e.*, d.name AS discipline_name, d.category, ${subtype} AS subtype,
  to_json(l) AS location, (SELECT COUNT(*)::int FROM event_registrations er WHERE er.event_id=e.id) AS registrations_count
  FROM events e JOIN disciplines d ON d.id=e.discipline_id LEFT JOIN locations l ON l.id=e.location_id`;

router.get('/', async (req, res, next) => {
  try {
    const { category, event_type, subtype: kind, status } = req.query;
    for (const [value, options] of [[category, ['esports', 'it']], [event_type, Object.keys(kinds)],
      [kind, Object.values(kinds).flat()], [status, ['open', 'ongoing', 'finished', 'cancelled']]]) {
      if (value !== undefined && !options.includes(value)) return res.status(400).json({ error: 'Некорректный фильтр' });
    }
    const { rows } = await db.query(`${eventSelect}
      WHERE ($1::text IS NULL OR d.category=$1) AND ($2::text IS NULL OR e.event_type=$2)
      AND ($3::text IS NULL OR ${subtype}=$3) AND ($4::text IS NULL OR e.status=$4)
      ORDER BY e.start_at, e.id`, [category, event_type, kind, status]);
    res.json({ events: rows });
  } catch (err) { next(err); }
});

router.get('/locations', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM locations ORDER BY city, venue_name, id');
    res.json({ locations: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(`${eventSelect} WHERE e.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Ивент не найден' });
    res.json({ event: rows[0] });
  } catch (err) { next(err); }
});

function validateDetails(type, details, start) {
  check(object(details), 400, 'Укажите details');
  if (details.theme !== undefined) check(text(details.theme), 400, 'Укажите тему ивента');
  if (details.schedule !== undefined) {
    check(Array.isArray(details.schedule) && details.schedule.every(item =>
      object(item) && text(item.title) && text(item.start_at) && Number.isFinite(Date.parse(item.start_at))),
    400, 'Элемент расписания должен содержать title и start_at');
  }
  check(details.subtype === undefined || kinds[type].includes(details.subtype), 400, 'Некорректный подтип');
  if (type === 'esports') {
    check(details.subtype === 'watch_party' || text(details.format), 400, 'Укажите формат турнира');
    check(!details.bracket_type || details.bracket_type === 'single_elimination', 400, 'Поддерживается сетка single_elimination');
  } else {
    check(strings(details.tracks) && strings(details.tech_stack), 400, 'Укажите треки и стек технологий');
    check(id(details.team_size_limit), 400, 'Укажите допустимый размер команды');
    check(text(details.submission_deadline) && Date.parse(details.submission_deadline) >= start,
      400, 'Дедлайн сдачи должен быть не раньше начала ивента');
    if (details.criteria !== undefined) check(strings(details.criteria), 400, 'Укажите критерии оценки списком');
  }
}

router.post('/', ...organizer, mutate(201, async (req, client) => {
  const { title, description, event_type: type, discipline_id, location_id = null,
    start_at, max_participants = 16, details } = req.body;
  check(text(title) && title.trim().length <= 200 && (description == null || typeof description === 'string'),
    400, 'Проверьте название и описание');
  check(Object.hasOwn(kinds, type) && text(start_at) && Number.isFinite(Date.parse(start_at)), 400, 'Проверьте тип и дату начала');
  check(id(max_participants) && id(discipline_id) && (location_id === null || id(location_id)), 400, 'Проверьте лимит, дисциплину и площадку');
  validateDetails(type, details, Date.parse(start_at));
  const discipline = await client.query('SELECT category FROM disciplines WHERE id=$1', [discipline_id]);
  check(discipline.rows[0]?.category === (type === 'hackathon' ? 'it' : 'esports'), 400, 'Дисциплина не подходит для типа ивента');
  if (location_id !== null) {
    const place = await client.query('SELECT id FROM locations WHERE id=$1 FOR KEY SHARE', [location_id]);
    check(place.rowCount, 400, 'Площадка не найдена');
  }
  const { rows } = await client.query(`INSERT INTO events
    (organizer_id,discipline_id,location_id,event_type,title,description,start_at,max_participants,details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, discipline_id, location_id, type, title.trim(), description, start_at, max_participants, details]);
  return { event: rows[0] };
}));

router.patch('/:id', ...organizer, mutate(200, async (req, client, event) => {
  owner(req, event);
  check(!['cancelled', 'finished'].includes(event.status), 409, 'Ивент закрыт');
  const fields = ['title', 'description', 'theme', 'schedule', 'start_at', 'location_id', 'status'];
  check(Object.keys(req.body).length && Object.keys(req.body).every(key => fields.includes(key)),
    400, 'Укажите поддерживаемые поля ивента');
  const { title = event.title, description = event.description, start_at = event.start_at.toISOString(),
    location_id = event.location_id, status = event.status, theme, schedule } = req.body;
  check(text(title) && title.trim().length <= 200 && (description === null || typeof description === 'string'),
    400, 'Проверьте название и описание');
  check(text(start_at) && Number.isFinite(Date.parse(start_at)), 400, 'Некорректная дата начала');
  check(status === event.status || status === 'cancelled' ||
    ((event.event_type === 'hackathon' || event.details.subtype === 'watch_party') &&
    ((event.status === 'open' && status === 'ongoing') || (event.status === 'ongoing' && status === 'finished'))),
  409, 'Недопустимый переход статуса');
  if (location_id !== null) {
    check(id(location_id), 400, 'Некорректная площадка');
    const place = await client.query('SELECT id FROM locations WHERE id=$1 FOR KEY SHARE', [location_id]);
    check(place.rowCount, 400, 'Площадка не найдена');
  }
  const details = { ...event.details };
  if (theme !== undefined) details.theme = theme;
  if (schedule !== undefined) details.schedule = schedule;
  validateDetails(event.event_type, details, Date.parse(start_at));
  const { rows } = await client.query(`UPDATE events SET title=$2,description=$3,start_at=$4,
    location_id=$5,status=$6,details=$7 WHERE id=$1 RETURNING *`,
    [event.id,title.trim(),description,start_at,location_id,status,details]);
  return { event: rows[0] };
}));

router.post('/:id/register', requireAuth, mutate(201, async (req, client, event) => {
  check(event.status === 'open', 409, 'Регистрация закрыта');
  const { team_id = null } = req.body;
  if (team_id !== null) {
    check(id(team_id), 400, 'Некорректный ID команды');
    const { rows } = await client.query(`SELECT t.*, (SELECT COUNT(*)::int FROM team_members m
      WHERE m.team_id=t.id AND m.status='accepted') AS size FROM teams t WHERE t.id=$1`, [team_id]);
    check(rows.length, 404, 'Команда не найдена');
    check(req.user.role === 'captain' && rows[0].captain_id === req.user.id, 403, 'Заявку подаёт капитан своей команды');
    check(rows[0].discipline_id === event.discipline_id, 400, 'Дисциплины команды и ивента различаются');
    if (event.details.team_size_limit) check(rows[0].size <= event.details.team_size_limit, 409, 'Превышен размер команды');
  }
  const count = await client.query('SELECT COUNT(*)::int AS n FROM event_registrations WHERE event_id=$1', [event.id]);
  check(count.rows[0].n < event.max_participants, 409, 'Свободных мест нет');
  const { rows } = await client.query(`INSERT INTO event_registrations(event_id,user_id,team_id)
    VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *`, [event.id, team_id === null ? req.user.id : null, team_id]);
  check(rows.length, 409, 'Участник уже зарегистрирован');
  return { registration: rows[0] };
}));

async function registrations(client, eventId) {
  return (await client.query(`SELECT er.*, COALESCE(t.name,p.nickname) AS name,t.captain_id
    FROM event_registrations er LEFT JOIN teams t ON t.id=er.team_id
    LEFT JOIN profiles p ON p.user_id=er.user_id WHERE er.event_id=$1 ORDER BY er.id`, [eventId])).rows;
}

function represents(user, registration) {
  return registration.user_id === user.id || (user.role === 'captain' && registration.captain_id === user.id);
}

router.get('/:id/registrations', ...organizer, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT organizer_id FROM events WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Ивент не найден' });
    if (rows[0].organizer_id !== req.user.id) return res.status(403).json({ error: 'Доступно организатору ивента' });
    res.json({ registrations: await registrations(db, req.params.id) });
  } catch (err) { next(err); }
});

function tournament(event) {
  check(event.event_type === 'esports' && event.details.subtype !== 'watch_party', 409, 'Для этого ивента нет турнирной сетки');
}

async function createRound(client, eventId, round, participants) {
  // Populate a power-of-two first round, giving byes to the unpaired seeds.
  const size = 2 ** Math.ceil(Math.log2(participants.length));
  const byes = size - participants.length;
  let index = 0;
  for (let slot = 0; slot < size / 2; slot++) {
    const first = participants[index++];
    const second = slot < byes ? null : participants[index++];
    await client.query(`INSERT INTO tournament_matches
      (event_id,round,participant1_id,participant2_id,status,winner_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [eventId, round, first, second, second === null ? 'confirmed' : 'scheduled', second === null ? first : null]);
  }
}

router.post('/:id/bracket', ...organizer, mutate(201, async (req, client, event) => {
  owner(req, event);
  tournament(event);
  check(event.status === 'open', 409, 'Сетка уже запущена или ивент закрыт');
  const exists = await client.query('SELECT 1 FROM tournament_matches WHERE event_id=$1 LIMIT 1', [event.id]);
  check(!exists.rowCount, 409, 'Сетка уже существует');
  const entries = await registrations(client, event.id);
  check(entries.length >= 2, 409, 'Для сетки нужны минимум два участника');
  await createRound(client, event.id, 1, entries.map(entry => entry.id));
  await client.query("UPDATE events SET status='ongoing' WHERE id=$1", [event.id]);
  return { round: 1 };
}));

router.get('/:id/bracket', async (req, res, next) => {
  try {
    const event = await db.query('SELECT event_type,details FROM events WHERE id=$1', [req.params.id]);
    if (!event.rowCount) return res.status(404).json({ error: 'Ивент не найден' });
    tournament(event.rows[0]);
    const { rows } = await db.query(`SELECT m.id,m.round,m.participant1_id,m.participant2_id,m.score,m.status,m.winner_id,
      COALESCE(t1.name,p1.nickname) AS participant1_name, COALESCE(t2.name,p2.nickname) AS participant2_name,
      CASE WHEN m.proof_url LIKE 'data:%' THEN '/api/events/'||m.event_id||'/matches/'||m.id||'/proof'
           ELSE m.proof_url END AS proof_url
      FROM tournament_matches m
      LEFT JOIN event_registrations a ON a.id=m.participant1_id LEFT JOIN teams t1 ON t1.id=a.team_id
      LEFT JOIN profiles p1 ON p1.user_id=a.user_id
      LEFT JOIN event_registrations b ON b.id=m.participant2_id LEFT JOIN teams t2 ON t2.id=b.team_id
      LEFT JOIN profiles p2 ON p2.user_id=b.user_id WHERE m.event_id=$1 ORDER BY m.round,m.id`, [req.params.id]);
    res.json({ matches: rows });
  } catch (err) { next(err); }
});

function screenshot(value) {
  if (httpUrl(value)) return value;
  const file = typeof value === 'string' && /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  check(file, 400, 'Приложите PNG/JPEG в формате data URL или ссылку на скриншот');
  const bytes = Buffer.from(file[2], 'base64');
  const signature = Buffer.from(file[1] === 'png' ? '89504e470d0a1a0a' : 'ffd8ff', 'hex');
  check(bytes.length <= 5*1024*1024 && bytes.subarray(0,signature.length).equals(signature), 400, 'Некорректное изображение или файл больше 5 МБ');
  return value;
}

router.get('/:id/matches/:matchId/proof', async (req, res, next) => {
  try {
    if (!id(Number(req.params.matchId))) return res.status(400).json({ error: 'Некорректный ID матча' });
    const { rows } = await db.query('SELECT proof_url FROM tournament_matches WHERE event_id=$1 AND id=$2', [req.params.id, req.params.matchId]);
    const proof = rows[0]?.proof_url;
    if (!proof) return res.status(404).json({ error: 'Скриншот не найден' });
    if (httpUrl(proof)) return res.json({ proof_url: proof });
    const data = /^data:image\/(png|jpeg);base64,(.+)$/.exec(proof);
    if (!data) return res.status(404).json({ error: 'Скриншот недоступен' });
    res.set('X-Content-Type-Options', 'nosniff').type('image/'+data[1]).send(Buffer.from(data[2], 'base64'));
  } catch (err) { next(err); }
});

async function advanceRound(client, eventId, round) {
  const { rows } = await client.query('SELECT winner_id,status FROM tournament_matches WHERE event_id=$1 AND round=$2 ORDER BY id', [eventId, round]);
  if (rows.some(match => match.status !== 'confirmed')) return;
  if (rows.length === 1) {
    await client.query("UPDATE events SET status='finished' WHERE id=$1", [eventId]);
  } else {
    await createRound(client, eventId, round+1, rows.map(match => match.winner_id));
  }
}

router.post('/:id/result', requireAuth, mutate(200, async (req, client, event) => {
  check(!['cancelled','finished'].includes(event.status), 409, 'Ивент закрыт');
  const { match_id, registration_id, score, proof_url, winner_id, repository_url, action = 'submit' } = req.body;
  if (event.event_type === 'hackathon') {
    check(action === 'submit' && id(registration_id) && httpUrl(repository_url), 400, 'Укажите registration_id и ссылку на репозиторий');
    const entry = (await registrations(client,event.id)).find(row => row.id === registration_id);
    check(entry, 404, 'Заявка не найдена');
    check(represents(req.user,entry), 403, 'Решение подаёт участник или капитан команды');
    check(Date.now() <= Date.parse(event.details.submission_deadline), 409, 'Дедлайн сдачи прошёл');
    check(!entry.evaluation, 409, 'Проект уже оценён');
    await client.query('UPDATE event_registrations SET repository_url=$1 WHERE id=$2', [repository_url,registration_id]);
    return { registration_id, repository_url };
  }
  tournament(event);
  check(id(match_id) && ['submit','confirm'].includes(action), 400, 'Укажите match_id и корректное действие');
  const match = (await client.query('SELECT * FROM tournament_matches WHERE event_id=$1 AND id=$2', [event.id,match_id])).rows[0];
  check(match, 404, 'Матч не найден');
  check(match.status !== 'confirmed', 409, 'Матч уже подтверждён');
  if (action === 'submit') {
    const competitors = (await registrations(client,event.id)).filter(row => [match.participant1_id,match.participant2_id].includes(row.id));
    check(competitors.some(row => represents(req.user,row)), 403, 'Результат подаёт участник матча');
    check(match.status === 'scheduled', 409, 'Результат уже передан судье');
    check(text(score) && score.length <= 50, 400, 'Укажите счёт матча');
    await client.query("UPDATE tournament_matches SET score=$1,proof_url=$2,status='disputed' WHERE id=$3",
      [score.trim(), screenshot(proof_url),match_id]);
    return { match_id, status: 'disputed' };
  }
  owner(req,event);
  check(match.status === 'disputed', 409, 'Результат ещё не подан');
  check(id(winner_id) && [match.participant1_id,match.participant2_id].includes(winner_id), 400, 'Победитель должен быть участником матча');
  check(score === undefined || (text(score) && score.length<=50), 400, 'Некорректный счёт');
  await client.query("UPDATE tournament_matches SET status='confirmed',winner_id=$1,score=COALESCE($2,score) WHERE id=$3",
    [winner_id,score,match_id]);
  await advanceRound(client,event.id,match.round);
  return { match_id, winner_id, status: 'confirmed' };
}));

router.patch('/:id/registrations/:registrationId', ...organizer, mutate(200, async (req,client,event) => {
  owner(req,event);
  check(event.status !== 'cancelled' && event.status !== 'finished',409,'Ивент закрыт');
  const registrationId = Number(req.params.registrationId);
  const { mentor, evaluation } = req.body;
  check(id(registrationId) && (mentor !== undefined || evaluation !== undefined),400,'Укажите участника и изменения');
  check(mentor === undefined || text(mentor),400,'Укажите имя ментора');
  const entry = (await registrations(client,event.id)).find(row => row.id === registrationId);
  check(entry,404,'Заявка не найдена');
  if (evaluation !== undefined) {
    check(event.event_type === 'hackathon' && entry.repository_url,409,'Оценить можно только сданный проект');
    check(object(evaluation) && Object.keys(evaluation).length && Object.values(evaluation).every(Number.isFinite),400,'Укажите числовые оценки по критериям');
    if (event.details.criteria) {
      check(event.details.criteria.every(key => Object.hasOwn(evaluation,key)) &&
        Object.keys(evaluation).every(key => event.details.criteria.includes(key)),400,'Оцените проект по критериям ивента');
    }
  }
  const { rows } = await client.query(`UPDATE event_registrations SET mentor=COALESCE($1,mentor),
    evaluation=COALESCE($2,evaluation) WHERE id=$3 RETURNING *`, [mentor,evaluation,registrationId]);
  return { registration: rows[0] };
}));

module.exports = router;
