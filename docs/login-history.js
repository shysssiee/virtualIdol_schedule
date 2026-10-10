import { client } from "./data.js";
import { escape as esc, dayKey, time } from "./calendar.js";
import { pageSizeOptions } from "./pagination.js";
export async function renderLoginHistory(root, { owner = false } = {}) {
  let page = 0,
    size = 10,
    request = 0;
  root.innerHTML = `<h2>${owner ? "所有帳號登入紀錄" : "我的登入紀錄"}</h2><p class="muted">時間依日曆選擇的時區。只顯示 Supabase 已保存的登入紀錄；沒有 IP 的項目顯示「未記錄」。</p><div class="table-toolbar"><button data-history-refresh>重新整理</button><label>每頁顯示<select data-history-size>${pageSizeOptions(size)}</select></label></div><div data-history-rows></div>`;
  const target = root.querySelector("[data-history-rows]");
  async function load() {
    const ticket = ++request;
    target.innerHTML = '<p class="muted">讀取中…</p>';
    const { data, error } = await client.rpc("login_history", {
      page_number: page,
      page_size: size,
    });
    if (ticket !== request || !root.isConnected) return;
    if (error) {
      target.innerHTML =
        '<p class="error">登入紀錄無法讀取，請確認本次登入紀錄 SQL 已執行。</p>';
      return;
    }
    page = Number(data.page);
    const pages = Math.max(1, Math.ceil(data.total / size));
    target.innerHTML = `<p class="muted">共 ${Number(data.total)} 筆 · 第 ${page + 1} / ${pages} 頁</p><div class="table-scroll"><table><thead><tr>${owner ? "<th>帳號暱稱</th>" : ""}<th>登入時間</th><th>IP</th></tr></thead><tbody>${data.rows.map((row) => `<tr>${owner ? `<td>${esc(row.nickname)}</td>` : ""}<td>${dayKey(row.logged_at)} ${time(row.logged_at)}</td><td>${esc(row.ip || "未記錄")}</td></tr>`).join("") || `<tr><td colspan="${owner ? 3 : 2}">尚無已保存的登入紀錄。請站主確認 Supabase Authentication → Audit Logs 的「Write audit logs to the database」已開啟。</td></tr>`}</tbody></table></div><div class="form-actions"><button data-history-prev ${page === 0 ? "disabled" : ""}>上一頁</button><button data-history-next ${page >= pages - 1 ? "disabled" : ""}>下一頁</button></div>`;
    target.querySelector("[data-history-prev]").onclick = () => {
      page--;
      load();
    };
    target.querySelector("[data-history-next]").onclick = () => {
      page++;
      load();
    };
  }
  root.querySelector("[data-history-refresh]").onclick = () => load();
  root.querySelector("[data-history-size]").onchange = (e) => {
    size = Number(e.target.value);
    page = 0;
    load();
  };
  await load();
}
