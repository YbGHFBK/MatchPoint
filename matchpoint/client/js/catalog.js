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
    `<label class="form-group arcade-form-group"><span class="arcade-label">${escape(label)}</span>${control}</label>`;
  const input = (name, type = "text", attrs = "") =>
    `<input class="arcade-input" type="${type}" name="${name}" ${attrs}>`;
  const select = (name, options, attrs = "") =>
    `<select class="arcade-select" name="${name}" ${attrs}>${options}</select>`;
  const button = (label) => `<button class="arcade-btn-mint" type="submit">${escape(label)}</button>`;
  const link = (href, label) =>
    `<a class="arcade-btn arcade-btn--xs" href="${escape(href)}">${escape(label)}</a>`;
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
      ["profile", "ПРОФИЛЬ"],
      ["admin", "АДМИН"],
    ];
    const nav = pages
      .map(([key, label]) =>
        page === key
          ? `<a class="arcade-nav__link is-active" href="${key}.html"><span class="cursor-blink text-mint">▶</span> ${label}</a>`
          : `<a class="arcade-nav__link" href="${key}.html">${label}</a>`,
      )
      .join("");
    const mobileNav = pages
      .map(
        ([key, label]) =>
          `<a class="arcade-nav__link ${page === key ? "is-active" : ""}" href="${key}.html">${page === key ? "▶ " : ""}${label}</a>`,
      )
      .join("");

    const accounts = api.SEED_ACCOUNTS.filter((a) => a.status === "active" && a.role !== "guest");
    const options = option("", "Гость") + accounts.map((a) => option(a.id, `${a.nickname} (${a.role})`)).join("");

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
          <button class="burger-btn" id="catalogBurgerBtn" type="button" aria-label="Открыть меню" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>`;

    // Мобильное меню-шторка в стиле остальных страниц
    document.getElementById("catalogMobileBackdrop")?.remove();
    document.getElementById("catalogMobileDrawer")?.remove();
    const drawerMarkup = document.createElement("div");
    drawerMarkup.innerHTML = `
      <div class="mobile-drawer-backdrop" id="catalogMobileBackdrop"></div>
      <nav class="mobile-drawer" id="catalogMobileDrawer" aria-label="Мобильная навигация">
        ${mobileNav}
        <div style="margin-top:auto;padding-top:12px;border-top:2px solid var(--border-dark);">
          <label class="arcade-label" for="mobileAccount">АККАУНТ СЕССИИ</label>
          <select id="mobileAccount" class="arcade-select">${options}</select>
        </div>
      </nav>`;
    document.body.append(...drawerMarkup.children);

    const account = document.getElementById("account");
    const mobileAccount = document.getElementById("mobileAccount");
    for (const sel of [account, mobileAccount]) {
      if (!sel) continue;
      if (user.id && !accounts.some((a) => a.id === user.id)) {
        sel.add(new Option(user.nickname || user.email, user.id));
      }
      sel.value = user.id || "";
      sel.onchange = async () => {
        sel.disabled = true;
        try {
          if (sel.value) {
            const target = accounts.find((a) => a.id === Number(sel.value));
            const session = await api.post("/api/auth/login", { email: target.email, password: "password" });
            storage.setAuthSession(session.token, session.user);
          } else storage.clearAuth();
          location.reload();
        } catch (err) {
          notice(err.message);
          sel.disabled = false;
          sel.value = user.id || "";
        }
      };
    }

    const burger = document.getElementById("catalogBurgerBtn");
    const drawer = document.getElementById("catalogMobileDrawer");
    const backdrop = document.getElementById("catalogMobileBackdrop");
    const toggleDrawer = (open) => {
      drawer?.classList.toggle("is-open", open);
      burger?.classList.toggle("is-open", open);
      backdrop?.classList.toggle("is-open", open);
      burger?.setAttribute("aria-expanded", String(open));
    };
    burger?.addEventListener("click", () => toggleDrawer(!drawer.classList.contains("is-open")));
    backdrop?.addEventListener("click", () => toggleDrawer(false));
  }
  async function start(page, render) {
    storage.initTheme();
    try {
      if (storage.getToken()) {
        try {
          Object.assign(user, (await api.getMe()).user);
        } catch (err) {
          if (err.status !== 401) throw err;
        }
      }
      header(page);
      await render();
    } catch (err) {
      header(page);
      root.innerHTML = `<div class="pixel-box"><p role="alert" class="text-coral" style="margin:0 0 12px;">${escape(err.message)}</p>${link(location.href, "Повторить")}</div>`;
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