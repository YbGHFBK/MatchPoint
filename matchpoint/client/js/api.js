/* ==========================================================================
   MatchPoint — Клиентский API-модуль (client/js/api.js)
   Зона ответственности: Фронтенд-ядро (Карулис Иван)
   Интегрировано с прикреплёнными серверными файлами:
   - server/server.js, server/middleware/auth.js, server/routes/auth.js
   - 01_schema.sql и 02_seed.sql (14 пользователей, 3 дисциплины, 15 ролей,
     11 рангов, 3 команды, свайпы и мэтчи)
   Логика работы:
   - Отправляет реальные запросы с заголовком Authorization: Bearer <JWT>.
   - Авторизация (/api/auth/login, /api/auth/register, /api/auth/me) работает
     напрямую с вашим Express + PostgreSQL сервером.
   - Пока серверные файлы routes/swipes.js, routes/teams.js, routes/admin.js
     ещё пустые (возвращают 404), модуль бесшовно использует точный слепок
     данных из 02_seed.sql, сохраняя свайпы и мэтчи текущей сессии.
   ========================================================================== */

(function (global) {
  "use strict";

  const SESSION_STATE_KEY = "mp_seed_runtime_state_v3";

  // --- Точные справочники из 02_seed.sql ---
  const SEED_DICTIONARIES = {
    disciplines: [
      { id: 1, name: "CS2", category: "esports" },
      { id: 2, name: "Dota 2", category: "esports" },
      { id: 3, name: "Хакатон / IT", category: "it" }
    ],
    discipline_roles: [
      // CS2 (discipline_id: 1)
      { id: 1, discipline_id: 1, name: "AWPer" },
      { id: 2, discipline_id: 1, name: "Entry Fragger" },
      { id: 3, discipline_id: 1, name: "Rifler" },
      { id: 4, discipline_id: 1, name: "Support" },
      { id: 5, discipline_id: 1, name: "IGL" },
      // Dota 2 (discipline_id: 2)
      { id: 6, discipline_id: 2, name: "Carry (Pos 1)" },
      { id: 7, discipline_id: 2, name: "Mid (Pos 2)" },
      { id: 8, discipline_id: 2, name: "Offlane (Pos 3)" },
      { id: 9, discipline_id: 2, name: "Soft Support (Pos 4)" },
      { id: 10, discipline_id: 2, name: "Hard Support (Pos 5)" },
      // Хакатон / IT (discipline_id: 3)
      { id: 11, discipline_id: 3, name: "Backend" },
      { id: 12, discipline_id: 3, name: "Frontend" },
      { id: 13, discipline_id: 3, name: "ML / Data Science" },
      { id: 14, discipline_id: 3, name: "UI/UX Designer" },
      { id: 15, discipline_id: 3, name: "Team Lead / Pitch" }
    ],
    ranks: [
      // CS2
      { id: 1, discipline_id: 1, name: "Faceit 3–4 lvl", sort_order: 1 },
      { id: 2, discipline_id: 1, name: "Faceit 5–7 lvl", sort_order: 2 },
      { id: 3, discipline_id: 1, name: "Faceit 8–9 lvl", sort_order: 3 },
      { id: 4, discipline_id: 1, name: "Faceit 10 lvl", sort_order: 4 },
      // Dota 2
      { id: 5, discipline_id: 2, name: "Legend (3000+ MMR)", sort_order: 1 },
      { id: 6, discipline_id: 2, name: "Ancient (4000+ MMR)", sort_order: 2 },
      { id: 7, discipline_id: 2, name: "Divine (5000+ MMR)", sort_order: 3 },
      { id: 8, discipline_id: 2, name: "Immortal (6000+ MMR)", sort_order: 4 },
      // Хакатон / IT
      { id: 9, discipline_id: 3, name: "Junior", sort_order: 1 },
      { id: 10, discipline_id: 3, name: "Middle", sort_order: 2 },
      { id: 11, discipline_id: 3, name: "Senior / Призёр", sort_order: 3 }
    ],
    locations: [
      { id: 1, city: "Гродно", venue_name: "CyberArena Grodno", address: "ул. Советская 18", lat: 53.6834, lng: 23.8342, is_verified: true },
      { id: 2, city: "Минск", venue_name: "Meta Arena", address: "пр-т Победителей 84", lat: 53.9362, lng: 27.5105, is_verified: true },
      { id: 3, city: "Гродно", venue_name: "Технопарк / Коворкинг", address: "ул. Горького 91А", lat: 53.7042, lng: 23.8166, is_verified: true }
    ]
  };

  const GRADIENTS = [
    "linear-gradient(135deg, #2b1d52, #5e35b1)",
    "linear-gradient(135deg, #0d324d, #1976d2)",
    "linear-gradient(135deg, #16382b, #1b8a5a)",
    "linear-gradient(135deg, #4a1525, #b5174a)",
    "linear-gradient(135deg, #1e293b, #3b82f6)",
    "linear-gradient(135deg, #3f1d38, #db2777)",
    "linear-gradient(135deg, #1f2937, #0f766e)"
  ];

  // --- 14 пользователей и профилей из 02_seed.sql (пароль для всех: password) ---
  const SEED_ACCOUNTS = [
    {
      id: 1, email: "admin@matchpoint.dev", role: "admin", status: "active",
      nickname: "AdminRoot", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=AdminRoot",
      prime_time: "18:00-23:00", bio: "Администратор платформы MatchPoint.",
      contacts: { telegram: "@mp_admin" }, external_links: { github: "https://github.com/mp-admin" }, trust_score: 5.00
    },
    {
      id: 2, email: "mod@matchpoint.dev", role: "moderator", status: "active",
      nickname: "ModWatch", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=ModWatch",
      prime_time: "17:00-22:00", bio: "Слежу за порядком в чатах и на турнирах.",
      contacts: { discord: "modwatch#0001" }, external_links: { steam: "https://steamcommunity.com/id/modwatch" }, trust_score: 4.95
    },
    {
      id: 3, email: "org@matchpoint.dev", role: "organizer", status: "active",
      nickname: "OrgCyber", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=OrgCyber",
      prime_time: "12:00-21:00", bio: "Организатор локальных LAN-турниров и хакатонов.",
      contacts: { telegram: "@org_cyber" }, external_links: { faceit: "https://www.faceit.com/en/players/OrgCyber" }, trust_score: 4.90
    },
    {
      id: 4, email: "captain@matchpoint.dev", role: "captain", status: "active",
      nickname: "KuroCap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=KuroCap",
      prime_time: "20:00-01:00", bio: "Капитан и IGL в CS2, собираю стабильный стак под турики.",
      contacts: { discord: "kurocap", telegram: "@kurocap" },
      external_links: { steam: "https://steamcommunity.com/id/kurocap", faceit: "https://www.faceit.com/en/players/KuroCap" }, trust_score: 4.85
    },
    {
      id: 5, email: "player@matchpoint.dev", role: "player", status: "active",
      nickname: "ShadowStep", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=ShadowStep",
      prime_time: "21:00-02:00", bio: "Играю CS2 по вечерам, параллельно ищу команду на зимний хакатон (Backend).",
      contacts: { discord: "shadowstep", telegram: "@shadowstep_dev" },
      external_links: { steam: "https://steamcommunity.com/id/shadowstep", github: "https://github.com/shadowstep" }, trust_score: 4.90
    },
    {
      id: 6, email: "guest@matchpoint.dev", role: "guest", status: "active",
      nickname: "GuestDemo", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=GuestDemo",
      prime_time: "19:00-22:00", bio: "Тестовый гостевой профиль.",
      contacts: {}, external_links: {}, trust_score: 5.00
    },
    {
      id: 7, email: "dota_cap@matchpoint.dev", role: "captain", status: "active",
      nickname: "AegisMind", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=AegisMind",
      prime_time: "19:00-00:00", bio: "Мидер 5200 MMR, ищу адекватных тиммейтов на боевой кубок.",
      contacts: { discord: "aegismind" }, external_links: { steam: "https://steamcommunity.com/id/aegismind" }, trust_score: 4.80
    },
    {
      id: 8, email: "hack_cap@matchpoint.dev", role: "captain", status: "active",
      nickname: "PyArchitect", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=PyArchitect",
      prime_time: "22:00-03:00", bio: "Пишу бэкенд на Python/Node.js, собираю команду на CodeJam.",
      contacts: { telegram: "@py_architect" }, external_links: { github: "https://github.com/pyarchitect" }, trust_score: 5.00
    },
    {
      id: 9, email: "awper@matchpoint.dev", role: "player", status: "active",
      nickname: "ColdFlick", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=ColdFlick",
      prime_time: "20:00-01:00", bio: "Мейн AWP, 10 lvl Faceit. Без тильта, чёткая инфа.",
      contacts: { discord: "coldflick" },
      external_links: { steam: "https://steamcommunity.com/id/coldflick", faceit: "https://www.faceit.com/en/players/ColdFlick" }, trust_score: 4.95
    },
    {
      id: 10, email: "supp@matchpoint.dev", role: "player", status: "active",
      nickname: "WardMaster", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=WardMaster",
      prime_time: "18:30-23:30", bio: "Позиция 5 в Dota 2. Делаю стаки, покупаю смоки, не ворую крипов.",
      contacts: { discord: "wardmaster" }, external_links: { steam: "https://steamcommunity.com/id/wardmaster" }, trust_score: 4.90
    },
    {
      id: 11, email: "front@matchpoint.dev", role: "player", status: "active",
      nickname: "PixelCraft", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=PixelCraft",
      prime_time: "19:00-00:00", bio: "Фронтендер (JS/HTML/CSS), по выходным катаю CS2.",
      contacts: { telegram: "@pixelcraft_js", discord: "pixelcraft" },
      external_links: { github: "https://github.com/pixelcraft" }, trust_score: 4.75
    },
    {
      id: 12, email: "mldev@matchpoint.dev", role: "player", status: "active",
      nickname: "TensorFlowed", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=TensorFlowed",
      prime_time: "20:00-02:00", bio: "ML-инженер на хакатоны и четвёрка в Доту для разгрузки мозга.",
      contacts: { telegram: "@tensor_ml" }, external_links: { github: "https://github.com/tensorflowed" }, trust_score: 4.85
    },
    {
      id: 13, email: "toxic@matchpoint.dev", role: "player", status: "muted",
      nickname: "TiltKing", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=TiltKing",
      prime_time: "23:00-04:00", bio: "Всегда иду мид или Б, тиммейты виноваты.",
      contacts: { discord: "tiltking99" }, external_links: { steam: "https://steamcommunity.com/id/tiltking" }, trust_score: 2.10
    },
    {
      id: 14, email: "rifler@matchpoint.dev", role: "player", status: "active",
      nickname: "HeadTap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=HeadTap",
      prime_time: "20:00-00:00", bio: "Опорник / рифлер, знаю раскид на всех картах маппула.",
      contacts: { discord: "headtap_cs" }, external_links: { faceit: "https://www.faceit.com/en/players/HeadTap" }, trust_score: 4.80
    }
  ];

  // --- profile_disciplines из 02_seed.sql ---
  const SEED_PROFILE_DISCIPLINES = [
    { profile_id: 1, discipline_id: 3, role_id: 11, rank_id: 11 },
    { profile_id: 2, discipline_id: 1, role_id: 4, rank_id: 2 },
    { profile_id: 3, discipline_id: 1, role_id: 5, rank_id: 3 },
    { profile_id: 4, discipline_id: 1, role_id: 5, rank_id: 3 },
    { profile_id: 5, discipline_id: 1, role_id: 2, rank_id: 2 },
    { profile_id: 5, discipline_id: 3, role_id: 11, rank_id: 10 },
    { profile_id: 6, discipline_id: 2, role_id: 6, rank_id: 5 },
    { profile_id: 7, discipline_id: 2, role_id: 7, rank_id: 7 },
    { profile_id: 8, discipline_id: 3, role_id: 11, rank_id: 10 },
    { profile_id: 8, discipline_id: 2, role_id: 8, rank_id: 6 },
    { profile_id: 9, discipline_id: 1, role_id: 1, rank_id: 4 },
    { profile_id: 10, discipline_id: 2, role_id: 10, rank_id: 7 },
    { profile_id: 11, discipline_id: 3, role_id: 12, rank_id: 10 },
    { profile_id: 11, discipline_id: 1, role_id: 3, rank_id: 2 },
    { profile_id: 12, discipline_id: 3, role_id: 13, rank_id: 10 },
    { profile_id: 12, discipline_id: 2, role_id: 9, rank_id: 6 },
    { profile_id: 13, discipline_id: 1, role_id: 2, rank_id: 2 },
    { profile_id: 14, discipline_id: 1, role_id: 3, rank_id: 3 }
  ];

  // --- teams из 02_seed.sql ---
  const INITIAL_TEAMS = [
    { id: 1, captain_id: 4, discipline_id: 1, name: "Grodno Five", description: "Стак по CS2 на зимний LAN, тренируемся 4 раза в неделю.", looking_for_role_id: 2, members_count: 3 },
    { id: 2, captain_id: 7, discipline_id: 2, name: "Radiant Stack", description: "Команда по Dota 2 на 5000+ MMR, нужен сильный керри.", looking_for_role_id: 6, members_count: 3 },
    { id: 3, captain_id: 8, discipline_id: 3, name: "NullPointer Crew", description: "Собираем веб-сервис на CodeJam, нужен UI/UX дизайнер.", looking_for_role_id: 14, members_count: 3 }
  ];

  // --- swipes и matches из 02_seed.sql ---
  const INITIAL_SWIPES = [
    { from_user_id: 5, to_user_id: 9, is_like: true },
    { from_user_id: 9, to_user_id: 5, is_like: true },
    { from_user_id: 5, to_user_id: 11, is_like: true },
    { from_user_id: 11, to_user_id: 5, is_like: true },
    { from_user_id: 7, to_user_id: 10, is_like: true },
    { from_user_id: 10, to_user_id: 7, is_like: true },
    // По сценарию 02_seed.sql: под player@matchpoint.dev (id: 5) лайк HeadTap (id: 14) или Grodno Five (captain id: 4) сразу создаёт Match!
    { from_user_id: 14, to_user_id: 5, is_like: true },
    { from_user_id: 4, to_user_id: 5, is_like: true },
    { from_user_id: 5, to_user_id: 13, is_like: false },
    { from_user_id: 8, to_user_id: 12, is_like: true }
  ];

  const INITIAL_MATCHES = [
    { id: 1, user1_id: 5, user2_id: 9, created_at: "Вчера, 21:15" },
    { id: 2, user1_id: 5, user2_id: 11, created_at: "Сегодня, 14:20" },
    { id: 3, user1_id: 7, user2_id: 10, created_at: "Сегодня, 18:05" }
  ];

  function loadSeedRuntime() {
    try {
      const raw = global.sessionStorage && global.sessionStorage.getItem(SESSION_STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      swipes: INITIAL_SWIPES.map((s) => ({ ...s })),
      matches: INITIAL_MATCHES.map((m) => ({ ...m })),
      teams: INITIAL_TEAMS.map((t) => ({ ...t })),
      reports: []
    };
  }

  function saveSeedRuntime(runtime) {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(runtime));
      }
    } catch (_) {}
  }

  function hydrateProfileDisciplines(userId) {
    return SEED_PROFILE_DISCIPLINES
      .filter((pd) => pd.profile_id === userId)
      .map((pd) => {
        const d = SEED_DICTIONARIES.disciplines.find((x) => x.id === pd.discipline_id) || {};
        const r = SEED_DICTIONARIES.discipline_roles.find((x) => x.id === pd.role_id) || {};
        const rk = SEED_DICTIONARIES.ranks.find((x) => x.id === pd.rank_id) || {};
        return {
          discipline_id: pd.discipline_id,
          discipline_name: d.name || "",
          category: d.category || "esports",
          role_id: pd.role_id,
          role_name: r.name || "",
          rank_id: pd.rank_id,
          rank_name: rk.name || "",
          sort_order: rk.sort_order || 0
        };
      });
  }

  function buildSeedCards(runtime, viewerId, filters = {}) {
    const swipedByViewer = new Set(
      runtime.swipes.filter((s) => s.from_user_id === viewerId).map((s) => s.to_user_id)
    );

    const allCards = [];

    for (const acc of SEED_ACCOUNTS) {
      if (acc.id === viewerId) continue;
      if (acc.role === "guest") continue;
      if (acc.status === "temp_banned" || acc.status === "perm_banned") continue;
      if (swipedByViewer.has(acc.id)) continue;

      const pds = hydrateProfileDisciplines(acc.id);
      if (!pds.length) continue;

      const gradient = GRADIENTS[acc.id % GRADIENTS.length];
      const capTeam = runtime.teams.find((t) => t.captain_id === acc.id && t.looking_for_role_id);

      if (capTeam) {
        const disc = SEED_DICTIONARIES.disciplines.find((d) => d.id === capTeam.discipline_id) || {};
        const lookRole = SEED_DICTIONARIES.discipline_roles.find((r) => r.id === capTeam.looking_for_role_id) || {};
        const capRank = pds.find((x) => x.discipline_id === capTeam.discipline_id) || pds[0] || {};
        allCards.push({
          card_key: `team_${capTeam.id}`,
          card_type: "team",
          user_id: acc.id,
          nickname: acc.nickname,
          avatar_url: acc.avatar_url,
          gradient,
          prime_time: acc.prime_time,
          bio: capTeam.description || acc.bio,
          external_links: acc.external_links || {},
          trust_score: acc.trust_score,
          profile_disciplines: [
            {
              discipline_id: capTeam.discipline_id,
              discipline_name: disc.name || "",
              category: disc.category || "esports",
              role_id: capTeam.looking_for_role_id,
              role_name: lookRole.name || "",
              rank_id: capRank.rank_id || null,
              rank_name: capRank.rank_name || "Middle+"
            }
          ],
          team: {
            ...capTeam,
            looking_for_role_name: lookRole.name || ""
          }
        });
      } else {
        allCards.push({
          card_key: `player_${acc.id}`,
          card_type: "player",
          user_id: acc.id,
          nickname: acc.nickname,
          avatar_url: acc.avatar_url,
          gradient,
          prime_time: acc.prime_time,
          bio: acc.bio,
          external_links: acc.external_links || {},
          trust_score: acc.trust_score,
          profile_disciplines: pds,
          team: null
        });
      }
    }

    return allCards.filter((card) => {
      if (filters.card_type && filters.card_type !== "all" && card.card_type !== filters.card_type) {
        return false;
      }

      const matchesDisc = card.profile_disciplines.some((pd) => {
        if (filters.category && filters.category !== "all" && pd.category !== filters.category) return false;
        if (filters.discipline_id && Number(pd.discipline_id) !== Number(filters.discipline_id)) return false;
        if (filters.role_id && Number(pd.role_id) !== Number(filters.role_id)) return false;
        if (filters.rank_id && Number(pd.rank_id) !== Number(filters.rank_id)) return false;
        return true;
      });
      if (!matchesDisc) return false;

      if (filters.prime_time && !String(card.prime_time || "").includes(filters.prime_time)) {
        return false;
      }
      if (filters.min_trust && Number(card.trust_score) < Number(filters.min_trust)) {
        return false;
      }
      return true;
    });
  }

  function buildMatchDto(runtime, matchRow, viewerId) {
    const partnerId = matchRow.user1_id === viewerId ? matchRow.user2_id : matchRow.user1_id;
    const acc = SEED_ACCOUNTS.find((u) => u.id === partnerId) || {};
    const pds = hydrateProfileDisciplines(partnerId);
    const pd = pds[0] || {};
    const capTeam = runtime.teams.find((t) => t.captain_id === partnerId);
    const lookRole = capTeam
      ? SEED_DICTIONARIES.discipline_roles.find((r) => r.id === capTeam.looking_for_role_id)
      : null;

    return {
      id: matchRow.id,
      user1_id: matchRow.user1_id,
      user2_id: matchRow.user2_id,
      created_at: matchRow.created_at,
      partner: {
        user_id: partnerId,
        nickname: capTeam ? `${capTeam.name} (@${acc.nickname})` : (acc.nickname || `User #${partnerId}`),
        avatar_url: acc.avatar_url || null,
        gradient: GRADIENTS[partnerId % GRADIENTS.length],
        prime_time: acc.prime_time || "",
        trust_score: acc.trust_score || 5.0,
        discipline_name: pd.discipline_name || "",
        role_name: lookRole ? `Ищем: ${lookRole.name}` : (pd.role_name || ""),
        rank_name: pd.rank_name || "",
        // По ТЗ и 01_schema.sql: JSONB-поле contacts раскрывается ТОЛЬКО после взаимного мэтча
        contacts: acc.contacts || {},
        external_links: acc.external_links || {},
        greeting: `Привет от @${acc.nickname}! Отличный мэтч, спишемся и пойдём в лобби?`
      }
    };
  }

  // Универсальный HTTP-вызов с подстановкой JWT из MPStorage
  async function request(path, options = {}) {
    const authHeaders = global.MPStorage ? global.MPStorage.getAuthHeaders() : {};
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
      ...(options.headers || {})
    };

    let res;
    try {
      res = await fetch(path, { ...options, headers });
    } catch (networkErr) {
      const err = new Error("Сервер недоступен (сетевая ошибка)");
      err.isOffline = true;
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function isRouteMissing(err) {
    return Boolean(err && (err.isOffline || err.status === 404 || err.status === 501));
  }

  async function tryEndpoints(candidates) {
    let lastErr = null;
    for (const fn of candidates) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isRouteMissing(err)) throw err;
      }
    }
    throw lastErr || new Error("Endpoint not available");
  }

  const MPApi = {
    SEED_ACCOUNTS,
    SEED_DICTIONARIES,

    request,
    get: (url) => request(url, { method: "GET" }),
    post: (url, body) => request(url, { method: "POST", body: JSON.stringify(body || {}) }),
    put: (url, body) => request(url, { method: "PUT", body: JSON.stringify(body || {}) }),
    patch: (url, body) => request(url, { method: "PATCH", body: JSON.stringify(body || {}) }),
    delete: (url) => request(url, { method: "DELETE" }),

    // --- Авторизация (server/routes/auth.js: /api/auth/login, /register, /me) ---
    async login({ email, password }) {
      try {
        const res = await this.post("/api/auth/login", { email, password });
        if (global.MPStorage && res.token && res.user) {
          global.MPStorage.setAuthSession(res.token, res.user);
        }
        return { ...res, source: "server" };
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const cleanEmail = String(email || "").trim().toLowerCase();
        const found = SEED_ACCOUNTS.find((u) => u.email === cleanEmail);
        if (!found || password !== "password") {
          throw new Error("Неверный email или пароль (для сид-аккаунтов пароль: password)");
        }
        const fakeToken = `demo_jwt_user_${found.id}`;
        if (global.MPStorage) {
          global.MPStorage.setAuthSession(fakeToken, found);
        }
        return { token: fakeToken, user: found, source: "seed" };
      }
    },

    async register({ email, password, nickname }) {
      try {
        const res = await this.post("/api/auth/register", { email, password, nickname });
        if (global.MPStorage && res.token && res.user) {
          global.MPStorage.setAuthSession(res.token, res.user);
        }
        return { ...res, source: "server" };
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const newUser = {
          id: SEED_ACCOUNTS.length + 1,
          email: String(email || "").trim().toLowerCase(),
          role: "player",
          status: "active",
          nickname: String(nickname || "NewPlayer").trim(),
          avatar_url: `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(nickname || "NewPlayer")}`,
          trust_score: 5.0
        };
        const fakeToken = `demo_jwt_user_${newUser.id}`;
        if (global.MPStorage) {
          global.MPStorage.setAuthSession(fakeToken, newUser);
        }
        return { token: fakeToken, user: newUser, source: "seed" };
      }
    },

    async getMe() {
      return this.get("/api/auth/me");
    },

    /**
     * Быстрое переключение на любой из 14 аккаунтов 02_seed.sql:
     * если запущен server.js + PostgreSQL, выполняет реальный вход POST /api/auth/login
     * и получает настоящий подписанный JWT!
     */
    async switchSeedAccount(userId) {
      const target = SEED_ACCOUNTS.find((u) => u.id === Number(userId));
      if (!target) throw new Error("Сид-аккаунт не найден");
      if (target.role === "guest") {
        if (global.MPStorage) global.MPStorage.clearAuth();
        return { user: target, source: "guest" };
      }
      try {
        return await this.login({ email: target.email, password: "password" });
      } catch (_) {
        const fakeToken = `demo_jwt_user_${target.id}`;
        if (global.MPStorage) {
          global.MPStorage.setAuthSession(fakeToken, target);
        }
        return { token: fakeToken, user: target, source: "seed" };
      }
    },

    // --- Справочники (disciplines, discipline_roles, ranks) ---
    async getDictionaries() {
      try {
        return await tryEndpoints([
          () => this.get("/api/dictionaries"),
          () => this.get("/api/admin/dictionaries"),
          () => this.get("/api/swipes/dictionaries")
        ]);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        return SEED_DICTIONARIES;
      }
    },

    // --- Лента карточек для свайпов ---
    async getCards(filters = {}) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "all") {
          qs.set(k, String(v));
        }
      });
      const query = qs.toString() ? `?${qs.toString()}` : "";

      try {
        return await tryEndpoints([
          () => this.get(`/api/swipes/feed${query}`),
          () => this.get(`/api/swipes/cards${query}`),
          () => this.get(`/api/cards${query}`)
        ]);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const viewerId = global.MPStorage?.getUser()?.id || 5;
        const runtime = loadSeedRuntime();
        return { cards: buildSeedCards(runtime, viewerId, filters), source: "seed" };
      }
    },

    // --- Отправка свайпа: swipes (from_user_id, to_user_id, is_like) + matches ---
    async sendSwipe({ to_user_id, is_like }) {
      const payload = {
        to_user_id: Number(to_user_id),
        is_like: Boolean(is_like)
      };

      try {
        return await tryEndpoints([
          () => this.post("/api/swipes", payload),
          () => this.post("/api/swipe", payload)
        ]);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;

        const viewerId = global.MPStorage?.getUser()?.id || 5;
        if (!payload.to_user_id || payload.to_user_id === viewerId) {
          throw new Error("Нельзя отправить свайп самому себе (from_user_id <> to_user_id)");
        }

        const runtime = loadSeedRuntime();
        const idx = runtime.swipes.findIndex(
          (s) => s.from_user_id === viewerId && s.to_user_id === payload.to_user_id
        );
        const rec = {
          from_user_id: viewerId,
          to_user_id: payload.to_user_id,
          is_like: payload.is_like
        };
        if (idx >= 0) runtime.swipes[idx] = rec;
        else runtime.swipes.push(rec);

        let matched = false;
        let matchDto = null;

        if (payload.is_like) {
          const reciprocal = runtime.swipes.find(
            (s) => s.from_user_id === payload.to_user_id && s.to_user_id === viewerId && s.is_like === true
          );
          if (reciprocal) {
            matched = true;
            const user1_id = Math.min(viewerId, payload.to_user_id);
            const user2_id = Math.max(viewerId, payload.to_user_id);
            let matchRow = runtime.matches.find(
              (m) => m.user1_id === user1_id && m.user2_id === user2_id
            );
            if (!matchRow) {
              matchRow = {
                id: runtime.matches.length + 1,
                user1_id,
                user2_id,
                created_at: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
              };
              runtime.matches.unshift(matchRow);
            }
            matchDto = buildMatchDto(runtime, matchRow, viewerId);
          }
        }

        saveSeedRuntime(runtime);
        return { ok: true, swipe: rec, matched, match: matchDto, source: "seed" };
      }
    },

    // --- Отмена последнего свайпа в рамках сессии ---
    undoSeedSwipe(toUserId) {
      const viewerId = global.MPStorage?.getUser()?.id || 5;
      const runtime = loadSeedRuntime();
      runtime.swipes = runtime.swipes.filter(
        (s) => !(s.from_user_id === viewerId && s.to_user_id === Number(toUserId))
      );
      saveSeedRuntime(runtime);
    },

    // --- Список взаимных мэтчей (matches + раскрытый profiles.contacts) ---
    async getMatches() {
      try {
        return await tryEndpoints([
          () => this.get("/api/swipes/matches"),
          () => this.get("/api/matches")
        ]);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const viewerId = global.MPStorage?.getUser()?.id || 5;
        const runtime = loadSeedRuntime();
        const myMatches = runtime.matches
          .filter((m) => m.user1_id === viewerId || m.user2_id === viewerId)
          .map((m) => buildMatchDto(runtime, m, viewerId));
        return { matches: myMatches, source: "seed" };
      }
    },

    // --- Создание вакансии команды (teams) ---
    async createTeam({ name, discipline_id, looking_for_role_id, description }) {
      const payload = {
        name: String(name || "").trim(),
        discipline_id: Number(discipline_id),
        looking_for_role_id: Number(looking_for_role_id) || null,
        description: String(description || "").trim()
      };
      return this.post("/api/teams", payload);
    },

    // --- Жалоба модераторам (reports) ---
    async sendReport({ target_user_id, reason }) {
      const payload = {
        target_user_id: Number(target_user_id),
        reason: String(reason || "").trim()
      };
      try {
        return await this.post("/api/reports", payload);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const runtime = loadSeedRuntime();
        runtime.reports.push({
          id: runtime.reports.length + 1,
          reporter_id: global.MPStorage?.getUser()?.id || 5,
          ...payload,
          status: "open"
        });
        saveSeedRuntime(runtime);
        return { ok: true, source: "seed" };
      }
    }
  };
// ========================================================================
  // РАСШИРЕНИЕ API: ПРОФИЛИ, TRUST FACTOR, МОДЕРАЦИЯ И АДМИН-ПАНЕЛЬ
  // ========================================================================
  const ADMIN_SEED_KEY = "mp_admin_profile_seed_v1";

  function loadExtendedSeed() {
    try {
      if (global.sessionStorage) {
        const raw = global.sessionStorage.getItem(ADMIN_SEED_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}

    const initial = {
      accounts: SEED_ACCOUNTS.map((a) => ({
        ...a,
        contacts: { ...(a.contacts || {}) },
        external_links: { ...(a.external_links || {}) },
        ban_until: a.status === "muted" ? new Date(Date.now() + 72 * 3600 * 1000).toISOString() : null,
        created_at: "2026-11-01T10:00:00.000Z"
      })),
      profile_disciplines: SEED_PROFILE_DISCIPLINES.map((pd, i) => ({ id: i + 1, ...pd })),
      dictionaries: {
        disciplines: SEED_DICTIONARIES.disciplines.map((x) => ({ ...x })),
        discipline_roles: SEED_DICTIONARIES.discipline_roles.map((x) => ({ ...x })),
        ranks: SEED_DICTIONARIES.ranks.map((x) => ({ ...x })),
        locations: [
          ...SEED_DICTIONARIES.locations.map((x) => ({ ...x })),
          { id: 4, city: "Брест", venue_name: "Brest Gaming Lounge", address: "ул. Гоголя 44", lat: 52.0937, lng: 23.6852, is_verified: false }
        ]
      },
      trust_ratings: [
        { id: 1, from_user_id: 5, to_user_id: 9, score: 5, comment: "Отличный AWP, спокойная инфа и стабильные энтри", created_at: "2026-11-20T18:30:00.000Z" },
        { id: 2, from_user_id: 9, to_user_id: 5, score: 5, comment: "Хорошо открывает точки, не тильтует", created_at: "2026-11-20T19:10:00.000Z" },
        { id: 3, from_user_id: 11, to_user_id: 5, score: 5, comment: "Пунктуальный, быстро отвечает в Telegram и чётко кодит", created_at: "2026-11-21T21:00:00.000Z" },
        { id: 4, from_user_id: 4, to_user_id: 5, score: 4, comment: "Отличный командный игрок, иногда чуть спешит с пушем", created_at: "2026-11-22T20:15:00.000Z" },
        { id: 5, from_user_id: 7, to_user_id: 10, score: 5, comment: "Варды по кд, комфортно играть", created_at: "2026-11-21T19:40:00.000Z" },
        { id: 6, from_user_id: 10, to_user_id: 7, score: 5, comment: "Сильный мидер, всегда приходит на ганги", created_at: "2026-11-21T20:05:00.000Z" },
        { id: 7, from_user_id: 5, to_user_id: 13, score: 1, comment: "Руинил раунды и кричал в войс", created_at: "2026-11-22T23:10:00.000Z" },
        { id: 8, from_user_id: 9, to_user_id: 13, score: 2, comment: "Вставал AFK после проигранной пистолетки", created_at: "2026-11-23T00:05:00.000Z" }
      ],
      reports: [
        { id: 1, reporter_id: 5, target_user_id: 13, reason: "Оскорбления в голосовом чате во время игры", status: "resolved", moderator_id: 2, action_taken: "mute", created_at: "2026-11-22T23:20:00.000Z" },
        { id: 2, reporter_id: 9, target_user_id: 13, reason: "Фейковый ранг и токсичное описание профиля", status: "open", moderator_id: null, action_taken: null, created_at: "2026-11-23T14:15:00.000Z" },
        { id: 3, reporter_id: 11, target_user_id: 13, reason: "Спам ссылками на сторонние рулетки в личные сообщения", status: "open", moderator_id: null, action_taken: null, created_at: "2026-11-24T11:30:00.000Z" },
        { id: 4, reporter_id: 7, target_user_id: 14, reason: "Подозрение на смурфинг на открытой квалификации", status: "dismissed", moderator_id: 2, action_taken: "none", created_at: "2026-11-23T18:00:00.000Z" },
        { id: 5, reporter_id: 4, target_user_id: 12, reason: "Не пришёл на запланированный прак без предупреждения (3 раза)", status: "open", moderator_id: null, action_taken: null, created_at: "2026-11-24T19:45:00.000Z" }
      ],
      audit_logs: [
        { id: 1, actor_id: 2, action: "report_resolved", target_type: "report", target_id: 1, details: { target_user_id: 13, action_taken: "mute", duration_hours: 72 }, created_at: "2026-11-22T23:25:00.000Z" },
        { id: 2, actor_id: 2, action: "report_dismissed", target_type: "report", target_id: 4, details: { target_user_id: 14, action_taken: "none" }, created_at: "2026-11-23T18:30:00.000Z" },
        { id: 3, actor_id: 1, action: "location_verified", target_type: "location", target_id: 1, details: { venue_name: "CyberArena Grodno", is_verified: true }, created_at: "2026-11-24T09:00:00.000Z" }
      ]
    };
    if (initial.accounts[2]) {
      initial.accounts[2].external_links.verified_organizer = true;
    }
    return initial;
  }

  function saveExtendedSeed(data) {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(ADMIN_SEED_KEY, JSON.stringify(data));
      }
    } catch (_) {}
  }

  function buildSeedFullProfile(ext, userId, includePrivate) {
    const acc = ext.accounts.find((u) => u.id === Number(userId));
    if (!acc) return null;
    const disciplines = ext.profile_disciplines
      .filter((pd) => pd.profile_id === acc.id)
      .map((pd) => {
        const d = ext.dictionaries.disciplines.find((x) => x.id === pd.discipline_id) || {};
        const r = ext.dictionaries.discipline_roles.find((x) => x.id === pd.role_id) || {};
        const rk = ext.dictionaries.ranks.find((x) => x.id === pd.rank_id) || {};
        return {
          id: pd.id,
          discipline_id: pd.discipline_id,
          discipline_name: d.name || "",
          category: d.category || "esports",
          role_id: pd.role_id,
          role_name: r.name || "",
          rank_id: pd.rank_id,
          rank_name: rk.name || "",
          rank_order: rk.sort_order || 0
        };
      });
    const ratings_count = ext.trust_ratings.filter((tr) => tr.to_user_id === acc.id).length;
    const profile = {
      id: acc.id,
      role: acc.role,
      status: acc.status,
      ban_until: acc.ban_until,
      created_at: acc.created_at,
      nickname: acc.nickname,
      avatar_url: acc.avatar_url,
      prime_time: acc.prime_time,
      bio: acc.bio,
      contacts: { ...(acc.contacts || {}) },
      external_links: { ...(acc.external_links || {}) },
      trust_score: Number(acc.trust_score),
      ratings_count,
      disciplines
    };
    if (includePrivate) profile.email = acc.email;
    return profile;
  }

  Object.assign(MPApi, {
    async getProfileCatalog() {
      try {
        return await this.get("/api/profile/catalog");
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const catalog = ext.dictionaries.disciplines.map((d) => ({
          ...d,
          roles: ext.dictionaries.discipline_roles.filter((r) => r.discipline_id === d.id),
          ranks: ext.dictionaries.ranks.filter((r) => r.discipline_id === d.id)
        }));
        return { disciplines: catalog, source: "seed" };
      }
    },

    async getMyProfile() {
      try {
        return await this.get("/api/profile/me");
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const uid = global.MPStorage?.getUser()?.id || 5;
        return { profile: buildSeedFullProfile(ext, uid, true), source: "seed" };
      }
    },

    async getProfile(userId) {
      try {
        return await this.get(`/api/profile/${Number(userId)}`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const profile = buildSeedFullProfile(ext, userId, false);
        if (!profile) throw new Error("Профиль не найден");
        return { profile, source: "seed" };
      }
    },

    async updateMyProfile(payload) {
      try {
        return await this.put("/api/profile/me", payload);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const uid = global.MPStorage?.getUser()?.id || 5;
        const acc = ext.accounts.find((u) => u.id === uid);
        if (!acc) throw new Error("Профиль не найден");
        ["nickname", "avatar_url", "prime_time", "bio", "contacts", "external_links"].forEach((k) => {
          if (Object.prototype.hasOwnProperty.call(payload, k)) acc[k] = payload[k];
        });
        saveExtendedSeed(ext);
        if (global.MPStorage) {
          const cur = global.MPStorage.getUser();
          global.MPStorage.setUser({ ...cur, nickname: acc.nickname, avatar_url: acc.avatar_url });
        }
        return { profile: buildSeedFullProfile(ext, uid, true), source: "seed" };
      }
    },

    async upsertMyDiscipline({ discipline_id, role_id, rank_id }) {
      const body = {
        discipline_id: Number(discipline_id),
        role_id: role_id ? Number(role_id) : null,
        rank_id: rank_id ? Number(rank_id) : null
      };
      try {
        return await this.put("/api/profile/me/disciplines", body);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const uid = global.MPStorage?.getUser()?.id || 5;
        const idx = ext.profile_disciplines.findIndex(
          (pd) => pd.profile_id === uid && pd.discipline_id === body.discipline_id
        );
        if (idx >= 0) {
          ext.profile_disciplines[idx].role_id = body.role_id;
          ext.profile_disciplines[idx].rank_id = body.rank_id;
        } else {
          ext.profile_disciplines.push({ id: Date.now(), profile_id: uid, ...body });
        }
        saveExtendedSeed(ext);
        return { disciplines: buildSeedFullProfile(ext, uid, true).disciplines, source: "seed" };
      }
    },

    async deleteMyDiscipline(disciplineId) {
      try {
        return await this.delete(`/api/profile/me/disciplines/${Number(disciplineId)}`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const uid = global.MPStorage?.getUser()?.id || 5;
        ext.profile_disciplines = ext.profile_disciplines.filter(
          (pd) => !(pd.profile_id === uid && pd.discipline_id === Number(disciplineId))
        );
        saveExtendedSeed(ext);
        return { message: "Дисциплина удалена из профиля", source: "seed" };
      }
    },

    async getProfileRatings(userId) {
      try {
        return await this.get(`/api/profile/${Number(userId)}/ratings`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const ratings = ext.trust_ratings
          .filter((tr) => tr.to_user_id === Number(userId))
          .map((tr) => {
            const from = ext.accounts.find((a) => a.id === tr.from_user_id) || {};
            return {
              ...tr,
              from_nickname: from.nickname || `User #${tr.from_user_id}`,
              from_avatar_url: from.avatar_url || ""
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach((r) => { distribution[r.score] = (distribution[r.score] || 0) + 1; });
        return { ratings, total: ratings.length, distribution, source: "seed" };
      }
    },

    async getMyTeammates() {
      try {
        return await this.get("/api/profile/me/teammates");
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const runtime = loadSeedRuntime();
        const uid = global.MPStorage?.getUser()?.id || 5;
        const partnerIds = new Set();
        runtime.matches.forEach((m) => {
          if (m.user1_id === uid) partnerIds.add(m.user2_id);
          if (m.user2_id === uid) partnerIds.add(m.user1_id);
        });
        const teammates = Array.from(partnerIds).map((pid) => {
          const acc = ext.accounts.find((a) => a.id === pid);
          if (!acc) return null;
          const myRating = ext.trust_ratings.find((tr) => tr.from_user_id === uid && tr.to_user_id === pid);
          return {
            id: acc.id,
            role: acc.role,
            status: acc.status,
            nickname: acc.nickname,
            avatar_url: acc.avatar_url,
            trust_score: Number(acc.trust_score),
            relation: "match",
            my_score: myRating ? myRating.score : null,
            my_comment: myRating ? myRating.comment : null
          };
        }).filter(Boolean);
        return { teammates, source: "seed" };
      }
    },

    async rateUser(userId, { score, comment }) {
      const body = { score: Number(score), comment: String(comment || "").trim() };
      try {
        return await this.post(`/api/profile/${Number(userId)}/rate`, body);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const uid = global.MPStorage?.getUser()?.id || 5;
        const tid = Number(userId);
        if (uid === tid) throw new Error("Нельзя оценить самого себя");
        const existing = ext.trust_ratings.find((tr) => tr.from_user_id === uid && tr.to_user_id === tid);
        if (existing) {
          existing.score = body.score;
          existing.comment = body.comment;
          existing.created_at = new Date().toISOString();
        } else {
          ext.trust_ratings.push({
            id: Date.now(),
            from_user_id: uid,
            to_user_id: tid,
            score: body.score,
            comment: body.comment,
            created_at: new Date().toISOString()
          });
        }
        const received = ext.trust_ratings.filter((tr) => tr.to_user_id === tid);
        const avg = received.length
          ? Number((received.reduce((s, r) => s + r.score, 0) / received.length).toFixed(2))
          : 5.0;
        const target = ext.accounts.find((a) => a.id === tid);
        if (target) target.trust_score = avg;
        saveExtendedSeed(ext);
        return { message: "Оценка сохранена", trust_score: avg, source: "seed" };
      }
    },

    async getReports(status = "all") {
      const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
      try {
        return await this.get(`/api/reports${qs}`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const list = ext.reports
          .filter((r) => status === "all" || r.status === status)
          .map((r) => {
            const rep = ext.accounts.find((a) => a.id === r.reporter_id) || {};
            const tgt = ext.accounts.find((a) => a.id === r.target_user_id) || {};
            const mod = ext.accounts.find((a) => a.id === r.moderator_id) || {};
            return {
              ...r,
              reporter_nickname: rep.nickname || `User #${r.reporter_id}`,
              target_nickname: tgt.nickname || `User #${r.target_user_id}`,
              target_bio: tgt.bio || "",
              target_trust_score: Number(tgt.trust_score ?? 5),
              target_role: tgt.role || "player",
              target_status: tgt.status || "active",
              target_ban_until: tgt.ban_until || null,
              moderator_nickname: mod.nickname || null
            };
          })
          .sort((a, b) => (a.status === "open" ? -1 : 1) - (b.status === "open" ? -1 : 1));
        return { reports: list, source: "seed" };
      }
    },

    async resolveReport(reportId, payload) {
      try {
        return await this.patch(`/api/reports/${Number(reportId)}`, payload);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const actor = global.MPStorage?.getUser() || { id: 2, role: "moderator" };
        const rep = ext.reports.find((r) => r.id === Number(reportId));
        if (!rep) throw new Error("Жалоба не найдена");
        rep.status = payload.status;
        rep.action_taken = payload.action_taken || "none";
        rep.moderator_id = actor.id;
        if (payload.status === "resolved") {
          const tgt = ext.accounts.find((a) => a.id === rep.target_user_id);
          if (tgt) {
            if (payload.action_taken === "mute") {
              tgt.status = "muted";
              tgt.ban_until = new Date(Date.now() + (Number(payload.duration_hours) || 24) * 3600 * 1000).toISOString();
            } else if (payload.action_taken === "temp_ban") {
              tgt.status = "temp_banned";
              tgt.ban_until = new Date(Date.now() + (Number(payload.duration_hours) || 72) * 3600 * 1000).toISOString();
            } else if (payload.action_taken === "perm_ban") {
              tgt.status = "perm_banned";
              tgt.ban_until = null;
            }
          }
        }
        ext.audit_logs.unshift({
          id: Date.now(),
          actor_id: actor.id,
          action: `report_${payload.status}`,
          target_type: "report",
          target_id: rep.id,
          details: { target_user_id: rep.target_user_id, action_taken: rep.action_taken },
          created_at: new Date().toISOString()
        });
        saveExtendedSeed(ext);
        return { message: "Жалоба обработана", report: rep, source: "seed" };
      }
    },

    async getAdminUsers(filters = {}) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== "all") qs.set(k, String(v));
      });
      const q = qs.toString() ? `?${qs.toString()}` : "";
      try {
        return await this.get(`/api/admin/users${q}`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const search = String(filters.search || "").trim().toLowerCase();
        const users = ext.accounts
          .filter((u) => (!filters.role || filters.role === "all" || u.role === filters.role))
          .filter((u) => (!filters.status || filters.status === "all" || u.status === filters.status))
          .filter((u) => (!search || u.nickname.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)))
          .map((u) => ({
            ...u,
            trust_score: Number(u.trust_score),
            verified_organizer: Boolean(u.external_links?.verified_organizer),
            reports_count: ext.reports.filter((r) => r.target_user_id === u.id).length,
            open_reports_count: ext.reports.filter((r) => r.target_user_id === u.id && r.status === "open").length
          }));
        return { users, source: "seed" };
      }
    },

    async updateAdminUser(userId, payload) {
      try {
        return await this.patch(`/api/admin/users/${Number(userId)}`, payload);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const actor = global.MPStorage?.getUser() || { id: 1, role: "admin" };
        const tgt = ext.accounts.find((u) => u.id === Number(userId));
        if (!tgt) throw new Error("Пользователь не найден");
        if (payload.role) tgt.role = payload.role;
        if (payload.status) {
          tgt.status = payload.status;
          tgt.ban_until = (payload.status === "muted" || payload.status === "temp_banned")
            ? new Date(Date.now() + (Number(payload.duration_hours) || 24) * 3600 * 1000).toISOString()
            : null;
        }
        if (payload.verified_organizer !== undefined) {
          tgt.external_links = { ...(tgt.external_links || {}) };
          if (payload.verified_organizer) tgt.external_links.verified_organizer = true;
          else delete tgt.external_links.verified_organizer;
        }
        ext.audit_logs.unshift({
          id: Date.now(),
          actor_id: actor.id,
          action: "user_updated",
          target_type: "user",
          target_id: tgt.id,
          details: payload,
          created_at: new Date().toISOString()
        });
        saveExtendedSeed(ext);
        return { message: "Пользователь обновлён", user: tgt, source: "seed" };
      }
    },

    async addDictionaryItem(payload) {
      try {
        return await this.post("/api/admin/dictionaries", payload);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const actor = global.MPStorage?.getUser() || { id: 1 };
        const id = Date.now();
        let item;
        if (payload.type === "discipline") {
          item = { id, name: payload.name, category: payload.category };
          ext.dictionaries.disciplines.push(item);
        } else if (payload.type === "role") {
          item = { id, discipline_id: Number(payload.discipline_id), name: payload.name };
          ext.dictionaries.discipline_roles.push(item);
        } else if (payload.type === "rank") {
          item = { id, discipline_id: Number(payload.discipline_id), name: payload.name, sort_order: Number(payload.sort_order) || 1 };
          ext.dictionaries.ranks.push(item);
        } else if (payload.type === "location") {
          item = { id, city: payload.city, venue_name: payload.venue_name, address: payload.address, is_verified: Boolean(payload.is_verified) };
          ext.dictionaries.locations.push(item);
        }
        ext.audit_logs.unshift({
          id: Date.now() + 1,
          actor_id: actor.id,
          action: "dictionary_created",
          target_type: payload.type,
          target_id: id,
          details: item || payload,
          created_at: new Date().toISOString()
        });
        saveExtendedSeed(ext);
        return { item, source: "seed" };
      }
    },

    async toggleLocationVerified(id, is_verified) {
      try {
        return await this.patch(`/api/admin/dictionaries/location/${Number(id)}`, { is_verified: Boolean(is_verified) });
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const loc = ext.dictionaries.locations.find((l) => l.id === Number(id));
        if (!loc) throw new Error("Локация не найдена");
        loc.is_verified = Boolean(is_verified);
        saveExtendedSeed(ext);
        return { item: loc, source: "seed" };
      }
    },

    async deleteDictionaryItem(type, id) {
      try {
        return await this.delete(`/api/admin/dictionaries/${encodeURIComponent(type)}/${Number(id)}`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const map = { discipline: "disciplines", role: "discipline_roles", rank: "ranks", location: "locations" };
        const key = map[type];
        if (key) {
          ext.dictionaries[key] = ext.dictionaries[key].filter((x) => x.id !== Number(id));
        }
        saveExtendedSeed(ext);
        return { message: "Запись удалена", source: "seed" };
      }
    },

    async getAdminStats() {
      try {
        return await this.get("/api/admin/stats");
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const runtime = loadSeedRuntime();
        const users_by_role = {};
        const users_by_status = {};
        ext.accounts.forEach((u) => {
          users_by_role[u.role] = (users_by_role[u.role] || 0) + 1;
          users_by_status[u.status] = (users_by_status[u.status] || 0) + 1;
        });
        const reports = { open: 0, resolved: 0, dismissed: 0 };
        ext.reports.forEach((r) => { reports[r.status] = (reports[r.status] || 0) + 1; });
        const avg = Number(
          (ext.accounts.reduce((s, u) => s + Number(u.trust_score || 5), 0) / ext.accounts.length).toFixed(2)
        );
        return {
          users_total: ext.accounts.length,
          users_by_role,
          users_by_status,
          reports,
          matches_count: runtime.matches.length,
          teams_count: runtime.teams.length,
          events_count: 3,
          ratings_count: ext.trust_ratings.length,
          avg_trust_score: avg,
          low_trust_count: ext.accounts.filter((u) => Number(u.trust_score) < 3.5).length,
          source: "seed"
        };
      }
    },

    async getAdminLogs() {
      try {
        return await this.get("/api/admin/logs");
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        const ext = loadExtendedSeed();
        const logs = ext.audit_logs.map((l) => {
          const actor = ext.accounts.find((a) => a.id === l.actor_id) || {};
          return { ...l, actor_nickname: actor.nickname || `User #${l.actor_id}` };
        });
        return { logs, source: "seed" };
      }
    }
  });
  global.MPApi = MPApi;
})(typeof window !== "undefined" ? window : globalThis);
