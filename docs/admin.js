import { paginate, pageSizeOptions } from "./pagination.js";
import { renderLoginHistory } from "./login-history.js";
import { downloadSharePage } from "./site-title.js";
import { client, save, remove, loadProfiles } from "./data.js";
import { escape as esc, dayKey, time } from "./calendar.js";
import { zoneLabel, validZone } from "./timezone.js";
import { bindSorting } from "./sorting.js";

export function createAdmin({
  getData,
  getUser,
  show,
  refresh,
  toast,
  eventForm,
  manageAnniversaries,
  manageReports,
  updatePresence,
  isLive,
  end,
}) {
  const $ = (s) => document.querySelector(s);
  const catalogs = [
    ["groups", "團體"],
    ["members", "成員"],
    ["categories", "活動分類"],
    ["platforms", "直播平台"],
  ];
  const allowed = () => getUser()?.role === "owner";
  let section = "overview",
    catalog = "groups",
    profiles = [],
    page = 0,
    pageSize = 10,
    request = 0;
  const dirty = new Map();
  const controls = (item) =>
    `<button type="button" data-drag aria-label="拖曳 ${esc(item.name)} 排序" title="拖曳排序">⠿</button><button type="button" data-move="-1" aria-label="上移 ${esc(item.name)}">↑</button><button type="button" data-move="1" aria-label="下移 ${esc(item.name)}">↓</button>`;
  function list(table, items, key = table) {
    return `<div data-catalog="${table}" data-order-key="${key}" class="sort-list">${items.map((item) => `<div class="admin-row" data-sort-id="${item.id}">${controls(item)}<span class="row-name">${item.color ? `<span class="dot" style="--color:${item.color}"></span> ` : ""}${esc(item.name)}</span><button data-edit-table="${table}" data-id="${item.id}">修改</button><button data-delete-table="${table}" data-id="${item.id}">刪除</button></div>`).join("") || '<p class="muted">尚無資料</p>'}</div><button data-save-order="${key}" disabled>儲存順序</button><span class="muted" data-order-status="${key}"></span>`;
  }
  function canLeave() {
    return !dirty.size || confirm("排序尚未儲存，確定放棄變更？");
  }
  async function admin() {
    if (!allowed()) return;
    const ticket = ++request;
    $("#admin-nav").innerHTML = [
      ["overview", "總覽／行程管理"],
      ["catalog", "團體與共用分類"],
      ["collaborators", "協作者管理"],
      ["settings", "網站設定"],
      ["reports", "建議／問題留言板"],
    ]
      .map(
        ([id, name]) =>
          `<button data-section="${id}" class="${section === id ? "active" : ""}">${name}</button>`,
      )
      .join("");
    $("#admin-nav")
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            if (!canLeave()) return;
            dirty.clear();
            section = b.dataset.section;
            page = 0;
            admin();
          }),
      );
    $("#admin-content").innerHTML = '<p class="muted">正在載入管理資料…</p>';
    try {
      await refresh();
      if (!allowed()) return;
      profiles = await loadProfiles();
    } catch (error) {
      if (ticket === request) {
        $("#admin-content").innerHTML =
          '<p class="error">無法載入管理資料，請確認已完成 v1.2 資料庫升級。</p>';
        toast(error.message);
      }
      return;
    }
    if (ticket !== request || !allowed()) return;
    renderSection();
  }
  function creator(event) {
    const p = profiles.find((p) => p.id === event.created_by);
    return p
      ? `${p.display_name}${p.role === "owner" ? "（站主）" : p.revoked ? "（已移除）" : ""}`
      : "未知建立者";
  }
  function status(event) {
    return event.status === "cancelled"
      ? "已取消"
      : isLive(event)
        ? "直播中"
        : event.status === "ended" || end(event) <= Date.now()
          ? "已結束"
          : "預定";
  }
  function renderSection() {
    const data = getData();
    $("#admin-status").hidden = true;
    if (section === "overview") {
      $("#admin-content").innerHTML =
        `<h1>總覽／行程管理</h1><p class="muted">所有過去與未來行程永久保留，只有站主主動刪除才移除。時間依日曆選擇的顯示時區。</p><div class="admin-filters"><label>搜尋標題／團體／新增者<input id="admin-search" type="search"></label><label>團體<select id="admin-group"><option value="">全部團體</option>${data.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></label><label>新增者<select id="admin-creator"><option value="">所有新增者</option>${profiles.map((p) => `<option value="${p.id}">${esc(p.display_name)}${p.revoked ? "（已移除）" : ""}</option>`).join("")}</select></label><label>從日期<input id="admin-from" type="date"></label><label>至日期<input id="admin-to" type="date"></label></div><div class="table-toolbar"><button id="admin-new">新增行程</button><button id="admin-refresh">重新整理</button><label>每頁顯示<select id="admin-page-size">${pageSizeOptions(pageSize)}</select></label></div><div id="event-table"></div>`;
      $("#admin-new").onclick = () => eventForm();
      $("#admin-refresh").onclick = async () => {
        try {
          await refresh();
          profiles = await loadProfiles();
          renderOverview();
          toast("行程已重新整理");
        } catch (error) {
          toast(error.message);
        }
      };
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
      $("#admin-page-size").onchange = () => {
        pageSize = Number($("#admin-page-size").value);
        page = 0;
        renderOverview();
      };
      renderOverview();
    } else if (section === "reports") {
      manageReports($("#admin-content"));
    } else if (section === "catalog") {
      $("#admin-content").innerHTML =
        `<h1>團體與共用分類</h1><p class="muted">共用分類與平台新增一次，再到團體設定勾選。拖曳或上下移動後，請按「儲存順序」。</p><div class="catalog-tabs">${catalogs.map(([id, name]) => `<button data-catalog-tab="${id}" class="${id === catalog ? "primary" : ""}">${name}</button>`).join("")}</div><div class="actions"><button class="primary" data-add="${catalog}">新增${catalogs.find((c) => c[0] === catalog)[1]}</button>${catalog === "members" ? '<button id="expand-members">全部展開</button><button id="collapse-members">全部收起</button>' : ""}</div>${
          catalog === "members"
            ? data.groups
                .map(
                  (g) =>
                    `<details class="member-section"><summary>${esc(g.name)}（${data.members.filter((m) => m.group_id === g.id).length} 位成員）</summary>${list(
                      "members",
                      data.members.filter((m) => m.group_id === g.id),
                      "members-" + g.id,
                    )}<div class="member-anniversaries">${(
                      data.anniversaries || []
                    )
                      .filter((a) => a.group_id === g.id)
                      .map(
                        (a) =>
                          `<p>${a.kind === "birthday" ? "🎂" : "🎉"} ${esc(a.member_id ? data.members.find((m) => m.id === a.member_id)?.name || a.name : "全團")} · ${esc(a.name)} · ${esc(a.original_date)}</p>`,
                      )
                      .join("")}</div></details>`,
                )
                .join("")
            : list(catalog, data[catalog])
        }`;
      document.querySelectorAll("[data-catalog-tab]").forEach(
        (b) =>
          (b.onclick = () => {
            if (!canLeave()) return;
            dirty.clear();
            catalog = b.dataset.catalogTab;
            renderSection();
          }),
      );
      if (catalog === "members")
        for (const [id, open] of [
          ["expand-members", true],
          ["collapse-members", false],
        ])
          $("#" + id).onclick = () =>
            document
              .querySelectorAll(".member-section")
              .forEach((d) => (d.open = open));
      $("#admin-content").insertAdjacentHTML(
        "beforeend",
        '<div id="anniversaries-manager" class="settings-card"></div>',
      );
      manageAnniversaries($("#anniversaries-manager"));
      bindCatalog();
    } else if (section === "collaborators") {
      $("#admin-content").innerHTML =
        `<h1>協作者管理</h1><p class="muted">先在 Supabase → Authentication → Users 人工建立登入帳號，再貼上 UUID 授權。移除僅取消網站協作資格，不刪除帳號或既有行程。</p><form id="grant-form" class="settings-card"><label>帳號 UUID<input name="id" required placeholder="從 Supabase 使用者列表複製"></label><label>顯示名稱<input name="display_name" required maxlength="80"></label><button class="primary">新增／恢復協作者</button><p class="error" id="form-error"></p></form><div id="profiles-list">${profiles
          .filter((p) => !p.revoked)
          .map(
            (p) =>
              `<div class="admin-row"><span class="row-name"><span class="account-avatar" data-presence-user="${esc(p.id)}" title="正在取得在線狀態" aria-label="正在取得在線狀態">${esc(Array.from(p.display_name)[0] || "人")}</span>${esc(p.display_name)} · ${p.role === "owner" ? "站主" : p.active ? "已啟用" : "已停用"}</span>${p.role !== "owner" ? `<button data-toggle="${p.id}">${p.active ? "停用" : "啟用"}</button><button data-revoke="${p.id}">移除授權</button>` : ""}</div>`,
          )
          .join("")}</div>`;
      $("#admin-content").insertAdjacentHTML(
        "beforeend",
        '<section id="login-history" class="login-history"></section>',
      );
      renderLoginHistory($("#login-history"), { owner: true }).catch((e) =>
        toast(e.message),
      );
      updatePresence($("#profiles-list"));
      $("#grant-form").onsubmit = async (event) => {
        event.preventDefault();
        const button = event.target.querySelector("button");
        button.disabled = true;
        try {
          const f = new FormData(event.target),
            id = f.get("id").trim();
          if (
            !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
              id,
            )
          )
            throw Error("請填入使用者 UUID，不能填 Email。");
          if (profiles.find((p) => p.id === id)?.role === "owner")
            throw Error("不能將站主改為協作者");
          const name = f.get("display_name").trim();
          if (!name) throw Error("請輸入顯示名稱");
          await save("profiles", {
            id,
            display_name: name,
            role: "collaborator",
            active: true,
            revoked: false,
          });
          await admin();
          toast("已授權協作者");
        } catch (error) {
          $("#form-error").textContent =
            error.code === "23503"
              ? "UUID 尚未在 Supabase 建立登入帳號。"
              : error.message;
        } finally {
          button.disabled = false;
        }
      };
      document.querySelectorAll("[data-toggle],[data-revoke]").forEach(
        (b) =>
          (b.onclick = async () => {
            const p = profiles.find(
              (p) => p.id === (b.dataset.toggle || b.dataset.revoke),
            );
            if (
              b.dataset.revoke &&
              !confirm(
                `移除「${p.display_name}」的協作資格？原行程與建立者紀錄會保留。`,
              )
            )
              return;
            b.disabled = true;
            try {
              if (b.dataset.revoke) {
                const { error } = await client.rpc("revoke_collaborator", {
                  user_id: p.id,
                });
                if (error) throw error;
              } else
                await save("profiles", {
                  id: p.id,
                  display_name: p.display_name,
                  role: p.role,
                  revoked: false,
                  active: !p.active,
                });
              await admin();
              toast(b.dataset.revoke ? "已移除授權" : "已更新協作者狀態");
            } catch (error) {
              toast(error.message);
              b.disabled = false;
            }
          }),
      );
    } else {
      const settings = data.site_settings[0] || {};
      $("#admin-content").innerHTML =
        `<h1>網站設定</h1><form id="settings-form" class="settings-card"><label>網站名稱<input name="name" maxlength="80" required value="${esc(settings.name || "星曆")}"></label><label>Google 問題回報表單網址（選填）<input type="url" name="report_url" placeholder="https://forms.gle/…" value="${esc(settings.report_url || "")}"></label><label>網站預設顯示時區<select name="default_timezone">${["auto", "Asia/Taipei", "Asia/Seoul", "Asia/Tokyo", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"].map((z) => `<option value="${z}" ${z === (settings.default_timezone || "auto") ? "selected" : ""}>${z === "auto" ? "自動：讀者裝置時區" : esc(zoneLabel(z))}</option>`).join("")}</select></label><p class="muted">讀者預設採用裝置時區；選「網站預設」時套用這裡的設定。讀者手動選擇優先保留。</p><button class="primary">儲存設定</button><p id="settings-error" class="error"></p></form><div class="settings-card"><h2>社群分享標題</h2><p class="muted">已設定 Calendar Pages 自動部署：儲存站名後，下次排程部署會同步分享標題；也可到 GitHub Actions 立即執行。尚未設定自動部署時，可使用下方下載檔案手動更新。社群平台舊快取可能延後更新。</p><button id="download-share-page">下載分享標題更新檔</button></div>`;
      $("#download-share-page").onclick = async () => {
        try {
          await downloadSharePage(getData().site_settings[0]?.name);
          toast("已下載 index.html，請上傳至 GitHub 發布資料夾覆蓋同名檔案。");
        } catch (error) {
          toast(error.message);
        }
      };
      $("#settings-form").onsubmit = async (event) => {
        event.preventDefault();
        const b = event.target.querySelector("button");
        b.disabled = true;
        try {
          const f = new FormData(event.target),
            name = f.get("name").trim(),
            report_url = f.get("report_url").trim(),
            default_timezone = f.get("default_timezone");
          if (!name) throw Error("請輸入網站名稱");
          if (report_url) {
            const u = new URL(report_url);
            if (
              u.protocol !== "https:" ||
              !["forms.gle", "docs.google.com"].includes(u.hostname)
            )
              throw Error(
                "請填入 https 的 Google 表單網址（forms.gle 或 docs.google.com）。",
              );
          }
          if (default_timezone !== "auto" && !validZone(default_timezone))
            throw Error("時區無效");
          const { error } = await client
            .from("site_settings")
            .update({ name, report_url, default_timezone })
            .eq("singleton", true)
            .select("singleton")
            .single();
          if (error) throw error;
          await refresh();
          toast(
            "網站設定已儲存；分享標題將於下次 GitHub Actions 部署同步。尚未設定 Actions 時仍需手動更新。",
          );
        } catch (error) {
          $("#settings-error").textContent = error.message;
        } finally {
          b.disabled = false;
        }
      };
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
          (!author || e.created_by === author) &&
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
              )}</td><td>${status(e)}</td><td>${esc(creator(e))}</td><td>${e.updated_at ? dayKey(e.updated_at) + " " + time(e.updated_at) : "—"}</td><td><button data-admin-edit="${e.id}">修改</button><button data-admin-delete="${e.id}">刪除</button></td></tr>`,
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
    document.querySelectorAll("[data-admin-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          const e = data.events.find((e) => e.id === b.dataset.adminDelete);
          if (!confirm(`確定刪除「${e.title}」？`)) return;
          b.disabled = true;
          try {
            await remove("events", e.id);
            await refresh();
            renderOverview();
            toast("行程已刪除");
          } catch (error) {
            toast(error.message);
            b.disabled = false;
          }
        }),
    );
  }
  function bindCatalog() {
    const data = getData();
    document.querySelectorAll("[data-add]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!canLeave()) return;
          dirty.clear();
          renderSection();
          catalogForm(b.dataset.add);
        }),
    );
    document.querySelectorAll("[data-edit-table]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!canLeave()) return;
          dirty.clear();
          renderSection();
          catalogForm(
            b.dataset.editTable,
            data[b.dataset.editTable].find((i) => i.id === b.dataset.id),
          );
        }),
    );
    document.querySelectorAll("[data-delete-table]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!canLeave()) return;
          const table = b.dataset.deleteTable,
            item = data[table].find((i) => i.id === b.dataset.id);
          const refs = data.events.filter((e) =>
            table === "categories"
              ? e.category_id === item.id
              : table === "platforms"
                ? e.links.some((l) => l.platform_id === item.id)
                : table === "members"
                  ? e.member_ids.includes(item.id)
                  : e.group_id === item.id,
          );
          if (refs.length) {
            toast(
              "仍被以下行程使用，請先修改：" +
                refs
                  .slice(0, 10)
                  .map((e) => e.title)
                  .join("、"),
            );
            return;
          }
          if (
            table === "groups" &&
            data.members.some((m) => m.group_id === item.id)
          ) {
            toast("團體仍有成員，請先移除成員。");
            return;
          }
          const field =
            table === "categories"
              ? "category_ids"
              : table === "platforms"
                ? "platform_ids"
                : null;
          const groups = field
            ? data.groups
                .filter((g) => g[field].includes(item.id))
                .map((g) => g.name)
            : [];
          if (
            !confirm(
              `確定刪除「${item.name}」？${groups.length ? "將解除團體設定：" + groups.join("、") : ""}`,
            )
          )
            return;
          b.disabled = true;
          try {
            dirty.clear();
            await remove(table, item.id);
            await refresh();
            renderSection();
            toast("已刪除");
          } catch (error) {
            toast(error.message);
            b.disabled = false;
          }
        }),
    );
    document.querySelectorAll("[data-catalog]").forEach((container) => {
      const key = container.dataset.orderKey,
        b = document.querySelector(`[data-save-order="${key}"]`),
        status = document.querySelector(`[data-order-status="${key}"]`);
      bindSorting(container, async (ids) => {
        dirty.set(key, ids);
        b.disabled = false;
        status.textContent = " 尚未儲存";
      });
      b.onclick = async () => {
        b.disabled = true;
        try {
          const { error } = await client.rpc("reorder_catalog", {
            catalog: container.dataset.catalog,
            ids: dirty.get(key),
          });
          if (error) throw error;
          dirty.delete(key);
          status.textContent = " 已儲存";
          await refresh();
          toast("排序已儲存");
        } catch (error) {
          toast(error.message);
          b.disabled = false;
        }
      };
    });
  }

  function groupChoices(group, table, field) {
    const data = getData(),
      ids = group?.[field] || [],
      items = [...data[table]].sort((a, b) => {
        const rank = (id) =>
          ids.includes(id)
            ? ids.indexOf(id)
            : ids.length + data[table].findIndex((x) => x.id === id);
        return rank(a.id) - rank(b.id);
      });
    return `<div class="sort-list" data-options="${field}">${items.map((item) => `<div class="admin-row" data-sort-id="${item.id}">${controls(item)}<label class="row-name"><input type="checkbox" name="${field}" value="${item.id}" ${ids.includes(item.id) ? "checked" : ""}> ${esc(item.name)}</label></div>`).join("") || '<p class="muted">請先新增共用分類或平台</p>'}</div>`;
  }
  function catalogForm(table, item) {
    if (!allowed()) return;
    const data = getData();
    show(
      `<h2>${item ? "修改" : "新增"}${catalogs.find((x) => x[0] === table)[1]}</h2><form id="catalog-form"><label>名稱<input name="name" required maxlength="80" value="${esc(item?.name || "")}"></label>${table === "groups" ? `<label>團體固定顏色<input name="color" type="color" value="${item?.color || "#9678ca"}"></label><h3>可使用的活動分類</h3>${groupChoices(item, "categories", "category_ids")}<h3>可使用的直播平台</h3>${groupChoices(item, "platforms", "platform_ids")}<p class="muted">勾選可用項目，拖曳或上下移動調整此團體的顯示順序；按儲存後生效。已有行程使用的項目需先修改相關行程才能取消勾選。</p>` : ""}${table === "members" ? `<label>所屬團體<select name="group_id">${data.groups.map((g) => `<option value="${g.id}" ${g.id === item?.group_id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>` : ""}<p class="error" id="form-error"></p><button class="primary">儲存</button></form>`,
    );
    document
      .querySelectorAll("[data-options]")
      .forEach((container) => bindSorting(container, async () => {}));
    $("#catalog-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const form = new FormData(event.target),
          value = {
            name: form.get("name").trim(),
            id: item?.id || crypto.randomUUID(),
            sort_order:
              item?.sort_order ??
              Math.max(0, ...data[table].map((x) => x.sort_order || 0)) + 1,
          };
        if (table === "groups") {
          value.color = form.get("color");
          value.category_ids = form.getAll("category_ids");
          value.platform_ids = form.getAll("platform_ids");
        }
        if (table === "members") value.group_id = form.get("group_id");
        await save(table, value);
        await refresh();
        document.querySelector("#modal").close();
        await admin();
        toast("已儲存");
      } catch (error) {
        $("#form-error").textContent = error.message;
      }
    };
  }
  function reset() {
    dirty.clear();
    request++;
  }
  const presenceTimer = setInterval(() => {
    if (!$("#admin-workspace").hidden && section === "collaborators")
      updatePresence($("#profiles-list"));
  }, 30000);
  window.addEventListener("pagehide", () => clearInterval(presenceTimer));
  return { admin, canLeave, reset };
}
