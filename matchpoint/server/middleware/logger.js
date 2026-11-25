const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG_FILE = path.join(LOGS_DIR, 'errors.log');

fs.mkdirSync(LOGS_DIR, { recursive: true });

function appendErrorFile(entry) {
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFile(ERROR_LOG_FILE, line, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('Не удалось записать ошибку в файл логов:', writeErr);
    }
  });
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const copy = { ...body };
  for (const secretKey of ['password', 'password_hash', 'token', 'newPassword']) {
    if (secretKey in copy) copy[secretKey] = '[REDACTED]';
  }
  return copy;
}

// 1. Лог всех HTTP-запросов в консоль
function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    const userTag = req.user ? ` user=${req.user.id ?? req.user.userId}(${req.user.role})` : '';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${userTag}`);
  });
  next();
}

// 2. Ручная запись действия админа/модератора в БД (для использования внутри роутов)
async function logAdminAction({
  actorId = null,
  action,
  targetType = null,
  targetId = null,
  details = {},
  ip = null,
}) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [actorId, action, targetType, targetId, JSON.stringify(details), ip]
    );
  } catch (err) {
    console.error('Ошибка записи в audit_logs:', err);
    appendErrorFile({
      timestamp: new Date().toISOString(),
      source: 'audit_logs',
      message: err.message,
      stack: err.stack,
    });
  }
}

// 3. Автоматический аудит изменяющих запросов модераторов и админов
function auditLogger(req, res, next) {
  const trackedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const isTrackedPath =
    req.originalUrl.startsWith('/api/admin') || req.originalUrl.startsWith('/api/reports');

  if (!trackedMethods.has(req.method) || !isTrackedPath) {
    return next();
  }

  res.on('finish', () => {
    const role = req.user?.role;
    if (res.statusCode >= 400 || (role !== 'admin' && role !== 'moderator')) {
      return;
    }

    const pathOnly = req.originalUrl.split('?')[0];
    const idMatch = pathOnly.match(/\/(\d+)(?:\/|$)/);
    const targetId = idMatch ? Number(idMatch[1]) : null;
    const targetType = pathOnly.startsWith('/api/reports') ? 'report' : 'admin_resource';

    logAdminAction({
      actorId: req.user.id ?? req.user.userId ?? null,
      action: `${req.method} ${pathOnly}`,
      targetType,
      targetId,
      details: {
        status: res.statusCode,
        body: sanitizeBody(req.body),
      },
      ip: req.ip || req.socket?.remoteAddress || null,
    });
  });

  next();
}

// 4. Централизованное логирование ошибок сервера
function errorLogger(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const entry = {
    timestamp: new Date().toISOString(),
    status,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id ?? req.user?.userId ?? null,
    role: req.user?.role ?? null,
    ip: req.ip || req.socket?.remoteAddress || null,
    message: err.message,
    stack: err.stack,
  };

  console.error(`[ERROR ${status}] ${req.method} ${req.originalUrl}:`, err.message);
  appendErrorFile(entry);

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Внутренняя ошибка сервера' : err.message,
  });
}

module.exports = {
  requestLogger,
  auditLogger,
  errorLogger,
  logAdminAction,
};