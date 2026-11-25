/* ==========================================================================
   MatchPoint — Панель Модератора и Администратора (client/js/admin.js)
   ========================================================================== */

(function () {
  "use strict";

  const ALL_ROLES = ["guest", "player", "captain", "organizer", "moderator", "admin"];

  const state = {
    activeTab: "moderation",
    dictionaries: { disciplines: [], discipline_roles: [], ranks: [], locations: [] },
    stats: null,
    lastUsers: [],
    lastLogs: []
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

  function exportCsv(filename, headers, rows) {
    const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function currentUser() {
    return window.MPStorage.getUser();
  }

  function isAdmin() {
    return currentUser().role === "admin";
  }

  function isModOrAdmin() {
    return ["moderator", "admin"].includes(currentUser().role);
  }

  function statusPillClass(status) {
    if (status === "active" || status === "resolved") return "status-pill--active";
    if (status === "muted" || status === "open") return "status-pill--muted";
    return "status-pill--banned";
  }

  function trustClass(score) {
    const n = Number(score ?? 5);
    if (n >= 4.5) return "high";
    if (n >= 3.5) return "mid";
    return "low";
  }

  function updateHeaderUI() {
    const user = currentUser();
    const sel = document.getElementById("roleSwitcher");
    const mobSel = document.getElementById("mobileRoleSwitcher");
    const authBtn = document.getElementById("openAuthModalBtn");
    if (sel && Array.from(sel.options).some((o) => Number(o.value) === Number(user.id))) {
      sel.value = String(user.id);
    }
    if (mobSel && Array.from(mobSel.options).some((o) => Number(o.value) === Number(user.id))) {
      mobSel.value = String(user.id);
    }
    if (authBtn) {
      authBtn.textContent = `👤 ${user.nickname} (${user.role})`;
    }
  }

  function setActiveTab(tabName) {
    if ((tabName === "dictionaries" || tabName === "analytics") && !isAdmin()) {
      tabName = "moderation";
    }
    state.activeTab = tabName;
    document.querySelectorAll("#adminTabs .tab-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === tabName);
    });
    document.querySelectorAll(".admin-panel-section").forEach((sec) => {
      sec.classList.toggle("is-active", sec.id === `tab-${tabName}`);
    });
  }

  function syncRoleAccess() {
    const user = currentUser();
    const allowed = isModOrAdmin();
    document.getElementById("accessDeniedBox").style.display = allowed ? "none" : "block";
    document.getElementById("adminWorkspace").style.display = allowed ? "block" : "none";

    if (!allowed) {
      document.getElementById("accessDeniedText").textContent =
        `Вы вошли как ${user.nickname} (роль: ${user.role}). Для доступа выберите аккаунт Модератора или Администратора.`;
      return false;
    }

    document.getElementById("adminPageTitle").textContent = isAdmin()
      ? "👑 ПАНЕЛЬ АДМИНИСТРАТОРА И МОДЕРАЦИИ"
      : "🛡 ПАНЕЛЬ МОДЕРАТОРА";
    document.getElementById("adminRoleSubtitle").textContent = isAdmin()
      ? "Полный доступ: очередь жалоб, роли, верификация, справочники, аналитика и аудит."
      : "Доступ модератора: разбор жалоб, выдача Warn / Mute / Temp Ban.";

    document.querySelectorAll('[data-admin-only="true"]').forEach((el) => {
      el.style.display = isAdmin() ? "inline-flex" : "none";
    });

    if (!isAdmin() && ["dictionaries", "analytics"].includes(state.activeTab)) {
      setActiveTab("moderation");
    }
    return true;
  }

  async function loadStats() {
    const stats = await window.MPApi.getAdminStats();
    state.stats = stats;
    const totalUsers = Number(stats.users_total ?? 0);
    document.getElementById("kpiUsers").textContent = String(totalUsers);
    document.getElementById("kpiOpenReports").textContent = String(stats.reports?.open ?? 0);
    document.getElementById("tabOpenCount").textContent = String(stats.reports?.open ?? 0);
    document.getElementById("kpiAvgTrust").textContent = `★ ${Number(stats.avg_trust_score ?? 5).toFixed(2)}`;
    document.getElementById("kpiActivity").textContent =
      `${stats.matches_count ?? 0} / ${stats.teams_count ?? 0} / ${stats.events_count ?? 0}`;

    const trustSub = document.getElementById("kpiTrustSub");
    if (trustSub) trustSub.textContent = `Зона риска (<3.5): ${stats.low_trust_count ?? 0}`;
    const repSub = document.getElementById("kpiReportsSub");
    if (repSub) repSub.textContent = `Решено: ${stats.reports?.resolved ?? 0} • Отклонено: ${stats.reports?.dismissed ?? 0}`;

    const rolesBox = document.getElementById("rolesBreakdown");
    rolesBox.innerHTML = Object.entries(stats.users_by_role || {}).map(([role, count]) => {
      const pct = totalUsers ? Math.round((Number(count) / totalUsers) * 100) : 0;
      return `
        <div class="bar-stat">
          <div class="bar-stat__head">
            <span class="badge badge--team">${esc(role)}</span>
            <strong>${count} <span class="text-xs text-muted">(${pct}%)</span></strong>
          </div>
          <div class="bar-stat__track"><div class="bar-stat__fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join("") || '<p class="text-sm text-muted">Нет данных</p>';

    const statusBox = document.getElementById("statusBreakdown");
    const statusRows = Object.entries(stats.users_by_status || {}).map(([st, count]) => {
      const pct = totalUsers ? Math.round((Number(count) / totalUsers) * 100) : 0;
      const tone = st === "active" ? "mint" : st === "muted" ? "gold" : "coral";
      return `
        <div class="bar-stat">
          <div class="bar-stat__head">
            <span class="status-pill ${statusPillClass(st)}">${esc(st)}</span>
            <strong>${count} <span class="text-xs text-muted">(${pct}%)</span></strong>
          </div>
          <div class="bar-stat__track"><div class="bar-stat__fill bar-stat__fill--${tone}" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join("");

    statusBox.innerHTML = statusRows + `
      <div class="dict-item">
        <span>Игроки с низким Trust (&lt; 3.5)</span>
        <strong class="text-coral">${stats.low_trust_count ?? 0}</strong>
      </div>
      <div class="dict-item">
        <span>Жалобы: открыто / решено / отклонено</span>
        <strong>${stats.reports?.open ?? 0} / ${stats.reports?.resolved ?? 0} / ${stats.reports?.dismissed ?? 0}</strong>
      </div>
    `;
  }

  async function loadReports() {
    const status = document.getElementById("reportStatusFilter")?.value || "open";
    const { reports } = await window.MPApi.getReports(status);
    const box = document.getElementById("reportsList");

    if (!reports?.length) {
      box.innerHTML = '<p class="text-sm text-muted" style="padding:12px 0;">Жалоб с выбранным статусом нет.</p>';
      return;
    }

    box.innerHTML = reports.map((r) => `
      <article class="report-card ${r.status === "resolved" ? "report-card--resolved" : r.status === "dismissed" ? "report-card--dismissed" : ""}">
        <div class="report-card__top">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong>#${r.id} Нарушитель: <a href="profile.html?id=${r.target_user_id}" style="color:var(--accent-gold);">${esc(r.target_nickname)} ↗</a></strong>
              <span class="badge badge--team">${esc(r.target_role)}</span>
              <span class="status-pill ${statusPillClass(r.target_status)}">${esc(r.target_status)}</span>
              <span class="trust-badge trust-badge--${trustClass(r.target_trust_score)}">★ ${Number(r.target_trust_score).toFixed(2)}</span>
            </div>
            <div class="text-xs text-muted" style="margin-top:4px;">
              Отправил: <b>${esc(r.reporter_nickname)}</b> • ${new Date(r.created_at).toLocaleString("ru-RU")}
            </div>
          </div>
          <span class="status-pill ${statusPillClass(r.status)}">${esc(r.status)}${r.action_taken ? ` • ${esc(r.action_taken)}` : ""}</span>
        </div>

        <p style="margin:6px 0;font-size:0.86rem;"><b>Причина:</b> ${esc(r.reason)}</p>
        ${r.target_bio ? `<p class="text-xs text-dim" style="margin:4px 0 0;">Описание профиля: «${esc(r.target_bio)}»</p>` : ""}

        ${r.status === "open" ? `
          <div class="report-actions">
            <button type="button" class="arcade-btn arcade-btn--xs" data-rep-act="dismiss" data-rep-id="${r.id}">ОТКЛОНИТЬ</button>
            <button type="button" class="arcade-btn-gold arcade-btn--xs" data-rep-act="warn" data-rep-id="${r.id}">⚠ WARN</button>
            <button type="button" class="arcade-btn arcade-btn--xs" data-rep-act="mute" data-rep-id="${r.id}">🔇 MUTE 24Ч</button>
            <button type="button" class="arcade-btn-coral arcade-btn--xs" data-rep-act="temp_ban" data-rep-id="${r.id}">⏳ BAN 72Ч</button>
            ${isAdmin() ? `<button type="button" class="arcade-btn-coral arcade-btn--xs" data-rep-act="perm_ban" data-rep-id="${r.id}">⛔ PERM BAN</button>` : ""}
          </div>
        ` : `
          <div class="text-xs text-muted" style="margin-top:8px;">
            Обработал: ${esc(r.moderator_nickname || "Модератор")} • мера: <b>${esc(r.action_taken || "none")}</b>
          </div>
        `}
      </article>
    `).join("");

    box.querySelectorAll("[data-rep-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.repId);
        const act = btn.dataset.repAct;
        if (act === "perm_ban" && !confirm(`Выдать перманентный бан по жалобе #${id}?`)) return;
        const payload = act === "dismiss"
          ? { status: "dismissed", action_taken: "none" }
          : {
              status: "resolved",
              action_taken: act,
              duration_hours: act === "mute" ? 24 : act === "temp_ban" ? 72 : undefined
            };
        try {
          await window.MPApi.resolveReport(id, payload);
          showToast(`Жалоба #${id} обработана (${act})`);
          await refreshAll();
        } catch (err) {
          showToast(err.message || "Ошибка обработки жалобы");
        }
      });
    });
  }

  async function loadUsers() {
    const filters = {
      search: document.getElementById("userSearchInput")?.value || "",
      role: document.getElementById("userRoleFilter")?.value || "all",
      status: document.getElementById("userStatusFilter")?.value || "all"
    };
    const { users } = await window.MPApi.getAdminUsers(filters);
    state.lastUsers = users || [];
    const tbody = document.getElementById("usersTableBody");
    const meId = Number(currentUser().id);

    if (!state.lastUsers.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Пользователи не найдены.</td></tr>';
      return;
    }

    tbody.innerHTML = state.lastUsers.map((u) => {
      const isSelf = Number(u.id) === meId;
      const roleCell = isAdmin() && !isSelf
        ? `<select class="form-control" style="padding:4px 8px;min-width:120px;" data-user-role="${u.id}">
            ${ALL_ROLES.map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}
           </select>`
        : `<span class="badge badge--team">${esc(u.role)}</span>`;

      const verifyBtn = isAdmin() && u.role === "organizer"
        ? `<button type="button" class="${u.verified_organizer ? "arcade-btn-mint" : "arcade-btn"} arcade-btn--xs" data-verify-org="${u.id}" data-next-ver="${u.verified_organizer ? "false" : "true"}">
            ${u.verified_organizer ? "✓ ORG" : "ВЕРИФИЦ."}
           </button>`
        : "";

      return `
        <tr>
          <td>#${u.id}</td>
          <td>
            <a href="profile.html?id=${u.id}" style="color:#fff;font-weight:700;text-decoration:none;">${esc(u.nickname)} ↗</a>
            ${u.verified_organizer ? ' <span class="badge badge--it">✓ Org</span>' : ""}
            <div class="text-xs text-muted">${esc(u.email)}</div>
          </td>
          <td>${roleCell}</td>
          <td>
            <span class="status-pill ${statusPillClass(u.status)}">${esc(u.status)}</span>
            ${u.ban_until ? `<div class="text-xs text-muted">до ${new Date(u.ban_until).toLocaleDateString("ru-RU")}</div>` : ""}
          </td>
          <td><span class="trust-badge trust-badge--${trustClass(u.trust_score)}">★ ${Number(u.trust_score).toFixed(2)}</span></td>
          <td>${u.open_reports_count > 0 ? `<b class="text-coral">${u.open_reports_count} откр.</b> / ` : ""}${u.reports_count ?? 0}</td>
          <td>
            <div class="action-row">
              ${verifyBtn}
              ${!isSelf ? `
                ${u.status !== "active"
                  ? `<button type="button" class="arcade-btn-mint arcade-btn--xs" data-user-status="${u.id}" data-next-status="active">РАЗБАН</button>`
                  : `<button type="button" class="arcade-btn-gold arcade-btn--xs" data-user-status="${u.id}" data-next-status="muted">MUTE</button>
                     <button type="button" class="arcade-btn-coral arcade-btn--xs" data-user-status="${u.id}" data-next-status="temp_banned">BAN 72Ч</button>`}
                ${isAdmin() && u.status !== "perm_banned"
                  ? `<button type="button" class="arcade-btn-coral arcade-btn--xs" data-user-status="${u.id}" data-next-status="perm_banned">PERM</button>`
                  : ""}
              ` : '<span class="text-xs text-muted">Вы</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-user-role]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await window.MPApi.updateAdminUser(sel.dataset.userRole, { role: sel.value });
          showToast(`Роль пользователя #${sel.dataset.userRole} изменена на ${sel.value}`);
          await refreshAll();
        } catch (err) {
          showToast(err.message || "Ошибка смены роли");
          await loadUsers();
        }
      });
    });

    tbody.querySelectorAll("[data-verify-org]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.MPApi.updateAdminUser(btn.dataset.verifyOrg, {
            verified_organizer: btn.dataset.nextVer === "true"
          });
          showToast("Статус верификации организатора обновлён");
          await refreshAll();
        } catch (err) {
          showToast(err.message || "Ошибка верификации");
        }
      });
    });

    tbody.querySelectorAll("[data-user-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const nextStatus = btn.dataset.nextStatus;
        if (nextStatus === "perm_banned" && !confirm(`Выдать перманентный бан пользователю #${btn.dataset.userStatus}?`)) return;
        try {
          await window.MPApi.updateAdminUser(btn.dataset.userStatus, {
            status: nextStatus,
            duration_hours: nextStatus === "muted" ? 24 : nextStatus === "temp_banned" ? 72 : undefined
          });
          showToast(`Статус пользователя #${btn.dataset.userStatus}: ${nextStatus}`);
          await refreshAll();
        } catch (err) {
          showToast(err.message || "Ошибка изменения статуса");
        }
      });
    });
  }

  async function loadDictionaries() {
    if (!isAdmin()) return;
    const dicts = await window.MPApi.getDictionaries();
    state.dictionaries = dicts;

    const discOptions = (dicts.disciplines || [])
      .map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
    document.getElementById("newRoleDisc").innerHTML = discOptions;
    document.getElementById("newRankDisc").innerHTML = discOptions;

    document.getElementById("dictDisciplinesList").innerHTML = (dicts.disciplines || []).map((d) => `
      <div class="dict-item">
        <span><span class="badge ${d.category === "it" ? "badge--it" : "badge--esports"}">${esc(d.category)}</span> ${esc(d.name)}</span>
        <button type="button" class="arcade-btn arcade-btn--xs text-coral" data-del-dict="discipline" data-id="${d.id}">✕</button>
      </div>
    `).join("");

    document.getElementById("dictRolesList").innerHTML = (dicts.discipline_roles || []).map((r) => {
      const disc = (dicts.disciplines || []).find((d) => d.id === r.discipline_id);
      return `
        <div class="dict-item">
          <span><b>${esc(r.name)}</b> <span class="text-xs text-muted">(${esc(r.discipline_name || disc?.name || "")})</span></span>
          <button type="button" class="arcade-btn arcade-btn--xs text-coral" data-del-dict="role" data-id="${r.id}">✕</button>
        </div>
      `;
    }).join("");

    document.getElementById("dictRanksList").innerHTML = (dicts.ranks || []).map((rk) => {
      const disc = (dicts.disciplines || []).find((d) => d.id === rk.discipline_id);
      return `
        <div class="dict-item">
          <span><b>${esc(rk.name)}</b> <span class="text-xs text-muted">(${esc(rk.discipline_name || disc?.name || "")})</span></span>
          <button type="button" class="arcade-btn arcade-btn--xs text-coral" data-del-dict="rank" data-id="${rk.id}">✕</button>
        </div>
      `;
    }).join("");

    document.getElementById("dictLocationsList").innerHTML = (dicts.locations || []).map((loc) => `
      <div class="dict-item">
        <div>
          <strong>${esc(loc.venue_name)}</strong> <span class="text-xs text-muted">(${esc(loc.city)}, ${esc(loc.address)})</span>
        </div>
        <div class="action-row">
          <button type="button" class="${loc.is_verified ? "arcade-btn-mint" : "arcade-btn"} arcade-btn--xs" data-toggle-loc="${loc.id}" data-next="${loc.is_verified ? "false" : "true"}">
            ${loc.is_verified ? "✓ ПРОВЕРЕНО" : "ПРОВЕРИТЬ"}
          </button>
          <button type="button" class="arcade-btn arcade-btn--xs text-coral" data-del-dict="location" data-id="${loc.id}">✕</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll("[data-del-dict]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Удалить запись из справочника?")) return;
        try {
          await window.MPApi.deleteDictionaryItem(btn.dataset.delDict, btn.dataset.id);
          showToast("Запись удалена из справочника");
          await loadDictionaries();
        } catch (err) {
          showToast(err.message || "Нельзя удалить используемую запись");
        }
      });
    });

    document.querySelectorAll("[data-toggle-loc]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.MPApi.toggleLocationVerified(btn.dataset.toggleLoc, btn.dataset.next === "true");
          showToast("Статус площадки обновлён");
          await loadDictionaries();
        } catch (err) {
          showToast(err.message || "Ошибка обновления площадки");
        }
      });
    });
  }

  function renderAuditLogsTable() {
    const tbody = document.getElementById("auditLogsBody");
    const q = (document.getElementById("auditSearchInput")?.value || "").trim().toLowerCase();
    const filtered = state.lastLogs.filter((l) => {
      if (!q) return true;
      return `${l.actor_nickname || ""} ${l.action || ""} ${l.target_type || ""} ${JSON.stringify(l.details || {})}`
        .toLowerCase()
        .includes(q);
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Записей по фильтру не найдено.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((l) => `
      <tr>
        <td class="text-xs">${new Date(l.created_at).toLocaleString("ru-RU")}</td>
        <td><strong>${esc(l.actor_nickname || `User #${l.actor_id}`)}</strong></td>
        <td><span class="badge badge--team">${esc(l.action)}</span></td>
        <td class="text-xs">${esc(l.target_type)} #${l.target_id ?? "—"}</td>
        <td class="text-xs">${esc(JSON.stringify(l.details || {}))}</td>
      </tr>
    `).join("");
  }

  async function loadAuditLogs() {
    if (!isAdmin()) return;
    const { logs } = await window.MPApi.getAdminLogs();
    state.lastLogs = logs || [];
    renderAuditLogsTable();
  }

  async function refreshAll() {
    updateHeaderUI();
    if (!syncRoleAccess()) return;
    try {
      await Promise.all([
        loadStats(),
        loadReports(),
        loadUsers(),
        loadDictionaries(),
        loadAuditLogs()
      ]);
    } catch (err) {
      showToast(err.message || "Ошибка загрузки данных админки");
    }
  }

  function bindEvents() {
    window.MPStorage.initTheme();

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
        showToast(`Аккаунт: ${currentUser().nickname} (${currentUser().role})`);
        await refreshAll();
      } catch (err) {
        showToast(err.message || "Ошибка смены аккаунта");
      }
    };

    document.getElementById("roleSwitcher")?.addEventListener("change", (e) => handleSwitch(e.target.value));
    document.getElementById("mobileRoleSwitcher")?.addEventListener("change", (e) => {
      handleSwitch(e.target.value);
      toggleDrawer(false);
    });
    document.querySelectorAll("[data-quick-switch]").forEach((btn) => {
      btn.addEventListener("click", () => handleSwitch(btn.dataset.quickSwitch));
    });

    document.querySelectorAll("#adminTabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });

    document.getElementById("refreshAdminBtn")?.addEventListener("click", refreshAll);
    document.getElementById("reportStatusFilter")?.addEventListener("change", loadReports);
    document.getElementById("userSearchInput")?.addEventListener("input", loadUsers);
    document.getElementById("userRoleFilter")?.addEventListener("change", loadUsers);
    document.getElementById("userStatusFilter")?.addEventListener("change", loadUsers);
    document.getElementById("auditSearchInput")?.addEventListener("input", renderAuditLogsTable);

    document.getElementById("exportUsersCsvBtn")?.addEventListener("click", () => {
      if (!state.lastUsers.length) return showToast("Нет данных для экспорта");
      exportCsv(
        "matchpoint_users.csv",
        ["ID", "Nickname", "Email", "Role", "Status", "Trust Score", "Reports"],
        state.lastUsers.map((u) => [u.id, u.nickname, u.email, u.role, u.status, u.trust_score, u.reports_count ?? 0])
      );
      showToast("Экспорт пользователей выполнен (CSV)");
    });

    document.getElementById("exportLogsCsvBtn")?.addEventListener("click", () => {
      if (!state.lastLogs.length) return showToast("Нет логов для экспорта");
      exportCsv(
        "matchpoint_audit_logs.csv",
        ["Created At", "Actor", "Action", "Target Type", "Target ID", "Details"],
        state.lastLogs.map((l) => [l.created_at, l.actor_nickname || l.actor_id, l.action, l.target_type, l.target_id, JSON.stringify(l.details || {})])
      );
      showToast("Экспорт журнала аудита выполнен (CSV)");
    });

    document.getElementById("addDisciplineDictForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.MPApi.addDictionaryItem({
          type: "discipline",
          name: document.getElementById("newDiscName").value.trim(),
          category: document.getElementById("newDiscCategory").value
        });
        document.getElementById("newDiscName").value = "";
        showToast("Дисциплина добавлена");
        await refreshAll();
      } catch (err) {
        showToast(err.message || "Ошибка добавления дисциплины");
      }
    });

    document.getElementById("addRoleDictForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.MPApi.addDictionaryItem({
          type: "role",
          discipline_id: document.getElementById("newRoleDisc").value,
          name: document.getElementById("newRoleName").value.trim()
        });
        document.getElementById("newRoleName").value = "";
        showToast("Роль добавлена");
        await refreshAll();
      } catch (err) {
        showToast(err.message || "Ошибка добавления роли");
      }
    });

    document.getElementById("addRankDictForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.MPApi.addDictionaryItem({
          type: "rank",
          discipline_id: document.getElementById("newRankDisc").value,
          name: document.getElementById("newRankName").value.trim()
        });
        document.getElementById("newRankName").value = "";
        showToast("Ранг добавлен");
        await refreshAll();
      } catch (err) {
        showToast(err.message || "Ошибка добавления ранга");
      }
    });

    document.getElementById("addLocationDictForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.MPApi.addDictionaryItem({
          type: "location",
          city: document.getElementById("newLocCity").value.trim(),
          venue_name: document.getElementById("newLocVenue").value.trim(),
          address: document.getElementById("newLocAddress").value.trim()
        });
        document.getElementById("newLocCity").value = "";
        document.getElementById("newLocVenue").value = "";
        document.getElementById("newLocAddress").value = "";
        showToast("Площадка добавлена");
        await refreshAll();
      } catch (err) {
        showToast(err.message || "Ошибка добавления площадки");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    refreshAll();
  });
})();