const EventDetail = (function () {
  const {
    api,
    root,
    user,
    params,
    escape: e,
    option,
    field,
    input,
    select,
    button,
    link,
    date,
    safeURL,
    notice,
    bindForms,
  } = Hub;
  const types = {
    tournament: "Турнир",
    lan: "LAN",
    online: "Онлайн-турнир",
    watch_party: "Watch Party",
    hackathon: "Хакатон",
    programming_contest: "Турнир по программированию",
  };
  const status = {
    open: "Регистрация открыта",
    ongoing: "Проходит сейчас",
    finished: "Завершён",
    cancelled: "Отменён",
    scheduled: "Ожидает результата",
    disputed: "На рассмотрении",
    confirmed: "Подтверждён",
  };
  const localInput = (v) => {
    const d = new Date(v);
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  function bracket(matches, mine, owner, active) {
    const rounds = [...new Set(matches.map((m) => m.round))];
    return (
      rounds
        .map(
          (round) =>
            `<div class="round"><h3>Раунд ${round}</h3>${matches
              .filter((m) => m.round === round)
              .map((m) => {
                const canReport =
                  active &&
                  m.status === "scheduled" &&
                  mine.some((r) => [m.participant1_id, m.participant2_id].includes(r.id));
                const winner = m.winner_id === m.participant1_id ? m.participant1_name : m.participant2_name;
                return `<article class="match stack"><div class="item-line"><strong>${e(m.participant1_name || "—")} / ${e(m.participant2_name || "Без соперника")}</strong><span class="muted">${e(status[m.status])}</span></div>
        ${m.score ? `<p>Счёт: <b>${e(m.score)}</b></p>` : ""}${m.winner_id ? `<p>Победитель: ${e(winner)}</p>` : ""}
        ${m.proof_url && safeURL(m.proof_url) ? `<a href="${safeURL(m.proof_url)}" target="_blank" rel="noopener">Посмотреть скриншот ↗</a>` : ""}
        ${
          canReport
            ? `<form data-action="report" data-id="${m.id}">${field("Счёт", input("score", "text", 'required maxlength="50"'))}
        ${field("Скриншот PNG или JPEG, до 5 МБ", input("proof", "file", 'accept="image/png,image/jpeg" required'))}${button("Отправить результат судье")}</form>`
            : ""
        }
        ${
          active && owner && m.status === "disputed"
            ? `<form data-action="confirm" data-id="${m.id}">${field("Победитель", select("winner", option("", "Выберите участника") + option(m.participant1_id, m.participant1_name) + option(m.participant2_id, m.participant2_name), "required"))}
        ${field("Итоговый счёт", input("score", "text", `required maxlength="50" value="${e(m.score)}"`))}${button("Подтвердить победителя")}</form>`
            : ""
        }</article>`;
              })
              .join("")}</div>`,
        )
        .join("") || "<p>Турнирная сетка ещё не сформирована.</p>"
    );
  }
  function organizerPanel(ev, entries, locations) {
    const opts = locations.map((l) => option(l.id, l.venue_name)).join(""),
      active = !["finished", "cancelled"].includes(ev.status);
    const statuses = [ev.status];
    if (ev.event_type === "hackathon" || ev.subtype === "watch_party")
      statuses.push(ev.status === "open" ? "ongoing" : "finished");
    statuses.push("cancelled");
    return `<section class="mp-card"><h2>Кабинет организатора</h2>
      ${
        active
          ? `<details><summary>Настройки и расписание</summary><form data-action="settings">
      ${field("Тема", input("theme", "text", `value="${e(ev.details.theme)}"`))}
      ${field("Начало", input("start_at", "datetime-local", `required value="${localInput(ev.start_at)}"`))}
      ${field("Площадка", select("location_id", option("", "Онлайн") + opts))}
      ${field("Статус", select("status", statuses.map((v) => option(v, status[v])).join("")))}
      ${button("Сохранить изменения")}</form>
      <form class="card-end" data-action="schedule">${field("Пункт расписания", input("title", "text", "required"))}${field("Время", input("start_at", "datetime-local", "required"))}${button("Добавить в расписание")}</form></details>`
          : ""
      }
      <h3>Заявки · ${entries.length}</h3>${
        entries
          .map(
            (r) => `<details class="member"><summary>${e(r.name)}</summary>
      ${r.mentor ? `<p>Ментор: ${e(r.mentor)}</p>` : ""}
      ${r.repository_url ? `<p><a href="${safeURL(r.repository_url)}" target="_blank" rel="noopener">Репозиторий проекта ↗</a></p>` : ""}
      ${
        r.evaluation
          ? `<p>${Object.entries(r.evaluation)
              .map(([key, val]) => `${e(key)}: ${e(val)}`)
              .join(" · ")}</p>`
          : ""
      }
      ${active ? `<form data-action="mentor" data-id="${r.id}">${field("Ментор", input("mentor", "text", `required value="${e(r.mentor)}"`))}${button("Назначить ментора")}</form>` : ""}
      ${active && r.repository_url ? `<form data-action="evaluate" data-id="${r.id}">${(ev.details.criteria || ["Общая оценка"]).map((key, i) => field(key, input("grade" + i, "number", `required step="any" value="${e(r.evaluation?.[key])}"`))).join("")}${button("Сохранить оценку")}</form>` : ""}</details>`,
          )
          .join("") || "<p>Пока никто не зарегистрирован.</p>"
      }</section>`;
  }
  async function render() {
    const base = "/api/events/" + encodeURIComponent(params.get("id")),
      { event: ev } = await api.get(base);
    const owner = user.role === "organizer" && user.id === ev.organizer_id,
      it = ev.event_type === "hackathon",
      tournament = !it && ev.subtype !== "watch_party";
    const active = !["finished", "cancelled"].includes(ev.status);
    const [mine, teams, br, entries, places] = await Promise.all([
      user.id ? api.get(base + "/registrations/me").then((v) => v.registrations) : [],
      user.role === "captain" ? api.get("/api/teams").then((v) => v.teams) : [],
      tournament ? api.get(base + "/bracket").then((v) => v.matches) : [],
      owner ? api.get(base + "/registrations").then((v) => v.registrations) : [],
      owner ? api.get("/api/events/locations").then((v) => v.locations) : [],
    ]);
    const candidates = teams.filter(
      (t) =>
        t.captain_id === user.id &&
        t.discipline_id === ev.discipline_id &&
        !mine.some((r) => r.team_id === t.id),
    );
    const canSolo = !mine.some((r) => r.user_id === user.id);
    const choices =
      (canSolo ? option("solo", "Лично") : "") + candidates.map((t) => option(t.id, t.name)).join("");
    const schedule = ev.details.schedule || [];
    root.innerHTML = `<a class="back" href="events.html">← Все ивенты</a>
      <div class="catalog-header"><h1>${e(ev.title)}</h1><span class="badge ${it ? "badge--it" : "badge--esports"}">${e(types[ev.subtype])}</span></div>
      <div class="catalog-layout"><div class="stack">
      <section class="mp-card"><div class="item-line"><h2>${it ? "О проектном соревновании" : "О мероприятии"}</h2><span class="muted">${e(status[ev.status])}</span></div>
      <p>${e(ev.description || ev.discipline_name)}</p><p class="card-meta">${e(ev.discipline_name)} · ${e(date(ev.start_at))} · ${e(ev.location?.venue_name || "Онлайн")}</p>
      ${ev.details.theme ? `<p>Тема: ${e(ev.details.theme)}</p>` : ""}
      ${
        it
          ? `<div class="row">${(ev.details.tracks || []).map((t) => `<span class="badge badge--it">${e(t)}</span>`).join("")}</div>
      <p>Стек: ${e((ev.details.tech_stack || []).join(", "))}</p><p>До ${e(ev.details.team_size_limit)} человек в команде · Сдача до ${e(date(ev.details.submission_deadline))}</p>`
          : ev.details.format
            ? `<p>Формат: ${e(ev.details.format)}</p>`
            : ""
      }
      ${schedule.length ? `<h3>Расписание</h3>${schedule.map((s) => `<p>${e(date(s.start_at))} · ${e(s.title)}</p>`).join("")}` : ""}</section>
      ${
        tournament
          ? `<section class="mp-card"><h2>Турнирная сетка</h2>${bracket(br, mine, owner, active)}
      ${owner && !br.length && ev.status === "open" ? `<form data-action="bracket">${button("Сформировать сетку")}</form>` : ""}</section>`
          : ""
      }
      ${owner ? organizerPanel(ev, entries, places) : ""}</div>
      <aside class="stack"><section class="mp-card"><h2>Регистрация</h2><p>Занято мест: ${ev.registrations_count} из ${ev.max_participants}</p>
      ${ev.status === "open" && ev.registrations_count < ev.max_participants ? (user.id ? (choices ? `<form data-action="register">${field("Участник", select("participant", choices))}${button("Зарегистрироваться")}</form>` : "") : "<p>Войдите, чтобы зарегистрироваться.</p>") : `<p>${ev.status === "open" ? "Свободных мест нет" : "Регистрация завершена"}</p>`}
      ${mine
        .map(
          (
            r,
          ) => `<div class="member"><strong>${e(r.name)}</strong><p class="muted">Регистрация подтверждена</p>
      ${r.mentor ? `<p>Ментор: ${e(r.mentor)}</p>` : ""}
      ${
        r.evaluation
          ? `<p>Оценки: ${Object.entries(r.evaluation)
              .map(([k, v]) => e(k) + " · " + e(v))
              .join(", ")}</p>`
          : ""
      }
      ${r.repository_url ? `<a href="${safeURL(r.repository_url)}" target="_blank" rel="noopener">Отправленное решение ↗</a>` : ""}
      ${active && it && !r.evaluation && Date.now() <= Date.parse(ev.details.submission_deadline) ? `<form data-action="project" data-id="${r.id}">${field("Ссылка на репозиторий", input("url", "url", `required value="${e(r.repository_url)}"`))}${button("Сдать проект")}</form>` : ""}</div>`,
        )
        .join("")}</section>
      ${ev.location ? `<section class="mp-card"><h2>Площадка</h2><strong>${e(ev.location.venue_name)}</strong><p>${e(ev.location.city)}, ${e(ev.location.address)}</p></section>` : ""}</aside></div>`;
    if (owner && active) root.querySelector("[name=location_id]").value = ev.location_id || "";
    async function changed(request, message) {
      await request;
      await render();
      notice(message);
    }
    bindForms({
      register: (v) =>
        changed(
          api.post(base + "/register", v.participant === "solo" ? {} : { team_id: Number(v.participant) }),
          "Регистрация подтверждена",
        ),
      bracket: () => changed(api.post(base + "/bracket", {}), "Сетка сформирована"),
      confirm: (v, f) =>
        changed(
          api.post(base + "/result", {
            action: "confirm",
            match_id: Number(f.dataset.id),
            winner_id: Number(v.winner),
            score: v.score,
          }),
          "Победитель подтверждён",
        ),
      report: async (v, f) => {
        if (v.proof.size > 5 * 1024 * 1024) throw Error("Максимальный размер файла — 5 МБ");
        const proof_url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(Error("Не удалось прочитать файл"));
          reader.readAsDataURL(v.proof);
        });
        await changed(
          api.post(base + "/result", { match_id: Number(f.dataset.id), score: v.score, proof_url }),
          "Результат передан судье",
        );
      },
      project: (v, f) =>
        changed(
          api.post(base + "/result", { registration_id: Number(f.dataset.id), repository_url: v.url }),
          "Проект отправлен",
        ),
      settings: (v) =>
        changed(
          api.patch(base, {
            ...(v.theme.trim() ? { theme: v.theme } : {}),
            start_at: new Date(v.start_at).toISOString(),
            location_id: Number(v.location_id) || null,
            status: v.status,
          }),
          "Настройки сохранены",
        ),
      schedule: (v) =>
        changed(
          api.patch(base, {
            schedule: [...schedule, { title: v.title, start_at: new Date(v.start_at).toISOString() }],
          }),
          "Расписание обновлено",
        ),
      mentor: (v, f) =>
        changed(api.patch(base + "/registrations/" + f.dataset.id, { mentor: v.mentor }), "Ментор назначен"),
      evaluate: (v, f) =>
        changed(
          api.patch(base + "/registrations/" + f.dataset.id, {
            evaluation: Object.fromEntries(
              (ev.details.criteria || ["Общая оценка"]).map((key, i) => [key, Number(v["grade" + i])]),
            ),
          }),
          "Оценка сохранена",
        ),
    });
  }
  return { render, types, status };
})();
