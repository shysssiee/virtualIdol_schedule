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
let anchor = new Date(dayKey(new Date()) + "T12:00:00+08:00");
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
function card(e, extra = "", style = "") {
  const g = group(e);
  return `<button class="event ${extra} ${e.status === "cancelled" ? "cancelled" : ""}" style="--color:${g.color};${style}" data-event="${esc(e.id)}"><span class="meta">${time(e.start_at)}${platforms(e) ? " · " + esc(platforms(e)) : ""}</span>${isLive(e) ? ' <span class="live">直播中</span>' : ""}<strong>${esc(e.title)}</strong>${e.status === "cancelled" ? "<span>已取消</span>" : ""}</button>`;
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
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 4),
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
      html += `<div class="cell ${d.getUTCMonth() !== anchor.getUTCMonth() ? "outside" : ""} ${i % 7 === 0 ? "sunday" : i % 7 === 6 ? "saturday" : ""}"><span class="day-number ${dayKey(d) === dayKey(new Date()) ? "is-today" : ""}">${d.getUTCDate()}</span>${items
        .slice(0, 3)
        .map((e) => card(e))
        .join(
          "",
        )}${items.length > 3 ? `<button class="more" data-date="${dayKey(d)}">還有 ${items.length - 3} 場</button>` : ""}</div>`;
    }
    html += "</div>";
  } else if (view === "list") {
    visible = events.filter(
      (e) => dayKey(e.start_at).slice(0, 7) === dayKey(anchor).slice(0, 7),
    );
    html = records(visible);
  } else {
    const start = view === "day" ? anchor : shift(anchor, -anchor.getUTCDay()),
      days = view === "day" ? 1 : 7;
    html = `<div class="timeline" style="grid-template-columns:repeat(${days},minmax(150px,1fr))">`;
    for (let i = 0; i < days; i++) {
      const d = shift(start, i);
      const items = events.filter(
        (e) =>
          new Date(e.start_at) <
            new Date(dayKey(shift(d, 1)) + "T00:00:00+08:00") &&
          end(e) > new Date(dayKey(d) + "T00:00:00+08:00"),
      );
      visible.push(...items);
      const midnight = new Date(dayKey(d) + "T00:00:00+08:00").getTime();
      html += `<section class="time-day"><div class="time-head">${d.getUTCMonth() + 1}/${d.getUTCDate()} ${["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()]}</div><div class="time-body">${Array.from({ length: 24 }, (_, h) => `<span class="hour" style="top:${h * 60}px">${String(h).padStart(2, "0")}</span>`).join("")}${layout(
        items,
      )
        .map((r) => {
          const top = Math.max(
              0,
              (new Date(r.event.start_at) - midnight) / 60000,
            ),
            bottom = Math.min(1440, (end(r.event) - midnight) / 60000);
          return card(
            r.event,
            "time-event",
            `top:${top}px;height:${bottom - top}px;left:${(r.column / r.columns) * 100}%;width:calc(${100 / r.columns}% - 3px)`,
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
        anchor = new Date(b.dataset.date + "T12:00:00+08:00");
        view = "day";
        render();
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
  return `<h2>${esc(e.title)}</h2><p><span class="dot" style="--color:${group(e).color}"></span> ${esc(group(e).name)} · ${esc(people(e))}</p><p>${dayKey(e.start_at)}　${time(e.start_at)}–${time(end(e))}（UTC+8）</p><p>${esc(data.categories.find((c) => c.id === e.category_id)?.name || "")} ${e.status === "cancelled" ? " · 已取消" : isLive(e) ? " · 直播中" : ""}</p><p style="white-space:pre-wrap">${esc(e.description)}</p>`;
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
function localInput(d) {
  return dayKey(d) + "T" + time(d);
}
function eventForm(e) {
  if (!me) return;
  const value = e || {
    title: "",
    group_id: data.groups[0]?.id,
    member_ids: [],
    category_id: null,
    start_at: dayKey(anchor) + "T20:00:00+08:00",
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
    `<h2>${e ? "編輯" : "新增"}行程</h2><form id="event-form"><label>標題<input name="title" maxlength="160" required value="${esc(value.title)}"></label><div class="row"><label>團體<select name="group_id">${options("groups", value.group_id)}</select></label><label>活動分類<select name="category_id"></select></label></div><div id="event-members" class="check-list"></div><p class="muted">不勾選成員代表全團。跨團聯動以主辦團體配色，其他參與者填寫於說明。</p><div class="row"><div><label for="event-start">開始時間（UTC+8）</label><button type="button" id="now-time">現在時間</button><input id="event-start" name="start_at" type="datetime-local" required value="${localInput(value.start_at)}"></div><label>結束時間（選填，最多四小時）<input name="end_at" type="datetime-local" value="${value.end_at ? localInput(value.end_at) : ""}"></label></div><label>狀態<select name="status">${[
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
  $("#now-time").onclick = () => {
    form.elements.start_at.value = localInput(new Date());
    form.elements.start_at.focus();
    const finish = form.elements.end_at.value;
    $("#form-error").textContent =
      finish &&
      new Date(finish + ":00+08:00") <=
        new Date(form.elements.start_at.value + ":00+08:00")
        ? "原本的結束時間已早於或等於開始時間，請重新調整。"
        : "";
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const f = new FormData(form),
        start = new Date(f.get("start_at") + ":00+08:00"),
        finish = f.get("end_at")
          ? new Date(f.get("end_at") + ":00+08:00")
          : null;
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
        start_at: start.toISOString(),
        end_at: finish?.toISOString() || null,
        status: f.get("status"),
        description: f.get("description"),
        links,
        created_by: e?.created_by || me.id,
      });
      modal.close();
      await refresh();
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
const { admin } = createAdmin({
  getData: () => data,
  getUser: () => me,
  show,
  refresh,
  toast,
});
async function refresh() {
  data = await loadData();
  me = await profile();
  const siteName = data.site_settings[0]?.name || "星曆";
  $("#site-name").textContent = siteName;
  document.title = siteName + " · 直播行程";
  $("#site-credit").textContent = "架設網站：shysssiee　版本：" + VERSION;
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
  history = false;
  render();
};
$("#history-nav").onclick = () => {
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
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + direction, 1, 4),
    );
    if (history) historyMonth = dayKey(anchor).slice(0, 7);
  } else anchor = shift(anchor, direction * (view === "week" ? 7 : 1));
  render();
}
$("#previous").onclick = () => navigate(-1);
$("#next").onclick = () => navigate(1);
$("#today").onclick = () => {
  anchor = new Date(dayKey(new Date()) + "T12:00:00+08:00");
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
$("#admin-button").onclick = admin;
try {
  await refresh();
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
    if (!modal.open) refresh().catch(() => {});
  }, 60000);
}
setInterval(() => {
  if (data && !modal.open) render();
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
