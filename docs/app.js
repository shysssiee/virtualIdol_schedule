import { showUrlImport } from "./url-import.js";
import { matchImportGroup, matchImportPlatform } from "./url-import-core.js";
import { groupDay, newEventStatus, duplicates, eventChanges } from "./v14.js";
import { bindGroupPhotos } from "./group-photo.js";
import {
  templateHtml,
  bindTemplates,
  showEventHistory,
} from "./event-tools.js";
import { defaultEventTitle, templateValues } from "./event-template.js";
import { startIdleSession } from "./idle-session.js";
import { startVisitorPresence } from "./visitor-presence.js";
import { visitorForm } from "./visitor-forms.js";
import { startAutoRefresh } from "./auto-refresh.js";
import { createBoard } from "./board.js";
import { createCollaborator } from "./collaborator.js";
import { greeting } from "./greeting.js";
import { memberEntryHtml, bindMemberEntry } from "./member-entry.js";
import { updateSiteMetadata } from "./site-title.js";
import { createPresence } from "./presence.js";
import { createExtras } from "./extras.js";
import { createHoverPanel } from "./hover.js";
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
  isUpcoming,
  escape as esc,
  shift,
  dayEvents,
  layout,
} from "./calendar.js";
const $ = (s) => document.querySelector(s);
let data,
  me,
  view = "month",
  history = false;
let zonePreference = localStorage.getItem("calendar-zone") || "auto";
let displayZone = deviceZone();
setZone(displayZone);
let anchor = civilDate(dayKey(new Date()));
let adminOpen = false;
let zoneInitialized = false;
// Following filters apply only to this visit; every new page starts with all groups.
let selected = null;
const memberSelection = new Map();
let historyMonth = "";
const modal = $("#modal");
const hoverPanel = createHoverPanel($("#tooltip"));
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
  modal.classList.remove("event-dialog");
  modal.style.removeProperty("--event-color");
  $("#modal").style.background = "white";
  hoverPanel.hide();
  $("#modal-body").innerHTML = content;
  modal.showModal();
}
const presence = createPresence(client, () => me);
const board = createBoard({ getUser: () => me, show, toast });
const extras = createExtras({
  getData: () => data,
  getUser: () => me,
  show,
  refresh,
  toast,
  render,
  getZone: () => displayZone,
  hoverPanel,
  positionHover,
  openLive: (start) => eventForm(null, start, true),
  openImport: () =>
    showUrlImport({
      show,
      openManual: () => eventForm(null, null, true),
      openEvent: (result) =>
        eventForm(null, new Date(result.start_at), true, result),
    }),
});
function positionHover(tip, button) {
  const r = button.getBoundingClientRect(),
    w = tip.offsetWidth,
    h = tip.offsetHeight;
  const left =
    r.right + 8 + w <= innerWidth
      ? r.right + 8
      : r.left - w - 8 >= 10
        ? r.left - w - 8
        : Math.max(10, Math.min(r.left, innerWidth - w - 10));
  tip.style.left = left + "px";
  tip.style.top = Math.max(10, Math.min(r.top, innerHeight - h - 10)) + "px";
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
function groupSummary(bundle, key) {
  const g = data.groups.find((g) => g.id === bundle.id),
    live = bundle.items.some((e) => isLive(e)),
    upcoming = bundle.items.some((e) => isUpcoming(e));
  return `<button class="event pill group-summary" style="--color:${esc(g.color)}" data-group-day="${key}" data-group-id="${esc(g.id)}" aria-label="${esc(g.name)} ${bundle.items.length} 場直播">${live ? '<span class="live">LIVE</span>' : upcoming ? '<span class="upcoming">即將直播</span>' : ""}<strong>${esc(g.name)}${bundle.items.length > 1 ? " ＋" : ""}</strong></button>`;
}
function showGroupDay(key, id) {
  const items = dayEvents(filtered(), civilDate(key))
    .filter((e) => e.group_id === id)
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  if (items.length === 1) {
    openEvent(items[0]);
    return;
  }
  const g = data.groups.find((g) => g.id === id);
  show(
    `<h2>${esc(g.name)} · ${esc(key)}</h2><p>當日 ${items.length} 場直播</p><div class="day-schedule-list">${items
      .map(
        (e) =>
          `<button class="day-schedule-item" data-event="${esc(e.id)}" style="--color:${esc(g.color)}"><strong>${isLive(e) ? '<span class="live">LIVE</span>' : isUpcoming(e) ? '<span class="upcoming">即將直播</span>' : ""}${time(e.start_at)} · ${esc(
            e.member_ids
              .map((id) => data.members.find((m) => m.id === id)?.name)
              .filter(Boolean)
              .join("、") || "全團",
          )}</strong><span>${esc(e.title)}</span></button>`,
      )
      .join("")}</div>`,
  );
  bindCards();
}
function card(e, extra = "", style = "", segmentStart = 0) {
  const continuation = segmentStart > Date.parse(e.start_at);
  const g = group(e);
  const category =
    data.categories.find((c) => c.id === e.category_id)?.name || "";
  const status =
    e.status === "cancelled"
      ? "已取消"
      : isUpcoming(e)
        ? "即將直播"
        : isLive(e)
          ? "直播中"
          : end(e) <= Date.now() || e.status === "ended"
            ? "已結束"
            : "";
  return `<button class="event ${extra} ${isLive(e) ? "is-live" : ""} ${e.status === "cancelled" ? "cancelled" : ""}" style="--color:${g.color};${style}" data-event="${esc(e.id)}" aria-label="${esc(time(e.start_at) + " " + g.name + " " + e.title + (isLive(e) ? " LIVE 直播中" : isUpcoming(e) ? " 即將直播" : ""))}">${status ? ` <span class="${status === "直播中" ? "live" : status === "即將直播" ? "upcoming" : "event-status"}">${status === "直播中" ? "LIVE" : status}</span>` : ""}<span class="meta">${time(continuation ? segmentStart : e.start_at)}${continuation ? " · 續播" : ""}</span><strong>${esc(g.name)}</strong><span class="event-info">${[
    category,
    platforms(e),
  ]
    .filter(Boolean)
    .map((text) => `<span>${esc(text)}</span>`)
    .join('<span class="event-separator"> · </span>')}</span></button>`;
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
          renderFilters();
          render();
        }),
    );
}
function render() {
  hoverPanel.hide();
  $("#jump-date").value = civilKey(anchor);
  const previousScroll = $(".timeline")?.scrollTop;
  const events = filtered().filter(extras.inRange);
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
  if (extras.rangeActive()) $("#period").textContent = extras.rangeLabel();
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
        .map(
          (x) =>
            `<div class="weekday"><span class="weekday-en">${x.split(" ")[0]}</span> ${x.split(" ")[1]}</div>`,
        )
        .join("");
    const daysInMonth = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const cellCount = Math.ceil((first.getUTCDay() + daysInMonth) / 7) * 7;
    for (let i = 0; i < cellCount; i++) {
      const d = shift(start, i),
        items = dayEvents(events, d).sort(
          (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
        );
      visible.push(...items);
      const bundles = groupDay(items);
      const limit = matchMedia("(max-width:600px)").matches ? 2 : 3;
      html += `<div data-day-list="${civilKey(d)}" class="cell ${d.getUTCMonth() !== anchor.getUTCMonth() ? "outside" : ""} ${i % 7 === 0 ? "sunday" : i % 7 === 6 ? "saturday" : ""}"><button type="button" data-day-list="${civilKey(d)}" aria-label="${civilKey(d)} 查看當日行程" class="day-number ${civilKey(d) === dayKey(new Date()) ? "is-today" : ""}">${d.getUTCDate()}</button>${extras.dateExtras(civilKey(d))}<div class="day-events">${bundles
        .slice(0, limit)
        .map((bundle) => groupSummary(bundle, civilKey(d)))
        .join(
          "",
        )}${bundles.length > limit ? `<button class="more-events" data-day-list="${civilKey(d)}">＋其他 ${bundles.length - limit} 團</button>` : ""}</div></div>`;
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
      (e) =>
        extras.rangeActive() ||
        (Date.parse(e.start_at) >= from && Date.parse(e.start_at) < to),
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
      const items = dayEvents(events, d).sort(
        (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
      );
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
  $("#group-legend").innerHTML = data.groups
    .filter((g) => selected.includes(g.id))
    .map(
      (g) =>
        `<span class="legend-item" ${g.photo_data ? `tabindex="0" role="button" aria-label="查看 ${esc(g.name)} 團體照片" data-photo-group="${esc(g.id)}"` : ""}><span class="dot" style="--color:${esc(g.color)}"></span>${esc(g.name)}</span>`,
    )
    .join("");
  $("#calendar").innerHTML = html;
  bindGroupPhotos($("#group-legend"), data.groups);
  document
    .querySelectorAll("[data-group-day]")
    .forEach(
      (b) =>
        (b.onclick = () => showGroupDay(b.dataset.groupDay, b.dataset.groupId)),
    );

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
        if (
          !me ||
          event.target.closest("[data-event],.more,[data-anniversary-date]")
        )
          return;
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
  document.querySelectorAll("[data-day-list]").forEach(
    (node) =>
      (node.onclick = (event) => {
        if (
          event.target.closest(
            "[data-event],[data-anniversary-date],[data-group-day]",
          )
        )
          return;
        event.stopPropagation();
        showDayList(node.dataset.dayList);
      }),
  );
  if (
    selectedDay &&
    view === "month" &&
    matchMedia("(max-width:600px)").matches
  )
    showDayList(selectedDay, false);
  else $("#mobile-day-panel").hidden = true;
  bindCards();
  extras.bindDates();
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
let selectedDay = null;
function showDayList(key, shouldScroll = true) {
  selectedDay = key;
  const items = dayEvents(filtered(), civilDate(key)).sort(
    (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
  );
  const content = `<h2>${esc(key)} 當日行程</h2><p class="muted">${extras.dayAlmanac(key).map(esc).join(" · ")}</p><div class="day-schedule-list">${items.map((e) => `<button data-event="${esc(e.id)}" class="day-schedule-item" style="--color:${esc(group(e).color)}"><strong>${isLive(e) ? '<span class="live">LIVE</span>' : isUpcoming(e) ? '<span class="upcoming">即將直播</span>' : e.status === "ended" ? "已結束 · " : ""}${time(e.start_at)} · ${esc(group(e).name)}</strong><span>${esc(e.title)}${e.members_only ? " · 屬於付費會員限定" : ""}</span></button>`).join("") || "<p>當日暫無行程</p>"}</div>${me ? '<button id="day-add-event" class="primary">＋ 新增行程</button>' : ""}`;
  if (matchMedia("(max-width:600px)").matches) {
    const panel = document.querySelector("#mobile-day-panel");
    panel.hidden = false;
    panel.innerHTML = content;
    if (shouldScroll)
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
  } else show(content);
  $("#day-add-event")?.addEventListener("click", () =>
    eventForm(null, fromLocal(key + "T12:00", displayZone)),
  );
  bindCards();
}
function detail(e) {
  const category =
    data.categories.find((c) => c.id === e.category_id)?.name || "";
  const icon = /可視/.test(category)
    ? "📺 "
    : /聲音/.test(category)
      ? "🔊 "
      : "";
  return `<div class="event-detail" style="--color:${group(e).color}"><h3>${esc(group(e).name)} · ${esc(people(e))}</h3><h2>${esc(e.title)}${e.previous_start_at ? ' <span class="time-change">時間異動</span>' : ""}${isLive(e) ? '<span class="detail-live-badge">直播中</span>' : isUpcoming(e) ? '<span class="upcoming">即將直播</span>' : ""}${e.members_only ? '<span class="members-only-badge">屬於付費會員限定</span>' : ""}</h2>${e.previous_start_at ? `<p class="muted">原時間：${dayKey(e.previous_start_at)} ${time(e.previous_start_at)} → 新時間：${dayKey(e.start_at)} ${time(e.start_at)}</p>` : ""}<p>${dayKey(e.start_at)}　${time(e.start_at)}（${esc(zoneLabel(displayZone, new Date(e.start_at)))}）</p><p>${icon}${esc(category)} ${e.status === "cancelled" ? " · 已取消" : ""}</p><p style="white-space:pre-wrap">${esc(e.description)}</p></div>`;
}
function platformLinks(e) {
  return e.links
    .filter((l) => /^https?:\/\//i.test(l.url))
    .map(
      (l) =>
        `<a class="platform-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(data.platforms.find((p) => p.id === l.platform_id)?.name)} · 開啟直播</a>`,
    )
    .join("");
}
function styleEventDialog(e) {
  modal.classList.add("event-dialog");
  modal.style.setProperty("--event-color", group(e).color);
  modal.style.background =
    "color-mix(in srgb, " + group(e).color + " 12%, white)";
}
function openEvent(e) {
  show(
    detail(e) +
      `<div>${platformLinks(e)}</div><p class="muted">直播提醒依預定時間顯示，開始後兩小時停止；並非平台開播確認。</p>${extras.shareHtml(e)}${me ? '<button id="event-history">修改紀錄</button>' : ""}${me && (me.role === "owner" || e.created_by === me.id) ? '<div class="actions"><button id="edit-event">編輯行程</button>' + (isLive(e) ? '<button id="end-live">結束直播</button>' : "") + (me.role === "owner" ? '<button id="delete-event">刪除行程</button>' : "") + "</div>" : ""}`,
  );
  styleEventDialog(e);
  $("#event-history")?.addEventListener("click", () =>
    showEventHistory(e, show, data),
  );
  extras.bindShare($("#modal-body"));
  $("#end-live")?.addEventListener("click", () => finishLive(e));
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
}
function bindCards() {
  document.querySelectorAll("[data-event]").forEach((b) => {
    const e = data.events.find((x) => x.id === b.dataset.event);
    b.onclick = () => openEvent(e);
    b.onmouseenter = () => {
      if (!matchMedia("(hover:hover)").matches || modal.open) return;
      hoverPanel.cancel();
      const tip = $("#tooltip");
      tip.innerHTML =
        '<button type="button" class="close" aria-label="關閉浮卡">×</button>' +
        detail(e) +
        platformLinks(e) +
        '<p class="muted">直播提醒開始後兩小時停止，並非平台開播確認。</p>' +
        extras.shareHtml(e);
      tip.style.setProperty("--event-color", group(e).color);
      tip.style.background =
        "color-mix(in srgb, " + group(e).color + " 12%, white)";
      extras.bindShare(tip);
      tip.querySelector(".close").onclick = hoverPanel.hide;
      tip.hidden = false;
      positionHover(tip, b);
    };
    b.onmouseleave = hoverPanel.leave;
  });
}
async function finishLive(e) {
  if (!confirm("確定結束直播提示？行程仍會保留。")) return;
  try {
    const { error } = await client.rpc("end_live", { event_id: e.id });
    if (error) throw error;
    modal.close();
    hoverPanel.hide();
    await refresh();
    toast("直播已手動結束");
  } catch (error) {
    toast(error.message);
  }
}
function options(table, value) {
  return data[table]
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${x.id === value ? "selected" : ""}>${esc(x.name)}</option>`,
    )
    .join("");
}
function eventForm(e, initialStart, liveOnly = false, imported = null) {
  if (!e && !liveOnly && me) {
    extras.choose(initialStart);
    return;
  }
  const inputZone = e?.input_timezone || "Asia/Taipei";
  if (!me) return;
  const value = e || {
    title: imported?.title || "",
    group_id:
      (imported && matchImportGroup(imported, data.groups)) ||
      data.groups[0]?.id,
    member_ids: [],
    members_only: false,
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
    `<h2>${e ? "編輯" : "新增"}行程</h2><form id="event-form">${imported ? `<div class="settings-card"><p>已導入 ${esc(imported.platform)} ${esc(imported.channel || imported.host || "")} 的直播資訊。請確認團體、成員、日期與時間；資料尚未發布。</p><label><input type="checkbox" required>我已確認導入資訊與團體選擇</label></div>` : ""}<label>輸入時區<select name="input_timezone"><option value="Asia/Taipei" ${inputZone === "Asia/Taipei" ? "selected" : ""}>台灣時間（UTC+8）</option><option value="Asia/Seoul" ${inputZone === "Asia/Seoul" ? "selected" : ""}>韓國時間（UTC+9）</option></select></label><p class="muted">開始時間依所選輸入時區；儲存後讀者會看到自己的當地時間。</p><label>標題<input name="title" maxlength="160" placeholder="留空自動顯示團體／分類 LIVE" value="${esc(value.title)}"></label><div class="row"><label>團體<select name="group_id">${options("groups", value.group_id)}</select></label><label>活動分類<select name="category_id"></select></label></div>${!e ? '<div class="settings-card"><label>套用過往行程<select id="past-event"></select></label><div class="actions"><button type="button" id="apply-latest">套用最近一次</button><button type="button" id="apply-past">套用選取行程</button></div><p class="muted">保留本次日期，帶入過往時間與設定；標題留空。請確認連結是否適用本次直播。</p></div>' : ""}<label class="members-only-option"><input type="checkbox" name="members_only" ${value.members_only ? "checked" : ""}>會員限定</label><div id="event-members" class="check-list"></div><p class="muted">不勾選成員代表全團。跨團聯動以主辦團體配色，其他參與者填寫於說明。</p><div class="row"><div><label for="event-start">開始時間（依輸入時區）</label><button type="button" id="now-time">現在時間</button><input id="event-start" name="start_at" type="datetime-local" required value="${localInput(value.start_at, inputZone)}"></div></div>${
      e
        ? `<label>狀態<select name="status">${[
            ["scheduled", "預定 / 依時間直播中"],
            ["ended", "已結束"],
            ["cancelled", "已取消"],
          ]
            .map(
              ([v, n]) =>
                `<option value="${v}" ${v === value.status ? "selected" : ""}>${n}</option>`,
            )
            .join("")}</select></label>`
        : '<p id="automatic-status" class="muted"></p>'
    }${!e ? templateHtml() : ""}<h3>平台與直播連結（選填）</h3><div id="event-links"></div><p class="muted">直播連結可以稍後補上；不填也能公開行程。</p><label>說明<textarea name="description" rows="3" maxlength="5000">${esc(value.description)}</textarea></label><p class="error" id="form-error"></p><button class="primary" type="submit">儲存並公開</button></form>`,
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
    let entry = form.querySelector(".member-entry");
    if (!entry) {
      $("#event-members").insertAdjacentHTML("afterend", memberEntryHtml());
      entry = form.querySelector(".member-entry");
    }
    bindMemberEntry(
      entry,
      data,
      () => form.elements.group_id.value,
      (m) => {
        const existing = form.querySelector(
          `input[name="member_ids"][value="${CSS.escape(m.id)}"]`,
        );
        if (existing) {
          existing.checked = true;
          return;
        }
        $("#event-members").insertAdjacentHTML(
          "beforeend",
          `<label><input type="checkbox" name="member_ids" value="${esc(m.id)}" checked>${esc(m.name)}</label>`,
        );
      },
    );
    $("#event-links").innerHTML = platforms
      .map(
        (p) =>
          `<label>${esc(p.name)}<input type="url" data-platform-url="${p.id}" placeholder="https://…" value="${esc(initial ? value.links.find((l) => l.platform_id === p.id)?.url || "" : "")}"></label>`,
      )
      .join("");
  }
  groupFields(true);
  form.elements.group_id.onchange = () => {
    groupFields(false);
    pastOptions();
    reloadTemplates?.();
  };
  function pastEvents() {
    return data.events
      .filter(
        (item) =>
          item.group_id === form.elements.group_id.value &&
          Date.parse(item.start_at) <= Date.now(),
      )
      .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at));
  }
  function pastOptions() {
    if (e) return;
    const items = pastEvents();
    $("#past-event").innerHTML =
      items
        .map(
          (item) =>
            `<option value="${esc(item.id)}">${esc(localInput(item.start_at, item.input_timezone || "Asia/Taipei").replace("T", " "))} · ${esc(item.title)}</option>`,
        )
        .join("") || '<option value="">尚無過往行程</option>';
    $("#apply-latest").disabled = $("#apply-past").disabled = !items.length;
  }
  function applyPast(item) {
    if (!item) return;
    const preset = templateValues(item, form.elements.start_at.value);
    form.elements.input_timezone.value = preset.zone;
    formZone = preset.zone;
    form.elements.start_at.value = preset.start;
    groupFields(false);
    form.elements.category_id.value = preset.category;
    if (form.elements.category_id.selectedIndex < 0)
      form.elements.category_id.value = "";
    form
      .querySelectorAll('[name="member_ids"]')
      .forEach((i) => (i.checked = preset.members.includes(i.value)));
    form.elements.members_only.checked = preset.membersOnly;
    form
      .querySelectorAll("[data-platform-url]")
      .forEach(
        (i) =>
          (i.value =
            preset.links.find((l) => l.platform_id === i.dataset.platformUrl)
              ?.url || ""),
      );
    form.elements.title.value = "";
    if (form.elements.status) form.elements.status.value = "scheduled";
    updateAutomaticStatus();
    toast("已帶入過往設定，請確認日期、時間與連結後儲存");
  }
  pastOptions();
  if (!e) {
    $("#apply-latest").onclick = () => applyPast(pastEvents()[0]);
    $("#apply-past").onclick = () =>
      applyPast(
        pastEvents().find((item) => item.id === $("#past-event").value),
      );
  }
  let formZone = inputZone;
  form.elements.input_timezone.onchange = () => {
    const next = form.elements.input_timezone.value;
    for (const name of ["start_at"]) {
      const field = form.elements[name];
      if (field.value)
        field.value = localInput(fromLocal(field.value, formZone), next);
    }
    formZone = next;
    updateAutomaticStatus();
  };
  function updateAutomaticStatus() {
    const note = $("#automatic-status");
    if (note && !form.elements.start_at.value) {
      note.textContent = "請選擇開始時間";
      return;
    }
    if (note)
      note.textContent =
        "狀態自動判定：" +
        (newEventStatus(
          fromLocal(form.elements.start_at.value, formZone).toISOString(),
        ) === "ended"
          ? "已結束（補登過往直播）"
          : "預定直播");
  }
  let reloadTemplates = null;
  if (!e) {
    reloadTemplates = bindTemplates(form, {
      getGroup: () => form.elements.group_id.value,
      getUser: () => me,
      toast,
      readSettings: () => ({
        zone: formZone,
        time: form.elements.start_at.value.slice(11, 16),
        category: form.elements.category_id.value,
        members: [...form.querySelectorAll('[name="member_ids"]')]
          .filter((i) => i.checked)
          .map((i) => i.value),
        membersOnly: form.elements.members_only.checked,
        links: [...form.querySelectorAll("[data-platform-url]")]
          .filter((i) => i.value.trim())
          .map((i) => ({
            platform_id: i.dataset.platformUrl,
            url: i.value.trim(),
          })),
      }),
      applySettings: (settings) => {
        const zone = ["Asia/Taipei", "Asia/Seoul"].includes(settings.zone)
          ? settings.zone
          : "Asia/Taipei";
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time))
          throw Error("範本時間格式錯誤");
        form.elements.input_timezone.value = zone;
        formZone = zone;
        form.elements.start_at.value =
          form.elements.start_at.value.slice(0, 10) + "T" + settings.time;
        groupFields(false);
        form.elements.category_id.value = settings.category || "";
        if (form.elements.category_id.selectedIndex < 0)
          form.elements.category_id.value = "";
        form
          .querySelectorAll('[name="member_ids"]')
          .forEach(
            (i) => (i.checked = (settings.members || []).includes(i.value)),
          );
        form.elements.members_only.checked = !!settings.membersOnly;
        form
          .querySelectorAll("[data-platform-url]")
          .forEach(
            (i) =>
              (i.value =
                (settings.links || []).find(
                  (l) => l.platform_id === i.dataset.platformUrl,
                )?.url || ""),
          );
        form.elements.title.value = "";
        updateAutomaticStatus();
      },
    });
    reloadTemplates();
    form.elements.start_at.addEventListener("input", updateAutomaticStatus);
    updateAutomaticStatus();
  }
  $("#now-time").onclick = () => {
    form.elements.start_at.value = localInput(new Date(), formZone);
    form.elements.start_at.focus();
    updateAutomaticStatus();
    $("#form-error").textContent = "";
  };
  if (imported) {
    const fillImportedLink = () => {
      const g = data.groups.find((g) => g.id === form.elements.group_id.value);
      const p = groupOptions(g, data.platforms, "platform_ids").find(p => matchImportPlatform(imported.platform, p.name));
      if (p) {
        const input = [...form.querySelectorAll("[data-platform-url]")].find(
          (i) => i.dataset.platformUrl === p.id,
        );
        if (input) input.value = imported.url;
      }
      const missing = form.querySelector("#import-platform-missing");
      if (missing) missing.remove();
      if (!p)
        form
          .querySelector("#event-links")
          .insertAdjacentHTML(
            "afterend",
            `<p id="import-platform-missing" class="error">此團體未啟用 ${esc(imported.platform)} 平台，請先由站主設定平台再儲存。來源：${esc(imported.url)}</p>`,
          );
      return !!p;
    };
    fillImportedLink();
    form.elements.group_id.addEventListener("change", fillImportedLink);
    form.dataset.importPlatform = imported.platform;
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (imported && form.querySelector("#import-platform-missing")) {
      $("#form-error").textContent =
        "請先啟用此團體的直播平台，避免遺漏匯入網址";
      return;
    }
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const f = new FormData(form),
        start = fromLocal(f.get("start_at"), formZone);
      const links = [...form.querySelectorAll("[data-platform-url]")]
        .filter((i) => i.value.trim())
        .map((i) => {
          const url = new URL(i.value);
          if (!["http:", "https:"].includes(url.protocol))
            throw Error("連結僅接受 http 或 https。");
          return { platform_id: i.dataset.platformUrl, url: url.href };
        });
      const duplicateRows = duplicates(data.events, {
        id: e?.id,
        group_id: f.get("group_id"),
        member_ids: f.getAll("member_ids"),
        start_at: start.toISOString(),
      });
      if (
        duplicateRows.length &&
        !confirm(
          `已有 ${duplicateRows.length} 筆同團、同時間且成員重疊的行程。確定仍要發布？`,
        )
      )
        return;
      await save(
        "events",
        {
          id: e?.id || crypto.randomUUID(),
          title: defaultEventTitle(
            f.get("title"),
            data.groups.find((g) => g.id === f.get("group_id"))?.name,
            data.categories.find((c) => c.id === f.get("category_id"))?.name,
          ),
          group_id: f.get("group_id"),
          category_id: f.get("category_id") || null,
          member_ids: f.getAll("member_ids"),
          members_only: f.has("members_only"),
          input_timezone: formZone,
          start_at: start.toISOString(),
          end_at: null,
          status: e ? f.get("status") : newEventStatus(start.toISOString()),
          description: f.get("description"),
          links,
          created_by: e?.created_by || me.id,
        },
        { existing: !!e },
      );
      modal.close();
      await refresh();
      if (adminOpen) {
        if (me.role === "owner") admin();
        else collaborator.render().catch((e) => toast(e.message));
      }
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
    '<h2>協作者登入</h2><p class="muted">帳號由站主建立，不開放自行註冊。</p><form id="login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><p id="form-error" class="error"></p><div class="form-actions"><button type="submit" class="primary">登入</button><button type="button" id="reset">忘記密碼</button></div></form>',
  );
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { data: loginResult, error } = await client.auth.signInWithPassword({
      email: f.get("email"),
      password: f.get("password"),
    });
    if (error) {
      $("#form-error").textContent = "登入失敗，請確認帳號與密碼。";
      return;
    }
    try {
      localStorage.setItem(
        "calendar-idle-" + loginResult.user.id,
        String(Date.now()),
      );
    } catch {}
    await refresh();
    if (!me) {
      $("#form-error").textContent = "帳號尚未授權或已停用，請聯絡站主。";
      await presence.stop();
      await client.auth.signOut();
      return;
    }
    show(
      `<div class="login-welcome"><h2>登入成功！</h2><p>${esc(greeting(me.display_name, displayZone))}</p><button id="welcome-start" class="primary">開始使用</button></div>`,
    );
    $("#welcome-start").onclick = () => modal.close();
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
  passwordForm,
  manageAnniversaries: extras.manager,
  manageReports: board.list,
  updatePresence: presence.badges,
  isLive,
  end,
});
let lastEvents = null,
  latestChanges = [];
async function refresh() {
  data = await loadData();
  const changes = eventChanges(lastEvents, data.events);
  lastEvents = structuredClone(data.events);
  if (changes.length) {
    latestChanges = changes;
    const notice = $("#update-notice");
    notice.hidden = false;
    notice.innerHTML = `<span>本次更新：新增 ${changes.filter((c) => c.kind === "新增").length} 場、修改 ${changes.filter((c) => c.kind === "修改").length} 場</span><button id="view-updates">查看更新</button><button id="dismiss-updates" aria-label="關閉更新提示">×</button>`;
    $("#dismiss-updates").onclick = () => (notice.hidden = true);
    $("#view-updates").onclick = () => {
      show(
        "<h2>本次行程更新</h2>" +
          latestChanges
            .map(
              (c) =>
                `<button class="day-schedule-item" data-event="${esc(c.event.id)}"><strong>${c.kind} · ${esc(data.groups.find((g) => g.id === c.event.group_id)?.name)} · ${dayKey(c.event.start_at)} ${time(c.event.start_at)}</strong><span>${esc(c.event.title)}</span>${c.prior && c.prior.start_at !== c.event.start_at ? `<span>原時間：${dayKey(c.prior.start_at)} ${time(c.prior.start_at)}</span>` : ""}</button>`,
            )
            .join(""),
      );
      bindCards();
    };
  }

  me = await profile();
  presence.start();
  const siteName = data.site_settings[0]?.name || "星曆";
  $("#site-name").textContent = siteName;
  updateSiteMetadata(document, siteName);
  $("#site-credit").textContent = "架設網站：shysssiee　版本：" + VERSION;
  const settings = data.site_settings[0] || {};
  applyZone(settings.default_timezone || "auto");
  $("#report-link").hidden = !!me;
  $("#apply-button").hidden = !!me;
  const freshVisit = selected === null;
  if (freshVisit) selected = data.groups.map((g) => g.id);
  selected = selected.filter((id) => data.groups.some((g) => g.id === id));
  for (const t of ["category", "platform"]) {
    const el = $("#" + t),
      value = freshVisit ? "" : el.value;
    el.innerHTML =
      `<option value="">全部${t === "category" ? "分類" : "平台"}</option>` +
      options(t === "category" ? "categories" : "platforms", value);
  }
  renderFilters();
  render();
  if (adminOpen && !me) leaveAdmin(true);
  updateGreeting();
  $("#new-button").hidden = !me;
  $("#password-button").hidden = !me;
  $("#admin-button").hidden = !me;
  $("#admin-button").textContent =
    me?.role === "owner" ? "站主管理" : "協作後台";
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
  $("#category").value = "";
  $("#platform").value = "";
  renderFilters();
  render();
};
$("#none").onclick = () => {
  selected = [];
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
  extras.clearRange();
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
  extras.clearRange();
  anchor = civilDate(event.target.value);
  render();
};
$("#previous").onclick = () => navigate(-1);
$("#next").onclick = () => navigate(1);
$("#today").onclick = () => {
  extras.clearRange();
  anchor = civilDate(dayKey(new Date()));
  historyMonth = "";
  render();
};
$("#login-button").onclick = async () => {
  if (me) {
    await presence.stop();
    await client.auth.signOut();
    await refresh();
  } else login();
};
$("#new-button").onclick = () => eventForm();
$("#password-button").onclick = passwordForm;
const collaborator = createCollaborator({
  isLive,
  end,
  getData: () => data,
  getUser: () => me,
  eventForm,
  manageAnniversaries: extras.manager,
  board,
  show,
  passwordForm,
  refresh,
  toast,
});
function enterAdmin() {
  if (adminOpen) return;
  if (!me) {
    toast("請先登入。");
    return;
  }
  adminOpen = true;
  modal.close();
  hoverPanel.hide();
  $("#public-workspace").hidden = true;
  $("#admin-workspace").hidden = false;
  $("#admin-workspace h2").textContent = "本站後台";
  if (me.role === "owner") admin();
  else collaborator.render().catch((e) => toast(e.message));
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
  if (location.hash === "#admin") {
    enterAdmin();
    return;
  }
  if (location.hash.startsWith("#event=")) {
    const id = decodeURIComponent(location.hash.slice(7));
    document.querySelector('[data-event="' + CSS.escape(id) + '"]')?.click();
    const e = data.events.find((x) => x.id === id);
    if (e && !modal.open) {
      show(detail(e) + platformLinks(e) + extras.shareHtml(e));
      styleEventDialog(e);
      extras.bindShare($("#modal-body"));
    }
  } else if (adminOpen) leaveAdmin();
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
function updateGreeting() {
  const el = $("#login-greeting");
  el.hidden = !me;
  el.textContent = me ? greeting(me.display_name, displayZone) : "";
}
function updateClock() {
  updateGreeting();
  const now = new Date(),
    p = parts(now, "Asia/Taipei");
  const weekday = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    weekday: "long",
  }).format(now);
  $("#taipei-clock").innerHTML =
    `<strong>${p.year}年${p.month}月${p.day}日（${weekday}）</strong><span>中原標準時間（UTC+8）</span><b>${p.hour}:${p.minute}:${p.second}</b>`;
}
updateClock();
setInterval(updateClock, 1000);
try {
  await refresh();
  if (location.hash === "#admin") enterAdmin();
  if (location.hash.startsWith("#event=")) {
    const id = decodeURIComponent(location.hash.slice(7));
    document.querySelector('[data-event="' + CSS.escape(id) + '"]')?.click();
    const e = data.events.find((x) => x.id === id);
    if (e && !modal.open) {
      show(detail(e) + platformLinks(e) + extras.shareHtml(e));
      styleEventDialog(e);
      extras.bindShare($("#modal-body"));
    }
  }
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
    if (event === "SIGNED_OUT")
      setTimeout(async () => {
        if (!me) return;
        me = null;
        modal.close();
        hoverPanel.hide();
        leaveAdmin(true);
        try {
          await presence.stop();
          await refresh();
        } catch (error) {
          toast(error.message);
        }
      }, 0);
  });
  const autoRefresh = startAutoRefresh({
    refresh,
    canRefresh: () => !modal.open && !adminOpen && $("#tooltip").hidden,
  });
  modal.addEventListener("close", autoRefresh.check);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) autoRefresh.stop();
  });
}
setInterval(() => {
  if (data && !modal.open && !adminOpen && $("#tooltip").hidden) render();
}, 30000);
window.addEventListener(
  "scroll",
  (event) => {
    if (!$("#tooltip").contains(event.target)) hoverPanel.hide();
  },
  true,
);
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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.open) hoverPanel.hide();
});

$("#apply-button").onclick = () => visitorForm("application", { show, toast });
$("#report-link").onclick = () => visitorForm("report", { show, toast });

startVisitorPresence(client, $("#count"));

if (client)
  startIdleSession({
    getUser: () => me,
    signOut: async () => {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) {
        toast("自動登出失敗，請檢查網路。");
        throw error;
      }
      await presence.stop();
      me = null;
      modal.close();
      hoverPanel.hide();
      leaveAdmin(true);
      await refresh();
      toast("閒置超過1小時，已自動登出。");
    },
  });
window.addEventListener("resize", () => {
  if (data && !modal.open && !adminOpen) render();
});
