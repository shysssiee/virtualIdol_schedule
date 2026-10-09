import {
  civilKey,
  civilDate,
  localInput,
  fromLocal,
  dayBounds,
  deviceZone,
  validZone,
  zoneLabel,
  parts,
} from "./timezone.js";
import { createAdmin } from "./admin.js";
import {
  configured,
  client,
  authFlow,
  loadData,
  profile,
  save,
  remove,
} from "./data.js";
import {
  setZone,
  MAX_DURATION,
  VERSION,
  groupOptions,
  dayKey,
  time,
  end,
  isLive,
  escape as esc,
  shift,
  dayEvents,
  layout,
} from "./calendar.js";
const $ = (s) => document.querySelector(s);
let data,
  me,
  view = matchMedia("(max-width:760px)").matches ? "list" : "month",
  history = false;
let zonePreference = localStorage.getItem("calendar-zone") || "auto";
let displayZone = deviceZone();
setZone(displayZone);
let anchor = civilDate(dayKey(new Date()));
let adminOpen = false;
let zoneInitialized = false;
let selected;
try {
  selected = JSON.parse(localStorage.getItem("calendar-groups") || "null");
} catch {
  selected = null;
}
const memberSelection = new Map();
let historyMonth = "";
const modal = $("#modal");
modal.querySelector(".close").onclick = () => modal.close();
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
function toast(message) {
  if (modal.open) {
    let status = $("#modal-status");
    if (!status) {
      status = document.createElement("p");
      status.id = "modal-status";
      status.className = "modal-status";
      status.setAttribute("role", "status");
      $("#modal-body").prepend(status);
    }
    status.textContent = message;
    status.scrollIntoView({ block: "nearest" });
    return;
  }
  if (adminOpen) {
    $("#admin-status").hidden = false;
    $("#admin-status").textContent = message;
    return;
  }
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  setTimeout(() => ($("#toast").hidden = true), 4000);
}
function show(content) {
  $("#tooltip").hidden = true;
  $("#modal-body").innerHTML = content;
  modal.showModal();
}
function group(e) {
  return (
    data.groups.find((g) => g.id === e.group_id) || {
      name: "未分類",
      color: "#777777",
    }
  );
}
function people(e) {
  return e.member_ids.length
    ? e.member_ids
        .map((id) => data.members.find((m) => m.id === id)?.name)
        .filter(Boolean)
        .join("、")
    : "全團";
}
function platforms(e) {
  return e.links
    .map((l) => data.platforms.find((p) => p.id === l.platform_id)?.name || "")
    .join(" / ");
}
function card(e, extra = "", style = "", segmentStart = 0) {
  const continuation = segmentStart > Date.parse(e.start_at);
  const g = group(e);
  const category =
    data.categories.find((c) => c.id === e.category_id)?.name || "";
  const status =
    e.status === "cancelled"
      ? "已取消"
      : isLive(e)
        ? "直播中"
        : end(e) <= Date.now() || e.status === "ended"
          ? "已結束"
          : "";
  return `<button class="event ${extra} ${e.status === "cancelled" ? "cancelled" : ""}" style="--color:${g.color};${style}" data-event="${esc(e.id)}" aria-label="${esc(time(e.start_at) + " " + g.name + " " + e.title)}"><span class="meta">${time(continuation ? segmentStart : e.start_at)}${continuation ? " · 續播" : ""}</span>${status ? ` <span class="${status === "直播中" ? "live" : "event-status"}">${status}</span>` : ""}<strong>${esc(g.name)}</strong><span class="event-info">${esc([category, platforms(e)].filter(Boolean).join(" · "))}</span></button>`;
}
function filtered() {
  const category = $("#category").value,
    platform = $("#platform").value;
  return data.events.filter(
    (e) =>
      selected.includes(e.group_id) &&
      (!category || e.category_id === category) &&
      (!platform || e.links.some((l) => l.platform_id === platform)) &&
      (!memberSelection.has(e.group_id) ||
        !e.member_ids.length ||
        e.member_ids.some((id) =>
          memberSelection.get(e.group_id).includes(id),
        )),
  );
}
function renderFilters() {
  const query = $("#search").value.trim().toLowerCase();
  $("#groups").innerHTML =
    data.groups
      .filter((g) => g.name.toLowerCase().includes(query))
      .map(
        (g) =>
          `<div class="group"><label><input type="checkbox" data-group="${esc(g.id)}" ${selected.includes(g.id) ? "checked" : ""}><span class="dot" style="--color:${g.color}"></span>${esc(g.name)}</label><details><summary>成員 / 紀錄</summary><button data-history="${esc(g.id)}">查看過往紀錄</button>${data.members
            .filter((m) => m.group_id === g.id)
            .map(
              (m) =>
                `<label><input type="checkbox" data-member="${esc(m.id)}" data-parent="${esc(g.id)}" ${!memberSelection.has(g.id) || memberSelection.get(g.id).includes(m.id) ? "checked" : ""}>${esc(m.name)}</label>`,
            )
            .join("")}</details></div>`,
      )
      .join("") || '<p class="muted">找不到團體</p>';
  $("#groups")
    .querySelectorAll("[data-group]")
    .forEach(
      (el) =>
        (el.onchange = () => {
          selected = el.checked
            ? [...new Set([...selected, el.dataset.group])]
            : selected.filter((id) => id !== el.dataset.group);
          persist();
          render();
        }),
    );
  $("#groups")
    .querySelectorAll("[data-member]")
    .forEach(
      (el) =>
        (el.onchange = () => {
          const id = el.dataset.parent;
          const ids = [...$("#groups").querySelectorAll("[data-member]")]
            .filter((n) => n.dataset.parent === id && n.checked)
            .map((n) => n.dataset.member);
          memberSelection.set(id, ids);
          if (!selected.includes(id)) selected.push(id);
          persist();
          render();
        }),
    );
  $("#groups")
    .querySelectorAll("[data-history]")
    .forEach(
      (el) =>
        (el.onclick = () => {
          selected = [el.dataset.history];
          history = true;
          historyMonth = "";
          persist();
          renderFilters();
          render();
        }),
    );
}
function persist() {
  localStorage.setItem("calendar-groups", JSON.stringify(selected));
}
function render() {
  $("#jump-date").value = civilKey(anchor);
  const previousScroll = $(".timeline")?.scrollTop;
  const events = filtered();
  $("#calendar-nav").classList.toggle("active", !history);
  $("#history-nav").classList.toggle("active", history);
  $(".views").hidden = history;
  $(".date-controls").hidden = history;
  $("#view-label").textContent = history ? "STREAM ARCHIVE" : "STREAM SCHEDULE";
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#period").textContent = history
    ? "過往直播紀錄"
    : `${anchor.getUTCFullYear()} 年 ${anchor.getUTCMonth() + 1} 月${view === "day" ? " " + anchor.getUTCDate() + " 日" : ""}`;
  let html = "",
    visible = [];
  if (history) {
    visible = events
      .filter(
        (e) =>
          (end(e) <= Date.now() ||
            (e.status === "ended" &&
              new Date(e.start_at).getTime() <= Date.now())) &&
          (!historyMonth || dayKey(e.start_at).startsWith(historyMonth)),
      )
      .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
    html =
      `<label class="history-month">依月份查看<input id="history-month" type="month" value="${historyMonth}"></label>` +
      records(visible);
  } else if (view === "month") {
    const first = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12),
    );
    const start = shift(first, -first.getUTCDay());
    html =
      '<div class="month">' +
      ["SUN 日", "MON 一", "TUE 二", "WED 三", "THU 四", "FRI 五", "SAT 六"]
        .map((x) => `<div class="weekday">${x}</div>`)
        .join("");
    for (let i = 0; i < 42; i++) {
      const d = shift(start, i),
        items = dayEvents(events, d);
      visible.push(...items);
      html += `<div ${me ? `data-create-date="${civilKey(d)}"` : ""} class="cell ${d.getUTCMonth() !== anchor.getUTCMonth() ? "outside" : ""} ${i % 7 === 0 ? "sunday" : i % 7 === 6 ? "saturday" : ""}"><button type="button" ${me ? `data-create-date="${civilKey(d)}" aria-label="${civilKey(d)} 新增行程"` : "disabled"} class="day-number ${civilKey(d) === dayKey(new Date()) ? "is-today" : ""}">${d.getUTCDate()}</button>${items
        .slice(0, 3)
        .map((e) => card(e, "", "", dayBounds(civilKey(d), displayZone)[0]))
        .join(
          "",
        )}${items.length > 3 ? `<button class="more" data-date="${civilKey(d)}">還有 ${items.length - 3} 場</button>` : ""}</div>`;
    }
    html += "</div>";
  } else if (view === "list") {
    const first = civilKey(anchor).slice(0, 7) + "-01";
    const next = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 12),
    );
    const from = dayBounds(first, displayZone)[0],
      to = dayBounds(civilKey(next), displayZone)[0];
    visible = events.filter(
      (e) => Date.parse(e.start_at) < to && end(e) > from,
    );
    html = records(visible);
  } else {
    const start = view === "day" ? anchor : shift(anchor, -anchor.getUTCDay()),
      days = view === "day" ? 1 : 7;
    html = `<div class="timeline" style="grid-template-columns:repeat(${days},minmax(150px,1fr))">`;
    for (let i = 0; i < days; i++) {
      const d = shift(start, i);
      const [midnight, finish] = dayBounds(civilKey(d), displayZone);
      const duration = (finish - midnight) / 60000;
      const items = dayEvents(events, d);
      visible.push(...items);
      html += `<section class="time-day"><button class="time-head" type="button" ${me ? `data-create-date="${civilKey(d)}"` : "disabled"}>${d.getUTCMonth() + 1}/${d.getUTCDate()} ${["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()]}</button><div class="time-body" style="height:${duration}px" ${me ? `data-create-date="${civilKey(d)}" data-midnight="${midnight}"` : ""}>${Array.from({ length: Math.ceil(duration / 60) }, (_, h) => `<span class="hour" style="top:${h * 60}px">${time(midnight + h * 3600000)}</span>`).join("")}${layout(
        items,
      )
        .map((r) => {
          const top = Math.max(
              0,
              (new Date(r.event.start_at) - midnight) / 60000,
            ),
            bottom = Math.min(duration, (end(r.event) - midnight) / 60000);
          return card(
            r.event,
            "time-event",
            `top:${top}px;height:${bottom - top}px;left:${(r.column / r.columns) * 100}%;width:calc(${100 / r.columns}% - 3px)`,
            midnight,
          );
        })
        .join("")}</div></section>`;
    }
    html += "</div>";
  }
  $("#calendar").innerHTML = html;
  $("#count").textContent = `${new Set(visible.map((e) => e.id)).size} 場行程`;
  $("#history-month")?.addEventListener("change", (e) => {
    historyMonth = e.target.value;
    render();
  });
  document.querySelectorAll("[data-date]").forEach(
    (b) =>
      (b.onclick = () => {
        anchor = civilDate(b.dataset.date);
        view = "day";
        render();
      }),
  );
  document.querySelectorAll("[data-create-date]").forEach(
    (node) =>
      (node.onclick = (event) => {
        if (!me || event.target.closest("[data-event],.more")) return;
        event.stopPropagation();
        let instant = fromLocal(
          node.dataset.createDate + "T20:00",
          displayZone,
        );
        if (node.dataset.midnight) {
          const minutes = Math.max(
            0,
            Math.floor(
              (event.clientY - node.getBoundingClientRect().top) / 15,
            ) * 15,
          );
          const finish = dayBounds(node.dataset.createDate, displayZone)[1];
          instant = new Date(
            Math.min(
              finish - 60000,
              Number(node.dataset.midnight) + minutes * 60000,
            ),
          );
        }
        eventForm(null, instant);
      }),
  );
  bindCards();
  const timeline = $(".timeline");
  if (timeline) {
    const firstCard = timeline.querySelector(".time-event");
    timeline.scrollTop =
      previousScroll ??
      Math.max(0, parseFloat(firstCard?.style.top || "1080") - 60);
  }
}
function records(events) {
  return events.length
    ? events
        .map(
          (e) =>
            `<article class="record"><div class="record-date">${dayKey(e.start_at)}<br><span>${esc(group(e).name)}</span></div>${card(e)}</article>`,
        )
        .join("")
    : '<div class="empty">目前沒有符合條件的行程</div>';
}
function detail(e) {
  return `<h2>${esc(e.title)}</h2><p><span class="dot" style="--color:${group(e).color}"></span> ${esc(group(e).name)} · ${esc(people(e))}</p><p>${dayKey(e.start_at)}　${time(e.start_at)}–${dayKey(end(e)) !== dayKey(e.start_at) ? dayKey(end(e)) + " " : ""}${time(end(e))}（${esc(zoneLabel(displayZone, new Date(e.start_at)))}）</p><p>${esc(data.categories.find((c) => c.id === e.category_id)?.name || "")} ${e.status === "cancelled" ? " · 已取消" : isLive(e) ? " · 直播中" : ""}</p><p>${esc(platforms(e))}</p><p style="white-space:pre-wrap">${esc(e.description)}</p>`;
}
function bindCards() {
  document.querySelectorAll("[data-event]").forEach((b) => {
    const e = data.events.find((x) => x.id === b.dataset.event);
    b.onclick = () => {
      show(
        detail(e) +
          `<p class="muted">直播提醒依預定時間顯示，並非平台開播確認。</p><div>${e.links
            .filter((l) => /^https?:\/\//i.test(l.url))
            .map(
              (l) =>
                `<a class="platform-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(data.platforms.find((p) => p.id === l.platform_id)?.name)} · 開啟直播</a>`,
            )
            .join(
              "",
            )}</div>${me && (me.role === "owner" || e.created_by === me.id) ? '<div class="actions"><button id="edit-event">編輯行程</button>' + (me.role === "owner" ? '<button id="delete-event">刪除行程</button>' : "") + "</div>" : ""}`,
      );
      $("#edit-event")?.addEventListener("click", () => eventForm(e));
      $("#delete-event")?.addEventListener("click", async () => {
        if (!confirm("確定刪除這筆行程？")) return;
        try {
          await remove("events", e.id);
          modal.close();
          await refresh();
          toast("行程已刪除");
        } catch (err) {
          toast(err.message);
        }
      });
    };
    b.onmouseenter = () => {
      if (!matchMedia("(hover:hover)").matches || modal.open) return;
      const tip = $("#tooltip");
      tip.innerHTML = detail(e);
      tip.hidden = false;
      const r = b.getBoundingClientRect();
      tip.style.left =
        Math.max(10, Math.min(r.left, innerWidth - tip.offsetWidth - 10)) +
        "px";
      tip.style.top =
        Math.max(
          10,
          Math.min(r.bottom + 8, innerHeight - tip.offsetHeight - 10),
        ) + "px";
    };
    b.onmouseleave = () => ($("#tooltip").hidden = true);
  });
}
function options(table, value) {
  return data[table]
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${x.id === value ? "selected" : ""}>${esc(x.name)}</option>`,
    )
    .join("");
}
function eventForm(e, initialStart) {
  const inputZone = e?.input_timezone || "Asia/Taipei";
  if (!me) return;
  const value = e || {
    title: "",
    group_id: data.groups[0]?.id,
    member_ids: [],
    category_id: null,
    start_at: (
      initialStart || fromLocal(civilKey(anchor) + "T20:00", "Asia/Taipei")
    ).toISOString(),
    end_at: null,
    description: "",
    links: [],
    status: "scheduled",
  };
  if (!data.groups.length) {
    toast("請先由站主建立團體。");
    return;
  }
  show(
    `<h2>${e ? "編輯" : "新增"}行程</h2><form id="event-form"><label>輸入時區<select name="input_timezone"><option value="Asia/Taipei" ${inputZone === "Asia/Taipei" ? "selected" : ""}>台灣時間（UTC+8）</option><option value="Asia/Seoul" ${inputZone === "Asia/Seoul" ? "selected" : ""}>韓國時間（UTC+9）</option></select></label><p class="muted">開始與結束時間均依所選輸入時區；儲存後讀者會看到自己的當地時間。</p><label>標題<input name="title" maxlength="160" required value="${esc(value.title)}"></label><div class="row"><label>團體<select name="group_id">${options("groups", value.group_id)}</select></label><label>活動分類<select name="category_id"></select></label></div><div id="event-members" class="check-list"></div><p class="muted">不勾選成員代表全團。跨團聯動以主辦團體配色，其他參與者填寫於說明。</p><div class="row"><div><label for="event-start">開始時間（依輸入時區）</label><button type="button" id="now-time">現在時間</button><input id="event-start" name="start_at" type="datetime-local" required value="${localInput(value.start_at, inputZone)}"></div><label>結束時間（選填，最多四小時）<input name="end_at" type="datetime-local" value="${value.end_at ? localInput(value.end_at, inputZone) : ""}"></label></div><label>狀態<select name="status">${[
      ["scheduled", "預定 / 依時間直播中"],
      ["ended", "已結束"],
      ["cancelled", "已取消"],
    ]
      .map(
        ([v, n]) =>
          `<option value="${v}" ${v === value.status ? "selected" : ""}>${n}</option>`,
      )
      .join(
        "",
      )}</select></label><h3>平台與直播連結（選填）</h3><div id="event-links"></div><p class="muted">直播連結可以稍後補上；不填也能公開行程。</p><label>說明<textarea name="description" rows="3" maxlength="5000">${esc(value.description)}</textarea></label><p class="error" id="form-error"></p><button class="primary" type="submit">儲存並公開</button></form>`,
  );
  const form = $("#event-form");
  function groupFields(initial = false) {
    const g = data.groups.find((g) => g.id === form.elements.group_id.value);
    const categories = groupOptions(g, data.categories, "category_ids"),
      platforms = groupOptions(g, data.platforms, "platform_ids");
    form.elements.category_id.innerHTML =
      '<option value="">不指定分類</option>' +
      categories
        .map(
          (c) =>
            `<option value="${c.id}" ${initial && c.id === value.category_id ? "selected" : ""}>${esc(c.name)}</option>`,
        )
        .join("");
    $("#event-members").innerHTML =
      "<label>參與成員</label>" +
      data.members
        .filter((m) => m.group_id === g.id)
        .map(
          (m) =>
            `<label><input type="checkbox" name="member_ids" value="${m.id}" ${initial && value.member_ids.includes(m.id) ? "checked" : ""}>${esc(m.name)}</label>`,
        )
        .join("");
    $("#event-links").innerHTML = platforms
      .map(
        (p) =>
          `<label>${esc(p.name)}<input type="url" data-platform-url="${p.id}" placeholder="https://…" value="${esc(initial ? value.links.find((l) => l.platform_id === p.id)?.url || "" : "")}"></label>`,
      )
      .join("");
  }
  groupFields(true);
  form.elements.group_id.onchange = () => groupFields(false);
  let formZone = inputZone;
  form.elements.input_timezone.onchange = () => {
    const next = form.elements.input_timezone.value;
    for (const name of ["start_at", "end_at"]) {
      const field = form.elements[name];
      if (field.value)
        field.value = localInput(fromLocal(field.value, formZone), next);
    }
    formZone = next;
  };
  $("#now-time").onclick = () => {
    form.elements.start_at.value = localInput(new Date(), formZone);
    form.elements.start_at.focus();
    const finish = form.elements.end_at.value;
    $("#form-error").textContent =
      finish &&
      fromLocal(finish, formZone) <=
        fromLocal(form.elements.start_at.value, formZone)
        ? "原本的結束時間已早於或等於開始時間，請重新調整。"
        : "";
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const f = new FormData(form),
        start = fromLocal(f.get("start_at"), formZone),
        finish = f.get("end_at") ? fromLocal(f.get("end_at"), formZone) : null;
      if (finish && (finish <= start || finish - start > MAX_DURATION))
        throw Error("結束時間須晚於開始，且相隔不超過四小時。");
      const links = [...form.querySelectorAll("[data-platform-url]")]
        .filter((i) => i.value.trim())
        .map((i) => {
          const url = new URL(i.value);
          if (!["http:", "https:"].includes(url.protocol))
            throw Error("連結僅接受 http 或 https。");
          return { platform_id: i.dataset.platformUrl, url: url.href };
        });
      await save("events", {
        id: e?.id || crypto.randomUUID(),
        title: f.get("title").trim(),
        group_id: f.get("group_id"),
        category_id: f.get("category_id") || null,
        member_ids: f.getAll("member_ids"),
        input_timezone: formZone,
        start_at: start.toISOString(),
        end_at: finish?.toISOString() || null,
        status: f.get("status"),
        description: f.get("description"),
        links,
        created_by: e?.created_by || me.id,
      });
      modal.close();
      await refresh();
      if (adminOpen) admin();
      toast("行程已公開");
    } catch (error) {
      const target = $("#form-error");
      if (target) target.textContent = error.message;
      else toast(error.message);
    } finally {
      button.disabled = false;
    }
  };
}
function login() {
  if (!configured) {
    show(
      "<h2>協作者登入</h2><p>目前是唯讀示範。請依安裝說明設定資料服務後啟用正式登入。</p>",
    );
    return;
  }
  show(
    '<h2>協作者登入</h2><p class="muted">帳號由站主建立，不開放自行註冊。</p><form id="login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><p id="form-error" class="error"></p><button type="submit" class="primary">登入</button><button type="button" id="reset">忘記密碼</button></form>',
  );
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await client.auth.signInWithPassword({
      email: f.get("email"),
      password: f.get("password"),
    });
    if (error) {
      $("#form-error").textContent = "登入失敗，請確認帳號與密碼。";
      return;
    }
    await refresh();
    if (!me) {
      $("#form-error").textContent = "帳號尚未授權或已停用，請聯絡站主。";
      await client.auth.signOut();
      return;
    }
    modal.close();
  };
  $("#reset").onclick = async () => {
    const email = $("#login-form").elements.email.value;
    if (!email) {
      $("#form-error").textContent = "請先輸入 Email。";
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: location.href.split("#")[0],
    });
    $("#form-error").textContent = error
      ? error.message
      : "若帳號存在，將寄出重設密碼信。";
  };
}
function passwordForm() {
  show(
    '<h2>設定新密碼</h2><form id="password-form"><label>新密碼<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><p id="form-error" class="error"></p><button class="primary">儲存密碼</button></form>',
  );
  $("#password-form").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await client.auth.updateUser({
      password: new FormData(e.target).get("password"),
    });
    if (error) {
      $("#form-error").textContent = error.message;
      return;
    }
    modal.close();
    await refresh();
    toast("密碼已更新");
  };
}
const {
  admin,
  canLeave,
  reset: resetAdmin,
} = createAdmin({
  getData: () => data,
  getUser: () => me,
  show,
  refresh,
  toast,
  eventForm,
  isLive,
  end,
});
async function refresh() {
  data = await loadData();
  me = await profile();
  const siteName = data.site_settings[0]?.name || "星曆";
  $("#site-name").textContent = siteName;
  document.title = siteName + " · 直播行程";
  $("#site-credit").textContent = "架設網站：shysssiee　版本：" + VERSION;
  const settings = data.site_settings[0] || {};
  applyZone(settings.default_timezone || "auto");
  const report = $("#report-link");
  report.hidden = !/^https:\/\//i.test(settings.report_url || "");
  report.href = report.hidden ? "#" : settings.report_url;
  if (selected === null) selected = data.groups.map((g) => g.id);
  selected = selected.filter((id) => data.groups.some((g) => g.id === id));
  for (const t of ["category", "platform"]) {
    const el = $("#" + t),
      value = el.value;
    el.innerHTML =
      `<option value="">全部${t === "category" ? "分類" : "平台"}</option>` +
      options(t === "category" ? "categories" : "platforms", value);
  }
  renderFilters();
  render();
  if (adminOpen && me?.role !== "owner") leaveAdmin(true);
  $("#new-button").hidden = !me;
  $("#password-button").hidden = !me;
  $("#admin-button").hidden = me?.role !== "owner";
  $("#login-button").textContent = me
    ? "登出 · " + me.display_name
    : "協作者登入";
}
$("#search").oninput = renderFilters;
$("#filter-toggle").onclick = () => {
  const expanded = $("aside").classList.toggle("expanded");
  $("#filter-toggle").setAttribute("aria-expanded", String(expanded));
  $("#filter-toggle").textContent = expanded ? "收起篩選" : "團體與平台篩選";
};
$("#category").onchange = render;
$("#platform").onchange = render;
$("#all").onclick = () => {
  selected = data.groups.map((g) => g.id);
  memberSelection.clear();
  persist();
  renderFilters();
  render();
};
$("#none").onclick = () => {
  selected = [];
  persist();
  renderFilters();
  render();
};
$("#calendar-nav").onclick = () => {
  if (adminOpen && !leaveAdmin()) return;
  history = false;
  render();
};
$("#history-nav").onclick = () => {
  if (adminOpen && !leaveAdmin()) return;
  history = true;
  render();
};
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      render();
    }),
);
function navigate(direction) {
  if (view === "month" || view === "list" || history) {
    anchor = new Date(
      Date.UTC(
        anchor.getUTCFullYear(),
        anchor.getUTCMonth() + direction,
        1,
        12,
      ),
    );
    if (history) historyMonth = civilKey(anchor).slice(0, 7);
  } else anchor = shift(anchor, direction * (view === "week" ? 7 : 1));
  render();
}
$("#jump-date").onchange = (event) => {
  if (!event.target.value) return;
  anchor = civilDate(event.target.value);
  render();
};
$("#previous").onclick = () => navigate(-1);
$("#next").onclick = () => navigate(1);
$("#today").onclick = () => {
  anchor = civilDate(dayKey(new Date()));
  historyMonth = "";
  render();
};
$("#login-button").onclick = async () => {
  if (me) {
    await client.auth.signOut();
    await refresh();
  } else login();
};
$("#new-button").onclick = () => eventForm();
$("#password-button").onclick = passwordForm;
function enterAdmin() {
  if (adminOpen) return;
  if (me?.role !== "owner") {
    toast("此頁面僅供站主使用，請先登入站主帳號。");
    return;
  }
  adminOpen = true;
  modal.close();
  $("#tooltip").hidden = true;
  $("#public-workspace").hidden = true;
  $("#admin-workspace").hidden = false;
  admin();
  location.hash = "admin";
}
function leaveAdmin(force = false) {
  if (!force && !canLeave()) return false;
  resetAdmin();
  adminOpen = false;
  $("#admin-workspace").hidden = true;
  $("#public-workspace").hidden = false;
  if (location.hash === "#admin") historyReplace();
  render();
  return true;
}
function historyReplace() {
  window.history.replaceState(null, "", location.pathname + location.search);
}
$("#admin-button").onclick = enterAdmin;
$("#return-calendar").onclick = () => leaveAdmin();
window.addEventListener("hashchange", () => {
  if (location.hash === "#admin") enterAdmin();
  else if (adminOpen) leaveAdmin();
});
function applyZone(defaultZone) {
  const requested = zonePreference === "default" ? defaultZone : zonePreference;
  const next =
    requested === "auto" || !validZone(requested) ? deviceZone() : requested;
  setZone(next);
  displayZone = next;
  if (!zoneInitialized) {
    anchor = civilDate(dayKey(new Date()));
    zoneInitialized = true;
  }
  const zones = [
    ...new Set([
      deviceZone(),
      "Asia/Taipei",
      "Asia/Seoul",
      "Asia/Tokyo",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "UTC",
      next,
    ]),
  ];
  $("#display-zone").innerHTML =
    '<option value="auto">自動：裝置時區</option><option value="default">網站預設</option>' +
    zones
      .map((z) => `<option value="${esc(z)}">${esc(zoneLabel(z))}</option>`)
      .join("");
  $("#display-zone").value = zonePreference;
  $("#zone-note").textContent = "行程顯示：" + zoneLabel(next);
}
$("#display-zone").onchange = (event) => {
  zonePreference = event.target.value;
  localStorage.setItem("calendar-zone", zonePreference);
  applyZone(data.site_settings[0]?.default_timezone || "auto");
  render();
};
function updateClock() {
  const now = new Date(),
    p = parts(now, "Asia/Taipei");
  const weekday = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    weekday: "long",
  }).format(now);
  $("#taipei-clock").innerHTML =
    `<strong>${p.year}年${p.month}月${p.day}日</strong><span>${weekday}</span><span>中原標準時間（UTC+8）</span><b>${p.hour}:${p.minute}:${p.second}</b>`;
}
updateClock();
setInterval(updateClock, 1000);
try {
  await refresh();
  if (location.hash === "#admin") enterAdmin();
  $("#notice").textContent = configured
    ? ""
    : "唯讀示範 · 團體與行程為虛構資料，設定資料服務後即可正式使用。";
} catch (err) {
  $("#notice").textContent = "資料載入失敗，請檢查連線與設定。";
  $("#calendar").innerHTML =
    '<div class="empty">暫時無法取得行程 <button onclick="location.reload()">重新載入</button></div>';
  console.error(err);
}
if (client) {
  if (authFlow) passwordForm();
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") passwordForm();
  });
  setInterval(() => {
    if (!modal.open && !adminOpen) refresh().catch(() => {});
  }, 60000);
}
setInterval(() => {
  if (data && !modal.open && !adminOpen) render();
}, 30000);
window.addEventListener("scroll", () => ($("#tooltip").hidden = true), true);
if (document.modelContext?.registerTool) {
  Promise.resolve(
    document.modelContext.registerTool({
      name: "read_calendar_events",
      description: "讀取目前篩選條件下的直播行程。",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (!input || Object.keys(input).length) throw Error("不接受參數");
        return filtered().map((e) => ({
          title: e.title,
          start: e.start_at,
          group: group(e).name,
          status: e.status,
        }));
      },
    }),
  ).catch(console.error);
}
