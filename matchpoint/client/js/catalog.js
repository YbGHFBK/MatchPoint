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
    `<label class="form-group"><span class="form-label">${escape(label)}</span>${control}</label>`;
  const input = (name, type = "text", attrs = "") =>
    `<input class="form-control" type="${type}" name="${name}" ${attrs}>`;
  const select = (name, options, attrs = "") =>
    `<select class="form-control" name="${name}" ${attrs}>${options}</select>`;
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
      ["index", "🔥 Свайпы"],
      ["events", "🏆 Ивенты"],
      ["teams", "👥 Команды"],
      ["profile", "👤 Профиль"],
      ["admin", "🛡 Админ"],
    ];
    const nav = pages
      .map(
        ([key, label]) =>
          `<a class="nav-link ${page === key ? "is-active" : ""}" href="${key}.html">${label}</a>`,
      )
      .join("");
    const accounts = api.SEED_ACCOUNTS.filter((a) => a.status === "active" && a.role !== "guest");
    const options = option("", "Гость") + accounts.map((a) => option(a.id, a.nickname)).join("");
    document.getElementById("siteHeader").innerHTML = `<div class="container header-inner">
      <a class="brand" href="index.html"><span class="brand__mark">◈</span><span>Match<span class="brand__accent">Point</span></span></a>
      <nav class="main-nav" aria-label="Навигация">${nav}</nav><div class="header-actions">
      <select id="account" class="role-switcher-select" aria-label="Аккаунт">${options}</select>
      <button class="theme-toggle" id="theme" aria-label="Сменить тему">☀</button>
      <details class="mobile-links"><summary aria-label="Меню">☰</summary><nav>${nav}</nav></details></div></div>`;
    const account = document.getElementById("account");
    if (user.id && !accounts.some((a) => a.id === user.id))
      account.add(new Option(user.nickname || user.email, user.id));
    account.value = user.id || "";
    account.onchange = async () => {
      account.disabled = true;
      try {
        if (account.value) {
          const target = accounts.find((a) => a.id === Number(account.value));
          const session = await api.post("/api/auth/login", { email: target.email, password: "password" });
          storage.setAuthSession(session.token, session.user);
        } else storage.clearAuth();
        location.reload();
      } catch (err) {
        notice(err.message);
        account.disabled = false;
        account.value = user.id || "";
      }
    };
    document.getElementById("theme").onclick = () => storage.toggleTheme();
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
