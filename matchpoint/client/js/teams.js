(function () {
  const {
    api,
    storage,
    root,
    params,
    user,
    escape: e,
    option,
    field,
    input,
    select,
    button,
    link,
    notice,
    bindForms,
  } = Hub;
  async function catalog() {
    const [{ teams }, dict] = await Promise.all([api.get("/api/teams"), api.getDictionaries()]);
    const create = user.role === "captain";
    root.innerHTML = `<div class="catalog-header"><h1>Команды</h1>${create ? link("#create", "Создать команду") : ""}</div>
      <div class="filters">${field("Дисциплина", select("discipline", option("", "Все дисциплины") + dict.disciplines.map((d) => option(d.id, d.name)).join("")))}
      ${field("Набор", select("vacancy", option("", "Все команды") + option("open", "С открытой вакансией")))}</div>
      <div class="catalog-grid" id="teams"></div>
      ${
        create
          ? `<details class="mp-card create-panel" id="create"><summary>Новая команда</summary><form data-action="create">
        ${field("Название", input("name", "text", 'required minlength="3" maxlength="50"'))}
        ${field("Дисциплина", select("discipline_id", dict.disciplines.map((d) => option(d.id, d.name)).join("")))}
        ${field("Описание", '<textarea class="form-control" name="description"></textarea>')}${button("Создать команду")}</form></details>`
          : ""
      }`;
    const filters = root.querySelector(".filters");
    function cards() {
      const items = teams.filter(
        (t) =>
          (!filters.querySelector("[name=discipline]").value ||
            String(t.discipline_id) === filters.querySelector("[name=discipline]").value) &&
          (!filters.querySelector("[name=vacancy]").value || t.looking_for_role_id),
      );
      document.getElementById("teams").innerHTML =
        items
          .map(
            (t) => `<article class="mp-card catalog-card">
        <div class="item-line"><span class="team-mark">${e(t.name.slice(0, 2).toUpperCase())}</span><span class="badge badge--team">${e(t.discipline_name)}</span></div>
        <h2><a href="?id=${t.id}">${e(t.name)}</a></h2><p>${t.looking_for_role_id ? `Ищем: ${e(t.looking_for_role_name)}` : "Набор закрыт"}</p>
        <div class="item-line card-end"><span class="muted">В составе: ${t.members_count}</span>${link("?id=" + t.id, "Открыть команду")}</div></article>`,
          )
          .join("") || "<p>Подходящих команд нет.</p>";
    }
    filters.onchange = cards;
    cards();
    if (create) {
      const panel = document.getElementById("create");
      root.querySelector('[href="#create"]').onclick = () => (panel.open = true);
      storage.bindFormDraft(panel.querySelector("form"), "team_create_" + user.id);
    }
    bindForms({
      create: async (values) => {
        const res = await api.post("/api/teams", { ...values, discipline_id: Number(values.discipline_id) });
        storage.clearDraft("team_create_" + user.id);
        location.search = "?id=" + res.team.id;
      },
    });
  }
  async function detail() {
    const base = "/api/teams/" + encodeURIComponent(params.get("id"));
    const { team: t } = await api.get(base);
    const owner = user.role === "captain" && t.captain_id === user.id;
    const [{ applications }, dict] = owner
      ? await Promise.all([api.get(base + "/applications"), api.getDictionaries()])
      : [{ applications: [] }, {}];
    const member = (
      m,
      action,
      label,
    ) => `<div class="member item-line"><span><strong>${e(m.nickname)}</strong><br><small class="muted">${m.user_id === t.captain_id ? "Капитан" : e(m.role_name || "Участник")}</small></span>
      ${action ? `<form data-action="${action}" data-user="${m.user_id}"><button class="btn btn--ghost btn--sm">${label}</button></form>` : ""}</div>`;
    root.innerHTML = `<a class="back" href="teams.html">← Все команды</a><div class="catalog-header"><h1>${e(t.name)}</h1><span class="badge badge--team">${e(t.discipline_name)}</span></div>
      <div class="catalog-layout"><div class="stack"><section class="mp-card"><h2>О команде</h2><p>${e(t.description || "Описание пока не добавлено.")}</p><span class="muted">Капитан · ${e(t.captain_nickname)}</span></section>
      <section class="mp-card"><h2>Состав · ${t.members.length}</h2>${t.members.map((m) => member(m, owner && m.user_id !== t.captain_id ? "kick" : null, "Исключить")).join("")}</section>
      ${owner ? `<section class="mp-card"><h2>Заявки · ${applications.length}</h2>${applications.map((m) => member(m, "accept", "Принять")).join("") || "<p>Ожидающих заявок нет.</p>"}</section>` : ""}</div>
      <aside class="stack"><section class="mp-card"><h2>Вакансия</h2><p>${e(t.looking_for_role_name || "Набор закрыт")}</p>
      ${
        owner
          ? `<form data-action="vacancy">${field(
              "Искомая роль",
              select(
                "role",
                option("", "Набор закрыт") +
                  dict.discipline_roles
                    .filter((r) => r.discipline_id === t.discipline_id)
                    .map((r) => option(r.id, r.name))
                    .join(""),
              ),
            )}${button("Сохранить вакансию")}</form>`
          : t.looking_for_role_id && !t.members.some((m) => m.user_id === user.id)
            ? user.id
              ? `<form data-action="apply">${button("Подать заявку")}</form>`
              : '<p class="muted">Войдите, чтобы подать заявку.</p>'
            : ""
      }</section>
      </aside></div>`;
    const draftKey = "vacancy_" + t.id + "_" + user.id;
    if (owner) {
      root.querySelector("[name=role]").value = t.looking_for_role_id || "";
      storage.bindFormDraft(root.querySelector("[data-action=vacancy]"), draftKey);
    }
    async function membership(action, form) {
      const id = Number(form.dataset.user);
      if (action === "kick" && !confirm("Исключить игрока из команды?")) return;
      await api.patch(base + "/members", { action, user_id: id });
      await detail();
      notice(action === "kick" ? "Игрок исключён" : "Игрок принят");
    }
    bindForms({
      vacancy: async (v) => {
        await api.patch(base + "/vacancy", { looking_for_role_id: Number(v.role) || null });
        storage.clearDraft(draftKey);
        await detail();
        notice("Вакансия сохранена");
      },
      apply: async () => {
        await api.post(base + "/applications", {});
        notice("Заявка отправлена капитану");
      },
      accept: (_, form) => membership("accept", form),
      kick: (_, form) => membership("kick", form),
    });
  }
  Hub.start("teams", params.has("id") ? detail : catalog);
})();
