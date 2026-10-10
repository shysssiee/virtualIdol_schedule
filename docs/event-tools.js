import { client } from "./data.js";
import { escape as esc, dayKey, time } from "./calendar.js";
import { localInput } from "./timezone.js";
export function bindTemplates(
  form,
  { getGroup, getUser, readSettings, applySettings, toast },
) {
  let rows = [],
    request = 0;
  const select = form.querySelector("#saved-template"),
    error = form.querySelector("#template-error");
  async function load() {
    const ticket = ++request,
      group = getGroup();
    rows = [];
    select.innerHTML = '<option value="">讀取中…</option>';
    const { data, error: err } = await client
      .from("event_templates")
      .select("*")
      .eq("user_id", getUser().id)
      .eq("group_id", group)
      .order("name");
    if (ticket !== request || group !== getGroup() || !form.isConnected) return;
    if (err) throw err;
    rows = data || [];
    select.innerHTML =
      '<option value="">選擇常用範本</option>' +
      rows
        .map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`)
        .join("");
  }
  const run = (action) => async () => {
    error.textContent = "";
    try {
      await action();
    } catch (e) {
      error.textContent = e.message || "請確認 v1.4 SQL 已執行";
    }
  };
  form.querySelector("#template-save").onclick = run(async () => {
    const name = form.querySelector("#template-name").value.trim();
    if (!name || Array.from(name).length > 80)
      throw Error("請填寫 1～80 字的範本名稱");
    const { error } = await client.from("event_templates").insert({
      user_id: getUser().id,
      group_id: getGroup(),
      name,
      settings: readSettings(),
    });
    if (error) throw error;
    await load();
    toast("常用範本已儲存");
  });
  form.querySelector("#template-apply").onclick = run(async () => {
    const row = rows.find((r) => r.id === select.value);
    if (!row) throw Error("請先選擇範本");
    applySettings(row.settings);
    toast("範本已帶入，請確認後發布");
  });
  form.querySelector("#template-delete").onclick = run(async () => {
    const row = rows.find((r) => r.id === select.value);
    if (!row) throw Error("請先選擇範本");
    if (!confirm("刪除範本「" + row.name + "」？已發布行程不受影響。")) return;
    const { error } = await client
      .from("event_templates")
      .delete()
      .eq("id", row.id);
    if (error) throw error;
    await load();
  });
  return () => run(load)();
}
export function templateHtml() {
  return `<details class="settings-card"><summary>我的常用行程範本</summary><label>已儲存範本<select id="saved-template"></select></label><div class="actions"><button type="button" id="template-apply">套用範本</button><button type="button" id="template-delete">刪除範本</button></div><label>儲存目前設定為範本<input id="template-name" maxlength="80" placeholder="例如：週三聲音直播"></label><button type="button" id="template-save">儲存範本</button><p class="muted">只保存時間及直播設定，不保存日期與標題；每個帳號管理自己的範本。</p><p id="template-error" class="error" role="alert"></p></details>`;
}
const names = {
  start_at: "開始時間",
  title: "標題",
  status: "狀態",
  links: "直播連結",
  description: "說明",
  category_id: "分類",
  member_ids: "成員",
  members_only: "會員限定",
  group_id: "團體",
};
export async function showEventHistory(event, show, data) {
  show('<h2>行程修改紀錄</h2><p id="change-history">讀取中…</p>');
  const target = document.querySelector("#change-history");
  try {
    const { data: rows, error } = await client.rpc("event_change_history", {
      target_event: event.id,
    });
    if (error) throw error;
    if (!target.isConnected) return;
    target.innerHTML =
      (rows || [])
        .map((r) => {
          const fields = Object.keys(names).filter(
            (k) =>
              JSON.stringify(r.before?.[k]) !== JSON.stringify(r.after?.[k]),
          );
          const text = (k, v) =>
            k === "start_at"
              ? dayKey(v) + " " + time(v)
              : k === "category_id"
                ? data.categories.find((c) => c.id === v)?.name || "無"
                : k === "group_id"
                  ? data.groups.find((g) => g.id === v)?.name || "無"
                  : k === "member_ids"
                    ? (v || [])
                        .map(
                          (id) =>
                            data.members.find((m) => m.id === id)?.name ||
                            "已移除成員",
                        )
                        .join("、") || "全團"
                    : k === "status"
                      ? {
                          scheduled: "預定",
                          ended: "已結束",
                          cancelled: "已取消",
                        }[v] || v
                      : k === "members_only"
                        ? v
                          ? "是"
                          : "否"
                        : k === "links"
                          ? (v || []).map((l) => l.url).join("、") || "無"
                          : String(v || "無");
          return `<article class="record"><strong>${esc(r.nickname)} · ${dayKey(r.changed_at)} ${time(r.changed_at)}</strong><p>${r.action === "INSERT" ? "新增行程" : r.action === "DELETE" ? "刪除行程" : "修改行程"}</p>${r.before && r.after ? fields.map((k) => `<p>${names[k]}：${esc(text(k, r.before[k]))} → ${esc(text(k, r.after[k]))}</p>`).join("") : ""}</article>`;
        })
        .join("") || "尚無修改紀錄（僅記錄 v1.4 更新後的異動）。";
  } catch (e) {
    if (target.isConnected) target.textContent = e.message;
  }
}
