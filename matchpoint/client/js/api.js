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

 const SESSION_STATE_KEY = "mp_seed_runtime_state_v5";

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
    },
    {
      id: 15, email: "sniper@matchpoint.dev", role: "player", status: "active",
      nickname: "SniperNova", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=SniperNova",
      prime_time: "20:00-01:00", bio: "AWP 2600 ELO на Faceit, стабильные опен-фраги на Mirage и Ancient.",
      contacts: { discord: "snipernova", telegram: "@sniper_nova" },
      external_links: { faceit: "https://www.faceit.com/en/players/SniperNova", steam: "https://steamcommunity.com/id/snipernova" }, trust_score: 4.92
    },
    {
      id: 16, email: "invoker@matchpoint.dev", role: "player", status: "active",
      nickname: "InvokerGod", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=InvokerGod",
      prime_time: "19:00-00:00", bio: "Мидер 6400 MMR (Invoker, Storm, Ember). Ищу активную четвёрку и капитана.",
      contacts: { discord: "invokergod" },
      external_links: { steam: "https://steamcommunity.com/id/invokergod" }, trust_score: 4.88
    },
    {
      id: 17, email: "clutch@matchpoint.dev", role: "player", status: "active",
      nickname: "ClutchFox", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=ClutchFox",
      prime_time: "18:30-23:30", bio: "Энтри-фраггер без тильта, 9 lvl Faceit. Готов катать пракки и турниры.",
      contacts: { discord: "clutchfox", telegram: "@clutch_fox" },
      external_links: { faceit: "https://www.faceit.com/en/players/ClutchFox" }, trust_score: 4.95
    },
    {
      id: 18, email: "mirage_cap@matchpoint.dev", role: "captain", status: "active",
      nickname: "MirageCap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=MirageCap",
      prime_time: "20:00-01:00", bio: "Капитан стака Minsk Mirage (CS2). Разбираем демки, готовимся к LAN.",
      contacts: { discord: "miragecap", telegram: "@minsk_mirage" },
      external_links: { faceit: "https://www.faceit.com/en/players/MirageCap" }, trust_score: 4.90
    },
    {
      id: 19, email: "roshan_cap@matchpoint.dev", role: "captain", status: "active",
      nickname: "RoshanLead", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=RoshanLead",
      prime_time: "19:00-00:00", bio: "Собираем состав по Dota 2 на Battle Cup и открытые квалификации.",
      contacts: { discord: "roshanlead" },
      external_links: { steam: "https://steamcommunity.com/id/roshanlead" }, trust_score: 4.84
    },
    {
      id: 20, email: "gocraft@matchpoint.dev", role: "player", status: "active",
      nickname: "GoCraft", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=GoCraft",
      prime_time: "20:00-02:00", bio: "Backend-разработчик (Go, PostgreSQL, Docker). Призёр 3 студенческих хакатонов.",
      contacts: { telegram: "@gocraft_dev" },
      external_links: { github: "https://github.com/gocraft" }, trust_score: 4.96
    },
    {
      id: 21, email: "figmawave@matchpoint.dev", role: "player", status: "active",
      nickname: "FigmaWave", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=FigmaWave",
      prime_time: "18:30-23:30", bio: "UI/UX дизайнер и верстальщик. Быстро собираю кликабельные прототипы и дизайн-системы.",
      contacts: { telegram: "@figma_wave", discord: "figmawave" },
      external_links: { github: "https://github.com/figmawave" }, trust_score: 4.91
    },
    {
      id: 22, email: "pitch@matchpoint.dev", role: "player", status: "active",
      nickname: "PitchMaster", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=PitchMaster",
      prime_time: "19:00-00:00", bio: "Тимлид и продакт на хакатоны: архитектура, презентация и защита перед жюри.",
      contacts: { telegram: "@pitch_master" },
      external_links: { github: "https://github.com/pitchmaster" }, trust_score: 4.87
    },
    {
      id: 23, email: "storm_cap@matchpoint.dev", role: "captain", status: "active",
      nickname: "StormLead", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=StormLead",
      prime_time: "20:00-02:00", bio: "Собираем веб-платформу на Winter CodeJam, нужен сильный фронтендер.",
      contacts: { telegram: "@bytestorm_lab" },
      external_links: { github: "https://github.com/bytestorm-lab" }, trust_score: 4.93
    },
    {
      id: 24, email: "neural_cap@matchpoint.dev", role: "captain", status: "active",
      nickname: "NeuralCap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=NeuralCap",
      prime_time: "22:00-03:00", bio: "Делаем AI-ассистента для геймеров, ищем ML-инженера в команду.",
      contacts: { telegram: "@neuralforge_ai" },
      external_links: { github: "https://github.com/neuralforge-ai" }, trust_score: 4.89
    },
    // --- Игроки киберспорта (25..29) ---
    {
      id: 25, email: "flashb@matchpoint.dev", role: "player", status: "active",
      nickname: "FlashBang", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=FlashBang",
      prime_time: "20:00-01:00", bio: "Саппорт в CS2: идеальные флешки под выход, знаю все смоки на Inferno и Anubis.",
      contacts: { discord: "flashbang_cs" }, external_links: { faceit: "https://www.faceit.com/en/players/FlashBang" }, trust_score: 4.94
    },
    {
      id: 26, email: "carry9k@matchpoint.dev", role: "player", status: "active",
      nickname: "PhantomFarm", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=PhantomFarm",
      prime_time: "19:00-00:00", bio: "Керри 5800 MMR (PA, Morph, Void). Фармлю стабильно, слушаю коллы капитана.",
      contacts: { discord: "phantomfarm", telegram: "@phantom_dota" }, external_links: { steam: "https://steamcommunity.com/id/phantomfarm" }, trust_score: 4.86
    },
    {
      id: 27, email: "iglpro@matchpoint.dev", role: "player", status: "active",
      nickname: "TacticMind", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=TacticMind",
      prime_time: "20:00-00:00", bio: "IGL в CS2, 2400 ELO. Люблю структурные раунды и спокойную коммуникацию.",
      contacts: { discord: "tacticmind" }, external_links: { faceit: "https://www.faceit.com/en/players/TacticMind" }, trust_score: 4.97
    },
    {
      id: 28, email: "roamer@matchpoint.dev", role: "player", status: "active",
      nickname: "SmokeGank", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=SmokeGank",
      prime_time: "18:30-23:30", bio: "Четвёрка в Dota 2 (Rubick, Earth Spirit, Tusk). Всегда на рунах и гангах мида.",
      contacts: { discord: "smokegank" }, external_links: { steam: "https://steamcommunity.com/id/smokegank" }, trust_score: 4.91
    },
    {
      id: 29, email: "anchor@matchpoint.dev", role: "player", status: "active",
      nickname: "SiteAnchor", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=SiteAnchor",
      prime_time: "22:00-03:00", bio: "Опорник Б в CS2 (7 lvl Faceit). Держу плэнт до последнего, играю поздно вечером.",
      contacts: { discord: "siteanchor" }, external_links: { steam: "https://steamcommunity.com/id/siteanchor" }, trust_score: 4.82
    },

    // --- Капитаны команд игроков (30..34) ---
    {
      id: 30, email: "cap_brest@matchpoint.dev", role: "captain", status: "active",
      nickname: "BrestIGL", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=BrestIGL",
      prime_time: "20:00-01:00", bio: "Собираем крепкий состав по CS2 на ESEA Open и локальные LAN.",
      contacts: { discord: "brest_igl", telegram: "@brest_cs2" }, external_links: { faceit: "https://www.faceit.com/en/players/BrestIGL" }, trust_score: 4.93
    },
    {
      id: 31, email: "cap_inferno@matchpoint.dev", role: "captain", status: "active",
      nickname: "InfernoBoss", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=InfernoBoss",
      prime_time: "19:00-00:00", bio: "Команда 8-10 lvl Faceit, тренируемся 3 раза в неделю с тренером.",
      contacts: { discord: "infernoboss" }, external_links: { faceit: "https://www.faceit.com/en/players/InfernoBoss" }, trust_score: 4.89
    },
    {
      id: 32, email: "cap_dire@matchpoint.dev", role: "captain", status: "active",
      nickname: "DireDraft", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=DireDraft",
      prime_time: "18:30-23:30", bio: "Драфтер и капитан Dota 2 стака, играем каждые выходные Battle Cup.",
      contacts: { discord: "diredraft" }, external_links: { steam: "https://steamcommunity.com/id/diredraft" }, trust_score: 4.90
    },
    {
      id: 33, email: "cap_ancient@matchpoint.dev", role: "captain", status: "active",
      nickname: "RuneControl", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=RuneControl",
      prime_time: "20:00-02:00", bio: "Ищем стабильную пятёрку в сыгранный Dota 2 ростер 4500+ MMR.",
      contacts: { discord: "runecontrol" }, external_links: { steam: "https://steamcommunity.com/id/runecontrol" }, trust_score: 4.85
    },
    {
      id: 34, email: "cap_clutch@matchpoint.dev", role: "captain", status: "active",
      nickname: "OvertimeCap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=OvertimeCap",
      prime_time: "20:00-00:00", bio: "Ночной CS2 микс на фейсит и студенческую лигу.",
      contacts: { discord: "overtimecap" }, external_links: { faceit: "https://www.faceit.com/en/players/OvertimeCap" }, trust_score: 4.88
    },

    // --- Разработчики (35..39) ---
    {
      id: 35, email: "rustdev@matchpoint.dev", role: "player", status: "active",
      nickname: "Rustacean", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=Rustacean",
      prime_time: "20:00-02:00", bio: "Пишу быстрые сервисы на Rust и Node.js, поднимаю Docker и CI/CD за 15 минут.",
      contacts: { telegram: "@rustacean_by" }, external_links: { github: "https://github.com/rustacean-by" }, trust_score: 4.98
    },
    {
      id: 36, email: "reactui@matchpoint.dev", role: "player", status: "active",
      nickname: "CssWizard", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=CssWizard",
      prime_time: "19:00-00:00", bio: "Frontend (React, TypeScript, CSS-анимации). Люблю пиксель-арт и адаптивную вёрстку.",
      contacts: { telegram: "@css_wizard", discord: "csswizard" }, external_links: { github: "https://github.com/csswizard" }, trust_score: 4.92
    },
    {
      id: 37, email: "cvml@matchpoint.dev", role: "player", status: "active",
      nickname: "VisionNet", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=VisionNet",
      prime_time: "20:00-01:00", bio: "Computer Vision & LLM инженер (PyTorch, FastAPI). Сделаю рабочий ML-бэкенд на хакатон.",
      contacts: { telegram: "@vision_net_ml" }, external_links: { github: "https://github.com/visionnet-ml" }, trust_score: 4.95
    },
    {
      id: 38, email: "uxpro@matchpoint.dev", role: "player", status: "active",
      nickname: "PixelMuse", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=PixelMuse",
      prime_time: "18:30-23:30", bio: "Product & UI/UX дизайнер: Figma, интерактивные макеты, презентации для жюри.",
      contacts: { telegram: "@pixel_muse_ux" }, external_links: { github: "https://github.com/pixelmuse" }, trust_score: 4.90
    },
    {
      id: 39, email: "fullstack@matchpoint.dev", role: "player", status: "active",
      nickname: "ApiBuilder", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=ApiBuilder",
      prime_time: "22:00-03:00", bio: "Junior+ Backend/Fullstack (Python, Express, SQL). Быстро учусь, готов тащить задачи ночью.",
      contacts: { telegram: "@apibuilder_dev" }, external_links: { github: "https://github.com/apibuilder" }, trust_score: 4.84
    },

    // --- Капитаны команд разработчиков (40..44) ---
    {
      id: 40, email: "hack_fin@matchpoint.dev", role: "captain", status: "active",
      nickname: "FinTechLead", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=FinTechLead",
      prime_time: "19:00-00:00", bio: "Собираем команду на FinTech-трек хакатона, есть идея и готовая архитектура.",
      contacts: { telegram: "@fintech_lead" }, external_links: { github: "https://github.com/fintech-squad" }, trust_score: 4.94
    },
    {
      id: 41, email: "hack_game@matchpoint.dev", role: "captain", status: "active",
      nickname: "GameJamCap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=GameJamCap",
      prime_time: "20:00-02:00", bio: "Делаем браузерную 16-битную игру на GameDev-трек, нужен дизайнер/художник.",
      contacts: { telegram: "@gamejam_cap", discord: "gamejamcap" }, external_links: { github: "https://github.com/gamejam-crew" }, trust_score: 4.91
    },
    {
      id: 42, email: "hack_edu@matchpoint.dev", role: "captain", status: "active",
      nickname: "EduTechBoss", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=EduTechBoss",
      prime_time: "18:30-23:30", bio: "Строим AI-тренажёр для студентов, нужен сильный Backend на Node/Python.",
      contacts: { telegram: "@edutech_boss" }, external_links: { github: "https://github.com/edutech-lab" }, trust_score: 4.89
    },
    {
      id: 43, email: "hack_sec@matchpoint.dev", role: "captain", status: "active",
      nickname: "CyberSecCap", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=CyberSecCap",
      prime_time: "20:00-01:00", bio: "Команда на CTF и Web-трек, ищем фронтендера для дашборда мониторинга.",
      contacts: { telegram: "@cybersec_cap" }, external_links: { github: "https://github.com/cybersec-team" }, trust_score: 4.96
    },
    {
      id: 44, email: "hack_pitch@matchpoint.dev", role: "captain", status: "active",
      nickname: "StartupCrew", avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=StartupCrew",
      prime_time: "19:00-00:00", bio: "Два разраба + ML готовы к CodeJam, нужен тимлид/питчер на защиту проекта.",
      contacts: { telegram: "@startup_crew_by" }, external_links: { github: "https://github.com/startup-crew" }, trust_score: 4.87
    }
  ];

  // --- profile_disciplines из 02_seed.sql ---
  const SEED_PROFILE_DISCIPLINES = [
    { profile_id: 1,  discipline_id: 3, role_id: 11, rank_id: 11 },
    { profile_id: 2,  discipline_id: 1, role_id: 4,  rank_id: 2 },
    { profile_id: 3,  discipline_id: 1, role_id: 5,  rank_id: 3 },
    { profile_id: 4,  discipline_id: 1, role_id: 5,  rank_id: 3 },
    { profile_id: 5,  discipline_id: 1, role_id: 2,  rank_id: 2 },
    { profile_id: 5,  discipline_id: 3, role_id: 11, rank_id: 10 },
    { profile_id: 6,  discipline_id: 2, role_id: 6,  rank_id: 5 },
    { profile_id: 7,  discipline_id: 2, role_id: 7,  rank_id: 7 },
    { profile_id: 8,  discipline_id: 3, role_id: 11, rank_id: 10 },
    { profile_id: 8,  discipline_id: 2, role_id: 8,  rank_id: 6 },
    { profile_id: 9,  discipline_id: 1, role_id: 1,  rank_id: 4 },
    { profile_id: 10, discipline_id: 2, role_id: 10, rank_id: 7 },
    { profile_id: 11, discipline_id: 3, role_id: 12, rank_id: 10 },
    { profile_id: 11, discipline_id: 1, role_id: 3,  rank_id: 2 },
    { profile_id: 12, discipline_id: 3, role_id: 13, rank_id: 10 },
    { profile_id: 12, discipline_id: 2, role_id: 9,  rank_id: 6 },
    { profile_id: 13, discipline_id: 1, role_id: 2,  rank_id: 2 },
    { profile_id: 14, discipline_id: 1, role_id: 3,  rank_id: 3 },
    { profile_id: 15, discipline_id: 1, role_id: 1,  rank_id: 4 },
    { profile_id: 16, discipline_id: 2, role_id: 7,  rank_id: 8 },
    { profile_id: 17, discipline_id: 1, role_id: 2,  rank_id: 3 },
    { profile_id: 18, discipline_id: 1, role_id: 5,  rank_id: 4 },
    { profile_id: 19, discipline_id: 2, role_id: 10, rank_id: 7 },
    { profile_id: 20, discipline_id: 3, role_id: 11, rank_id: 11 },
    { profile_id: 21, discipline_id: 3, role_id: 14, rank_id: 10 },
    { profile_id: 22, discipline_id: 3, role_id: 15, rank_id: 11 },
    { profile_id: 23, discipline_id: 3, role_id: 11, rank_id: 10 },
    { profile_id: 24, discipline_id: 3, role_id: 13, rank_id: 11 },
    { profile_id: 25, discipline_id: 1, role_id: 4,  rank_id: 3 },
    { profile_id: 26, discipline_id: 2, role_id: 6,  rank_id: 7 },
    { profile_id: 27, discipline_id: 1, role_id: 5,  rank_id: 4 },
    { profile_id: 28, discipline_id: 2, role_id: 9,  rank_id: 7 },
    { profile_id: 29, discipline_id: 1, role_id: 3,  rank_id: 2 },
    { profile_id: 30, discipline_id: 1, role_id: 5,  rank_id: 3 },
    { profile_id: 31, discipline_id: 1, role_id: 5,  rank_id: 4 },
    { profile_id: 32, discipline_id: 2, role_id: 10, rank_id: 7 },
    { profile_id: 33, discipline_id: 2, role_id: 7,  rank_id: 6 },
    { profile_id: 34, discipline_id: 1, role_id: 3,  rank_id: 3 },
    { profile_id: 35, discipline_id: 3, role_id: 11, rank_id: 11 },
    { profile_id: 36, discipline_id: 3, role_id: 12, rank_id: 10 },
    { profile_id: 37, discipline_id: 3, role_id: 13, rank_id: 11 },
    { profile_id: 38, discipline_id: 3, role_id: 14, rank_id: 10 },
    { profile_id: 39, discipline_id: 3, role_id: 11, rank_id: 9 },
    { profile_id: 40, discipline_id: 3, role_id: 15, rank_id: 11 },
    { profile_id: 41, discipline_id: 3, role_id: 12, rank_id: 10 },
    { profile_id: 42, discipline_id: 3, role_id: 13, rank_id: 10 },
    { profile_id: 43, discipline_id: 3, role_id: 11, rank_id: 11 },
    { profile_id: 44, discipline_id: 3, role_id: 11, rank_id: 10 }
  ];

  // --- teams из 02_seed.sql ---
  const INITIAL_TEAMS = [
    { id: 1,  captain_id: 4,  discipline_id: 1, name: "Grodno Five",      description: "Стак по CS2 на зимний LAN, тренируемся 4 раза в неделю.",               looking_for_role_id: 2,  members_count: 3 },
    { id: 2,  captain_id: 7,  discipline_id: 2, name: "Radiant Stack",    description: "Команда по Dota 2 на 5000+ MMR, нужен сильный керри.",                  looking_for_role_id: 6,  members_count: 3 },
    { id: 3,  captain_id: 8,  discipline_id: 3, name: "NullPointer Crew", description: "Собираем веб-сервис на CodeJam, нужен UI/UX дизайнер.",                 looking_for_role_id: 14, members_count: 3 },
    { id: 4,  captain_id: 30, discipline_id: 1, name: "Brest Syndicate",  description: "Сыгранная четвёрка CS2 на ESEA Open, ищем стабильного AWPer 8+ lvl.",   looking_for_role_id: 1,  members_count: 4 },
    { id: 5,  captain_id: 31, discipline_id: 1, name: "Inferno Kings",    description: "Тренировки 3 раза в неделю + разбор демок, нужен Entry Fragger.",        looking_for_role_id: 2,  members_count: 4 },
    { id: 6,  captain_id: 32, discipline_id: 2, name: "Dire Wolves",      description: "Состав на Battle Cup (5000+ MMR), ищем сильного мидера (Pos 2).",        looking_for_role_id: 7,  members_count: 4 },
    { id: 7,  captain_id: 33, discipline_id: 2, name: "Rune Guardians",   description: "Дружный стак 4500+ MMR без тильта, нужна пятёрка (Hard Support).",       looking_for_role_id: 10, members_count: 4 },
    { id: 8,  captain_id: 34, discipline_id: 1, name: "Overtime Five",    description: "Студенческая команда по CS2 на зимний кубок, ищем рифлера.",             looking_for_role_id: 3,  members_count: 4 },
    { id: 9,  captain_id: 40, discipline_id: 3, name: "FinFlow Squad",    description: "Делаем скоринг-сервис на FinTech-трек, нужен ML / Data Science.",        looking_for_role_id: 13, members_count: 3 },
    { id: 10, captain_id: 41, discipline_id: 3, name: "PixelForge Jam",   description: "Собираем 16-битную веб-игру за 36 часов, ищем UI/UX дизайнера.",         looking_for_role_id: 14, members_count: 3 },
    { id: 11, captain_id: 42, discipline_id: 3, name: "CampusAI Lab",     description: "AI-помощник для подготовки к экзаменам, нужен Backend (Node/Python).",   looking_for_role_id: 11, members_count: 3 },
    { id: 12, captain_id: 43, discipline_id: 3, name: "ZeroDay Shield",   description: "Дашборд безопасности на Web-трек, ищем Frontend-разработчика.",          looking_for_role_id: 12, members_count: 3 },
    { id: 13, captain_id: 44, discipline_id: 3, name: "ShipFast Crew",    description: "Сильный тех-стек уже собран, нужен Team Lead / Pitch для защиты.",       looking_for_role_id: 15, members_count: 3 }
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

  // --- Автономные сид-данные для teams.html и events.html (работа без Node.js/npm) ---
  const CATALOG_SEED_KEY = "mp_catalog_seed_state_v1";

  const INITIAL_LOCATIONS = [
    { id: 1, city: "Гродно", venue_name: "CyberArena Grodno", address: "ул. Советская 18", lat: 53.6834, lng: 23.8342, is_verified: true },
    { id: 2, city: "Минск", venue_name: "Meta Arena", address: "пр-т Победителей 84", lat: 53.9362, lng: 27.5105, is_verified: true },
    { id: 3, city: "Гродно", venue_name: "Технопарк / Коворкинг", address: "ул. Горького 91А", lat: 53.7042, lng: 23.8166, is_verified: true }
  ];

  const INITIAL_TEAM_MEMBERS = [
    // Grodno Five (id: 1)
    { team_id: 1, user_id: 4, role_id: 5, status: "accepted" },
    { team_id: 1, user_id: 9, role_id: 1, status: "accepted" },
    { team_id: 1, user_id: 14, role_id: 3, status: "accepted" },
    { team_id: 1, user_id: 5, role_id: 2, status: "pending" },
    // Radiant Stack (id: 2)
    { team_id: 2, user_id: 7, role_id: 7, status: "accepted" },
    { team_id: 2, user_id: 10, role_id: 10, status: "accepted" },
    { team_id: 2, user_id: 12, role_id: 9, status: "accepted" },
    // NullPointer Crew (id: 3)
    { team_id: 3, user_id: 8, role_id: 11, status: "accepted" },
    { team_id: 3, user_id: 11, role_id: 12, status: "accepted" },
    { team_id: 3, user_id: 12, role_id: 13, status: "accepted" },
    // Капитаны остальных команд из INITIAL_TEAMS
    { team_id: 4, user_id: 30, role_id: 5, status: "accepted" },
    { team_id: 5, user_id: 31, role_id: 5, status: "accepted" },
    { team_id: 6, user_id: 32, role_id: 10, status: "accepted" },
    { team_id: 7, user_id: 33, role_id: 7, status: "accepted" },
    { team_id: 8, user_id: 34, role_id: 3, status: "accepted" },
    { team_id: 9, user_id: 40, role_id: 15, status: "accepted" },
    { team_id: 10, user_id: 41, role_id: 12, status: "accepted" },
    { team_id: 11, user_id: 42, role_id: 13, status: "accepted" },
    { team_id: 12, user_id: 43, role_id: 11, status: "accepted" },
    { team_id: 13, user_id: 44, role_id: 11, status: "accepted" }
  ];

  const INITIAL_EVENTS = [
    {
      id: 1,
      organizer_id: 3,
      discipline_id: 1,
      location_id: 1,
      event_type: "esports",
      title: "MatchPoint Winter Cup: CS2 5x5",
      description: "Открытый LAN-турнир по Counter-Strike 2. Групповой этап + плей-офф Single Elimination.",
      start_at: "2026-12-12T09:00:00.000Z",
      max_participants: 16,
      status: "open",
      details: {
        subtype: "lan",
        format: "5x5",
        bracket_type: "single_elimination",
        prize_pool: "1500 BYN",
        map_pool: ["Mirage", "Inferno", "Ancient", "Anubis", "Nuke"]
      }
    },
    {
      id: 2,
      organizer_id: 3,
      discipline_id: 3,
      location_id: 3,
      event_type: "hackathon",
      title: "Winter CodeJam 2026",
      description: "36-часовой хакатон для студентов и разработчиков: от идеи до рабочего прототипа.",
      start_at: "2026-12-19T07:00:00.000Z",
      max_participants: 20,
      status: "open",
      details: {
        subtype: "hackathon",
        tracks: ["Web & SaaS", "AI / ML", "GameDev"],
        tech_stack: ["Node.js", "Python", "PostgreSQL", "HTML/CSS/JS"],
        team_size_limit: 4,
        submission_deadline: "2026-12-20T15:00:00.000Z"
      }
    }
  ];

  const INITIAL_EVENT_REGISTRATIONS = [
    { id: 1, event_id: 1, user_id: null, team_id: 1, repository_url: null, mentor: null, evaluation: null },
    { id: 2, event_id: 1, user_id: 11, team_id: null, repository_url: null, mentor: null, evaluation: null },
    { id: 3, event_id: 2, user_id: null, team_id: 3, repository_url: null, mentor: null, evaluation: null },
    { id: 4, event_id: 2, user_id: 5, team_id: null, repository_url: null, mentor: null, evaluation: null }
  ];

  const INITIAL_TOURNAMENT_MATCHES = [
    {
      id: 1,
      event_id: 1,
      round: 1,
      participant1_id: 1,
      participant2_id: 2,
      score: "13:11",
      proof_url: "https://example.com/proofs/match1_scoreboard.png",
      status: "disputed",
      winner_id: null
    }
  ];

  function loadCatalogSeed() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(CATALOG_SEED_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      teams: INITIAL_TEAMS.map((t) => ({ ...t })),
      team_members: INITIAL_TEAM_MEMBERS.map((m) => ({ ...m })),
      locations: INITIAL_LOCATIONS.map((l) => ({ ...l })),
      events: INITIAL_EVENTS.map((ev) => ({ ...ev, details: { ...ev.details } })),
      registrations: INITIAL_EVENT_REGISTRATIONS.map((r) => ({ ...r })),
      matches: INITIAL_TOURNAMENT_MATCHES.map((m) => ({ ...m }))
    };
  }

  function saveCatalogSeed(state) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(CATALOG_SEED_KEY, JSON.stringify(state));
      }
    } catch (_) {}
  }

  function makeHttpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
  }

  function getOfflineCurrentUser() {
    const stored = global.MPStorage && global.MPStorage.getUser();
    if (!stored || !stored.id || stored.role === "guest") return null;
    const seedAcc = SEED_ACCOUNTS.find((a) => a.id === Number(stored.id));
    return seedAcc ? { ...seedAcc, ...stored } : stored;
  }

  function formatSeedEvent(ev, state) {
    const disc = SEED_DICTIONARIES.disciplines.find((d) => d.id === Number(ev.discipline_id)) || {};
    const loc = ev.location_id ? state.locations.find((l) => l.id === Number(ev.location_id)) || null : null;
    const details = ev.details || {};
    const subtype = details.subtype || (ev.event_type === "hackathon" ? "hackathon" : ev.location_id ? "lan" : "online");
    const registrations_count = state.registrations.filter((r) => r.event_id === ev.id).length;
    return {
      ...ev,
      details,
      discipline_name: disc.name || "",
      category: disc.category || (ev.event_type === "hackathon" ? "it" : "esports"),
      subtype,
      location: loc,
      registrations_count
    };
  }

  function formatSeedRegistration(r, state) {
    let name = "Участник #" + r.id;
    if (r.team_id) {
      const team = state.teams.find((t) => t.id === Number(r.team_id));
      name = team ? team.name : "Команда #" + r.team_id;
    } else if (r.user_id) {
      const acc = SEED_ACCOUNTS.find((a) => a.id === Number(r.user_id));
      name = acc ? acc.nickname : "Игрок #" + r.user_id;
    }
    return { ...r, name };
  }

  function formatSeedTeamMember(m) {
    const acc = SEED_ACCOUNTS.find((a) => a.id === Number(m.user_id)) || {};
    const role = SEED_DICTIONARIES.discipline_roles.find((r) => r.id === Number(m.role_id)) || {};
    return {
      ...m,
      nickname: acc.nickname || "User #" + m.user_id,
      role_name: role.name || null
    };
  }

  function tryCatalogOfflineFallback(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const parsedUrl = new URL(path, "http://localhost");
    const pathname = parsedUrl.pathname;
    let body = {};
    if (options.body) {
      try { body = JSON.parse(options.body); } catch (_) {}
    }

    // 1. Auth endpoints, вызываемые напрямую из catalog.js
    if (pathname === "/api/auth/me" && method === "GET") {
      const current = getOfflineCurrentUser();
      if (!current) throw makeHttpError(401, "Требуется авторизация");
      return { user: current, source: "seed" };
    }
    if (pathname === "/api/auth/login" && method === "POST") {
      const cleanEmail = String(body.email || "").trim().toLowerCase();
      const found = SEED_ACCOUNTS.find((u) => u.email === cleanEmail);
      if (!found || body.password !== "password") {
        throw makeHttpError(401, "Неверный email или пароль (для сид-аккаунтов пароль: password)");
      }
      return { token: `demo_jwt_user_${found.id}`, user: found, source: "seed" };
    }

    // 2. Teams endpoints (/api/teams...)
    if (pathname === "/api/teams" && method === "GET") {
      const state = loadCatalogSeed();
      const teams = state.teams
        .map((t) => {
          const disc = SEED_DICTIONARIES.disciplines.find((d) => d.id === Number(t.discipline_id)) || {};
          const role = SEED_DICTIONARIES.discipline_roles.find((r) => r.id === Number(t.looking_for_role_id)) || {};
          const members_count = state.team_members.filter((m) => m.team_id === t.id && m.status === "accepted").length || t.members_count || 1;
          return {
            ...t,
            discipline_name: disc.name || "",
            looking_for_role_name: role.name || null,
            members_count
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id - b.id);
      return { teams, source: "seed" };
    }

    if (pathname === "/api/teams" && method === "POST") {
      const current = getOfflineCurrentUser();
      if (!current) throw makeHttpError(401, "Требуется авторизация");
      if (current.role !== "captain") throw makeHttpError(403, "Доступно только капитану");
      const name = String(body.name || "").trim();
      if (name.length < 3 || name.length > 50) throw makeHttpError(400, "Укажите корректное название команды");
      const state = loadCatalogSeed();
      const nextId = state.teams.reduce((m, t) => Math.max(m, t.id), 0) + 1;
      const newTeam = {
        id: nextId,
        captain_id: current.id,
        discipline_id: Number(body.discipline_id) || 1,
        name,
        description: body.description || null,
        looking_for_role_id: body.looking_for_role_id ? Number(body.looking_for_role_id) : null,
        members_count: 1
      };
      state.teams.push(newTeam);
      state.team_members.push({ team_id: nextId, user_id: current.id, role_id: null, status: "accepted" });
      saveCatalogSeed(state);
      return { team: newTeam, source: "seed" };
    }

    const teamMatch = pathname.match(/^\/api\/teams\/(\d+)(?:\/(applications|vacancy|members))?$/);
    if (teamMatch) {
      const teamId = Number(teamMatch[1]);
      const sub = teamMatch[2] || "";
      const state = loadCatalogSeed();
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) throw makeHttpError(404, "Команда не найдена");

      if (!sub && method === "GET") {
        const disc = SEED_DICTIONARIES.disciplines.find((d) => d.id === Number(team.discipline_id)) || {};
        const role = SEED_DICTIONARIES.discipline_roles.find((r) => r.id === Number(team.looking_for_role_id)) || {};
        const cap = SEED_ACCOUNTS.find((a) => a.id === Number(team.captain_id)) || {};
        const members = state.team_members
          .filter((m) => m.team_id === teamId && m.status === "accepted")
          .map(formatSeedTeamMember);
        const registered_event_ids = state.registrations
          .filter((r) => r.team_id === teamId)
          .map((r) => r.event_id);
        return {
          team: {
            ...team,
            discipline_name: disc.name || "",
            looking_for_role_name: role.name || null,
            captain_nickname: cap.nickname || "Капитан",
            registered_event_ids,
            members
          },
          source: "seed"
        };
      }

      if (sub === "applications" && method === "GET") {
        const applications = state.team_members
          .filter((m) => m.team_id === teamId && m.status === "pending")
          .map(formatSeedTeamMember);
        return { applications, source: "seed" };
      }

      if (sub === "applications" && method === "POST") {
        const current = getOfflineCurrentUser();
        if (!current) throw makeHttpError(401, "Требуется авторизация");
        const exists = state.team_members.find((m) => m.team_id === teamId && m.user_id === current.id);
        if (exists) throw makeHttpError(409, "Вы уже подали заявку или состоите в команде");
        const app = { team_id: teamId, user_id: current.id, role_id: team.looking_for_role_id || null, status: "pending" };
        state.team_members.push(app);
        saveCatalogSeed(state);
        return { application: app, source: "seed" };
      }

      if (sub === "vacancy" && method === "PATCH") {
        team.looking_for_role_id = body.looking_for_role_id ? Number(body.looking_for_role_id) : null;
        saveCatalogSeed(state);
        return { team, source: "seed" };
      }

      if (sub === "members" && method === "PATCH") {
        const uid = Number(body.user_id);
        if (body.action === "accept") {
          const m = state.team_members.find((x) => x.team_id === teamId && x.user_id === uid);
          if (m) m.status = "accepted";
        } else if (body.action === "kick") {
          state.team_members = state.team_members.filter((x) => !(x.team_id === teamId && x.user_id === uid));
        }
        saveCatalogSeed(state);
        return { ok: true, source: "seed" };
      }
    }

    // 3. Events endpoints (/api/events...)
    if (pathname === "/api/events/locations" && method === "GET") {
      const state = loadCatalogSeed();
      return { locations: state.locations, source: "seed" };
    }

    if (pathname === "/api/events" && method === "GET") {
      const state = loadCatalogSeed();
      const cat = parsedUrl.searchParams.get("category");
      const etype = parsedUrl.searchParams.get("event_type");
      const kind = parsedUrl.searchParams.get("subtype");
      const st = parsedUrl.searchParams.get("status");
      const events = state.events
        .map((ev) => formatSeedEvent(ev, state))
        .filter((ev) => (!cat || ev.category === cat) && (!etype || ev.event_type === etype) && (!kind || ev.subtype === kind) && (!st || ev.status === st))
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at) || a.id - b.id);
      return { events, source: "seed" };
    }

    if (pathname === "/api/events" && method === "POST") {
      const current = getOfflineCurrentUser();
      if (!current) throw makeHttpError(401, "Требуется авторизация");
      if (current.role !== "organizer") throw makeHttpError(403, "Доступно только организатору");
      const state = loadCatalogSeed();
      const nextId = state.events.reduce((m, ev) => Math.max(m, ev.id), 0) + 1;
      const newEvent = {
        id: nextId,
        organizer_id: current.id,
        discipline_id: Number(body.discipline_id) || 1,
        location_id: body.location_id ? Number(body.location_id) : null,
        event_type: body.event_type || "esports",
        title: String(body.title || "").trim(),
        description: body.description || "",
        start_at: body.start_at || new Date().toISOString(),
        max_participants: Number(body.max_participants) || 16,
        status: "open",
        details: body.details || {}
      };
      state.events.push(newEvent);
      saveCatalogSeed(state);
      return { event: formatSeedEvent(newEvent, state), source: "seed" };
    }

    const eventMatch = pathname.match(/^\/api\/events\/(\d+)(?:\/(register|registrations\/me|registrations(?:\/(\d+))?|bracket|result))?$/);
    if (eventMatch) {
      const eventId = Number(eventMatch[1]);
      const sub = eventMatch[2] || "";
      const regId = eventMatch[3] ? Number(eventMatch[3]) : null;
      const state = loadCatalogSeed();
      const ev = state.events.find((x) => x.id === eventId);
      if (!ev) throw makeHttpError(404, "Ивент не найден");

      if (!sub && method === "GET") {
        return { event: formatSeedEvent(ev, state), source: "seed" };
      }

      if (!sub && method === "PATCH") {
        if (body.theme !== undefined) ev.details = { ...(ev.details || {}), theme: body.theme };
        if (body.schedule !== undefined) ev.details = { ...(ev.details || {}), schedule: body.schedule };
        if (body.start_at !== undefined) ev.start_at = body.start_at;
        if (body.location_id !== undefined) ev.location_id = body.location_id;
        if (body.status !== undefined) ev.status = body.status;
        saveCatalogSeed(state);
        return { event: formatSeedEvent(ev, state), source: "seed" };
      }

      if (sub === "register" && method === "POST") {
        const current = getOfflineCurrentUser();
        if (!current) throw makeHttpError(401, "Требуется авторизация");
        const teamId = body.team_id ? Number(body.team_id) : null;
        const dup = state.registrations.find((r) => r.event_id === eventId && (teamId ? r.team_id === teamId : r.user_id === current.id));
        if (dup) throw makeHttpError(409, "Регистрация уже существует");
        const nextId = state.registrations.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        const reg = {
          id: nextId,
          event_id: eventId,
          user_id: teamId ? null : current.id,
          team_id: teamId,
          repository_url: null,
          mentor: null,
          evaluation: null
        };
        state.registrations.push(reg);
        saveCatalogSeed(state);
        return { registration: formatSeedRegistration(reg, state), source: "seed" };
      }

      if (sub === "registrations/me" && method === "GET") {
        const current = getOfflineCurrentUser();
        if (!current) return { registrations: [], source: "seed" };
        const myTeamIds = new Set(
          state.teams.filter((t) => t.captain_id === current.id).map((t) => t.id)
        );
        state.team_members
          .filter((m) => m.user_id === current.id && m.status === "accepted")
          .forEach((m) => myTeamIds.add(m.team_id));
        const registrations = state.registrations
          .filter((r) => r.event_id === eventId && (r.user_id === current.id || (r.team_id && myTeamIds.has(r.team_id))))
          .map((r) => formatSeedRegistration(r, state));
        return { registrations, source: "seed" };
      }

      if (sub === "registrations" && method === "GET") {
        const registrations = state.registrations
          .filter((r) => r.event_id === eventId)
          .map((r) => formatSeedRegistration(r, state));
        return { registrations, source: "seed" };
      }

      if (sub.startsWith("registrations/") && regId && method === "PATCH") {
        const reg = state.registrations.find((r) => r.id === regId && r.event_id === eventId);
        if (!reg) throw makeHttpError(404, "Регистрация не найдена");
        if (body.mentor !== undefined) reg.mentor = body.mentor;
        if (body.evaluation !== undefined) reg.evaluation = body.evaluation;
        saveCatalogSeed(state);
        return { registration: formatSeedRegistration(reg, state), source: "seed" };
      }

      if (sub === "bracket" && method === "GET") {
        const matches = state.matches
          .filter((m) => m.event_id === eventId)
          .map((m) => {
            const p1 = state.registrations.find((r) => r.id === m.participant1_id);
            const p2 = state.registrations.find((r) => r.id === m.participant2_id);
            return {
              ...m,
              participant1_name: p1 ? formatSeedRegistration(p1, state).name : null,
              participant2_name: p2 ? formatSeedRegistration(p2, state).name : null
            };
          });
        return { matches, source: "seed" };
      }

      if (sub === "bracket" && method === "POST") {
        const regs = state.registrations.filter((r) => r.event_id === eventId);
        if (regs.length < 2) throw makeHttpError(400, "Для сетки нужно минимум 2 участника");
        let nextId = state.matches.reduce((m, x) => Math.max(m, x.id), 0) + 1;
        for (let i = 0; i < regs.length; i += 2) {
          state.matches.push({
            id: nextId++,
            event_id: eventId,
            round: 1,
            participant1_id: regs[i].id,
            participant2_id: regs[i + 1] ? regs[i + 1].id : null,
            score: null,
            proof_url: null,
            status: regs[i + 1] ? "scheduled" : "confirmed",
            winner_id: regs[i + 1] ? null : regs[i].id
          });
        }
        ev.status = "ongoing";
        saveCatalogSeed(state);
        return { ok: true, source: "seed" };
      }

      if (sub === "result" && method === "POST") {
        if (body.registration_id) {
          const reg = state.registrations.find((r) => r.id === Number(body.registration_id) && r.event_id === eventId);
          if (!reg) throw makeHttpError(404, "Регистрация не найдена");
          reg.repository_url = body.repository_url;
          saveCatalogSeed(state);
          return { registration: formatSeedRegistration(reg, state), source: "seed" };
        }
        const match = state.matches.find((m) => m.id === Number(body.match_id) && m.event_id === eventId);
        if (!match) throw makeHttpError(404, "Матч не найден");
        if (body.action === "confirm") {
          match.winner_id = Number(body.winner_id);
          match.score = body.score;
          match.status = "confirmed";
        } else {
          match.score = body.score;
          match.proof_url = body.proof_url;
          match.status = "disputed";
        }
        saveCatalogSeed(state);
        return { match, source: "seed" };
      }
    }

    return null;
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
      const fallback = tryCatalogOfflineFallback(path, options);
      if (fallback !== null) return fallback;
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      if (isRouteMissing(err)) {
        const fallback = tryCatalogOfflineFallback(path, options);
        if (fallback !== null) return fallback;
      }
      throw err;
    }
    return data;
  }

 function isRouteMissing(err) {
    return Boolean(
      err && (err.isOffline || err.status === 404 || err.status === 405 || err.status === 501)
    );
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
        const response = await tryEndpoints([
          () => this.get(`/api/swipes/feed${query}`),
          () => this.get(`/api/swipes/cards${query}`),
          () => this.get(`/api/cards${query}`)
        ]);
        if (Array.isArray(response.cards)) return response;

        const cards = (response.candidates || [])
          .filter((user) => !filters.prime_time || (user.prime_time || "").includes(filters.prime_time))
          .map((user) => {
            const pds = Array.isArray(user.disciplines) ? user.disciplines : [];
            if (user.team && user.team.looking_for_role_id) {
              const t = user.team;
              const capRank = pds.find((x) => Number(x.discipline_id) === Number(t.discipline_id)) || pds[0] || {};
              const teamPd = {
                discipline_id: t.discipline_id,
                discipline_name: t.discipline_name || "",
                category: t.category || "esports",
                role_id: t.looking_for_role_id,
                role_name: t.looking_for_role_name || "",
                rank_id: capRank.rank_id || null,
                rank_name: capRank.rank_name || "Middle+"
              };
              return {
                ...user,
                card_key: `team_${t.id}`,
                card_type: "team",
                user_id: user.id,
                gradient: GRADIENTS[user.id % GRADIENTS.length],
                bio: t.description || user.bio,
                profile_disciplines: [teamPd],
                team: t
              };
            }
            return {
              ...user,
              card_key: `player_${user.id}`,
              card_type: "player",
              user_id: user.id,
              gradient: GRADIENTS[user.id % GRADIENTS.length],
              profile_disciplines: pds,
              team: null
            };
          })
          .filter((card) => {
            if (filters.card_type && filters.card_type !== "all" && card.card_type !== filters.card_type) {
              return false;
            }
            if (filters.category && filters.category !== "all") {
              return card.profile_disciplines.some((pd) => pd.category === filters.category);
            }
            return true;
          });
        return { cards };
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
    async undoSwipe(toUserId) {
      const targetId = Number(toUserId);
      if (!targetId) return { ok: false };
      this.undoSeedSwipe(targetId);
      try {
        return await this.delete(`/api/swipes/${targetId}`);
      } catch (err) {
        if (!isRouteMissing(err)) throw err;
        return { ok: true, source: "seed" };
      }
    },

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