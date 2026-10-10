import { paginate, pageSizeOptions } from "./pagination.js";
import { renderLoginHistory } from "./login-history.js";
import { client } from "./data.js";
import { escape as esc, time, dayKey } from "./calendar.js";
import { memberEntryHtml, bindMemberEntry } from "./member-entry.js";
export function createCollaborator({
  isLive,
  end,
  getData,
  getUser,
  eventForm,
  manageAnniversaries,
  board,
  show,
  passwordForm,
  refresh,
  toast,
}) {
  let section = "events",
    timer,
    page = 0,
    pageSize = 10,
    creators = new Map();
  const $ = (s) => root().querySelector(s);
  const creator = (e) =>
    creators.get(e.id) ||
    (e.created_by === getUser()?.id ? getUser().display_name : "未知建立者");
  const status = (e) =>
    e.status === "cancelled"
      ? "已取消"
      : isLive(e)
        ? "直播中"
        : e.status === "ended" || end(e) <= Date.now()
          ? "已結束"
          : "預定";
  const root = () => document.querySelector("#admin-content");
  async function render() {
    if (!getUser() || getUser().role === "owner") return;
    await refresh();
    const data = getData(),
      me = getUser();
    if (!me) return;
    document.querySelector("#admin-nav").innerHTML = [
      ["events", "行程管理"],
      ["members", "成員與紀念日"],
      ["directory", "協作者名單"],
      ["board", "建議／問題留言板"],
      ["account", "我的帳號"],
    ]
      .map(
        ([id, name]) =>
          `<button data-collab-section="${id}" class="${section === id ? "active" : ""}">${name}</button>`,
      )
      .join("");
    document.querySelectorAll("[data-collab-section]").forEach(
      (b) =>
        (b.onclick = () => {
          section = b.dataset.collabSection;
          render().catch((e) => toast(e.message));
        }),
    );
    const r = root();
    if (section === "events") {
      const result = await client.rpc("event_creator_names", {});
      if (result.error) toast("新增者名稱無法讀取，請執行本次補充 SQL。");
      creators = new Map(
        (result.data || []).map((row) => [row.event_id, row.nickname]),
      );
      const authors = [...new Set(data.events.map(creator))].sort();
      r.innerHTML = `<h1>行程管理</h1><p class="muted">所有過去與未來行程永久保留，只有站主主動刪除才移除。時間依日曆選擇的顯示時區。</p><div class="admin-filters"><label>搜尋標題／團體／新增者<input id="admin-search" type="search"></label><label>團體<select id="admin-group"><option value="">全部團體</option>${data.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></label><label>新增者<select id="admin-creator"><option value="">所有新增者</option>${authors.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}</select></label><label>從日期<input id="admin-from" type="date"></label><label>至日期<input id="admin-to" type="date"></label></div><div class="table-toolbar"><button id="admin-new">新增行程</button><button id="admin-refresh">重新整理</button><label>每頁顯示<select id="admin-page-size">${pageSizeOptions(pageSize)}</select></label></div><div id="event-table"></div>`;
      $("#admin-new").onclick = () => eventForm();
      $("#admin-refresh").onclick = () =>
        render().catch((e) => toast(e.message));
      for (const id of [
        "admin-search",
        "admin-group",
        "admin-creator",
        "admin-from",
        "admin-to",
      ])
        $("#" + id).oninput = () => {
          page = 0;
          renderOverview();
        };
      page = 0;
      $("#admin-page-size").onchange = () => {
        pageSize = Number($("#admin-page-size").value);
        page = 0;
        renderOverview();
      };
      renderOverview();
    } else if (section === "members") {
      r.innerHTML =
        '<h1>成員與紀念日</h1><label>團體<select id="collab-group">' +
        data.groups
          .map((g) => `<option value="${g.id}">${esc(g.name)}</option>`)
          .join("") +
        "</select></label>" +
        memberEntryHtml() +
        '<div id="collab-members"></div><div id="collab-anniversaries"></div>';
      const renderMembers = () => {
        r.querySelector("#collab-members").textContent = data.members
          .filter((m) => m.group_id === r.querySelector("#collab-group").value)
          .map((m) => m.name)
          .join("、");
      };
      r.querySelector("#collab-group").onchange = renderMembers;
      bindMemberEntry(
        r,
        data,
        () => r.querySelector("#collab-group").value,
        renderMembers,
      );
      renderMembers();
      manageAnniversaries(r.querySelector("#collab-anniversaries"));
    } else if (section === "directory") {
      r.innerHTML = '<h1>協作者名單</h1><div id="directory-rows">讀取中…</div>';
      await directory();
    } else if (section === "board") await board.list(r);
    else {
      r.innerHTML =
        "<h1>我的帳號</h1><p>" +
        esc(me.display_name) +
        '</p><button id="collab-password">修改密碼</button><section id="login-history" class="login-history"></section>';
      r.querySelector("#collab-password").onclick = passwordForm;
      await renderLoginHistory(r.querySelector("#login-history"));
    }
  }
  function renderOverview() {
    const data = getData(),
      query = $("#admin-search").value.trim().toLowerCase(),
      g = $("#admin-group").value,
      author = $("#admin-creator").value,
      from = $("#admin-from").value,
      to = $("#admin-to").value;
    const rows = data.events
      .filter((e) => {
        const date = dayKey(e.start_at),
          name = data.groups.find((g) => g.id === e.group_id)?.name || "";
        return (
          (!g || e.group_id === g) &&
          (!author || creator(e) === author) &&
          (!from || date >= from) &&
          (!to || date <= to) &&
          (!query ||
            [e.title, name, creator(e)].join(" ").toLowerCase().includes(query))
        );
      })
      .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at));
    const pagination = paginate(rows, page, pageSize),
      pages = pagination.pages;
    page = pagination.page;
    $("#event-table").innerHTML =
      `<p class="muted">共 ${rows.length} 筆 · 第 ${page + 1} / ${pages} 頁</p><div class="table-scroll"><table><thead><tr>${["開始時間", "團體", "標題", "分類", "平台", "狀態", "新增者", "最後更新", "操作"].map((n) => `<th>${n}</th>`).join("")}</tr></thead><tbody>${
        pagination.rows
          .map(
            (e) =>
              `<tr><td>${dayKey(e.start_at)}<br>${time(e.start_at)}</td><td>${esc(data.groups.find((g) => g.id === e.group_id)?.name)}</td><td>${esc(e.title)}</td><td>${esc(data.categories.find((c) => c.id === e.category_id)?.name)}</td><td>${esc(
                e.links
                  .map(
                    (l) =>
                      data.platforms.find((p) => p.id === l.platform_id)?.name,
                  )
                  .filter(Boolean)
                  .join(" / "),
              )}</td><td>${status(e)}</td><td>${esc(creator(e))}</td><td>${e.updated_at ? dayKey(e.updated_at) + " " + time(e.updated_at) : "—"}</td><td>${e.created_by === getUser().id ? `<button data-admin-edit="${e.id}">修改</button>` : `<button data-feedback-event="${e.id}">回報站主</button>`}</td></tr>`,
          )
          .join("") || '<tr><td colspan="9">沒有符合條件的行程</td></tr>'
      }</tbody></table></div><div class="actions"><button id="admin-prev" ${page === 0 ? "disabled" : ""}>上一頁</button><button id="admin-next" ${page === pages - 1 ? "disabled" : ""}>下一頁</button></div>`;
    $("#admin-prev").onclick = () => {
      page--;
      renderOverview();
    };
    $("#admin-next").onclick = () => {
      page++;
      renderOverview();
    };
    document
      .querySelectorAll("[data-admin-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            eventForm(data.events.find((e) => e.id === b.dataset.adminEdit))),
      );
    root()
      .querySelectorAll("[data-feedback-event]")
      .forEach(
        (b) => (b.onclick = () => board.form(null, b.dataset.feedbackEvent)),
      );
  }
  async function directory() {
    const target = document.querySelector("#directory-rows");
    if (!target) return;
    const { data, error } = await client.rpc("collaborator_directory", {});
    if (error) {
      target.textContent = "名單無法讀取，請確認 r7 SQL 已執行。";
      return;
    }
    target.innerHTML = data
      .map(
        (p) =>
          `<div class="directory-row"><span class="account-avatar ${p.online ? "online" : ""}" title="${p.online ? "在線" : "離線"}">${esc(Array.from(p.nickname)[0] || "人")}</span><strong>${esc(p.nickname)}</strong><span>${p.role === "owner" ? "站主" : "協作者"}</span><span>${p.online ? "在線" : "離線"}</span></div>`,
      )
      .join("");
  }
  timer = setInterval(() => {
    if (
      section === "directory" &&
      !document.querySelector("#admin-workspace").hidden
    )
      directory().catch(() => {});
  }, 30000);
  window.addEventListener("pagehide", () => clearInterval(timer));
  return { render };
}
