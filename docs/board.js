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
      "<h1>建議／問題留言板</h1><p>所有協作者可查看；站主回答與實際處理狀態分開紀錄。</p>";
    try {
      const rows = await rpc("board_list");
      root.insertAdjacentHTML(
        "beforeend",
        '<div class="table-toolbar"><button id="board-new">發表建議／問題</button><button id="board-refresh">重新整理</button><label>狀態<select id="board-filter"><option value="">全部</option><option value="false">未處理</option><option value="true">已處理</option></select></label></div><div id="board-rows"></div>',
      );
      const render = () => {
        const status = root.querySelector("#board-filter").value;
        root.querySelector("#board-rows").innerHTML =
          rows
            .filter((x) => !status || String(x.resolved) === status)
            .map(
              (x) =>
                `<button class="board-row" data-post="${x.id}"><span>${x.resolved ? "已處理" : "未處理"}</span><strong>${esc(x.title)}</strong><span>${esc(x.nickname)}</span><time>${new Date(x.created_at).toLocaleDateString("zh-TW")}</time></button>`,
            )
            .join("") || "<p>目前沒有留言。</p>";
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
      root.querySelector("#board-filter").onchange = render;
      render();
    } catch (e) {
      root.insertAdjacentHTML(
        "beforeend",
        `<p class="error">${esc(e.message)}；請確認 r7 SQL 已執行。</p>`,
      );
    }
  }
  function detail(x, root) {
    const owner = getUser()?.role === "owner";
    show(
      `<h2>${esc(x.title)}</h2><p>${esc(x.nickname)} · ${x.resolved ? "已處理" : "未處理"}</p><p class="preserve-lines">${esc(x.content)}</p>${x.event_id ? '<p>相關行程：<a href="#event=' + esc(x.event_id) + '">查看行程</a></p>' : ""}<h3>站主回答</h3>${owner ? `<form id="board-answer"><label>回答內容<textarea name="reply" maxlength="5000" rows="5">${esc(x.reply)}</textarea></label><label class="members-only-option"><input type="checkbox" name="done" ${x.resolved ? "checked" : ""}>已處理</label><button>儲存回答／狀態</button><p class="error"></p></form>` : `<p class="preserve-lines">${esc(x.reply || "站主尚未回答")}</p>`}<div class="actions">${owner || x.mine ? '<button id="board-edit">修改文章</button>' : ""}${owner ? '<button id="board-delete">刪除文章</button>' : ""}</div>`,
    );
    $("#board-edit")?.addEventListener("click", () => form(x));
    $("#board-delete")?.addEventListener("click", async () => {
      if (!confirm("確定刪除此留言？")) return;
      try {
        await rpc("board_delete", { post_id: x.id });
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
        await rpc("board_answer", {
          post_id: x.id,
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
