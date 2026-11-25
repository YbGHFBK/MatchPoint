
/* ==========================================================================
   MatchPoint — Механика свайпов, фильтров, мэтчей и авторизации (client/js/swipe.js)
   Зона ответственности: Фронтенд-ядро (Карулис Иван)
   Синхронизировано с 01_schema.sql, 02_seed.sql и server/routes/auth.js:
   - Перетаскивание карточек (Pointer Events: мышь и сенсорные экраны) + кнопки
   - Каскадные фильтры БД: disciplines -> discipline_roles, ranks + prime_time + trust_score
   - Модалка «It’s a Match!», раскрытие JSONB contacts и лобби-чат (с проверкой status='muted')
   - Работа с реальным /api/auth/login, /api/auth/register, /api/auth/me + 14 сид-аккаунтов
   ========================================================================== */

(function () {
  "use strict";

  const SWIPE_THRESHOLD_X = 105;

  const state = {
    dictionaries: { disciplines: [], discipline_roles: [], ranks: [] },
    cards: [],
    matches: [],
    activePartnerForChat: null,
    reportTargetCard: null,
    chatMessagesByUser: {},
    isAnimating: false,
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function initialsFromName(name) {
    const clean = String(name || "MP").replace(/^@/, "").trim();
    const parts = clean.split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function avatarInnerHTML(avatarUrl, nickname) {
    const initials = esc(initialsFromName(nickname));
    if (!avatarUrl) return `<span>${initials}</span>`;
    return `<img src="${esc(avatarUrl)}" alt="${esc(nickname || "avatar")}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${initials}'}))">`;
  }

  function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      el.style.transition = "0.22s ease";
      setTimeout(() => el.remove(), 240);
    }, 2800);
  }

  function syncModalBodyLock() {
    const anyModalOpen = Boolean(document.querySelector(".modal-overlay.is-open"));
    document.body.classList.toggle("modal-open", anyModalOpen);
  }

  function openModal(id) {
    document.getElementById(id)?.classList.add("is-open");
    syncModalBodyLock();
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove("is-open");
    syncModalBodyLock();
  }

  function setBurgerOpen(open) {
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileDrawer = document.getElementById("mobileDrawer");
    const mobileBackdrop = document.getElementById("mobileBackdrop");
    if (!burgerBtn || !mobileDrawer) return;

    mobileDrawer.classList.toggle("is-open", open);
    burgerBtn.classList.toggle("is-open", open);
    mobileBackdrop?.classList.toggle("is-open", open);
    burgerBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  }

  function trustBadgeClass(score) {
    const n = Number(score ?? 5);
    if (n >= 4.8) return "trust-badge--high";
    if (n >= 3.5) return "trust-badge--mid";
    return "trust-badge--low";
  }

  // ================= ШАПКА, ТЕМА, БУРГЕР-МЕНЮ И СЕССИЯ =================
  async function initHeaderAndSession() {
    const theme = window.MPStorage.initTheme();
    updateThemeBtn(theme);

    document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
      const next = window.MPStorage.toggleTheme();
      updateThemeBtn(next);
      showToast(
        next === "dark"
          ? "🌙 Тёмная тема сохранена в localStorage"
          : "☀️ Светлая тема сохранена в localStorage"
      );
    });

    if (window.MPStorage.hasToken()) {
      // Если запущен реальный backend (/api/auth/me), синхронизируем актуальный профиль из БД
      try {
        const me = await window.MPApi.getMe();
        if (me && me.user) window.MPStorage.setUser(me.user);
      } catch (err) {
        if (err.status === 401) window.MPStorage.clearAuth();
      }
    }

    // Адаптивное бургер-меню
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileDrawer = document.getElementById("mobileDrawer");
    const mobileBackdrop = document.getElementById("mobileBackdrop");
    if (burgerBtn && mobileDrawer) {
      burgerBtn.addEventListener("click", () => {
        setBurgerOpen(!mobileDrawer.classList.contains("is-open"));
      });
      mobileBackdrop?.addEventListener("click", () => setBurgerOpen(false));
      window.addEventListener("resize", () => {
        if (window.innerWidth >= 1024 && mobileDrawer.classList.contains("is-open")) {
          setBurgerOpen(false);
        }
      });
    }

    // Мобильные вкладки (360px–767px)
    document.querySelectorAll("[data-mobile-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-mobile-tab");
        document.querySelectorAll("[data-mobile-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.getElementById("swipeLayout")?.setAttribute("data-mobile-view", view);
      });
    });
  }

  function updateThemeBtn(theme) {
    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.textContent = theme === "dark" ? "☀️" : "🌙";
      btn.title = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
    }
  }

  // ================= СПРАВОЧНИКИ БД И ФИЛЬТРЫ (localStorage) =================
  function populateDisciplineSelects() {
    const { disciplines } = state.dictionaries;
    const esports = disciplines.filter((d) => d.category === "esports");
    const itList = disciplines.filter((d) => d.category === "it");

    const optionsHTML = `
      <option value="">Все дисциплины</option>
      <optgroup label="Киберспорт (esports)">
        ${esports.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}
      </optgroup>
      <optgroup label="IT и Хакатоны (it)">
        ${itList.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}
      </optgroup>
    `;

    const fDisc = document.getElementById("fDisciplineId");
    if (fDisc) fDisc.innerHTML = optionsHTML;

  }

  function populateDependentRolesAndRanks(disciplineId, selectedRoleId = "", selectedRankId = "") {
    const { discipline_roles, ranks } = state.dictionaries;
    const discIdNum = Number(disciplineId) || 0;

    const filteredRoles = discIdNum
      ? discipline_roles.filter((r) => r.discipline_id === discIdNum)
      : discipline_roles;

    const filteredRanks = (discIdNum
      ? ranks.filter((rk) => rk.discipline_id === discIdNum)
      : ranks
    ).slice().sort((a, b) => a.sort_order - b.sort_order);

    const roleSelect = document.getElementById("fRoleId");
    if (roleSelect) {
      roleSelect.innerHTML =
        `<option value="">Любая роль</option>` +
        filteredRoles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
      roleSelect.value =
        selectedRoleId && filteredRoles.some((r) => String(r.id) === String(selectedRoleId))
          ? String(selectedRoleId)
          : "";
    }

    const rankSelect = document.getElementById("fRankId");
    if (rankSelect) {
      rankSelect.innerHTML =
        `<option value="">Любой ранг / грейд</option>` +
        filteredRanks.map((rk) => `<option value="${rk.id}">${esc(rk.name)}</option>`).join("");
      rankSelect.value =
        selectedRankId && filteredRanks.some((rk) => String(rk.id) === String(selectedRankId))
          ? String(selectedRankId)
          : "";
    }
  }

  const SEARCH_MODE_MAP = {
    all:            { card_type: "all",    category: "all" },
    esports_player: { card_type: "player", category: "esports" },
    esports_team:   { card_type: "team",   category: "esports" },
    dev_player:     { card_type: "player", category: "it" },
    dev_team:       { card_type: "team",   category: "it" }
  };

  function resolveSearchMode(filters) {
    const ct = filters.card_type || "all";
    const cat = filters.category || "all";
    if (ct === "player" && cat === "esports") return "esports_player";
    if (ct === "team"   && cat === "esports") return "esports_team";
    if (ct === "player" && cat === "it")      return "dev_player";
    if (ct === "team"   && cat === "it")      return "dev_team";
    return "all";
  }

  function applyModeTheme(mode) {
    document.documentElement.setAttribute("data-mode", mode || "all");
  }

  function filterDisciplineOptionsByCategory(category) {
    const fDisc = document.getElementById("fDisciplineId");
    if (!fDisc) return;
    const { disciplines } = state.dictionaries;
    const list = category && category !== "all"
      ? disciplines.filter((d) => d.category === category)
      : disciplines;

    const esports = list.filter((d) => d.category === "esports");
    const itList = list.filter((d) => d.category === "it");

    let html = `<option value="">Все дисциплины</option>`;
    if (esports.length) {
      html += `<optgroup label="Киберспорт (esports)">${esports.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</optgroup>`;
    }
    if (itList.length) {
      html += `<optgroup label="IT и Хакатоны (it)">${itList.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</optgroup>`;
    }
    fDisc.innerHTML = html;
  }

  function syncFiltersToUI(filters) {
    const mode = resolveSearchMode(filters);
    applyModeTheme(mode);

    document.querySelectorAll("[data-search-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-search-mode") === mode);
    });

    filterDisciplineOptionsByCategory(filters.category);
    const fDisc = document.getElementById("fDisciplineId");
    if (fDisc) {
      const valid = Array.from(fDisc.options).some((o) => String(o.value) === String(filters.discipline_id));
      fDisc.value = valid ? (filters.discipline_id || "") : "";
    }

    const activeDiscId = fDisc ? fDisc.value : filters.discipline_id;
    const defaultCatDisc = !activeDiscId && filters.category === "it"
      ? (state.dictionaries.disciplines.find((d) => d.category === "it")?.id || "")
      : activeDiscId;
    populateDependentRolesAndRanks(defaultCatDisc, filters.role_id, filters.rank_id);

    const fPrime = document.getElementById("fPrimeTime");
    if (fPrime) fPrime.value = filters.prime_time || "";

    const fTrust = document.getElementById("fMinTrust");
    if (fTrust) fTrust.value = filters.min_trust || "";
  }

  function initFilters() {
    populateDisciplineSelects();
    const saved = window.MPStorage.getFilters();
    syncFiltersToUI(saved);
    document.querySelectorAll("[data-search-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-search-mode");
        const preset = SEARCH_MODE_MAP[mode] || SEARCH_MODE_MAP.all;
        const updated = window.MPStorage.setFilters({
          card_type: preset.card_type,
          category: preset.category,
          discipline_id: "",
          role_id: "",
          rank_id: ""
        });
        syncFiltersToUI(updated);
        loadCards();
      });
    });
    document.querySelectorAll("[data-card-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card_type = btn.getAttribute("data-card-type");
        const updated = window.MPStorage.setFilters({ card_type });
        syncFiltersToUI(updated);
        loadCards();
      });
    });

    document.getElementById("fDisciplineId")?.addEventListener("change", (e) => {
      const discipline_id = e.target.value;
      populateDependentRolesAndRanks(discipline_id, "", "");
      window.MPStorage.setFilters({ discipline_id, role_id: "", rank_id: "" });
      loadCards();
      showToast("🎛 Дисциплина обновлена (роли и ранги синхронизированы)");
    });

    const form = document.getElementById("filtersForm");
    form?.addEventListener("change", (e) => {
      if (e.target.id === "fDisciplineId") return;
      window.MPStorage.setFilters({
        discipline_id: document.getElementById("fDisciplineId").value,
        role_id: document.getElementById("fRoleId").value,
        rank_id: document.getElementById("fRankId").value,
        prime_time: document.getElementById("fPrimeTime").value,
        min_trust: document.getElementById("fMinTrust").value
      });
      loadCards();
      showToast("💾 Фильтры сохранены в localStorage");
    });

    document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
      const defaults = window.MPStorage.resetFilters();
      syncFiltersToUI(defaults);
      loadCards();
      showToast("🔄 Фильтры сброшены");
    });
  }

  // ================= ЗАГРУЗКА И ОТРИСОВКА КОЛОДЫ КАРТОЧЕК =================
  function pickPrimaryDiscipline(card, activeFilters) {
    const pds = Array.isArray(card.profile_disciplines) ? card.profile_disciplines : [];
    if (!pds.length) return {};
    if (activeFilters.discipline_id) {
      const match = pds.find((pd) => Number(pd.discipline_id) === Number(activeFilters.discipline_id));
      if (match) return match;
    }
    return pds[0];
  }

  async function loadCards() {
    if (!window.MPStorage.isAuthenticated()) {
      state.cards = [];
      renderDeck();
      return;
    }
    const filters = window.MPStorage.getFilters();
    try {
      const replay = window.MPStorage.getDeckReplay();
      const res = await window.MPApi.getCards(filters, replay !== null);
      const viewedKeys = new Set(replay ?? window.MPStorage.getViewedCardIds());

      const currentUserId = window.MPStorage.getUser()?.id || 0;
      state.cards = (res.cards || [])
        .filter((c) => c.user_id !== currentUserId && !viewedKeys.has(c.card_key))
        .map((c) => ({
          ...c,
          primary_discipline: pickPrimaryDiscipline(c, filters)
        }));
      renderDeck();
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    }
  }

  function renderDeck() {
    const stack = document.getElementById("cardStack");
    const counter = document.getElementById("deckCounter");
    if (!stack) return;
    const signedIn = window.MPStorage.isAuthenticated();
    stack.closest(".deck-stage").classList.toggle("is-guest", !signedIn);
    if (!signedIn) {
      if (counter) counter.textContent = "АНКЕТЫ";
      stack.innerHTML = `
        <div class="deck-empty">
          <h3>Войдите в аккаунт, чтобы смотреть анкеты</h3>
          <button type="button" class="arcade-btn-mint" id="deckLoginBtn">Войти</button>
        </div>`;
      document.getElementById("deckLoginBtn").onclick = () => window.MPAuth.openLoginModal();
      return;
    }

    if (counter) {
      counter.innerHTML = `Найдено в выдаче: <b>${state.cards.length}</b>`;
    }

    if (!state.cards.length) {
      stack.innerHTML = `
        <div class="deck-empty">
          <div class="deck-empty__icon">🎯</div>
          <h3>Анкеты по выбранным фильтрам закончились</h3>
          <p class="text-sm text-secondary">
            Сбросьте параметры поиска в <code>localStorage</code> или очистите историю просмотров текущей сессии в <code>sessionStorage</code>.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px">
            <button type="button" class="btn btn--primary btn--sm" id="reloadDeckBtn">🔄 Показать просмотренные снова</button>
            <button type="button" class="btn btn--ghost btn--sm" id="emptyResetBtn">Сбросить фильтры</button>
          </div>
        </div>
      `;
      document.getElementById("reloadDeckBtn")?.addEventListener("click", () => {
        window.MPStorage.restartDeck();
        renderSessionHistory();
        loadCards();
      });
      document.getElementById("emptyResetBtn")?.addEventListener("click", () => {
        const defaults = window.MPStorage.resetFilters();
        syncFiltersToUI(defaults);
        loadCards();
      });
      return;
    }

    const visible = state.cards.slice(0, 3);
    stack.innerHTML = visible.map((card, idx) => buildCardHTML(card, idx)).join("");

    const topCardEl = stack.querySelector(".swipe-card.is-top");
    if (topCardEl) {
      attachPointerSwipe(topCardEl);
      topCardEl.querySelector(".js-card-report-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!state.cards.length) return;
        const viewer = window.MPStorage.getUser();
        if (viewer.role === "guest") {
          showToast("🔒 Жалобы доступны только авторизованным пользователям. Войдите через кнопку в шапке!");
          return;
        }
        const top = state.cards[0];
        state.reportTargetCard = top;
        const label = document.getElementById("reportTargetLabel");
        if (label) {
          label.textContent = top.card_type === "team" && top.team
            ? `${top.team.name} (@${top.nickname}, user_id: ${top.user_id})`
            : `@${top.nickname} (user_id: ${top.user_id})`;
        }
        openModal("reportModal");
      });
    }
  }

  function buildCardHTML(card, index) {
    const posClass = index === 0 ? "is-top" : index === 1 ? "is-next" : "is-third";
    const pds = Array.isArray(card.profile_disciplines) ? card.profile_disciplines : [];
    const pd = card.primary_discipline || pds[0] || {};
    const isTeam = card.card_type === "team" && card.team;
    const trustNum = Number(card.trust_score ?? 5).toFixed(2);
    const trustCls = trustBadgeClass(card.trust_score);

    const hasEsports = pds.some((d) => d.category === "esports");
    const hasIt = pds.some((d) => d.category === "it");

    const badges = [];
    if (isTeam) {
      const teamDisc = pds.find((d) => Number(d.discipline_id) === Number(card.team.discipline_id)) || pd;
      const teamLabel = teamDisc.category === "it"
        ? `🚀 Команда разрабов (${esc(card.team.members_count || 3)}/5)`
        : `🛡 Команда игроков (${esc(card.team.members_count || 3)}/5)`;
      badges.push(`<span class="badge badge--team">${teamLabel}</span>`);
    } else {
      if (hasEsports) {
        badges.push(`<span class="badge badge--esports">🎮 Игрок</span>`);
      }
      if (hasIt) {
        badges.push(`<span class="badge badge--it">💻 Разработчик</span>`);
      }
      if (!badges.length) {
        badges.push(`<span class="badge badge--esports">🎮 Игрок</span>`);
      }
    }
    const typeBadge = `<div class="card-hero__badges" style="display:flex;flex-wrap:wrap;gap:6px;">${badges.join("")}</div>`;

    const allRolesText = [...new Set(pds.map((d) => d.role_name).filter(Boolean))].join(", ");
    const allRanksText = [...new Set(pds.map((d) => d.rank_name).filter(Boolean))].join(", ");

    const title = isTeam ? card.team.name : `@${card.nickname}`;
    const subtitle = isTeam
      ? `Капитан @${card.nickname} • Ищем: ${card.team.looking_for_role_name || pd.role_name}`
      : pds.length > 1
        ? pds.map((d) => `${d.discipline_name} • ${d.role_name || "Универсал"}`).join("  |  ")
        : `${pd.discipline_name || "MatchPoint"} • ${pd.role_name || "Универсал"}`;

    const extLinks = card.external_links || {};
    const extHTML = Object.entries(extLinks)
      .map(([platform, url]) => `<a class="ext-pill" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(platform.toUpperCase())} ↗</a>`)
      .join("");

    const discChips = (card.profile_disciplines || [])
      .map((d) => `<span class="skill-chip">${esc(d.discipline_name)}: ${esc(d.role_name)} (${esc(d.rank_name || "—")})</span>`)
      .join("");

    return `
      <article class="swipe-card ${posClass}" data-card-key="${esc(card.card_key)}" data-user-id="${esc(card.user_id)}">
        <div class="swipe-stamp swipe-stamp--like">ЛАЙК 💚</div>
        <div class="swipe-stamp swipe-stamp--skip">ПРОПУСК ✕</div>

        <div class="card-hero" style="background: ${card.gradient || "linear-gradient(135deg, #2b1d52, #5e35b1)"};">
         <div class="card-hero__top">
            ${typeBadge}
            <div class="card-hero__right">
              <span class="trust-badge ${trustCls}" title="Репутация profiles.trust_score">
                ♥ ${trustNum} / 5.00
              </span>
              <button type="button" class="arcade-btn arcade-btn--xs text-coral js-card-report-btn" title="Пожаловаться на профиль">!</button>
            </div>
          </div>

          <div class="card-hero__profile">
            <div class="card-avatar">${avatarInnerHTML(card.avatar_url, isTeam ? card.team.name : card.nickname)}</div>
            <div class="card-identity">
              <h2>${esc(title)}</h2>
              <p>${esc(subtitle)}</p>
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="card-metrics">
            <div class="metric-box">
              <span>Ранг / Грейд</span>
              <b title="${esc(allRanksText || pd.rank_name || "Любой")}">${esc(allRanksText || pd.rank_name || "Любой")}</b>
            </div>
            <div class="metric-box">
              <span>${isTeam ? "Вакансия" : (pds.length > 1 ? "Роли" : "Роль")}</span>
              <b title="${esc(isTeam ? card.team.looking_for_role_name : (allRolesText || pd.role_name))}">${esc((isTeam ? card.team.looking_for_role_name : (allRolesText || pd.role_name)) || "—")}</b>
            </div>
            <div class="metric-box">
              <span>Прайм-тайм</span>
              <b>${esc(card.prime_time || "Гибкий")}</b>
            </div>
          </div>

          <p class="card-bio">${esc(card.bio || "Готов к совместным играм и турнирам!")}</p>

          <div class="card-tags">
            ${discChips}
          </div>

          <div class="card-links">
            <span>Внешние профили:</span>
            <div class="ext-profiles">
              ${extHTML || '<span class="ext-pill">Не указаны</span>'}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // ================= ПЕРЕТАСКИВАНИЕ МЫШЬЮ И ТАЧЕМ (POINTER EVENTS) =================
  function attachPointerSwipe(cardEl) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;

    const stampLike = cardEl.querySelector(".swipe-stamp--like");
    const stampSkip = cardEl.querySelector(".swipe-stamp--skip");

    cardEl.addEventListener("pointerdown", (e) => {
      if (state.isAnimating || e.target.closest("a, button")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      dy = 0;
      cardEl.classList.remove("is-animating");
      try {
        cardEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    let rafId = null;
    cardEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;

      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!dragging) return;
        const rotate = dx * 0.045;
        cardEl.style.transform = `translate3d(${dx}px, ${dy * 0.35}px, 0) rotate(${rotate}deg)`;
        if (stampLike) stampLike.style.opacity = dx > 25 ? String(Math.min((dx - 25) / 85, 1)) : "0";
        if (stampSkip) stampSkip.style.opacity = dx < -25 ? String(Math.min((-dx - 25) / 85, 1)) : "0";
      });
    });

    function finishGesture() {
      if (!dragging) return;
      dragging = false;

      if (dx >= SWIPE_THRESHOLD_X) {
        performSwipe(true);
      } else if (dx <= -SWIPE_THRESHOLD_X) {
        performSwipe(false);
      } else {
        cardEl.classList.add("is-animating");
        cardEl.style.transform = "";
        if (stampLike) stampLike.style.opacity = "0";
        if (stampSkip) stampSkip.style.opacity = "0";
      }
    }

    cardEl.addEventListener("pointerup", finishGesture);
    cardEl.addEventListener("pointercancel", finishGesture);
  }

  // ================= ВЫПОЛНЕНИЕ СВАЙПА (swipes.is_like BOOLEAN) =================
  async function performSwipe(isLike) {
    if (state.isAnimating || !state.cards.length) return;

    const currentUser = window.MPStorage.getUser();
    if (!currentUser || currentUser.role === "guest") {
      showToast("🔒 Гость может только просматривать карточки. Войдите или смените роль в шапке!");
      const topEl = document.querySelector(".swipe-card.is-top");
      if (topEl) {
        topEl.classList.add("is-animating");
        topEl.style.transform = "";
        topEl.querySelectorAll(".swipe-stamp").forEach((s) => { s.style.opacity = "0"; });
      }
      return;
    }

    state.isAnimating = true;
    const card = state.cards[0];
    const topEl = document.querySelector(".swipe-card.is-top");

    if (topEl) {
      topEl.classList.add("is-animating");
      const stamp = topEl.querySelector(isLike ? ".swipe-stamp--like" : ".swipe-stamp--skip");
      if (stamp) stamp.style.opacity = "1";
      const flyX = isLike ? window.innerWidth * 0.85 : -window.innerWidth * 0.85;
      const rot = isLike ? 24 : -24;
      topEl.style.transform = `translate3d(${flyX}px, 24px, 0) rotate(${rot}deg)`;
      topEl.style.opacity = "0";
    }

    setTimeout(async () => {
      state.cards.shift();
      window.MPStorage.addViewedCard(card, isLike);
      renderSessionHistory();
      renderDeck();
      state.isAnimating = false;

      try {
        const res = await window.MPApi.sendSwipe({
          to_user_id: card.user_id,
          is_like: Boolean(isLike)
        });

        if (res && res.matched && res.match) {
          await loadMatches();
          openMatchCelebration(res.match);
        }
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      }
    }, 270);
  }

  function cardMatchesFilters(card, filters) {
    if (!card) return false;
    const ct = filters.card_type || "all";
    if (ct !== "all" && card.card_type !== ct) return false;

    const pds = Array.isArray(card.profile_disciplines) ? card.profile_disciplines : [];
    const cat = filters.category || "all";
    if (cat !== "all" && !pds.some((d) => d.category === cat)) return false;
    if (filters.discipline_id && !pds.some((d) => Number(d.discipline_id) === Number(filters.discipline_id))) return false;
    if (filters.role_id && !pds.some((d) => Number(d.role_id) === Number(filters.role_id))) return false;
    if (filters.rank_id && !pds.some((d) => Number(d.rank_id) === Number(filters.rank_id))) return false;
    if (filters.prime_time && !String(card.prime_time || "").includes(filters.prime_time)) return false;
    if (filters.min_trust && Number(card.trust_score) < Number(filters.min_trust)) return false;
    return true;
  }

  async function undoLastSwipe() {
    if (state.isAnimating) return;
    const last = window.MPStorage.popLastViewedCard();
    if (!last || !last.cardSnapshot) {
      showToast("ℹ️ В истории текущей сессии нет карточек для возврата");
      return;
    }

    try {
      await window.MPApi.undoSwipe(last.to_user_id);
    } catch (err) {
      showToast(`⚠️ Не удалось отменить свайп: ${err.message}`);
    }

    const filters = window.MPStorage.getFilters();
    const fitsCurrentTab = cardMatchesFilters(last.cardSnapshot, filters);

    await Promise.all([loadCards(), loadMatches()]);
    if (fitsCurrentTab) {
      state.cards = [
        last.cardSnapshot,
        ...state.cards.filter((c) => c.card_key !== last.cardSnapshot.card_key)
      ];
      renderDeck();
      showToast(`↶ Возвращена карточка: ${last.display_title}`);
    } else {
      showToast(`↶ Свайп отменён: ${last.display_title} возвращена в свою категорию`);
    }
    renderSessionHistory();
  }

  // ================= ВЗАИМНЫЕ МЭТЧИ (matches + contacts JSONB) =================
  async function loadMatches() {
    if (!window.MPStorage.isAuthenticated()) {
      state.matches = [];
      renderMatches();
      return;
    }
    try {
      const res = await window.MPApi.getMatches();
      state.matches = res.matches || [];
      renderMatches();
    } catch (_) {}
  }

  function renderMatches() {
    document.querySelectorAll(".js-matches-count").forEach((el) => {
      el.textContent = String(state.matches.length);
    });

    const listEl = document.getElementById("matchesList");
    if (!listEl) return;

    if (!state.matches.length) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:28px 12px;color:var(--text-muted);font-size:0.84rem">
          Взаимных мэтчей пока нет.<br>При совпадении лайков здесь раскроется <code>profiles.contacts</code> и лобби-чат.
        </div>
      `;
      return;
    }

    listEl.innerHTML = state.matches.map((m) => {
      const p = m.partner || {};
      const contacts = p.contacts || {};
      const contactButtons = Object.entries(contacts)
        .map(([key, val]) => `<button type="button" class="contact-tag" data-copy="${esc(val)}">📋 ${esc(key)}: ${esc(val)}</button>`)
        .join("");

      return `
        <div class="match-item">
          <div class="match-item__head">
            <div class="match-item__avatar" style="background:${p.gradient || "linear-gradient(135deg,#7c5cff,#4f46e5)"}">
              ${avatarInnerHTML(p.avatar_url, p.nickname)}
            </div>
            <div class="match-item__info">
              <b>${esc(p.nickname)}</b>
              <span>${esc(p.discipline_name || "")} • ${esc(p.role_name || "")} • ★ ${Number(p.trust_score || 5).toFixed(2)}</span>
            </div>
            <button type="button" class="btn btn--primary btn--sm" data-open-chat="${p.user_id}">💬 Чат</button>
          </div>
          <div class="match-contacts">
            ${contactButtons || `<span class="text-xs text-muted">Контакты не заполнены</span>`}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-copy");
        navigator.clipboard?.writeText(val).catch(() => {});
        showToast(`📋 Скопировано из profiles.contacts: ${val}`);
      });
    });

    listEl.querySelectorAll("[data-open-chat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = Number(btn.getAttribute("data-open-chat"));
        const found = state.matches.find((m) => m.partner.user_id === uid);
        if (found) openLobbyChat(found.partner);
      });
    });
  }

  function openMatchCelebration(matchObj) {
    const p = matchObj.partner || {};
    const viewer = window.MPStorage.getUser();

    const viewerAv = document.getElementById("matchViewerAvatar");
    if (viewerAv) viewerAv.innerHTML = avatarInnerHTML(viewer.avatar_url, viewer.nickname);

    const targetAv = document.getElementById("matchTargetAvatar");
    if (targetAv) {
      targetAv.innerHTML = avatarInnerHTML(p.avatar_url, p.nickname);
      targetAv.style.background = p.gradient || "linear-gradient(135deg, #16a34a, #15803d)";
    }

    document.getElementById("matchTargetName").textContent = p.nickname || "тиммейт";
    document.getElementById("matchTargetMeta").textContent =
      `${p.discipline_name || ""} • ${p.role_name || ""} • Trust ★ ${Number(p.trust_score || 5).toFixed(2)}`;

    const contacts = p.contacts || {};
    document.getElementById("matchModalContacts").innerHTML = Object.entries(contacts)
      .map(([k, v]) => `<span class="skill-chip">${esc(k)}: ${esc(v)}</span>`)
      .join("");

    document.getElementById("matchOpenChatBtn").onclick = () => {
      closeModal("matchModal");
      openLobbyChat(p);
    };

    openModal("matchModal");
  }

  function openLobbyChat(partner) {
    state.activePartnerForChat = partner;
    document.getElementById("chatTitle").textContent = `Лобби-чат с ${partner.nickname}`;
    const cStr = Object.entries(partner.contacts || {}).map(([k, v]) => `${k}: ${v}`).join(" • ");
    document.getElementById("chatSub").textContent = cStr || partner.discipline_name || "";

    if (!state.chatMessagesByUser[partner.user_id]) {
      state.chatMessagesByUser[partner.user_id] = [
        { from: "them", text: partner.greeting || "Привет! Отличный мэтч, идём в лобби?" }
      ];
    }
    renderChatMessages(partner.user_id);

    const chatInput = document.getElementById("chatInput");
    const draftKey = `lobby_msg_${partner.user_id}`;
    const saved = window.MPStorage.getDraft(draftKey);
    chatInput.value = saved?.text || "";
    chatInput.oninput = () => {
      window.MPStorage.saveDraft(draftKey, { text: chatInput.value });
    };

    openModal("chatModal");
    chatInput.focus();
  }

  function renderChatMessages(userId) {
    const box = document.getElementById("chatMessages");
    const list = state.chatMessagesByUser[userId] || [];
    box.innerHTML = list.map((m) => `
      <div class="chat-bubble ${m.from === "me" ? "chat-bubble--me" : "chat-bubble--them"}">
        ${esc(m.text)}
      </div>
    `).join("");
    box.scrollTop = box.scrollHeight;
  }

  // ================= МОДАЛКИ: ЧЕРНОВИК ВАКАНСИИ, ЖАЛОБЫ И АВТОРИЗАЦИЯ =================
  function initFormsAndModals() {
    // 1. Лобби-чат (с проверкой users.status === 'muted' из 01_schema.sql)
    document.getElementById("chatForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const viewer = window.MPStorage.getUser();
      if (viewer?.status === "muted") {
        showToast("🔇 Ваш аккаунт в статусе muted (мут) — отправка сообщений в чат заблокирована");
        return;
      }
      const partner = state.activePartnerForChat;
      const input = document.getElementById("chatInput");
      const text = input.value.trim();
      if (!partner || !text) return;

      state.chatMessagesByUser[partner.user_id].push({ from: "me", text });
      input.value = "";
      window.MPStorage.clearDraft(`lobby_msg_${partner.user_id}`);
      renderChatMessages(partner.user_id);

      setTimeout(() => {
        state.chatMessagesByUser[partner.user_id].push({
          from: "them",
          text: "Договорились! Захожу в Discord / лобби 🚀"
        });
        if (state.activePartnerForChat?.user_id === partner.user_id) {
          renderChatMessages(partner.user_id);
        }
      }, 650);
    });

    // 2. Модалка «+ ВАКАНСИЯ» (черновик формы в sessionStorage + POST /api/teams)
    const draftForm = document.getElementById("teamVacancyDraftForm");
    const draftDiscSelect = document.getElementById("draftDisciplineId");
    const draftRoleSelect = document.getElementById("draftLookingRoleId");
    const DRAFT_KEY = "team_vacancy_draft";

    const fillDraftRoleSelect = (disciplineId) => {
      if (!draftRoleSelect) return;
      const { discipline_roles } = state.dictionaries;
      const discNum = Number(disciplineId) || 0;
      const roles = discNum
        ? discipline_roles.filter((r) => r.discipline_id === discNum)
        : discipline_roles;
      draftRoleSelect.innerHTML =
        `<option value="">Любая роль</option>` +
        roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
    };

    const populateDraftDisciplines = () => {
      if (!draftDiscSelect) return;
      const { disciplines } = state.dictionaries;
      const esports = disciplines.filter((d) => d.category === "esports");
      const itList = disciplines.filter((d) => d.category === "it");
      draftDiscSelect.innerHTML =
        `<option value="">Выберите дисциплину</option>` +
        (esports.length
          ? `<optgroup label="Киберспорт (esports)">${esports.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</optgroup>`
          : "") +
        (itList.length
          ? `<optgroup label="IT и Хакатоны (it)">${itList.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</optgroup>`
          : "");
    };

    const openDraftModal = () => {
      const viewer = window.MPStorage.getUser();
      if (!viewer || viewer.role === "guest") {
        showToast("🔒 Публикация вакансий доступна капитанам. Войдите через кнопку в шапке!");
        window.MPAuth.openLoginModal();
        return;
      }
      if (viewer.role !== "captain") {
        showToast("🛡 Создавать команду и вакансию может только капитан. Выберите демо-профиль капитана в форме входа (например, KuroCap)!");
        return;
      }
      openModal("draftModal");
    };

    document.getElementById("openDraftModalBtn")?.addEventListener("click", openDraftModal);
    document.getElementById("mobileOpenDraftBtn")?.addEventListener("click", () => {
      setBurgerOpen(false);
      openDraftModal();
    });

    // Каскадное заполнение: discipline_id -> looking_for_role_id
    draftDiscSelect?.addEventListener("change", () => fillDraftRoleSelect(draftDiscSelect.value));

    if (draftForm) {
      populateDraftDisciplines();
      // Автосохранение черновика в sessionStorage + восстановление при повторном открытии
      window.MPStorage.bindFormDraft(draftForm, DRAFT_KEY, (draft) => {
        fillDraftRoleSelect(draft.discipline_id ?? draftDiscSelect?.value);
        const badge = document.getElementById("draftRestoredBadge");
        if (badge) badge.style.display = "inline-flex";
      });

      draftForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const viewer = window.MPStorage.getUser();
        if (!viewer || viewer.role === "guest") {
          showToast("🔒 Войдите под аккаунтом капитана, чтобы опубликовать вакансию");
          return;
        }
        if (viewer.role !== "captain") {
          showToast("🛡 Публиковать вакансии может только капитан команды");
          return;
        }

        const name = document.getElementById("draftTeamName")?.value.trim() || "";
        const disciplineId = Number(draftDiscSelect?.value || 0);
        const roleId = Number(draftRoleSelect?.value || 0) || null;
        const description = document.getElementById("draftDescription")?.value.trim() || "";

        if (name.length < 3 || name.length > 50) {
          showToast("⚠️ Название команды должно быть от 3 до 50 символов");
          return;
        }
        if (!disciplineId) {
          showToast("⚠️ Выберите дисциплину команды");
          return;
        }

        const submitBtn = draftForm.querySelector("[type=submit]");
        if (submitBtn) submitBtn.disabled = true;
        try {
          await window.MPApi.createTeam({
            name,
            discipline_id: disciplineId,
            looking_for_role_id: roleId,
            description
          });
          window.MPStorage.clearDraft(DRAFT_KEY);
          draftForm.reset();
          populateDraftDisciplines();
          const badge = document.getElementById("draftRestoredBadge");
          if (badge) badge.style.display = "none";
          closeModal("draftModal");
          showToast(`🚀 Команда «${name}» создана, вакансия опубликована (POST /api/teams)`);
        } catch (err) {
          showToast(`⚠️ ${err.message}`);
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // 3. Жалоба модератору (reports)
    document.getElementById("reportForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.reportTargetCard) return;
      const reason = document.getElementById("reportReason").value.trim();
      if (reason.length < 5) {
        showToast("⚠️ Опишите причину подробнее — сервер принимает минимум 5 символов");
        return;
      }

      try {
        await window.MPApi.sendReport({
          target_user_id: state.reportTargetCard.user_id,
          reason
        });
        document.getElementById("reportReason").value = "";
        closeModal("reportModal");
        showToast(`🚩 Жалоба на @${state.reportTargetCard.nickname} передана модераторам`);
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      }
    });

  }

  // ================= ИСТОРИЯ ПРОСМОТРОВ В sessionStorage =================
  function renderSessionHistory() {
    const list = window.MPStorage.getViewedCards();
    const countEl = document.getElementById("sessionHistoryCount");
    if (countEl) countEl.textContent = String(list.length);

    const box = document.getElementById("historyList");
    if (!box) return;

    if (!list.length) {
      box.innerHTML = `
        <div style="text-align:center;padding:24px 10px;color:var(--text-muted);font-size:0.82rem">
          Просмотренных карточек в текущей сессии пока нет.<br>Хранилище: <code>sessionStorage</code>.
        </div>
      `;
      return;
    }

    box.innerHTML = list.map((item) => `
      <div class="history-row">
        <div>
          <b style="display:block">${esc(item.display_title)}</b>
          <span style="font-size:0.73rem;color:var(--text-secondary)">${esc(item.discipline_name)} • ${esc(item.created_at)}</span>
        </div>
        ${item.is_like
          ? `<span class="trust-badge trust-badge--high">♥ Лайк</span>`
          : `<span class="badge" style="background:var(--accent-skip-soft);color:var(--accent-skip)">✕ Пропуск</span>`}
      </div>
    `).join("");
  }

  // ================= КНОПКИ И ГОРЯЧИЕ КЛАВИШИ =================
  function initControls() {
    document.getElementById("btnLike")?.addEventListener("click", () => performSwipe(true));
    document.getElementById("btnSkip")?.addEventListener("click", () => performSwipe(false));
    document.getElementById("btnUndo")?.addEventListener("click", undoLastSwipe);

    // Кнопка #btnReport удалена: жалоба теперь только через «!» на карточке (.js-card-report-btn)

    window.MPAuth.bindAccountButtons(() => window.MPAuth.openLoginModal(), () => setBurgerOpen(false));

    document.querySelectorAll("[data-right-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-right-tab");
        document.querySelectorAll("[data-right-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.getElementById("matchesTabBody").style.display = tab === "matches" ? "block" : "none";
        document.getElementById("historyTabBody").style.display = tab === "history" ? "block" : "none";
      });
    });

    document.getElementById("clearHistoryBtn")?.addEventListener("click", () => {
      window.MPStorage.restartDeck();
      renderSessionHistory();
      loadCards();
      showToast("🧹 История sessionStorage очищена");
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close-modal")));
    });

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("is-open");
          syncModalBodyLock();
        }
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (document.getElementById("mobileDrawer")?.classList.contains("is-open")) {
          setBurgerOpen(false);
          return;
        }
        if (document.querySelector(".modal-overlay.is-open")) {
          document.querySelectorAll(".modal-overlay.is-open").forEach((m) => m.classList.remove("is-open"));
          syncModalBodyLock();
          return;
        }
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (!window.MPStorage.isAuthenticated() || document.querySelector(".modal-overlay.is-open")) return;

      if (e.key === "ArrowLeft") { e.preventDefault(); performSwipe(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); performSwipe(true); }
      else if (e.key === "Backspace") { e.preventDefault(); undoLastSwipe(); }
    });
  }

  // ================= ИНИЦИАЛИЗАЦИЯ =================
  document.addEventListener("DOMContentLoaded", async () => {
    await initHeaderAndSession();
    initControls();
    initFormsAndModals();
    if (!window.MPStorage.isAuthenticated()) renderDeck();
    state.dictionaries = await window.MPApi.getDictionaries();
    initFilters();
    renderSessionHistory();
    await Promise.all([loadCards(), loadMatches()]);
  });
})();

