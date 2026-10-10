import { client } from "./data.js";
import { escape as esc, time, dayKey } from "./calendar.js";
import { memberEntryHtml, bindMemberEntry } from "./member-entry.js";
export function createCollaborator({
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
    timer;
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
      r.innerHTML =
        '<h1>行程管理</h1><button id="collab-new">新增行程</button><div class="collab-event-list">' +
        [...data.events]
          .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
          .map(
            (e) =>
              `<article class="settings-card"><strong>${esc(data.groups.find((g) => g.id === e.group_id)?.name || "")} · ${dayKey(e.start_at)} ${time(e.start_at)}</strong><p>${esc(e.title)}</p><div class="actions">${e.created_by === me.id ? `<button data-own-event="${e.id}">修改行程</button>` : `<button data-feedback-event="${e.id}">回報站主</button>`}</div></article>`,
          )
          .join("") +
        "</div>";
      r.querySelector("#collab-new").onclick = () => eventForm();
      r.querySelectorAll("[data-own-event]").forEach(
        (b) =>
          (b.onclick = () =>
            eventForm(data.events.find((e) => e.id === b.dataset.ownEvent))),
      );
      r.querySelectorAll("[data-feedback-event]").forEach(
        (b) => (b.onclick = () => board.form(null, b.dataset.feedbackEvent)),
      );
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
        '</p><button id="collab-password">修改密碼</button>';
      r.querySelector("#collab-password").onclick = passwordForm;
    }
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
