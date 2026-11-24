/* ==========================================================================
   MatchPoint — Движок карточек, свайпов, фильтров и мэтчей (client/js/swipe.js)
   Модуль: Фронтенд-ядро (Карулис Иван)
   Синхронизировано со схемой БД:
   - disciplines / discipline_roles / ranks / profile_disciplines
   - profiles (trust_score NUMERIC(3,2), contacts JSONB, external_links JSONB)
   - swipes (to_user_id, is_like BOOLEAN) и matches (user1_id < user2_id)
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
    isAnimating: false
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
    }, 2600);
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

  // ================= ШАПКА, БУРГЕР-МЕНЮ, ТЕМА И СЕССИЯ =================
  function initHeaderAndTheme() {
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

    if (!window.MPStorage.getToken()) {
      window.MPStorage.setToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mp_user_2");
    }

    const roleSelect = document.getElementById("roleSwitcher");
    const mobileRoleSelect = document.getElementById("mobileRoleSwitcher");
    const currentUser = window.MPStorage.getUser();

    function applySelectedRole(selectedRole) {
      const isGuest = selectedRole === "guest";
      const updated = window.MPStorage.setUser({
        id: isGuest ? 0 : 2,
        nickname: isGuest ? "Гость" : "Karulis1",
        role: selectedRole,
        status: "active"
      });
      if (roleSelect) roleSelect.value = selectedRole;
      if (mobileRoleSelect) mobileRoleSelect.value = selectedRole;
      showToast(`👤 Текущая роль (${updated.role}) обновлена в localStorage`);
    }

    if (currentUser) {
      const initialRole = currentUser.role || "player";
      if (roleSelect) roleSelect.value = initialRole;
      if (mobileRoleSelect) mobileRoleSelect.value = initialRole;
    }

    roleSelect?.addEventListener("change", () => applySelectedRole(roleSelect.value));
    mobileRoleSelect?.addEventListener("change", () => applySelectedRole(mobileRoleSelect.value));

    // Адаптивное бургер-меню + подложка + автозакрытие при ресайзе на десктоп
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileDrawer = document.getElementById("mobileDrawer");
    const mobileBackdrop = document.getElementById("mobileBackdrop");
    if (burgerBtn && mobileDrawer) {
      burgerBtn.addEventListener("click", () => {
        const nextOpen = !mobileDrawer.classList.contains("is-open");
        setBurgerOpen(nextOpen);
      });
      mobileBackdrop?.addEventListener("click", () => setBurgerOpen(false));
      window.addEventListener("resize", () => {
        if (window.innerWidth >= 1024 && mobileDrawer.classList.contains("is-open")) {
          setBurgerOpen(false);
        }
      });
    }

    document.querySelectorAll("[data-team-page]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        setBurgerOpen(false);
        showToast(`📌 Страница ${link.getAttribute("href")} (${link.getAttribute("data-team-page")})`);
      });
    });

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
      <optgroup label="IT-направления (it)">
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
      roleSelect.innerHTML = `<option value="">Любая роль</option>` +
        filteredRoles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
      if (selectedRoleId && filteredRoles.some((r) => String(r.id) === String(selectedRoleId))) {
        roleSelect.value = String(selectedRoleId);
      } else {
        roleSelect.value = "";
      }
    }

    const rankSelect = document.getElementById("fRankId");
    if (rankSelect) {
      rankSelect.innerHTML = `<option value="">Любой ранг / грейд</option>` +
        filteredRanks.map((rk) => `<option value="${rk.id}">${esc(rk.name)}</option>`).join("");
      if (selectedRankId && filteredRanks.some((rk) => String(rk.id) === String(selectedRankId))) {
        rankSelect.value = String(selectedRankId);
      } else {
        rankSelect.value = "";
      }
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
      showToast("🎛 Дисциплина обновлена (роли и ранги подгружены)");
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

  // ================= ЗАГРУЗКА И ОТРИСОВКА КАРТОЧЕК =================
  async function loadCards(ignoreSessionHistory = false) {
    const filters = window.MPStorage.getFilters();
    const res = await window.MPApi.getCards(filters);
    const viewedKeys = ignoreSessionHistory
      ? new Set()
      : new Set(window.MPStorage.getViewedCards().map((v) => v.card_key));

    const currentUserId = window.MPStorage.getUser()?.id || 0;
    state.cards = (res.cards || []).filter(
      (c) => c.user_id !== currentUserId && !viewedKeys.has(c.card_key)
    );
    renderDeck();
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
          <h3>Все подходящие анкеты просмотрены</h3>
          <p style="color:var(--text-secondary);font-size:0.88rem;max-width:330px">
            Измените параметры фильтрации по дисциплинам и рангам или обновите историю текущей сессии.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">
            <button type="button" class="btn btn--primary" id="reloadDeckBtn">🔄 Смотреть заново</button>
            <button type="button" class="btn btn--ghost" id="emptyResetBtn">Сбросить фильтры</button>
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

    const topThree = state.cards.slice(0, 3);
    stack.innerHTML = topThree
      .map((card, idx) => buildCardHTML(card, idx))
      .reverse()
      .join("");

    const topEl = stack.querySelector(".swipe-card.is-top");
    if (topEl) attachDragHandlers(topEl, state.cards[0]);
  }

  function buildCardHTML(card, index) {
    const posClass = index === 0 ? "is-top" : index === 1 ? "is-next" : "is-third";
    const pd = (card.profile_disciplines && card.profile_disciplines[0]) || {
      discipline_name: "Дисциплина",
      category: "esports",
      role_name: "Игрок",
      rank_name: "—"
    };

    const isTeam = card.card_type === "team" && card.team;
    const title = isTeam ? `Команда «${card.team.name}»` : `@${card.nickname}`;
    const subtitle = isTeam
      ? `Капитан @${card.nickname} • Состав ${card.team.members_count || 3}/5`
      : `${pd.discipline_name} • ${pd.role_name}`;

    const badgeHTML = isTeam
      ? `<span class="badge badge--team">📢 Вакансия команды</span>`
      : `<span class="badge ${pd.category === "it" ? "badge--it" : "badge--esports"}">${pd.category === "it" ? "💻 IT-профиль" : "🎮 Игрок"}</span>`;

    const trustNum = Number(card.trust_score ?? 5.0).toFixed(2);
    const trustClass = Number(trustNum) >= 4.7 ? "trust-badge--high" : "trust-badge--mid";

    const linksObj = card.external_links || {};
    const extKeys = Object.keys(linksObj);

    const avatarContent = card.avatar_url
      ? `<img src="${esc(card.avatar_url)}" alt="${esc(title)}" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`
      : initialsFromName(isTeam ? card.team.name : card.nickname);

    const extraChips = [];
    if (isTeam && card.team.looking_for_role_name) {
      extraChips.push(`Ищем: ${card.team.looking_for_role_name}`);
    }
    (card.profile_disciplines || []).forEach((d) => {
      extraChips.push(`${d.discipline_name}: ${d.role_name}`);
      if (d.rank_name) extraChips.push(d.rank_name);
    });

    return `
      <article class="swipe-card ${posClass}" data-user-id="${card.user_id}">
        <div class="swipe-stamp swipe-stamp--like">ЛАЙК 💚</div>
        <div class="swipe-stamp swipe-stamp--skip">ПРОПУСК ✕</div>

        <div class="card-hero" style="background: ${card.gradient || "linear-gradient(135deg, #1f2937, #4f46e5)"}">
          <div class="card-hero__top">
            ${badgeHTML}
            <span class="trust-badge ${trustClass}" title="Trust Factor (profiles.trust_score 1.00–5.00)">
              ★ ${trustNum} / 5.00
            </span>
          </div>
          <div class="card-hero__profile">
            <div class="card-avatar">${avatarContent}</div>
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
              <b>${esc(pd.rank_name || "Не указан")}</b>
            </div>
            <div class="metric-box">
              <span>${isTeam ? "Нужна роль" : "Роль"}</span>
              <b>${esc(isTeam ? card.team.looking_for_role_name : pd.role_name)}</b>
            </div>
            <div class="metric-box">
              <span>Прайм-тайм</span>
              <b>${esc(card.prime_time || "Гибкий")}</b>
            </div>
          </div>

          <p class="card-bio">${esc(isTeam && card.team.description ? card.team.description : card.bio)}</p>

          <div class="card-tags">
            ${extraChips.slice(0, 4).map((chip) => `<span class="skill-chip">${esc(chip)}</span>`).join("")}
          </div>

          <div class="card-links">
            <span>Внешние профили:</span>
            <div class="ext-profiles">
              ${extKeys.length
                ? extKeys.map((k) => `<a class="ext-pill" href="${esc(linksObj[k])}" target="_blank" rel="noopener noreferrer">🔗 ${esc(k.toUpperCase())}</a>`).join("")
                : `<span style="font-size:0.74rem">Контакты после мэтча</span>`}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // ================= МЕХАНИКА ПЕРЕТАСКИВАНИЯ (Pointer Events) =================
  function attachDragHandlers(cardEl, cardData) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;

    const likeStamp = cardEl.querySelector(".swipe-stamp--like");
    const skipStamp = cardEl.querySelector(".swipe-stamp--skip");

    const onPointerDown = (e) => {
      if (state.isAnimating) return;
      if (e.target.closest("a")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      dy = 0;
      cardEl.classList.remove("is-animating");
      try { cardEl.setPointerCapture(e.pointerId); } catch (_) {}
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;

      const rotate = dx * 0.055;
      cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg)`;

      if (likeStamp) likeStamp.style.opacity = dx > 20 ? String(Math.min(1, (dx - 20) / 85)) : "0";
      if (skipStamp) skipStamp.style.opacity = dx < -20 ? String(Math.min(1, (-dx - 20) / 85)) : "0";
    };

    const onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      try { cardEl.releasePointerCapture(e.pointerId); } catch (_) {}

      if (dx >= SWIPE_THRESHOLD_X) {
        performSwipe(true, cardEl, cardData);
      } else if (dx <= -SWIPE_THRESHOLD_X) {
        performSwipe(false, cardEl, cardData);
      } else {
        cardEl.classList.add("is-animating");
        cardEl.style.transform = "";
        if (likeStamp) likeStamp.style.opacity = "0";
        if (skipStamp) skipStamp.style.opacity = "0";
      }
    };

    cardEl.addEventListener("pointerdown", onPointerDown);
    cardEl.addEventListener("pointermove", onPointerMove);
    cardEl.addEventListener("pointerup", onPointerUp);
    cardEl.addEventListener("pointercancel", onPointerUp);
  }

  async function performSwipe(isLike, cardElParam, cardDataParam) {
    if (state.isAnimating || !state.cards.length) return;

    const currentUser = window.MPStorage.getUser();
    if (currentUser?.role === "guest") {
      showToast("🔒 Гостям доступен просмотр. Выберите роль «Игрок» или «Капитан» в шапке для свайпов!");
      if (cardElParam) {
        cardElParam.classList.add("is-animating");
        cardElParam.style.transform = "";
      }
      return;
    }

    const cardEl = cardElParam || document.querySelector("#cardStack .swipe-card.is-top");
    const cardData = cardDataParam || state.cards[0];
    if (!cardEl || !cardData) return;

    state.isAnimating = true;
    cardEl.classList.add("is-animating");

    const stamp = cardEl.querySelector(isLike ? ".swipe-stamp--like" : ".swipe-stamp--skip");
    if (stamp) stamp.style.opacity = "1";

    const flyX = isLike ? window.innerWidth : -window.innerWidth;
    const rot = isLike ? 25 : -25;
    cardEl.style.transform = `translate3d(${flyX}px, 50px, 0) rotate(${rot}deg)`;
    cardEl.style.opacity = "0";

    // История в sessionStorage
    window.MPStorage.addViewedCard(cardData, isLike);
    renderSessionHistory();

    setTimeout(async () => {
      state.cards.shift();
      state.isAnimating = false;
      renderDeck();

      try {
        // POST /api/swipe -> swipes (from_user_id, to_user_id, is_like)
        const res = await window.MPApi.sendSwipe({
          to_user_id: cardData.user_id,
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
      showToast("ℹ️ В истории текущей сессии нет анкет для возврата");
      return;
    }
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
          Взаимных мэтчей пока нет.<br>При совпадении лайков здесь откроется <code>profiles.contacts</code> и лобби-чат.
        </div>
      `;
      return;
    }

    listEl.innerHTML = state.matches.map((m) => {
      const p = m.partner;
      const contacts = p.contacts || {};
      return `
        <div class="match-item">
          <div class="match-item__head">
            <div class="match-item__avatar" style="background:${p.gradient || "linear-gradient(135deg,#7c5cff,#4f46e5)"}">
              ${initialsFromName(p.nickname)}
            </div>
            <div class="match-item__info">
              <b>${esc(p.nickname)}</b>
              <span>${esc(p.discipline_name || "")} • ${esc(p.role_name || "")} • ★ ${Number(p.trust_score || 5).toFixed(2)}</span>
            </div>
            <button type="button" class="btn btn--primary btn--sm" data-open-chat="${p.user_id}">💬 Чат</button>
          </div>
          <div class="match-contacts">
            ${Object.entries(contacts).map(([key, val]) =>
              `<button type="button" class="contact-tag" data-copy="${esc(val)}">📋 ${esc(key)}: ${esc(val)}</button>`
            ).join("")}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-copy");
        navigator.clipboard?.writeText(val).catch(() => {});
        showToast(`📋 Скопировано из contacts: ${val}`);
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
    const p = matchObj.partner;
    const viewer = window.MPStorage.getUser();

    document.getElementById("matchViewerAvatar").textContent = initialsFromName(viewer.nickname || "MP");
    const targetAv = document.getElementById("matchTargetAvatar");
    targetAv.textContent = initialsFromName(p.nickname);
    targetAv.style.background = p.gradient || "linear-gradient(135deg, #16a34a, #15803d)";

    document.getElementById("matchTargetName").textContent = p.nickname;
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
        { from: "them", text: partner.greeting || "Привет! Отличный мэтч, погнали в лобби!" }
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

  // ================= ЧЕРНОВИКИ ФОРМ (sessionStorage) И ЖАЛОБЫ =================
  function initFormsAndModals() {
    document.getElementById("chatForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const viewer = window.MPStorage.getUser();
      if (viewer?.status === "muted") {
        showToast("🔇 Ваш аккаунт в статусе muted — отправка сообщений ограничена");
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
          text: "Договорились! Уже захожу в голосовой канал 🚀"
        });
        if (state.activePartnerForChat?.user_id === partner.user_id) {
          renderChatMessages(partner.user_id);
        }
      }, 650);
    });

    // Черновик формы создания вакансии команды (teams: name, discipline_id, looking_for_role_id, description)
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

      teamDraftForm.addEventListener("submit", (e) => {
        e.preventDefault();
        window.MPStorage.clearDraft("team_vacancy_form");
        teamDraftForm.reset();
        updateDraftRoleOptions(draftDiscSelect?.value || 1);
        const badge = document.getElementById("draftRestoredBadge");
        if (badge) badge.style.display = "none";
        closeModal("draftModal");
        showToast("✅ Черновик вакансии отправлен и очищен из sessionStorage");
      });
    }

    // Форма жалобы (reports: target_user_id, reason)
    document.getElementById("reportForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.reportTargetCard) return;
      const reason = document.getElementById("reportReason").value.trim();
      if (!reason) return;
      await window.MPApi.sendReport({
        target_user_id: state.reportTargetCard.user_id,
        reason
      });
      document.getElementById("reportReason").value = "";
      closeModal("reportModal");
      showToast(`🚩 Жалоба на @${state.reportTargetCard.nickname} отправлена модераторам`);
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
          ? `<span class="trust-badge trust-badge--high">♥ is_like: true</span>`
          : `<span class="badge" style="background:var(--accent-skip-soft);color:var(--accent-skip)">✕ is_like: false</span>`}
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
      state.reportTargetCard = state.cards[0];
      document.getElementById("reportTargetLabel").textContent = `@${state.reportTargetCard.nickname} (user_id: ${state.reportTargetCard.user_id})`;
      openModal("reportModal");
    });

    document.getElementById("openDraftModalBtn")?.addEventListener("click", () => openModal("draftModal"));
    document.getElementById("mobileOpenDraftBtn")?.addEventListener("click", () => {
      setBurgerOpen(false);
      openModal("draftModal");
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

  // ================= ЗАПУСК =================
  document.addEventListener("DOMContentLoaded", async () => {
    initHeaderAndTheme();
    state.dictionaries = await window.MPApi.getDictionaries();
    initFilters();
    initControls();
    initFormsAndModals();
    renderSessionHistory();
    await Promise.all([loadCards(), loadMatches()]);
  });
})();
