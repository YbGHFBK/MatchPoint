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
    authMode: "login" // 'login' | 'register'
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
  function updateHeaderAuthUI() {
    const user = window.MPStorage.getUser();
    const roleSelect = document.getElementById("roleSwitcher");
    const mobileRoleSelect = document.getElementById("mobileRoleSwitcher");
    const authBtn = document.getElementById("openAuthModalBtn");

    if (roleSelect && Array.from(roleSelect.options).some((o) => Number(o.value) === Number(user.id))) {
      roleSelect.value = String(user.id);
    }
    if (mobileRoleSelect && Array.from(mobileRoleSelect.options).some((o) => Number(o.value) === Number(user.id))) {
      mobileRoleSelect.value = String(user.id);
    }
    if (authBtn) {
      authBtn.textContent = user.role === "guest" ? "🔐 Войти" : `👤 ${user.nickname}`;
      authBtn.title = `${user.email || "Гость"} • роль: ${user.role} • статус: ${user.status}`;
    }
  }

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

    // Если токен ещё не задан — инициализируем демо-аккаунт ShadowStep (id: 5 из 02_seed.sql)
    if (!window.MPStorage.getToken() && window.MPStorage.getUser().role !== "guest") {
      try {
        await window.MPApi.switchSeedAccount(window.MPStorage.getUser().id || 5);
      } catch (_) {}
    } else if (window.MPStorage.getToken()) {
      // Если запущен реальный backend (/api/auth/me), синхронизируем актуальный профиль из БД
      try {
        const me = await window.MPApi.getMe();
        if (me && me.user) window.MPStorage.setUser(me.user);
      } catch (_) {}
    }

    updateHeaderAuthUI();

    const roleSelect = document.getElementById("roleSwitcher");
    const mobileRoleSelect = document.getElementById("mobileRoleSwitcher");

    async function handleAccountSwitch(userIdValue) {
      try {
        const res = await window.MPApi.switchSeedAccount(Number(userIdValue));
        window.MPStorage.clearViewedCards();
        updateHeaderAuthUI();
        renderSessionHistory();
        await Promise.all([loadCards(), loadMatches()]);
        const u = res.user;
        const modeTag = res.source === "server" ? "JWT от PostgreSQL" : "02_seed.sql";
        showToast(`👤 Аккаунт: @${u.nickname} (${u.role}${u.status === "muted" ? ", muted" : ""}) • ${modeTag}`);
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      }
    }

    roleSelect?.addEventListener("change", () => handleAccountSwitch(roleSelect.value));
    mobileRoleSelect?.addEventListener("change", () => {
      setBurgerOpen(false);
      handleAccountSwitch(mobileRoleSelect.value);
    });

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

    const draftDisc = document.getElementById("draftDisciplineId");
    if (draftDisc) {
      draftDisc.innerHTML = disciplines
        .map((d) => `<option value="${d.id}">${esc(d.name)} (${d.category})</option>`)
        .join("");
    }
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

  function syncFiltersToUI(filters) {
    document.querySelectorAll("[data-card-type]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-card-type") === filters.card_type);
    });

    const fDisc = document.getElementById("fDisciplineId");
    if (fDisc) fDisc.value = filters.discipline_id || "";

    populateDependentRolesAndRanks(filters.discipline_id, filters.role_id, filters.rank_id);

    const fPrime = document.getElementById("fPrimeTime");
    if (fPrime) fPrime.value = filters.prime_time || "";

    const fTrust = document.getElementById("fMinTrust");
    if (fTrust) fTrust.value = filters.min_trust || "";
  }

  function initFilters() {
    populateDisciplineSelects();
    const saved = window.MPStorage.getFilters();
    syncFiltersToUI(saved);

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

  async function loadCards(ignoreSessionHistory = false) {
    const filters = window.MPStorage.getFilters();
    try {
      const res = await window.MPApi.getCards(filters);
      const viewedKeys = ignoreSessionHistory
        ? new Set()
        : new Set(window.MPStorage.getViewedCards().map((v) => v.card_key));

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
        window.MPStorage.clearViewedCards();
        renderSessionHistory();
        loadCards(true);
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
    if (topCardEl) attachPointerSwipe(topCardEl);
  }

  function buildCardHTML(card, index) {
    const posClass = index === 0 ? "is-top" : index === 1 ? "is-next" : "is-third";
    const pd = card.primary_discipline || (card.profile_disciplines && card.profile_disciplines[0]) || {};
    const isTeam = card.card_type === "team" && card.team;
    const trustNum = Number(card.trust_score ?? 5).toFixed(2);
    const trustCls = trustBadgeClass(card.trust_score);

    const typeBadge = isTeam
      ? `<span class="badge badge--team">👥 Команда (${esc(card.team.members_count || 3)}/5)</span>`
      : pd.category === "it"
        ? `<span class="badge badge--it">💻 Разработчик</span>`
        : `<span class="badge badge--esports">🎮 Игрок</span>`;

    const title = isTeam ? card.team.name : `@${card.nickname}`;
    const subtitle = isTeam
      ? `Капитан @${card.nickname} • Ищем: ${card.team.looking_for_role_name || pd.role_name}`
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
            <span class="trust-badge ${trustCls}" title="Репутация profiles.trust_score">
              ★ ${trustNum} / 5.00
            </span>
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
              <b title="${esc(pd.rank_name || "Любой")}">${esc(pd.rank_name || "Любой")}</b>
            </div>
            <div class="metric-box">
              <span>${isTeam ? "Вакансия" : "Роль"}</span>
              <b title="${esc(isTeam ? card.team.looking_for_role_name : pd.role_name)}">${esc((isTeam ? card.team.looking_for_role_name : pd.role_name) || "—")}</b>
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

    cardEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;

      const rotate = dx * 0.055;
      cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg)`;

      if (stampLike) stampLike.style.opacity = dx > 25 ? String(Math.min((dx - 25) / 85, 1)) : "0";
      if (stampSkip) stampSkip.style.opacity = dx < -25 ? String(Math.min((-dx - 25) / 85, 1)) : "0";
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

  function undoLastSwipe() {
    if (state.isAnimating) return;
    const last = window.MPStorage.popLastViewedCard();
    if (!last || !last.cardSnapshot) {
      showToast("ℹ️ В истории текущей сессии нет карточек для возврата");
      return;
    }
    window.MPApi.undoSeedSwipe?.(last.to_user_id);
    state.cards.unshift(last.cardSnapshot);
    renderDeck();
    renderSessionHistory();
    showToast(`↶ Возвращена карточка: ${last.display_title}`);
  }

  // ================= ВЗАИМНЫЕ МЭТЧИ (matches + contacts JSONB) =================
  async function loadMatches() {
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

    // 2. Черновик вакансии команды (teams) в sessionStorage
    const draftDiscSelect = document.getElementById("draftDisciplineId");
    const draftRoleSelect = document.getElementById("draftLookingRoleId");

    function updateDraftRoleOptions(discId) {
      const roles = state.dictionaries.discipline_roles.filter(
        (r) => r.discipline_id === Number(discId)
      );
      if (draftRoleSelect) {
        draftRoleSelect.innerHTML = roles
          .map((r) => `<option value="${r.id}">${esc(r.name)}</option>`)
          .join("");
      }
    }

    if (draftDiscSelect) {
      updateDraftRoleOptions(draftDiscSelect.value || 1);
      draftDiscSelect.addEventListener("change", () => updateDraftRoleOptions(draftDiscSelect.value));
    }

    const teamDraftForm = document.getElementById("teamVacancyDraftForm");
    if (teamDraftForm) {
      window.MPStorage.bindFormDraft(teamDraftForm, "team_vacancy_form", (draft) => {
        if (draft.discipline_id) {
          updateDraftRoleOptions(draft.discipline_id);
          if (draft.looking_for_role_id && draftRoleSelect) {
            draftRoleSelect.value = draft.looking_for_role_id;
          }
        }
        const badge = document.getElementById("draftRestoredBadge");
        if (badge && (draft.name || draft.description)) badge.style.display = "inline-flex";
      });

      teamDraftForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const viewer = window.MPStorage.getUser();
        if (viewer.role === "guest") {
          showToast("🔒 Авторизуйтесь, чтобы опубликовать вакансию команды");
          return;
        }

        try {
          await window.MPApi.createTeam({
            name: document.getElementById("draftTeamName").value,
            discipline_id: draftDiscSelect.value,
            looking_for_role_id: draftRoleSelect.value,
            description: document.getElementById("draftDescription").value
          });
          window.MPStorage.clearDraft("team_vacancy_form");
          teamDraftForm.reset();
          updateDraftRoleOptions(draftDiscSelect?.value || 1);
          const badge = document.getElementById("draftRestoredBadge");
          if (badge) badge.style.display = "none";
          closeModal("draftModal");
          loadCards();
          showToast("✅ Вакансия команды опубликована, черновик очищен из sessionStorage");
        } catch (err) {
          showToast(`⚠️ ${err.message}`);
        }
      });
    }

    // 3. Жалоба модератору (reports)
    document.getElementById("reportForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.reportTargetCard) return;
      const reason = document.getElementById("reportReason").value.trim();
      if (!reason) return;

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

    // 4. Модалка реального входа / регистрации (/api/auth/login и /api/auth/register)
    const authTabs = document.querySelectorAll("[data-auth-tab]");
    const nicknameGroup = document.getElementById("authNicknameGroup");
    const authSubmitBtn = document.getElementById("authSubmitBtn");

    authTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.authMode = btn.getAttribute("data-auth-tab");
        authTabs.forEach((b) => b.classList.toggle("is-active", b === btn));
        if (nicknameGroup) nicknameGroup.style.display = state.authMode === "register" ? "flex" : "none";
        if (authSubmitBtn) {
          authSubmitBtn.textContent = state.authMode === "register" ? "Зарегистрироваться" : "Войти в аккаунт";
        }
      });
    });

    document.querySelectorAll("[data-seed-email]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("authEmail").value = btn.getAttribute("data-seed-email");
        document.getElementById("authPassword").value = "password";
      });
    });

    document.getElementById("authForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      const nickname = document.getElementById("authNickname")?.value.trim() || "";

      try {
        const res = state.authMode === "register"
          ? await window.MPApi.register({ email, password, nickname })
          : await window.MPApi.login({ email, password });

        window.MPStorage.clearViewedCards();
        updateHeaderAuthUI();
        renderSessionHistory();
        await Promise.all([loadCards(), loadMatches()]);
        closeModal("authModal");
        showToast(`✅ Вы вошли как @${res.user.nickname} (${res.source === "server" ? "PostgreSQL JWT" : "02_seed.sql"})`);
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

    document.getElementById("btnReport")?.addEventListener("click", () => {
      if (!state.cards.length) return;
      const viewer = window.MPStorage.getUser();
      if (viewer.role === "guest") {
        showToast("🔒 Жалобы доступны только авторизованным пользователям");
        return;
      }
      state.reportTargetCard = state.cards[0];
      document.getElementById("reportTargetLabel").textContent =
        `@${state.reportTargetCard.nickname} (user_id: ${state.reportTargetCard.user_id})`;
      openModal("reportModal");
    });

    document.getElementById("openDraftModalBtn")?.addEventListener("click", () => openModal("draftModal"));
    document.getElementById("mobileOpenDraftBtn")?.addEventListener("click", () => {
      setBurgerOpen(false);
      openModal("draftModal");
    });

    document.getElementById("openAuthModalBtn")?.addEventListener("click", () => openModal("authModal"));
    document.getElementById("mobileOpenAuthBtn")?.addEventListener("click", () => {
      setBurgerOpen(false);
      openModal("authModal");
    });

    document.querySelectorAll("[data-right-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-right-tab");
        document.querySelectorAll("[data-right-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.getElementById("matchesTabBody").style.display = tab === "matches" ? "block" : "none";
        document.getElementById("historyTabBody").style.display = tab === "history" ? "block" : "none";
      });
    });

    document.getElementById("clearHistoryBtn")?.addEventListener("click", () => {
      window.MPStorage.clearViewedCards();
      renderSessionHistory();
      loadCards(true);
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
      if (document.querySelector(".modal-overlay.is-open")) return;

      if (e.key === "ArrowLeft") { e.preventDefault(); performSwipe(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); performSwipe(true); }
      else if (e.key === "Backspace") { e.preventDefault(); undoLastSwipe(); }
    });
  }

  // ================= ИНИЦИАЛИЗАЦИЯ =================
  document.addEventListener("DOMContentLoaded", async () => {
    await initHeaderAndSession();
    state.dictionaries = await window.MPApi.getDictionaries();
    initFilters();
    initControls();
    initFormsAndModals();
    renderSessionHistory();
    await Promise.all([loadCards(), loadMatches()]);
  });
})();
