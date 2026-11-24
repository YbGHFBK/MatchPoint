/* ==========================================================================
   MatchPoint — Модуль клиентских хранилищ (client/js/storage.js)
   Зона ответственности: Фронтенд-ядро (Карулис Иван)
   Назначение модуля:
   1. localStorage:
      - сохранение и проверка JWT-токена и данных сессии (users + profiles);
      - сохранение и синхронизация темы оформления ('dark' / 'light');
      - сохранение, валидация и сброс фильтров подбора (disciplines, roles, ranks,
        prime_time, trust_score).
   2. sessionStorage:
      - автосохранение, восстановление и очистка черновиков любых форм
        (без сохранения полей type="password" и type="file");
      - ведение истории просмотренных за текущую сессию карточек свайпов
        (swipes.is_like) с поддержкой возврата последнего свайпа (Undo).
   ========================================================================== */

(function (global) {
  "use strict";

  const KEYS = Object.freeze({
    TOKEN: "mp_auth_token",
    USER: "mp_current_user",
    THEME: "mp_theme",
    FILTERS: "mp_swipe_filters_v2",
    HISTORY: "mp_session_viewed_cards_v2",
    DRAFT_PREFIX: "mp_form_draft_"
  });

  const MAX_HISTORY_ITEMS = 50;

  // Допустимые значения из CHECK-ограничений схемы БД
  const ALLOWED_ROLES = new Set([
    "guest",
    "player",
    "captain",
    "organizer",
    "moderator",
    "admin"
  ]);

  const ALLOWED_STATUSES = new Set([
    "active",
    "muted",
    "temp_banned",
    "perm_banned"
  ]);

  const ALLOWED_CARD_TYPES = new Set(["all", "player", "team"]);
  const ALLOWED_CATEGORIES = new Set(["all", "esports", "it"]);

  // Параметры фильтрации строго по полям таблиц БД и индекса idx_profile_disc_lookup
  const DEFAULT_FILTERS = Object.freeze({
    card_type: "all",     // 'all' | 'player' (profiles) | 'team' (teams.looking_for_role_id)
    category: "all",      // 'all' | 'esports' | 'it' (disciplines.category)
    discipline_id: "",    // INTEGER REFERENCES disciplines(id)
    role_id: "",          // INTEGER REFERENCES discipline_roles(id)
    rank_id: "",          // INTEGER REFERENCES ranks(id)
    prime_time: "",       // profiles.prime_time
    min_trust: ""         // profiles.trust_score NUMERIC(3,2)
  });

  // Демо-пользователь по структуре users JOIN profiles
  const DEFAULT_USER = Object.freeze({
    id: 2,
    email: "ivan@matchpoint.by",
    role: "captain",
    status: "active",
    nickname: "Karulis1",
    avatar_url: null,
    trust_score: 4.95
  });

  // Резервное in-memory хранилище на случай блокировки Web Storage или переполнения квоты
  const memoryFallback = {
    localStorage: Object.create(null),
    sessionStorage: Object.create(null)
  };

  function createSafeAdapter(storageName) {
    const mem = memoryFallback[storageName];

    function getNative() {
      try {
        const store = global && global[storageName];
        return store || null;
      } catch (_) {
        return null;
      }
    }

    return {
      getItem(key) {
        const store = getNative();
        if (store) {
          try {
            const val = store.getItem(key);
            if (val !== null) return val;
          } catch (_) {}
        }
        return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
      },

      setItem(key, value) {
        const str = String(value);
        mem[key] = str;
        const store = getNative();
        if (!store) return false;
        try {
          store.setItem(key, str);
          return true;
        } catch (_) {
          // Если переполнена квота sessionStorage — освобождаем старый хвост истории и пробуем ещё раз
          if (storageName === "sessionStorage" && key !== KEYS.HISTORY) {
            try {
              const rawHist = store.getItem(KEYS.HISTORY);
              if (rawHist) {
                const trimmed = JSON.parse(rawHist).slice(0, 15);
                store.setItem(KEYS.HISTORY, JSON.stringify(trimmed));
                store.setItem(key, str);
                return true;
              }
            } catch (_retryErr) {}
          }
          return false;
        }
      },

      removeItem(key) {
        delete mem[key];
        const store = getNative();
        if (!store) return;
        try {
          store.removeItem(key);
        } catch (_) {}
      },

      keys() {
        const collected = new Set(Object.keys(mem));
        const store = getNative();
        if (store) {
          try {
            for (let i = 0; i < store.length; i += 1) {
              const k = store.key(i);
              if (k) collected.add(k);
            }
          } catch (_) {}
        }
        return Array.from(collected);
      }
    };
  }

  const local = createSafeAdapter("localStorage");
  const session = createSafeAdapter("sessionStorage");

  function readJSON(adapter, key, fallback) {
    const raw = adapter.getItem(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(adapter, key, value) {
    adapter.setItem(key, JSON.stringify(value));
  }

  function emitEvent(name, detail) {
    if (!global || typeof global.dispatchEvent !== "function" || typeof global.CustomEvent !== "function") {
      return;
    }
    try {
      global.dispatchEvent(new global.CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function sanitizeUser(input) {
    const src = input && typeof input === "object" ? input : {};
    const role = ALLOWED_ROLES.has(src.role) ? src.role : DEFAULT_USER.role;
    const status = ALLOWED_STATUSES.has(src.status) ? src.status : DEFAULT_USER.status;
    const numericTrust = Number(src.trust_score);
    const trust_score = Number.isFinite(numericTrust)
      ? Math.min(5, Math.max(1, Number(numericTrust.toFixed(2))))
      : DEFAULT_USER.trust_score;

    return {
      id: Number.isFinite(Number(src.id)) ? Number(src.id) : DEFAULT_USER.id,
      email: typeof src.email === "string" ? src.email : DEFAULT_USER.email,
      role,
      status,
      nickname: typeof src.nickname === "string" && src.nickname.trim()
        ? src.nickname.trim()
        : DEFAULT_USER.nickname,
      avatar_url: src.avatar_url || null,
      trust_score
    };
  }

  function sanitizeFilters(input) {
    const src = input && typeof input === "object" ? input : {};
    const cleanId = (val) => {
      if (val === "" || val === null || val === undefined) return "";
      const n = Number(val);
      return Number.isInteger(n) && n > 0 ? String(n) : "";
    };
    const cleanTrust = (val) => {
      if (val === "" || val === null || val === undefined) return "";
      const n = Number(val);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n.toFixed(2) : "";
    };

    return {
      card_type: ALLOWED_CARD_TYPES.has(src.card_type) ? src.card_type : "all",
      category: ALLOWED_CATEGORIES.has(src.category) ? src.category : "all",
      discipline_id: cleanId(src.discipline_id),
      role_id: cleanId(src.role_id),
      rank_id: cleanId(src.rank_id),
      prime_time: typeof src.prime_time === "string" ? src.prime_time.trim() : "",
      min_trust: cleanTrust(src.min_trust)
    };
  }

  function applyThemeToDocument(theme) {
    if (global && global.document && global.document.documentElement) {
      global.document.documentElement.setAttribute("data-theme", theme);
    }
  }

  const MPStorage = {
    KEYS,
    DEFAULT_FILTERS,
    DEFAULT_USER,

    // ========================================================================
    // 1. ТОКЕН АВТОРИЗАЦИИ И СЕССИЯ ПОЛЬЗОВАТЕЛЯ (localStorage)
    // ========================================================================
    getToken() {
      return local.getItem(KEYS.TOKEN) || "";
    },

    setToken(token) {
      const clean = typeof token === "string" ? token.trim() : "";
      if (!clean) {
        local.removeItem(KEYS.TOKEN);
      } else {
        local.setItem(KEYS.TOKEN, clean);
      }
      emitEvent("mp:auth-change", { hasToken: Boolean(clean) });
      return clean;
    },

    hasToken() {
      const token = this.getToken();
      return Boolean(token) && !this.isTokenExpired(token);
    },

    isTokenExpired(token = this.getToken()) {
      if (!token) return true;
      const parts = token.split(".");
      if (parts.length !== 3 || typeof global.atob !== "function") {
        // Короткий/демо-токен без секции exp считаем валидным в рамках учебного стенда
        return false;
      }
      try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(global.atob(base64));
        if (!payload || typeof payload.exp !== "number") return false;
        return Date.now() >= payload.exp * 1000;
      } catch (_) {
        return false;
      }
    },

    getAuthHeaders() {
      const headers = {};
      const token = this.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const user = this.getUser();
      if (user && user.id) headers["X-User-Id"] = String(user.id);
      return headers;
    },

    getUser() {
      const saved = readJSON(local, KEYS.USER, null);
      return sanitizeUser(saved || DEFAULT_USER);
    },

    setUser(partialUser) {
      const merged = sanitizeUser({ ...this.getUser(), ...(partialUser || {}) });
      writeJSON(local, KEYS.USER, merged);
      emitEvent("mp:user-change", { user: merged });
      return merged;
    },

    isAuthenticated() {
      const user = this.getUser();
      return this.hasToken() && user.role !== "guest" && user.id > 0;
    },

    hasRole(...roles) {
      const currentRole = this.getUser().role;
      return roles.includes(currentRole);
    },

    clearAuth() {
      local.removeItem(KEYS.TOKEN);
      const guest = sanitizeUser({
        id: 0,
        email: "",
        role: "guest",
        status: "active",
        nickname: "Гость",
        avatar_url: null,
        trust_score: 5.0
      });
      writeJSON(local, KEYS.USER, guest);
      emitEvent("mp:auth-change", { hasToken: false, user: guest });
      return guest;
    },

    // ========================================================================
    // 2. ТЕМА ОФОРМЛЕНИЯ UI (localStorage)
    // ========================================================================
    getTheme() {
      const saved = local.getItem(KEYS.THEME);
      if (saved === "light" || saved === "dark") return saved;
      if (global && typeof global.matchMedia === "function") {
        try {
          if (global.matchMedia("(prefers-color-scheme: light)").matches) {
            return "light";
          }
        } catch (_) {}
      }
      return "dark";
    },

    setTheme(theme) {
      const normalized = theme === "light" ? "light" : "dark";
      local.setItem(KEYS.THEME, normalized);
      applyThemeToDocument(normalized);
      emitEvent("mp:theme-change", { theme: normalized });
      return normalized;
    },

    toggleTheme() {
      return this.setTheme(this.getTheme() === "dark" ? "light" : "dark");
    },

    initTheme() {
      const current = this.getTheme();
      local.setItem(KEYS.THEME, current);
      applyThemeToDocument(current);
      return current;
    },

    // ========================================================================
    // 3. ФИЛЬТРЫ ПОДБОРА ТИММЕЙТОВ И КОМАНД (localStorage)
    // ========================================================================
    getFilters() {
      const saved = readJSON(local, KEYS.FILTERS, null);
      return sanitizeFilters({ ...DEFAULT_FILTERS, ...(saved || {}) });
    },

    setFilters(partialFilters) {
      const current = this.getFilters();
      const nextRaw = { ...current, ...(partialFilters || {}) };

      // Если дисциплина изменена и явно не переданы новые role_id / rank_id — сбрасываем зависимые поля
      if (
        partialFilters &&
        Object.prototype.hasOwnProperty.call(partialFilters, "discipline_id") &&
        String(partialFilters.discipline_id ?? "") !== current.discipline_id
      ) {
        if (!Object.prototype.hasOwnProperty.call(partialFilters, "role_id")) {
          nextRaw.role_id = "";
        }
        if (!Object.prototype.hasOwnProperty.call(partialFilters, "rank_id")) {
          nextRaw.rank_id = "";
        }
      }

      const sanitized = sanitizeFilters(nextRaw);
      writeJSON(local, KEYS.FILTERS, sanitized);
      emitEvent("mp:filters-change", { filters: sanitized });
      return sanitized;
    },

    resetFilters() {
      const defaults = sanitizeFilters(DEFAULT_FILTERS);
      writeJSON(local, KEYS.FILTERS, defaults);
      emitEvent("mp:filters-change", { filters: defaults });
      return defaults;
    },

    // ========================================================================
    // 4. ЧЕРНОВИКИ ФОРМ (sessionStorage)
    // ========================================================================
    saveDraft(formKey, data) {
      if (!formKey) return null;
      const payload = {
        updated_at: new Date().toISOString(),
        data: data && typeof data === "object" ? data : {}
      };
      writeJSON(session, KEYS.DRAFT_PREFIX + formKey, payload);
      return payload;
    },

    getDraft(formKey) {
      if (!formKey) return null;
      const entry = readJSON(session, KEYS.DRAFT_PREFIX + formKey, null);
      return entry && typeof entry === "object" && "data" in entry ? entry.data : null;
    },

    getDraftMeta(formKey) {
      if (!formKey) return null;
      return readJSON(session, KEYS.DRAFT_PREFIX + formKey, null);
    },

    clearDraft(formKey) {
      if (!formKey) return;
      session.removeItem(KEYS.DRAFT_PREFIX + formKey);
    },

    listDraftKeys() {
      return session
        .keys()
        .filter((k) => k.startsWith(KEYS.DRAFT_PREFIX))
        .map((k) => k.slice(KEYS.DRAFT_PREFIX.length));
    },

    clearAllDrafts() {
      session
        .keys()
        .filter((k) => k.startsWith(KEYS.DRAFT_PREFIX))
        .forEach((k) => session.removeItem(k));
    },

    /**
     * Автоматически связывает HTML-форму с sessionStorage:
     * - при инициализации восстанавливает значения всех именованных полей;
     * - при вводе сохраняет снимок полей (исключая type="password" и type="file");
     * - возвращает функцию отписки unbind().
     */
    bindFormDraft(formEl, formKey, onRestore) {
      if (!formEl || !formKey) return () => {};

      const isSaveableField = (el) => {
        if (!el || !el.name || el.disabled) return false;
        const type = String(el.type || "").toLowerCase();
        return !["password", "file", "submit", "reset", "button"].includes(type);
      };

      const draft = this.getDraft(formKey);
      if (draft && typeof draft === "object") {
        Array.from(formEl.elements || []).forEach((el) => {
          if (!isSaveableField(el)) return;
          if (!Object.prototype.hasOwnProperty.call(draft, el.name)) return;
          const savedVal = draft[el.name];
          const type = String(el.type || "").toLowerCase();

          if (type === "checkbox") {
            el.checked = Boolean(savedVal);
          } else if (type === "radio") {
            el.checked = String(el.value) === String(savedVal);
          } else if (el.tagName === "SELECT" && el.multiple && Array.isArray(savedVal)) {
            Array.from(el.options).forEach((opt) => {
              opt.selected = savedVal.includes(opt.value);
            });
          } else if (savedVal !== undefined && savedVal !== null) {
            el.value = String(savedVal);
          }
        });

        if (typeof onRestore === "function") {
          onRestore(draft);
        }
      }

      const captureSnapshot = () => {
        const snapshot = {};
        Array.from(formEl.elements || []).forEach((el) => {
          if (!isSaveableField(el)) return;
          const type = String(el.type || "").toLowerCase();

          if (type === "checkbox") {
            snapshot[el.name] = Boolean(el.checked);
          } else if (type === "radio") {
            if (el.checked) snapshot[el.name] = el.value;
          } else if (el.tagName === "SELECT" && el.multiple) {
            snapshot[el.name] = Array.from(el.selectedOptions).map((o) => o.value);
          } else {
            snapshot[el.name] = el.value;
          }
        });
        this.saveDraft(formKey, snapshot);
      };

      let debounceTimer = null;
      const onInput = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(captureSnapshot, 120);
      };
      const onChange = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        captureSnapshot();
      };

      formEl.addEventListener("input", onInput);
      formEl.addEventListener("change", onChange);

      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        formEl.removeEventListener("input", onInput);
        formEl.removeEventListener("change", onChange);
      };
    },

    // ========================================================================
    // 5. ИСТОРИЯ ПРОСМОТРЕННЫХ КАРТОЧЕК ТЕКУЩЕЙ СЕССИИ (sessionStorage)
    // ========================================================================
    getViewedCards() {
      const list = readJSON(session, KEYS.HISTORY, []);
      return Array.isArray(list) ? list : [];
    },

    hasViewedCard(cardKey) {
      if (!cardKey) return false;
      return this.getViewedCards().some((item) => item.card_key === cardKey);
    },

    getViewedCardIds() {
      return this.getViewedCards().map((item) => item.card_key);
    },

    addViewedCard(card, isLike) {
      if (!card || !card.card_key) return this.getViewedCards();

      const primaryDisc =
        card.primary_discipline ||
        (Array.isArray(card.profile_disciplines) ? card.profile_disciplines[0] : null);

      const list = this.getViewedCards().filter((item) => item.card_key !== card.card_key);
      const now = new Date();

      list.unshift({
        card_key: String(card.card_key),
        to_user_id: Number(card.user_id) || 0,
        team_id: card.team ? card.team.id : null,
        display_title: card.team ? card.team.name : card.nickname || "Игрок",
        discipline_name: primaryDisc ? primaryDisc.discipline_name : "—",
        is_like: Boolean(isLike),
        created_at: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        viewed_iso: now.toISOString(),
        cardSnapshot: card
      });

      const trimmed = list.slice(0, MAX_HISTORY_ITEMS);
      writeJSON(session, KEYS.HISTORY, trimmed);
      emitEvent("mp:history-change", { count: trimmed.length });
      return trimmed;
    },

    popLastViewedCard() {
      const list = this.getViewedCards();
      if (!list.length) return null;
      const last = list.shift();
      writeJSON(session, KEYS.HISTORY, list);
      emitEvent("mp:history-change", { count: list.length });
      return last;
    },

    getSessionSwipeStats() {
      const list = this.getViewedCards();
      const likes = list.filter((item) => item.is_like).length;
      return {
        total: list.length,
        likes,
        skips: list.length - likes
      };
    },

    clearViewedCards() {
      session.removeItem(KEYS.HISTORY);
      emitEvent("mp:history-change", { count: 0 });
    }
  };

  // Мгновенно применяем сохранённую тему к <html>, предотвращая мигание при загрузке страниц
  applyThemeToDocument(MPStorage.getTheme());

  // Синхронизация темы и авторизации между вкладками браузера
  if (global && typeof global.addEventListener === "function") {
    global.addEventListener("storage", (event) => {
      if (!event) return;
      if (event.key === KEYS.THEME && event.newValue) {
        applyThemeToDocument(event.newValue === "light" ? "light" : "dark");
      }
    });
  }

  if (global) {
    global.MPStorage = MPStorage;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = MPStorage;
  }
})(typeof window !== "undefined" ? window : globalThis);
