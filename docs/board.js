import { paginate, pageSizeOptions } from "./pagination.js";
import { client } from "./data.js";
import { escape as esc } from "./calendar.js";
export function createBoard({ getUser, show, toast }) {
  const $ = (s) => document.querySelector(s);
  async function rpc(name, args = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }
  function form(item = null, eventId = null) {
    show(
      `<h2>${item ? "修改留言" : "發表建議／問題"}</h2><form id="board-form"><label>標題<input name="title" maxlength="160" required value="${esc(item?.title || "")}"></label><label>問題／建議內容<textarea name="content" maxlength="3000" rows="6" required>${esc(item?.content || "")}</textarea></label><button class="primary">送出</button><p class="error"></p></form>`,
    );
    $("#board-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget,
        b = f.querySelector("button");
      b.disabled = true;
      try {
        const v = new FormData(f);
        await rpc("board_write", {
          post_id: item?.id || null,
          post_title: v.get("title"),
          post_content: v.get("content"),
          linked_event: eventId,
        });
        $("#modal").close();
        toast("留言已儲存");
      } catch (error) {
        f.querySelector(".error").textContent = error.message;
      } finally {
        b.disabled = false;
      }
    };
  }
  async function list(root) {
    root.innerHTML =
      "<h1>建議／問題留言板</h1><p>一般留言與問題回報供站主和協作者查看；協作者申請僅站主可查看。</p>";
    try {
      const rows = await rpc("board_feed");
      let page = 0,
        size = 10;
      root.insertAdjacentHTML(
        "beforeend",
        `<div class="table-toolbar"><button id="board-new">發表建議／問題</button><button id="board-refresh">重新整理</button><label>狀態<select id="board-filter"><option value="">全部</option><option value="false">未處理</option><option value="true">已處理</option></select></label><label>類型<select id="board-kind"><option value="">全部</option><option value="member">協作者留言</option><option value="report">問題回報</option>${getUser()?.role === "owner" ? '<option value="application">協作者申請</option>' : ""}</select></label><label>每頁顯示<select id="board-size">${pageSizeOptions(size)}</select></label></div><div id="board-rows"></div>`,
      );
      const render = () => {
        const status = root.querySelector("#board-filter").value,
          kind = root.querySelector("#board-kind").value;
        const result = paginate(
          rows.filter(
            (x) =>
              (!status || String(x.resolved) === status) &&
              (!kind || x.kind === kind),
          ),
          page,
          size,
        );
        page = result.page;
        root.querySelector("#board-rows").innerHTML =
          `<p class="muted">共 ${result.total} 筆 · 第 ${page + 1} / ${result.pages} 頁</p>` +
          (result.rows
            .map(
              (x) =>
                `<button class="board-row" data-post="${x.id}"><span>${x.resolved ? "已處理" : "未處理"}</span><strong><small>${x.kind === "application" ? "協作者申請" : x.kind === "report" ? "問題回報" : "協作者留言"}</small><br>${esc(x.title)}</strong><span>${esc(x.nickname)}</span><time>${new Date(x.created_at).toLocaleDateString("zh-TW")}</time></button>`,
            )
            .join("") || "<p>目前沒有留言。</p>") +
          `<div class="form-actions"><button id="board-prev" ${page === 0 ? "disabled" : ""}>上一頁</button><button id="board-next" ${page === result.pages - 1 ? "disabled" : ""}>下一頁</button></div>`;
        root.querySelector("#board-prev").onclick = () => {
          page--;
          render();
        };
        root.querySelector("#board-next").onclick = () => {
          page++;
          render();
        };
        root.querySelectorAll("[data-post]").forEach(
          (b) =>
            (b.onclick = () =>
              detail(
                rows.find((x) => x.id === b.dataset.post),
                root,
              )),
        );
      };
      root.querySelector("#board-new").onclick = () => form();
      root.querySelector("#board-refresh").onclick = () => list(root);
      for (const id of ["board-filter", "board-kind"])
        root.querySelector("#" + id).onchange = () => {
          page = 0;
          render();
        };
      root.querySelector("#board-size").onchange = () => {
        size = Number(root.querySelector("#board-size").value);
        page = 0;
        render();
      };
      render();
    } catch (e) {
      root.insertAdjacentHTML(
        "beforeend",
        `<p class="error">${esc(e.message)}；請確認本次 upgrade-v1.2-r7-public-forms.sql 已執行。</p>`,
      );
    }
  }
  function detail(x, root) {
    const owner = getUser()?.role === "owner";
    show(
      `<h2>${esc(x.title)}</h2><p>${esc(x.nickname)} · ${x.resolved ? "已處理" : "未處理"}</p><p class="preserve-lines">${esc(x.content)}</p>${owner && x.kind === "application" ? `<div class="settings-card"><p>申請暱稱：${esc(x.nickname)}</p><p>申請信箱：${esc(x.email)}</p><p>聯絡方式：${esc(x.contact)}</p><p class="muted">申請不會自動建立帳號；請站主人工建立後再授權。</p></div>` : ""}${x.event_id ? '<p>相關行程：<a href="#event=' + esc(x.event_id) + '">查看行程</a></p>' : ""}<h3>站主回答</h3>${owner ? `<form id="board-answer"><label>回答內容<textarea name="reply" maxlength="5000" rows="5">${esc(x.reply)}</textarea></label><label class="members-only-option"><input type="checkbox" name="done" ${x.resolved ? "checked" : ""}>已處理</label><button>儲存回答／狀態</button><p class="error"></p></form>` : `<p class="preserve-lines">${esc(x.reply || "站主尚未回答")}</p>`}<div class="actions">${x.source !== "visitor" && (owner || x.mine) ? '<button id="board-edit">修改文章</button>' : ""}${owner ? '<button id="board-delete">刪除文章</button>' : ""}</div>`,
    );
    $("#board-edit")?.addEventListener("click", () => form(x));
    $("#board-delete")?.addEventListener("click", async () => {
      if (!confirm("確定刪除此留言？")) return;
      try {
        await rpc(
          x.source === "visitor" ? "visitor_delete" : "board_delete",
          x.source === "visitor" ? { message_id: x.id } : { post_id: x.id },
        );
        $("#modal").close();
        list(root);
      } catch (e) {
        toast(e.message);
      }
    });
    $("#board-answer")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget,
        b = f.querySelector("button");
      b.disabled = true;
      try {
        await rpc(x.source === "visitor" ? "visitor_answer" : "board_answer", {
          ...(x.source === "visitor"
            ? { message_id: x.id }
            : { post_id: x.id }),
          answer: f.elements.reply.value,
          done: f.elements.done.checked,
        });
        $("#modal").close();
        list(root);
      } catch (e) {
        f.querySelector(".error").textContent = e.message;
      } finally {
        b.disabled = false;
      }
    });
  }
  return { list, form };
}
