
const Hub = (function () {
  const api = window.MPApi;
  const storage = window.MPStorage;
  const root = document.getElementById("content");
  const params = new URLSearchParams(location.search);
  const user = { id: null, role: "guest" };
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const option = (value, label) => `<option value="${escape(value)}">${escape(label)}</option>`;
  const field = (label, control) =>
    `<label class="arcade-form-group form-group"><span class="arcade-label form-label">${escape(label)}</span>${control}</label>`;
  const input = (name, type = "text", attrs = "") =>
    `<input class="arcade-input form-control" type="${type}" name="${name}" ${attrs}>`;
  const select = (name, options, attrs = "") =>
    `<select class="arcade-select form-control" name="${name}" ${attrs}>${options}</select>`;
  const button = (label) => `<button class="btn btn--primary" type="submit">${escape(label)}</button>`;
  const link = (href, label) =>
    `<a class="btn btn--ghost btn--sm" href="${escape(href)}">${escape(label)}</a>`;
  function safeURL(value) {
    try {
      const u = new URL(value, location.origin);
      return /^https?:$/.test(u.protocol) ? escape(u.href) : "";
    } catch {
      return "";
    }
  }
  const date = (value) =>
    new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  let timer;
  function notice(message) {
    const box = document.getElementById("notice");
    box.textContent = message;
    clearTimeout(timer);
    timer = setTimeout(() => (box.textContent = ""), 6500);
  }
  function header(page) {
    const pages = [
      ["index", "СВАЙПЫ"],
      ["events", "ИВЕНТЫ"],
      ["teams", "КОМАНДЫ"],
      ["admin", "АДМИН"],
    ];
    const nav = pages
      .map(([key, label]) => {
        const active = page === key;
        return `<a class="arcade-nav__link ${active ? "is-active" : ""}" href="${key}.html">${active ? '<span class="cursor-blink text-mint">▶</span> ' : ""}${label}</a>`;
      })
      .join("");
    const accounts = api.SEED_ACCOUNTS.filter((a) => a.status === "active" && a.role !== "guest");
    let options = option("", "Гость") + accounts.map((a) => option(a.id, a.nickname)).join("");
    if (user.id && !accounts.some((a) => a.id === user.id)) {
      options += option(user.id, user.nickname || user.email);
    }
    const themeIcon = (storage.getTheme?.() || storage.initTheme()) === "dark" ? "☀️" : "🌙";
    document.getElementById("siteHeader").innerHTML = `
      <div class="arcade-container arcade-header__inner">
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
          <a href="index.html" class="arcade-brand">
            <div class="arcade-brand__icon">
              <svg width="28" height="28" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true">
                <rect x="4" y="1" width="3" height="1" fill="#FFD166"/>
                <rect x="3" y="2" width="5" height="2" fill="#06D6A0"/>
                <rect x="2" y="4" width="7" height="3" fill="#06D6A0"/>
                <rect x="4" y="3" width="2" height="2" fill="#FFFFFF"/>
                <rect x="3" y="7" width="5" height="2" fill="#059669"/>
                <rect x="4" y="9" width="3" height="1" fill="#FFD166"/>
              </svg>
            </div>
            <div>
              <div class="mp-wordmark" aria-label="MatchPoint">
                <span class="mp-word--match">MATCH</span><span class="mp-word--point">POINT</span>
              </div>
              <div class="arcade-brand__sub">16-BIT PARTY FINDER</div>
            </div>
          </a>
          <nav class="arcade-nav" aria-label="Основная навигация">${nav}</nav>
        </div>
        <div class="arcade-hud-right">
          <select id="account" class="arcade-select arcade-select--compact hide-on-mobile" aria-label="Аккаунт">${options}</select>
          <button class="arcade-btn arcade-btn--xs hide-on-mobile" id="openAuthModalBtn" type="button">Войти</button>
          <button class="arcade-btn arcade-btn--xs" id="theme" type="button" title="Сменить светлую / тёмную тему" aria-label="Сменить тему">${themeIcon}</button>
          <button class="burger-btn" id="burgerBtn" type="button" aria-label="Открыть меню" aria-controls="mobileDrawer" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <div class="mobile-drawer-backdrop" id="mobileBackdrop"></div>
      <nav class="mobile-drawer" id="mobileDrawer" aria-label="Мобильная навигация">
        ${nav}
        <div style="margin-top:auto;padding-top:12px;border-top:2px solid var(--border-dark);">
          <label class="arcade-label" for="mobileAccount">АККАУНТ СЕССИИ</label>
          <select id="mobileAccount" class="arcade-select">${options}</select>
          <button class="arcade-btn arcade-btn--block" id="mobileOpenAuthBtn" type="button">Войти</button>
        </div>
      </nav>`;
    const account = document.getElementById("account");
    const mobileAccount = document.getElementById("mobileAccount");
    account.value = user.id || "";
    mobileAccount.value = user.id || "";
    const burgerBtn = document.getElementById("burgerBtn");
    const drawer = document.getElementById("mobileDrawer");
    const backdrop = document.getElementById("mobileBackdrop");
    const setDrawer = (open) => {
      drawer?.classList.toggle("is-open", open);
      burgerBtn?.classList.toggle("is-open", open);
      backdrop?.classList.toggle("is-open", open);
      burgerBtn?.setAttribute("aria-expanded", String(open));
    };
    burgerBtn?.addEventListener("click", () => setDrawer(!drawer.classList.contains("is-open")));
    backdrop?.addEventListener("click", () => setDrawer(false));
    window.MPAuth.bindAccountButtons(() => window.MPAuth.openLoginModal(() => location.reload()), () => setDrawer(false));
    const switchAccount = async (selectEl) => {
      selectEl.disabled = true;
      try {
        if (selectEl.value) {
          const target = accounts.find((a) => a.id === Number(selectEl.value));
          const session = await api.post("/api/auth/login", { email: target.email, password: "password" });
          storage.setAuthSession(session.token, session.user);
        } else storage.clearAuth();
        location.reload();
      } catch (err) {
        notice(err.message);
        selectEl.disabled = false;
        selectEl.value = user.id || "";
      }
    };
    account.onchange = () => switchAccount(account);
    mobileAccount.onchange = () => {
      setDrawer(false);
      switchAccount(mobileAccount);
    };
    document.getElementById("theme").onclick = () => {
      const next = storage.toggleTheme();
      const btn = document.getElementById("theme");
      if (btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
    };
  }
  async function start(page, render) {
    storage.initTheme();
    try {
      if (storage.hasToken()) {
        try {
          Object.assign(user, (await api.getMe()).user);
        } catch (err) {
          if (err.status !== 401) throw err;
          storage.clearAuth();
        }
      }
      header(page);
      await render();
    } catch (err) {
      header(page);
      root.innerHTML = `<p role="alert">${escape(err.message)}</p>${link(location.href, "Повторить")}`;
    }
  }
  function bindForms(actions) {
    root.onsubmit = async (event) => {
      event.preventDefault();
      const form = event.target,
        run = actions[form.dataset.action];
      if (!run || form.dataset.busy) return;
      form.dataset.busy = "1";
      const submit = event.submitter;
      if (submit) submit.disabled = true;
      try {
        await run(Object.fromEntries(new FormData(form)), form);
      } catch (err) {
        notice(err.message);
      } finally {
        delete form.dataset.busy;
        if (submit) submit.disabled = false;
      }
    };
  }
  return {
    api,
    storage,
    root,
    params,
    user,
    escape,
    option,
    field,
    input,
    select,
    button,
    link,
    date,
    safeURL,
    notice,
    start,
    bindForms,
  };
})();


