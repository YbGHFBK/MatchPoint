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

  global.MPApi = MPApi;
})(typeof window !== "undefined" ? window : globalThis);
