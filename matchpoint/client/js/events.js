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
    date,
    link,
    bindForms,
  } = Hub;
  const types = EventDetail.types;
  const subtypeOptions = (cat) =>
    Object.entries(types)
      .filter(([k]) => !cat || (["hackathon", "programming_contest"].includes(k) ? "it" : "esports") === cat)
      .map(([k, v]) => option(k, v))
      .join("");
  const csv = (s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  function newForm(dict, places) {
    return `<details id="create" class="mp-card create-panel"><summary>Новый ивент</summary><form data-action="create">
      ${field("Тип", select("event_type", option("esports", "Киберспорт") + option("hackathon", "IT-мероприятие")))}
      ${field("Название", input("title", "text", 'required maxlength="200"'))}
      ${field("Описание", '<textarea name="description" class="form-control"></textarea>')}
      ${field("Подтип", select("subtype", ""))}${field("Дисциплина", select("discipline_id", "", "required"))}
      ${field("Начало", input("start_at", "datetime-local", "required"))}${field("Мест", input("max_participants", "number", 'required min="1" value="16"'))}
      ${field("Площадка", select("location_id", option("", "Онлайн") + places.map((l) => option(l.id, l.city + " · " + l.venue_name)).join("")))}
      <div id="sportsFields">${field("Формат игры", input("format", "text", 'placeholder="Например, 5×5"'))}</div>
      <div id="itFields" class="stack">
      ${field("Треки через запятую", input("tracks"))}${field("Технологии через запятую", input("tech_stack"))}
      ${field("Размер команды", input("team_size_limit", "number", 'min="1" value="4"'))}
      ${field("Дедлайн сдачи", input("submission_deadline", "datetime-local"))}
      ${field("Критерии оценки через запятую", input("criteria"))}</div>${button("Создать ивент")}</form></details>`;
  }
  async function catalog() {
    const [{ events }, { locations }] = await Promise.all([
      api.get("/api/events"),
      api.get("/api/events/locations"),
    ]);
    const canCreate = user.role === "organizer",
      dict = canCreate ? await api.getDictionaries() : null;
    root.innerHTML = `<div class="catalog-header"><h1>Ивенты</h1>${canCreate ? link("#create", "Создать ивент") : ""}</div>
      <div class="filters">${field("Направление", select("category", option("", "Все направления") + option("esports", "Киберспорт") + option("it", "IT")))}
      ${field("Вид мероприятия", select("kind", option("", "Все виды") + subtypeOptions("")))}</div>
      <div class="catalog-layout"><div class="stack"><div id="events" class="catalog-grid"></div>
      ${canCreate ? newForm(dict, locations) : ""}</div>
      <aside class="mp-card"><h2>Площадки</h2>${field("Показать ивенты", select("place", option("", "Все площадки") + option("online", "Онлайн") + locations.map((l) => option(l.id, l.venue_name)).join("")))}
      <div id="places"></div></aside></div>`;
    const filter = (name) => root.querySelector(`[name="${name}"]`);
    function render() {
      const cat = filter("category").value,
        kind = filter("kind").value,
        place = filter("place").value;
      const list = events.filter(
        (ev) =>
          (!cat || ev.category === cat) &&
          (!kind || ev.subtype === kind) &&
          (!place || (place === "online" ? !ev.location_id : String(ev.location_id) === place)),
      );
      document.getElementById("events").innerHTML =
        list
          .map((ev) => {
            const dt = new Date(ev.start_at),
              it = ev.event_type === "hackathon";
            return `<article class="mp-card catalog-card ${it ? "it" : ""}"><div class="item-line"><time class="date-tile"><b>${dt.getDate()}</b><small>${e(dt.toLocaleString("ru", { month: "short" }))}</small></time>
        <span class="badge ${it ? "badge--it" : "badge--esports"}">${e(types[ev.subtype])}</span></div>
        <h2><a href="?id=${ev.id}">${e(ev.title)}</a></h2><p class="card-meta">${e(ev.discipline_name)} · ${e(ev.location?.city || "Онлайн")} · ${e(EventDetail.status[ev.status])}</p>
        <p>${it ? e((ev.details.tracks || []).join(" · ")) : e(ev.details.format || types[ev.subtype])}</p>
        <div class="item-line card-end"><span class="muted">Заявок: ${ev.registrations_count} / ${ev.max_participants}</span>${link("?id=" + ev.id, "Подробнее")}</div></article>`;
          })
          .join("") || "<p>По этим фильтрам ивентов нет.</p>";
      document.getElementById("places").innerHTML = locations
        .filter((l) => !place || String(l.id) === place)
        .map(
          (l) =>
            `<details class="member"><summary>${e(l.venue_name)}</summary><p>${e(l.city)}, ${e(l.address)}</p>${l.lat != null && l.lng != null ? link("https://www.openstreetmap.org/?mlat=" + encodeURIComponent(l.lat) + "&mlon=" + encodeURIComponent(l.lng) + "#map=16/" + encodeURIComponent(l.lat) + "/" + encodeURIComponent(l.lng), "На карте") : ""}</details>`,
        )
        .join("");
    }
    filter("category").onchange = () => {
      filter("kind").innerHTML = option("", "Все виды") + subtypeOptions(filter("category").value);
      render();
    };
    filter("kind").onchange = render;
    filter("place").onchange = render;
    render();
    if (!canCreate) return;
    const panel = document.getElementById("create"),
      form = panel.querySelector("form"),
      f = form.elements;
    root.querySelector('[href="#create"]').onclick = () => (panel.open = true);
    function chooseType() {
      const it = f.event_type.value === "hackathon",
        cat = it ? "it" : "esports";
      f.subtype.innerHTML = subtypeOptions(cat);
      f.discipline_id.innerHTML = dict.disciplines
        .filter((d) => d.category === cat)
        .map((d) => option(d.id, d.name))
        .join("");
      for (const [group, hide] of [
        ["itFields", !it],
        ["sportsFields", it],
      ]) {
        const box = document.getElementById(group);
        box.hidden = hide;
        box.querySelectorAll("input").forEach((el) => {
          el.disabled = hide;
          el.required = !hide && el.name !== "criteria";
        });
      }
    }
    const draftKey = "event_create_" + user.id;
    const draft = storage.getDraft(draftKey);
    if (draft?.event_type) f.event_type.value = draft.event_type;
    chooseType();
    storage.bindFormDraft(form, draftKey);
    function formatRequired() {
      f.format.required = f.event_type.value === "esports" && f.subtype.value !== "watch_party";
    }
    f.event_type.onchange = () => {
      chooseType();
      formatRequired();
    };
    f.subtype.onchange = formatRequired;
    formatRequired();
    bindForms({
      create: async (v) => {
        const details = { subtype: v.subtype };
        if (v.event_type === "esports") details.format = v.format;
        else
          Object.assign(details, {
            tracks: csv(v.tracks),
            tech_stack: csv(v.tech_stack),
            team_size_limit: Number(v.team_size_limit),
            submission_deadline: new Date(v.submission_deadline).toISOString(),
          });
        if (v.criteria?.trim()) details.criteria = csv(v.criteria);
        const { event } = await api.post("/api/events", {
          title: v.title,
          description: v.description,
          event_type: v.event_type,
          discipline_id: Number(v.discipline_id),
          location_id: Number(v.location_id) || null,
          start_at: new Date(v.start_at).toISOString(),
          max_participants: Number(v.max_participants),
          details,
        });
        storage.clearDraft(draftKey);
        location.search = "?id=" + event.id;
      },
    });
  }
  Hub.start("events", params.has("id") ? EventDetail.render : catalog);
})();
