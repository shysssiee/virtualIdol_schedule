import { client, save, remove } from "./data.js";
import { escape as esc } from "./calendar.js";
import { bindSorting } from "./sorting.js";

export function createAdmin({ getData, getUser, show, refresh, toast }) {
  const $ = (selector) => document.querySelector(selector);
  const catalogs = [
    ["groups", "團體"],
    ["members", "成員"],
    ["categories", "活動分類"],
    ["platforms", "直播平台"],
  ];
  const allowed = () => getUser()?.role === "owner";
  function controls(item) {
    return `<button type="button" data-drag aria-label="拖曳 ${esc(item.name)} 排序" title="拖曳排序">⠿</button><button type="button" data-move="-1" aria-label="上移 ${esc(item.name)}">↑</button><button type="button" data-move="1" aria-label="下移 ${esc(item.name)}">↓</button>`;
  }
  function list(table, items) {
    return `<div data-catalog="${table}" class="sort-list">${items.map((item) => `<div class="admin-row" data-sort-id="${item.id}">${controls(item)}<span class="row-name">${item.color ? `<span class="dot" style="--color:${item.color}"></span> ` : ""}${esc(item.name)}</span><button data-edit-table="${table}" data-id="${item.id}">修改</button><button data-delete-table="${table}" data-id="${item.id}">刪除</button></div>`).join("") || '<p class="muted">尚無資料</p>'}</div>`;
  }
  function admin() {
    if (!allowed()) return;
    const data = getData();
    show(
      `<h2>站主管理</h2><form id="settings-form"><label>網站名稱<input name="name" required maxlength="80" value="${esc(data.site_settings[0]?.name || "星曆")}"></label><button class="primary">儲存網站名稱</button><p class="error" id="settings-error"></p></form><h3>團體與共用分類</h3><p class="muted">分類與平台只需新增一次，再到團體設定勾選可用項目。拖曳左側把手排序，或使用上移／下移按鈕；清單排序自動儲存。</p><div class="actions">${catalogs.map(([table, name]) => `<button data-add="${table}">新增${name}</button>`).join("")}</div>${catalogs
        .map(
          ([table, name]) =>
            `<h3>${name}</h3>${table === "members" ? '<div class="actions"><button id="expand-members">全部展開</button><button id="collapse-members">全部收起</button></div>' : ""}${
              table === "members"
                ? data.groups
                    .map(
                      (g) =>
                        `<details class="member-section"><summary>${esc(g.name)}（${data.members.filter((m) => m.group_id === g.id).length} 位成員）</summary>${list(
                          table,
                          data.members.filter((m) => m.group_id === g.id),
                        )}</details>`,
                    )
                    .join("")
                : list(table, data[table])
            }`,
        )
        .join(
          "",
        )}<h3>協作者</h3><p class="muted">帳號由你在 Supabase 後台人工建立，再於此授權。站主不會接觸協作者自行設定的密碼。</p><form id="grant-form"><label>帳號 UUID<input name="id" required placeholder="從 Supabase 使用者列表複製"></label><label>顯示名稱<input name="display_name" required maxlength="80"></label><button class="primary">授權為協作者</button><p class="error" id="form-error"></p></form><div id="profiles-list"></div>`,
    );
    for (const [id, open] of [
      ["expand-members", true],
      ["collapse-members", false],
    ]) {
      $("#" + id).onclick = () =>
        document
          .querySelectorAll(".member-section")
          .forEach((section) => (section.open = open));
    }
    $("#settings-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const name = new FormData(event.target).get("name").trim();
        if (!name) throw Error("請輸入網站名稱");
        const { error } = await client
          .from("site_settings")
          .update({ name })
          .eq("singleton", true);
        if (error) throw error;
        await refresh();
        toast("網站名稱已更新");
      } catch (error) {
        $("#settings-error").textContent = error.message;
      }
    };
    document
      .querySelectorAll("[data-add]")
      .forEach(
        (button) => (button.onclick = () => catalogForm(button.dataset.add)),
      );
    document.querySelectorAll("[data-edit-table]").forEach(
      (button) =>
        (button.onclick = () =>
          catalogForm(
            button.dataset.editTable,
            data[button.dataset.editTable].find(
              (item) => item.id === button.dataset.id,
            ),
          )),
    );
    document.querySelectorAll("[data-delete-table]").forEach(
      (button) =>
        (button.onclick = async () => {
          const table = button.dataset.deleteTable,
            item = data[table].find((item) => item.id === button.dataset.id);
          const references = data.events.filter((event) =>
            table === "categories"
              ? event.category_id === item.id
              : table === "platforms"
                ? event.links.some((link) => link.platform_id === item.id)
                : table === "members"
                  ? event.member_ids.includes(item.id)
                  : event.group_id === item.id,
          );
          if (references.length) {
            toast(
              "仍被以下行程使用，請先修改：" +
                references
                  .slice(0, 10)
                  .map((event) => event.title)
                  .join("、"),
            );
            return;
          }
          const field =
            table === "categories"
              ? "category_ids"
              : table === "platforms"
                ? "platform_ids"
                : null;
          const affected = field
            ? data.groups
                .filter((group) => group[field].includes(item.id))
                .map((group) => group.name)
            : [];
          if (
            !confirm(
              `確定刪除「${item.name}」？${affected.length ? "將同步解除團體設定：" + affected.join("、") : ""}`,
            )
          )
            return;
          button.disabled = true;
          try {
            await remove(table, item.id);
            await refresh();
            admin();
            toast("已刪除");
          } catch (error) {
            button.disabled = false;
            toast(
              error.code === "23503"
                ? "資料仍有成員或行程使用，請先解除使用。"
                : error.message,
            );
          }
        }),
    );
    document.querySelectorAll("[data-catalog]").forEach((container) => {
      container.addEventListener("sorterror", (event) =>
        toast(event.detail.message),
      );
      bindSorting(container, async (ids) => {
        const { error } = await client.rpc("reorder_catalog", {
          catalog: container.dataset.catalog,
          ids,
        });
        if (error) throw error;
        await refresh();
        toast("排序已儲存");
      });
    });
    $("#grant-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const f = new FormData(event.target),
          id = f.get("id").trim();
        const { data: existing, error } = await client
          .from("profiles")
          .select("role")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (existing?.role === "owner")
          throw Error("不能將站主帳號改為協作者。");
        await save("profiles", {
          id,
          display_name: f.get("display_name").trim(),
          role: "collaborator",
          active: true,
        });
        admin();
        toast("已授權");
      } catch (error) {
        $("#form-error").textContent = error.message;
      }
    };
    client
      .from("profiles")
      .select("*")
      .then(({ data: rows, error }) => {
        if (error) {
          toast(error.message);
          return;
        }
        const target = $("#profiles-list");
        if (!target) return;
        target.innerHTML = rows
          .map(
            (p) =>
              `<div class="admin-row"><span class="row-name">${esc(p.display_name)} · ${p.role === "owner" ? "站主" : p.active ? "已啟用" : "已停用"}</span>${p.role !== "owner" ? `<button data-toggle="${p.id}">${p.active ? "停用" : "啟用"}</button>` : ""}</div>`,
          )
          .join("");
        target.querySelectorAll("[data-toggle]").forEach(
          (button) =>
            (button.onclick = async () => {
              try {
                const p = rows.find((p) => p.id === button.dataset.toggle);
                await save("profiles", { ...p, active: !p.active });
                admin();
              } catch (error) {
                toast(error.message);
              }
            }),
        );
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
        admin();
        toast("已儲存");
      } catch (error) {
        $("#form-error").textContent = error.message;
      }
    };
  }
  return { admin };
}
