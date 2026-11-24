const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  const { email, password, nickname } = req.body;

  if (!email || !password || !nickname) {
    return res.status(400).json({ error: 'Заполните email, password и nickname' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'player')
       RETURNING id, email, role, status`,
      [email.trim().toLowerCase(), passwordHash]
    );

    const user = userRes.rows[0];
    const avatarUrl = `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(nickname.trim())}`;

    await client.query(
      `INSERT INTO profiles (user_id, nickname, avatar_url)
       VALUES ($1, $2, $3)`,
      [user.id, nickname.trim(), avatarUrl]
    );

    await client.query('COMMIT');

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        nickname: nickname.trim(),
        avatar_url: avatarUrl,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Такой email или никнейм уже занят' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.status, u.ban_until,
              p.nickname, p.avatar_url, p.trust_score
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (user.status === 'perm_banned') {
      return res.status(403).json({ error: 'Аккаунт заблокирован навсегда' });
    }

    if (user.status === 'temp_banned' && user.ban_until && new Date(user.ban_until) > new Date()) {
      return res.status(403).json({ error: 'Аккаунт временно заблокирован' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        trust_score: Number(user.trust_score),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.role, u.status,
              p.nickname, p.avatar_url, p.prime_time, p.bio, p.contacts, p.external_links, p.trust_score
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;