const jwt = require('jsonwebtoken');
const db = require('../db/database');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id, email, role, status, ban_until FROM users WHERE id = $1',
      [payload.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const user = rows[0];

    if (user.status === 'perm_banned') {
      return res.status(403).json({ error: 'Аккаунт заблокирован навсегда' });
    }

    if (user.status === 'temp_banned' && user.ban_until && new Date(user.ban_until) > new Date()) {
      return res.status(403).json({
        error: `Аккаунт временно заблокирован до ${new Date(user.ban_until).toLocaleString('ru-RU')}`,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для этого действия' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };