/**
 * MatchPoint — Автоматизированный QA-набор (Integration & RBAC API Tests)
 * Запуск (при работающем сервере npm start):
 *   node --test tests/api.qa.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = process.env.API_URL || "http://localhost:3000";

async function apiRequest(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function loginAs(email, password = "password") {
  const { status, data } = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(status, 200, `Login failed for ${email}: ${JSON.stringify(data)}`);
  assert.ok(data.token, "JWT token missing");
  return { token: data.token, user: data.user };
}

let tokens = {};

test.before(async () => {
  const [admin, mod, captain, player] = await Promise.all([
    loginAs("admin@matchpoint.dev"),
    loginAs("mod@matchpoint.dev"),
    loginAs("captain@matchpoint.dev"),
    loginAs("player@matchpoint.dev"),
  ]);
  tokens = {
    admin: admin.token,
    mod: mod.token,
    captain: captain.token,
    player: player.token,
  };
});

test("1. Health & Dictionaries — сервер и PostgreSQL доступны", async () => {
  const health = await apiRequest("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.status, "ok");

  const dicts = await apiRequest("/api/dictionaries");
  assert.equal(dicts.status, 200);
  assert.ok(dicts.data.disciplines.length >= 3, "Ожидается минимум 3 дисциплины");
  assert.ok(dicts.data.discipline_roles.length >= 15, "Ожидается минимум 15 ролей");
  assert.ok(dicts.data.locations.length >= 3, "Ожидается минимум 3 площадки");
});

test("2. Auth & Security — неверный пароль и анонимный доступ блокируются", async () => {
  const badLogin = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "player@matchpoint.dev", password: "wrong_password" },
  });
  assert.equal(badLogin.status, 401);

  const unauthProfile = await apiRequest("/api/profile/me");
  assert.equal(unauthProfile.status, 401);

  const me = await apiRequest("/api/auth/me", { token: tokens.player });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, "player@matchpoint.dev");
});

test("3. Profile & Trust Factor — валидация ссылок и защита от самооценки", async () => {
  const myProfile = await apiRequest("/api/profile/me", { token: tokens.player });
  assert.equal(myProfile.status, 200);
  assert.ok(myProfile.data.profile.nickname);

  // Попытка сохранить невалидный домен Steam должна вернуть 400
  const badLink = await apiRequest("/api/profile/me", {
    method: "PUT",
    token: tokens.player,
    body: {
      nickname: myProfile.data.profile.nickname,
      external_links: { steam: "https://evil-phishing.example/id/test" },
    },
  });
  assert.equal(badLink.status, 400);

  // Самооценка Trust Factor запрещена
  const selfRate = await apiRequest(`/api/profile/${myProfile.data.profile.id}/rate`, {
    method: "POST",
    token: tokens.player,
    body: { score: 5, comment: "Self-rate test" },
  });
  assert.equal(selfRate.status, 400);

  // Просмотр рейтингов работает
  const ratings = await apiRequest("/api/profile/9/ratings", { token: tokens.player });
  assert.equal(ratings.status, 200);
  assert.ok(typeof ratings.data.total === "number");
});

test("4. RBAC — разграничение прав player / moderator / admin", async () => {
  // Обычный игрок не имеет доступа к статистике и жалобам
  const playerStats = await apiRequest("/api/admin/stats", { token: tokens.player });
  assert.equal(playerStats.status, 403);

  const playerReports = await apiRequest("/api/reports", { token: tokens.player });
  assert.equal(playerReports.status, 403);

  // Модератор видит жалобы, но не может читать логи аудита админа
  const modReports = await apiRequest("/api/reports?status=all", { token: tokens.mod });
  assert.equal(modReports.status, 200);

  const modLogs = await apiRequest("/api/admin/logs", { token: tokens.mod });
  assert.equal(modLogs.status, 403);

  // Админ имеет полный доступ к статистике, пользователям и аудиту
  const adminStats = await apiRequest("/api/admin/stats", { token: tokens.admin });
  assert.equal(adminStats.status, 200);
  assert.ok(adminStats.data.users_total >= 14);

  const adminLogs = await apiRequest("/api/admin/logs", { token: tokens.admin });
  assert.equal(adminLogs.status, 200);
  assert.ok(Array.isArray(adminLogs.data.logs));
});

test("5. Moderation E2E — подача жалобы игроком и отклонение модератором", async () => {
  const created = await apiRequest("/api/reports", {
    method: "POST",
    token: tokens.player,
    body: {
      target_user_id: 13,
      reason: "QA autotest report — проверка очереди модерации",
    },
  });
  assert.equal(created.status, 201);
  const reportId = created.data.report?.id;
  assert.ok(reportId, "Report ID не вернулся");

  // Модератор отклоняет тестовую жалобу, чтобы не засорять очередь
  const dismissed = await apiRequest(`/api/reports/${reportId}`, {
    method: "PATCH",
    token: tokens.mod,
    body: { status: "dismissed", action_taken: "none" },
  });
  assert.equal(dismissed.status, 200);
});

test("6. Content, Teams, Events & Swipes Undo — сквозной smoke-тест", async () => {
  const teams = await apiRequest("/api/teams");
  assert.equal(teams.status, 200);
  assert.ok(teams.data.teams.length >= 3, "В БД должны быть команды");

  const events = await apiRequest("/api/events");
  assert.equal(events.status, 200);
  assert.ok(events.data.events.length >= 2, "В БД должны быть ивенты");

  const teamFeed = await apiRequest("/api/swipes/feed?card_type=team", { token: tokens.player });
  assert.equal(teamFeed.status, 200);
  assert.ok(Array.isArray(teamFeed.data.candidates));

  // Проверка свайпа и отмены (Undo)
  const feed = await apiRequest("/api/swipes/feed", { token: tokens.player });
  assert.equal(feed.status, 200);
  if (feed.data.candidates.length > 0) {
    const targetId = feed.data.candidates[0].id;
    const swiped = await apiRequest("/api/swipes", {
      method: "POST",
      token: tokens.player,
      body: { to_user_id: targetId, is_like: false },
    });
    assert.equal(swiped.status, 200);

    const undone = await apiRequest(`/api/swipes/${targetId}`, {
      method: "DELETE",
      token: tokens.player,
    });
    assert.equal(undone.status, 200);
    assert.equal(undone.data.ok, true);
  }
});