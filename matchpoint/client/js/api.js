/* ==========================================================================
   MatchPoint — Обёртка fetch-запросов к бэкенду (client/js/api.js)
   Модуль: Фронтенд-ядро (Карулис Иван)
   Синхронизировано с таблицами БД:
   - disciplines, discipline_roles, ranks, profile_disciplines
   - users, profiles (trust_score NUMERIC(3,2), contacts JSONB, external_links JSONB)
   - swipes (from_user_id, to_user_id, is_like)
   - matches (id, user1_id, user2_id, created_at)
   - teams (id, captain_id, discipline_id, name, description, looking_for_role_id)
   ========================================================================== */

(function (global) {
  "use strict";

  const MOCK_DICTIONARIES = {
    disciplines: [
      { id: 1, name: "CS2", category: "esports" },
      { id: 2, name: "Dota 2", category: "esports" },
      { id: 3, name: "Valorant", category: "esports" },
      { id: 4, name: "Веб-разработка / Хакатоны", category: "it" },
      { id: 5, name: "Спортивное программирование", category: "it" }
    ],
    discipline_roles: [
      { id: 101, discipline_id: 1, name: "IGL / Капитан" },
      { id: 102, discipline_id: 1, name: "AWP / Снайпер" },
      { id: 103, discipline_id: 1, name: "Entry Fragger" },
      { id: 104, discipline_id: 1, name: "Support / Опорник" },
      { id: 105, discipline_id: 2, name: "Carry (Pos 1)" },
      { id: 106, discipline_id: 2, name: "Midlaner (Pos 2)" },
      { id: 107, discipline_id: 2, name: "Hard Support (Pos 5)" },
      { id: 108, discipline_id: 3, name: "Duelist" },
      { id: 109, discipline_id: 3, name: "Controller / Саппорт" },
      { id: 110, discipline_id: 4, name: "Frontend" },
      { id: 111, discipline_id: 4, name: "Backend (Node.js / SQL)" },
      { id: 112, discipline_id: 4, name: "Fullstack / ML" },
      { id: 113, discipline_id: 4, name: "UI/UX Дизайнер" },
      { id: 114, discipline_id: 5, name: "Алгоритмист C++" },
      { id: 115, discipline_id: 5, name: "Математик / Графы" }
    ],
    ranks: [
      { id: 201, discipline_id: 1, name: "Faceit 4–6", sort_order: 1 },
      { id: 202, discipline_id: 1, name: "Faceit 7–9", sort_order: 2 },
      { id: 203, discipline_id: 1, name: "Faceit 10 (2000+ ELO)", sort_order: 3 },
      { id: 204, discipline_id: 2, name: "Ancient", sort_order: 1 },
      { id: 205, discipline_id: 2, name: "Divine", sort_order: 2 },
      { id: 206, discipline_id: 2, name: "Immortal (6500+ MMR)", sort_order: 3 },
      { id: 207, discipline_id: 3, name: "Platinum / Diamond", sort_order: 1 },
      { id: 208, discipline_id: 3, name: "Ascendant", sort_order: 2 },
      { id: 209, discipline_id: 3, name: "Immortal / Radiant", sort_order: 3 },
      { id: 210, discipline_id: 4, name: "Junior", sort_order: 1 },
      { id: 211, discipline_id: 4, name: "Middle", sort_order: 2 },
      { id: 212, discipline_id: 4, name: "Senior / Lead", sort_order: 3 },
      { id: 213, discipline_id: 5, name: "Expert (1600+ CF)", sort_order: 1 },
      { id: 214, discipline_id: 5, name: "Candidate Master (1900+ CF)", sort_order: 2 }
    ]
  };

  // Резервные карточки в точном формате таблиц profiles + profile_disciplines + teams
  const MOCK_CARDS = [
    {
      card_key: "player_1",
      card_type: "player",
      user_id: 1,
      nickname: "YbGHFBK",
      avatar_url: null,
      gradient: "linear-gradient(135deg, #2b1d52, #5e35b1)",
      prime_time: "18:00–23:00",
      bio: "Координирую раунды, разбираю демки, без тильта. Собираю стак под воскресный FastCup 5x5 и LAN в Минске.",
      external_links: { steam: "https://steamcommunity.com/id/YbGHFBK", faceit: "https://www.faceit.com/ru/players/YbGHFBK" },
      trust_score: 4.98,
      profile_disciplines: [
        { discipline_id: 1, discipline_name: "CS2", category: "esports", role_id: 101, role_name: "IGL / Капитан", rank_id: 203, rank_name: "Faceit 10 (2000+ ELO)", sort_order: 3 }
      ],
      team: null,
      _contacts: { discord: "ybghfbk#0001", telegram: "@YbGHFBK" },
      _likedViewer: true,
      _greeting: "Привет! Отличный стак получается, го сегодня прак в 20:00?"
    },
    {
      card_key: "team_1",
      card_type: "team",
      user_id: 3,
      nickname: "Hikonodere",
      avatar_url: null,
      gradient: "linear-gradient(135deg, #0d324d, #1976d2)",
      prime_time: "Выходные",
      bio: "Ищем фронтендера (HTML5/CSS3/ES6+) на 48-часовой FinTech & AI Хакатон. Серверная часть и схема БД уже готовы!",
      external_links: { github: "https://github.com/Hikonodere" },
      trust_score: 4.94,
      profile_disciplines: [
        { discipline_id: 4, discipline_name: "Веб-разработка / Хакатоны", category: "it", role_id: 110, role_name: "Frontend", rank_id: 211, rank_name: "Middle", sort_order: 2 }
      ],
      team: {
        id: 1,
        captain_id: 3,
        discipline_id: 4,
        name: "ByteStorm",
        description: "Ищем фронтендера (HTML5/CSS3/ES6+) на 48-часовой FinTech & AI Хакатон.",
        looking_for_role_id: 110,
        looking_for_role_name: "Frontend",
        members_count: 3
      },
      _contacts: { discord: "bytestorm_cap", telegram: "@Hikonodere" },
      _likedViewer: true,
      _greeting: "Рады мэтчу! Скинуть ссылку на репозиторий команды ByteStorm?"
    },
    {
      card_key: "player_4",
      card_type: "player",
      user_id: 4,
      nickname: "VeRfetti",
      avatar_url: null,
      gradient: "linear-gradient(135deg, #16382b, #1b8a5a)",
      prime_time: "18:00–23:00",
      bio: "Пул 12+ кор-героев, стабильный фарм и макро. Ищу саппорта 5 позиции или сыгранную пятёрку на субботний Battle Cup.",
      external_links: { steam: "https://steamcommunity.com/id/VeRfetti" },
      trust_score: 4.89,
      profile_disciplines: [
        { discipline_id: 2, discipline_name: "Dota 2", category: "esports", role_id: 105, role_name: "Carry (Pos 1)", rank_id: 206, rank_name: "Immortal (6500+ MMR)", sort_order: 3 }
      ],
      team: null,
      _contacts: { discord: "verfetti_dota", telegram: "@VeRfetti" },
      _likedViewer: true,
      _greeting: "Йо! Го ранкед через полчаса, проверим синергию на линии!"
    },
    {
      card_key: "team_2",
      card_type: "team",
      user_id: 5,
      nickname: "GrodnoCap",
      avatar_url: null,
      gradient: "linear-gradient(135deg, #4a1525, #b5174a)",
      prime_time: "18:00–23:00",
      bio: "В сыгранную четвёрку нужен мейн-AWP со знанием раскидок на Mirage, Nuke и Ancient. Играем студенческую LAN-лигу.",
      external_links: { faceit: "https://www.faceit.com", steam: "https://steamcommunity.com" },
      trust_score: 4.82,
      profile_disciplines: [
        { discipline_id: 1, discipline_name: "CS2", category: "esports", role_id: 102, role_name: "AWP / Снайпер", rank_id: 202, rank_name: "Faceit 7–9", sort_order: 2 }
      ],
      team: {
        id: 2,
        captain_id: 5,
        discipline_id: 1,
        name: "Grodno Five",
        description: "Нужен стабильный AWP на вечерние праки и LAN-турнир.",
        looking_for_role_id: 102,
        looking_for_role_name: "AWP / Снайпер",
        members_count: 4
      },
      _contacts: { discord: "grodno5_igl", telegram: "@grodno_five" },
      _likedViewer: true,
      _greeting: "Привет! Нам как раз не хватало снайпера на вечерний скрим!"
    },
    {
      card_key: "player_6",
      card_type: "player",
      user_id: 6,
      nickname: "NovaAim",
      avatar_url: null,
      gradient: "linear-gradient(135deg, #431839, #9d174d)",
      prime_time: "23:00–03:00",
      bio: "Мейн Jett / Reyna, спокойный колл инфы без токсичности. Ищу дуо или стак для Premier и апа Immortal.",
      external_links: { steam: "https://steamcommunity.com" },
      trust_score: 4.91,
      profile_disciplines: [
        { discipline_id: 3, discipline_name: "Valorant", category: "esports", role_id: 108, role_name: "Duelist", rank_id: 208, rank_name: "Ascendant", sort_order: 2 }
      ],
      team: null,
      _contacts: { discord: "nova_aim", telegram: "@nova_vlr" },
      _likedViewer: true,
      _greeting: "Супер! Скидывай Riot ID, пойдём Premier!"
    },
    {
      card_key: "player_7",
      card_type: "player",
      user_id: 7,
      nickname: "AlgoMaster",
      avatar_url: null,
      gradient: "linear-gradient(135deg, #1f2937, #0f766e)",
      prime_time: "Выходные",
      bio: "Решаю графы, деревья отрезков и ДП на C++20. Ищу сокомандников для тренировок к четвертьфиналу ICPC.",
      external_links: { github: "https://github.com/algomaster" },
      trust_score: 5.0,
      profile_disciplines: [
        { discipline_id: 5, discipline_name: "Спортивное программирование", category: "it", role_id: 114, role_name: "Алгоритмист C++", rank_id: 214, rank_name: "Candidate Master (1900+ CF)", sort_order: 2 }
      ],
      team: null,
      _contacts: { discord: "algomaster_by", telegram: "@algomaster" },
      _likedViewer: true,
      _greeting: "Привет! Порешаем контест в эту субботу?"
    }
  ];

  const mockMatches = [
    {
      id: 1,
      user1_id: 1,
      user2_id: 2,
      created_at: "Сегодня, 18:40",
      partner: {
        user_id: 1,
        nickname: "YbGHFBK",
        gradient: "linear-gradient(135deg, #2b1d52, #5e35b1)",
        prime_time: "18:00–23:00",
        trust_score: 4.98,
        discipline_name: "CS2",
        role_name: "IGL / Капитан",
        rank_name: "Faceit 10 (2000+ ELO)",
        contacts: { discord: "ybghfbk#0001", telegram: "@YbGHFBK" },
        external_links: { steam: "https://steamcommunity.com/id/YbGHFBK", faceit: "https://www.faceit.com/ru/players/YbGHFBK" },
        greeting: "Привет! Отличный стак получается, го сегодня прак в 20:00?"
      }
    }
  ];

  function filterMockCards(filters) {
    return MOCK_CARDS.filter((c) => {
      const pd = c.profile_disciplines[0];
      if (filters.card_type && filters.card_type !== "all" && c.card_type !== filters.card_type) return false;
      if (filters.category && filters.category !== "all" && pd.category !== filters.category) return false;
      if (filters.discipline_id && Number(pd.discipline_id) !== Number(filters.discipline_id)) return false;
      if (filters.role_id && Number(pd.role_id) !== Number(filters.role_id)) return false;
      if (filters.rank_id && Number(pd.rank_id) !== Number(filters.rank_id)) return false;
      if (filters.prime_time && c.prime_time !== filters.prime_time) return false;
      if (filters.min_trust && Number(c.trust_score) < Number(filters.min_trust)) return false;
      return true;
    }).map(({ _contacts, _likedViewer, _greeting, ...publicCard }) => publicCard);
  }

  async function request(path, options = {}) {
    const token = global.MPStorage ? global.MPStorage.getToken() : "";
    const currentUser = global.MPStorage ? global.MPStorage.getUser() : null;

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(currentUser && currentUser.id ? { "X-User-Id": String(currentUser.id) } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  const MPApi = {
    async getDictionaries() {
      try {
        return await request("/api/admin/dictionaries");
      } catch (_) {
        return MOCK_DICTIONARIES;
      }
    },

    async getCards(filters = {}) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "" && v !== "all") {
          qs.set(k, String(v));
        }
      });
      try {
        return await request(`/api/cards?${qs.toString()}`);
      } catch (_) {
        return { cards: filterMockCards(filters) };
      }
    },

    async sendSwipe({ to_user_id, is_like }) {
      try {
        return await request("/api/swipe", {
          method: "POST",
          body: JSON.stringify({
            to_user_id: Number(to_user_id),
            is_like: Boolean(is_like)
          })
        });
      } catch (_) {
        const viewerId = global.MPStorage?.getUser()?.id || 2;
        const target = MOCK_CARDS.find((c) => c.user_id === Number(to_user_id));
        const matched = Boolean(target && is_like && target._likedViewer);
        let match = null;
        if (matched && target) {
          const pd = target.profile_disciplines[0];
          match = {
            id: Date.now(),
            user1_id: Math.min(viewerId, target.user_id),
            user2_id: Math.max(viewerId, target.user_id),
            created_at: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
            partner: {
              user_id: target.user_id,
              nickname: target.team ? `${target.team.name} (@${target.nickname})` : target.nickname,
              gradient: target.gradient,
              prime_time: target.prime_time,
              trust_score: target.trust_score,
              discipline_name: pd.discipline_name,
              role_name: target.team ? target.team.looking_for_role_name : pd.role_name,
              rank_name: pd.rank_name,
              contacts: target._contacts,
              external_links: target.external_links,
              greeting: target._greeting
            }
          };
          if (!mockMatches.some((m) => m.partner.user_id === target.user_id)) {
            mockMatches.unshift(match);
          }
        }
        return { ok: true, matched, match };
      }
    },

    async getMatches() {
      try {
        return await request("/api/matches");
      } catch (_) {
        return { matches: mockMatches };
      }
    },

    async sendReport({ target_user_id, reason }) {
      try {
        return await request("/api/reports", {
          method: "POST",
          body: JSON.stringify({ target_user_id: Number(target_user_id), reason })
        });
      } catch (_) {
        return { ok: true };
      }
    }
  };

  global.MPApi = MPApi;
})(window);
