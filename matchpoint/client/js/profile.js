/* ==========================================================================
   MatchPoint — Личный кабинет и Trust Factor (client/js/profile.js)
   ========================================================================== */

(function () {
  "use strict";

  const state = {
    catalog: [],
    currentProfile: null,
    viewingUserId: null, // null = собственный профиль
    selectedScore: 5,
    authMode: "login",
    draftController: null
  };

  function esc(val) {
    return String(val ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function showToast(msg) {
    const box = document.getElementById("toastContainer");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      el.style.transition = "0.22s ease";
      setTimeout(() => el.remove(), 240);
    }, 2800);
  }

  function openModal(id) {
    document.getElementById(id)?.classList.add("is-open");
    document.body.classList.add("modal-open");
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove("is-open");
    if (!document.querySelector(".modal-overlay.is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function trustClass(score) {
    const n = Number(score ?? 5);
    if (n >= 4.5) return "high";
    if (n >= 3.5) return "mid";
    return "low";
  }

  function trustLabel(score) {
    const n = Number(score ?? 5);
    if (n >= 4.5) return "Высокий уровень доверия";
    if (n >= 3.5) return "Средний уровень доверия";
    return "Низкий Trust Factor — зона риска";
  }

  function statusPillClass(status) {
    if (status === "active") return "status-pill--active";
    if (status === "muted") return "status-pill--muted";
    return "status-pill--banned";
  }

  function validateExternalLinkClient(key, raw) {
    const val = String(raw || "").trim();
    if (!val) return null;
    let parsed;
    try {
      parsed = new URL(val);
    } catch (_) {
      return `Некорректный URL в поле "${key}"`;
    }
    const rules = {
      steam: ["steamcommunity.com", "www.steamcommunity.com", "s.team"],
      faceit: ["faceit.com", "www.faceit.com"],
      github: ["github.com", "www.github.com"],
      gitlab: ["gitlab.com", "www.gitlab.com"]
    };
    if (rules[key] && !rules[key].includes(parsed.hostname.toLowerCase())) {
      return `Поле ${key} должно ссылаться на ${rules[key][0]}`;
    }
    return null;
  }

  function updateHeaderUI() {
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
    }
  }

  function initHeaderControls() {
    const theme = window.MPStorage.initTheme();
    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
      themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
      themeBtn.addEventListener("click", () => {
        const next = window.MPStorage.toggleTheme();
        themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
      });
    }

    const burgerBtn = document.getElementById("burgerBtn");
    const drawer = document.getElementById("mobileDrawer");
    const backdrop = document.getElementById("mobileBackdrop");
    const toggleDrawer = (open) => {
      drawer?.classList.toggle("is-open", open);
      burgerBtn?.classList.toggle("is-open", open);
      backdrop?.classList.toggle("is-open", open);
      burgerBtn?.setAttribute("aria-expanded", String(open));
    };
    burgerBtn?.addEventListener("click", () => toggleDrawer(!drawer.classList.contains("is-open")));
    backdrop?.addEventListener("click", () => toggleDrawer(false));

    const handleSwitch = async (userId) => {
      try {
        await window.MPApi.switchSeedAccount(userId);
        updateHeaderUI();
        state.viewingUserId = null;
        const inspectSel = document.getElementById("inspectProfileSelect");
        if (inspectSel) inspectSel.value = "me";
        await loadAll();
        showToast(`Аккаунт переключён: ${window.MPStorage.getUser().nickname}`);
      } catch (err) {
        showToast(err.message || "Ошибка переключения аккаунта");
      }
    };

    document.getElementById("roleSwitcher")?.addEventListener("change", (e) => handleSwitch(e.target.value));
    document.getElementById("mobileRoleSwitcher")?.addEventListener("change", (e) => {
      handleSwitch(e.target.value);
      toggleDrawer(false);
    });

    document.getElementById("openAuthModalBtn")?.addEventListener("click", () => openModal("authModal"));
    document.getElementById("mobileOpenAuthBtn")?.addEventListener("click", () => {
      toggleDrawer(false);
      openModal("authModal");
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll(".modal-overlay").forEach((ov) => {
      ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(ov.id); });
    });

    document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.authMode = tab.dataset.authTab;
        document.querySelectorAll("[data-auth-tab]").forEach((t) => t.classList.toggle("is-active", t === tab));
        document.getElementById("authNicknameGroup").style.display = state.authMode === "register" ? "block" : "none";
        document.getElementById("authSubmitBtn").textContent = state.authMode === "register" ? "Создать аккаунт" : "Войти в аккаунт";
      });
    });

    document.getElementById("authForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      const nickname = document.getElementById("authNickname").value.trim();
      try {
        if (state.authMode === "register") {
          await window.MPApi.register({ email, password, nickname });
          showToast("Регистрация выполнена");
        } else {
          await window.MPApi.login({ email, password });
          showToast("Вход выполнен");
        }
        closeModal("authModal");
        updateHeaderUI();
        state.viewingUserId = null;
        await loadAll();
      } catch (err) {
        showToast(err.message || "Ошибка авторизации");
      }
    });
  }

  function renderHero(profile, isOwn) {
    const avatarEl = document.getElementById("heroAvatar");
    const initials = esc((profile.nickname || "MP").slice(0, 2).toUpperCase());
    avatarEl.innerHTML = profile.avatar_url
      ? `<img src="${esc(profile.avatar_url)}" alt="${esc(profile.nickname)}" onerror="this.replaceWith(document.createTextNode('${initials}'))">`
      : initials;

    document.getElementById("heroNickname").textContent = profile.nickname || "Без имени";
    document.getElementById("heroRoleBadge").textContent = profile.role || "player";

    const pill = document.getElementById("heroStatusPill");
    pill.textContent = profile.status || "active";
    pill.className = `status-pill ${statusPillClass(profile.status)}`;

    const verifiedBadge = document.getElementById("heroVerifiedBadge");
    verifiedBadge.style.display = profile.external_links?.verified_organizer ? "inline-flex" : "none";

    document.getElementById("heroBio").textContent = profile.bio || "Описание профиля пока не заполнено.";

    const linksBox = document.getElementById("heroExternalLinks");
    const linkLabels = { steam: "🎮 Steam", faceit: "⚡ Faceit", github: "💻 GitHub", gitlab: "🦊 GitLab" };
    const pills = [];
    if (profile.prime_time) {
      pills.push(`<span class="ext-link-pill">🕒 ${esc(profile.prime_time)}</span>`);
    }
    Object.entries(linkLabels).forEach(([key, label]) => {
      const href = profile.external_links?.[key];
      if (href) {
        pills.push(`<a class="ext-link-pill" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
      }
    });
    linksBox.innerHTML = pills.join("") || '<span class="text-xs text-muted">Внешние ссылки не добавлены</span>';

    const score = Number(profile.trust_score ?? 5);
    const level = trustClass(score);
    const badge = document.getElementById("heroTrustBadge");
    badge.textContent = `★ ${score.toFixed(2)}`;
    badge.className = `trust-badge trust-badge--${level}`;
    document.getElementById("heroTrustMeta").textContent = `${trustLabel(score)} • оценок: ${profile.ratings_count ?? 0}`;

    document.getElementById("publicProfileActions").style.display = isOwn ? "none" : "flex";
    document.getElementById("backToMyProfileBtn").style.display = isOwn ? "none" : "inline-flex";
    document.getElementById("editProfileSection").style.display = isOwn ? "block" : "none";
    document.getElementById("addDisciplineForm").style.display = isOwn ? "grid" : "none";
    document.getElementById("teammatesRateSection").style.display = isOwn ? "block" : "none";
    document.getElementById("ratePublicProfileCard").style.display = isOwn ? "none" : "block";

    document.getElementById("profilePageTitle").textContent = isOwn
      ? "👤 Личный кабинет и Trust Factor"
      : `👤 Профиль игрока: ${profile.nickname}`;
  }

  function fillEditForm(profile) {
    document.getElementById("profNickname").value = profile.nickname || "";
    document.getElementById("profPrimeTime").value = profile.prime_time || "";
    document.getElementById("profAvatarUrl").value = profile.avatar_url || "";
    document.getElementById("profBio").value = profile.bio || "";
    document.getElementById("profDiscord").value = profile.contacts?.discord || "";
    document.getElementById("profTelegram").value = profile.contacts?.telegram || "";
    document.getElementById("profSteam").value = profile.external_links?.steam || "";
    document.getElementById("profFaceit").value = profile.external_links?.faceit || "";
    document.getElementById("profGithub").value = profile.external_links?.github || "";
    document.getElementById("profGitlab").value = profile.external_links?.gitlab || "";

    const form = document.getElementById("profileEditForm");
    if (window.MPStorage?.bindFormDraft && form) {
      if (state.draftController?.unbind) state.draftController.unbind();
      state.draftController = window.MPStorage.bindFormDraft(`profile_user_${profile.id}`, form);
    }
  }

  function renderDisciplines(profile, isOwn) {
    const box = document.getElementById("profileDisciplinesList");
    const list = profile.disciplines || [];
    if (!list.length) {
      box.innerHTML = '<p class="text-sm text-muted">Дисциплины ещё не добавлены.</p>';
      return;
    }
    box.innerHTML = list.map((d) => `
      <div class="disc-chip-row">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="badge ${d.category === "it" ? "badge--it" : "badge--esports"}">${esc(d.discipline_name)}</span>
          <strong>${esc(d.role_name || "Любая роль")}</strong>
          <span class="text-xs text-secondary">• ${esc(d.rank_name || "Без ранга")}</span>
        </div>
        ${isOwn ? `<button type="button" class="btn btn--ghost btn--xs" data-del-disc="${d.discipline_id}">✕ Удалить</button>` : ""}
      </div>
    `).join("");

    if (isOwn) {
      box.querySelectorAll("[data-del-disc]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await window.MPApi.deleteMyDiscipline(btn.dataset.delDisc);
            showToast("Дисциплина удалена");
            await loadAll();
          } catch (err) {
            showToast(err.message || "Ошибка удаления");
          }
        });
      });
    }
  }

  function populateDisciplineSelects() {
    const discSel = document.getElementById("discSelect");
    const roleSel = document.getElementById("discRoleSelect");
    const rankSel = document.getElementById("discRankSelect");
    if (!discSel) return;

    discSel.innerHTML = state.catalog.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("");

    const syncCascade = () => {
      const selected = state.catalog.find((d) => Number(d.id) === Number(discSel.value));
      const roles = selected?.roles || [];
      const ranks = selected?.ranks || [];
      roleSel.innerHTML = '<option value="">— Роль —</option>' + roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
      rankSel.innerHTML = '<option value="">— Ранг —</option>' + ranks.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("");
    };

    discSel.onchange = syncCascade;
    syncCascade();
  }

  function renderTrustBlock(profile, ratingsData) {
    const score = Number(profile.trust_score ?? 5);
    const level = trustClass(score);
    const pct = Math.min(100, Math.max(0, (score / 5) * 100));

    const badge = document.getElementById("trustCardScore");
    badge.textContent = `★ ${score.toFixed(2)}`;
    badge.className = `trust-badge trust-badge--${level}`;

    const fill = document.getElementById("trustMeterFill");
    fill.style.width = `${pct}%`;
    fill.className = `trust-meter__fill trust-meter__fill--${level}`;

    document.getElementById("trustCardSummary").textContent =
      `${trustLabel(score)}. Всего отзывов: ${ratingsData.total || 0}.`;

    const dist = ratingsData.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total = ratingsData.total || 0;
    document.getElementById("trustDistribution").innerHTML = [5, 4, 3, 2, 1].map((star) => {
      const count = dist[star] || 0;
      const w = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="dist-row">
          <span>${star} ★</span>
          <div class="dist-bar"><div class="dist-bar__fill" style="width:${w}%"></div></div>
          <span>${count}</span>
        </div>
      `;
    }).join("");

    document.getElementById("reviewsCount").textContent = String(total);
    const revBox = document.getElementById("reviewsList");
    if (!ratingsData.ratings?.length) {
      revBox.innerHTML = '<p class="text-sm text-muted">Пока нет отзывов от тиммейтов.</p>';
      return;
    }

    revBox.innerHTML = ratingsData.ratings.map((r) => `
      <div class="review-item">
        <div class="review-item__top">
          <strong>${esc(r.from_nickname)}</strong>
          <span class="trust-badge trust-badge--${trustClass(r.score)}">★ ${r.score}</span>
        </div>
        <p class="text-sm text-secondary" style="margin:0 0 6px;">${esc(r.comment || "Без комментария")}</p>
        <div class="text-xs text-muted">${new Date(r.created_at).toLocaleDateString("ru-RU")}</div>
      </div>
    `).join("");
  }

  async function renderTeammates() {
    const box = document.getElementById("teammatesList");
    try {
      const { teammates } = await window.MPApi.getMyTeammates();
      if (!teammates?.length) {
        box.innerHTML = '<p class="text-sm text-muted">Пока нет взаимных мэтчей или тиммейтов. Поставьте лайки в ленте свайпов!</p>';
        return;
      }
      box.innerHTML = teammates.map((t) => `
        <div class="disc-chip-row">
          <div>
            <strong>${esc(t.nickname)}</strong>
            <span class="trust-badge trust-badge--${trustClass(t.trust_score)}" style="margin-left:6px;">★ ${Number(t.trust_score).toFixed(2)}</span>
            <div class="text-xs text-muted" style="margin-top:3px;">
              ${t.my_score ? `Ваша оценка: ${t.my_score} ★ (${esc(t.my_comment || "без комментария")})` : "Вы ещё не оценивали этого игрока"}
            </div>
          </div>
          <div class="btn-group">
            <button type="button" class="btn btn--secondary btn--xs" data-inspect-user="${t.id}">
              ⭐ Оценить / Профиль
            </button>
          </div>
        </div>
      `).join("");

      box.querySelectorAll("[data-inspect-user]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.viewingUserId = Number(btn.dataset.inspectUser);
          const sel = document.getElementById("inspectProfileSelect");
          if (sel && Array.from(sel.options).some((o) => Number(o.value) === state.viewingUserId)) {
            sel.value = String(state.viewingUserId);
          }
          loadAll();
        });
      });
    } catch (_) {
      box.innerHTML = '<p class="text-sm text-muted">Войдите в аккаунт, чтобы оценивать тиммейтов.</p>';
    }
  }

  async function loadAll() {
    try {
      const catRes = await window.MPApi.getProfileCatalog();
      state.catalog = catRes.disciplines || [];
      populateDisciplineSelects();

      const me = window.MPStorage.getUser();
      const isOwn = !state.viewingUserId || Number(state.viewingUserId) === Number(me.id);

      const profRes = isOwn
        ? await window.MPApi.getMyProfile()
        : await window.MPApi.getProfile(state.viewingUserId);

      const profile = profRes.profile;
      state.currentProfile = profile;

      renderHero(profile, isOwn);
      renderDisciplines(profile, isOwn);
      if (isOwn) {
        fillEditForm(profile);
        await renderTeammates();
      }

      const ratingsData = await window.MPApi.getProfileRatings(profile.id);
      renderTrustBlock(profile, ratingsData);
    } catch (err) {
      showToast(err.message || "Не удалось загрузить профиль");
    }
  }

  function bindProfileEvents() {
    document.getElementById("inspectProfileSelect")?.addEventListener("change", (e) => {
      state.viewingUserId = e.target.value === "me" ? null : Number(e.target.value);
      loadAll();
    });

    document.getElementById("backToMyProfileBtn")?.addEventListener("click", () => {
      state.viewingUserId = null;
      document.getElementById("inspectProfileSelect").value = "me";
      loadAll();
    });

    document.getElementById("clearProfileDraftBtn")?.addEventListener("click", () => {
      if (state.draftController?.clear) state.draftController.clear();
      if (state.currentProfile) fillEditForm(state.currentProfile);
      showToast("Черновик сброшен");
    });

    document.getElementById("profileEditForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBox = document.getElementById("profileFormError");
      errBox.style.display = "none";

      const links = {
        steam: document.getElementById("profSteam").value.trim(),
        faceit: document.getElementById("profFaceit").value.trim(),
        github: document.getElementById("profGithub").value.trim(),
        gitlab: document.getElementById("profGitlab").value.trim()
      };

      for (const [k, v] of Object.entries(links)) {
        const msg = validateExternalLinkClient(k, v);
        if (msg) {
          errBox.textContent = msg;
          errBox.style.display = "block";
          return;
        }
        if (!v) delete links[k];
      }

      const contacts = {};
      const disc = document.getElementById("profDiscord").value.trim();
      const tg = document.getElementById("profTelegram").value.trim();
      if (disc) contacts.discord = disc;
      if (tg) contacts.telegram = tg;

      try {
        await window.MPApi.updateMyProfile({
          nickname: document.getElementById("profNickname").value.trim(),
          avatar_url: document.getElementById("profAvatarUrl").value.trim() || null,
          prime_time: document.getElementById("profPrimeTime").value.trim() || null,
          bio: document.getElementById("profBio").value.trim() || null,
          contacts,
          external_links: links
        });
        if (state.draftController?.clear) state.draftController.clear();
        updateHeaderUI();
        showToast("Профиль сохранён");
        await loadAll();
      } catch (err) {
        errBox.textContent = err.message || "Ошибка сохранения профиля";
        errBox.style.display = "block";
      }
    });

    document.getElementById("addDisciplineForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.MPApi.upsertMyDiscipline({
          discipline_id: document.getElementById("discSelect").value,
          role_id: document.getElementById("discRoleSelect").value || null,
          rank_id: document.getElementById("discRankSelect").value || null
        });
        showToast("Дисциплина сохранена в профиле");
        await loadAll();
      } catch (err) {
        showToast(err.message || "Не удалось добавить дисциплину");
      }
    });

    document.querySelectorAll("#starPicker .star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedScore = Number(btn.dataset.score);
        document.querySelectorAll("#starPicker .star-btn").forEach((b) => {
          b.classList.toggle("is-active", Number(b.dataset.score) <= state.selectedScore);
        });
      });
    });

    document.getElementById("rateProfileForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.currentProfile) return;
      try {
        const res = await window.MPApi.rateUser(state.currentProfile.id, {
          score: state.selectedScore,
          comment: document.getElementById("rateComment").value.trim()
        });
        document.getElementById("rateComment").value = "";
        showToast(`Оценка сохранена! Новый Trust Factor: ${Number(res.trust_score).toFixed(2)}`);
        await loadAll();
      } catch (err) {
        showToast(err.message || "Не удалось отправить оценку");
      }
    });

    document.getElementById("openReportProfileBtn")?.addEventListener("click", () => {
      if (!state.currentProfile) return;
      document.getElementById("reportTargetLabel").textContent = state.currentProfile.nickname;
      openModal("reportModal");
    });

    document.getElementById("reportForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.currentProfile) return;
      const reason = document.getElementById("reportReason").value.trim();
      if (reason.length < 5) {
        showToast("Опишите причину жалобы (минимум 5 символов)");
        return;
      }
      try {
        await window.MPApi.sendReport({ target_user_id: state.currentProfile.id, reason });
        document.getElementById("reportReason").value = "";
        closeModal("reportModal");
        showToast("Жалоба отправлена в очередь модерации");
      } catch (err) {
        showToast(err.message || "Ошибка отправки жалобы");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const idParam = Number(params.get("id"));
    if (Number.isInteger(idParam) && idParam > 0) {
      state.viewingUserId = idParam;
    }

    initHeaderControls();
    updateHeaderUI();
    bindProfileEvents();
    loadAll();
  });
})();