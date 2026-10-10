import { save, remove } from "./data.js";
import { escape as esc } from "./calendar.js";
import { paginate, pageSizeOptions } from "./pagination.js";
import { anniversaryDate, bindBirthdayYear } from "./anniversaries.js";
export function anniversaryManager(
  root,
  { getData, getUser, openForm, refresh, toast },
) {
  let page = 0,
    size = 10,
    editing = null;
  const me = getUser(),
    names = { birthday: "生日", debut: "出道日", anniversary: "其他紀念日" };
  const groupName = (x) =>
    getData().groups.find((g) => g.id === x.group_id)?.name || "";
  const memberName = (x) =>
    x.member_id
      ? getData().members.find((m) => m.id === x.member_id)?.name || x.name
      : x.kind === "birthday"
        ? x.name
        : "全團";
  root.innerHTML = `<h2>生日／紀念日</h2><p class="muted">${me.role === "owner" ? "管理所有生日與紀念日。" : "管理自己新增的生日與紀念日。"}出生年份未知時只顯示生日，不計算歲數。</p><div class="admin-filters"><label>搜尋團體／成員／名稱<input data-ann-search type="search"></label><label>團體<select data-ann-group><option value="">全部團體</option>${getData()
    .groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`)
    .join(
      "",
    )}</select></label><label>類型<select data-ann-kind><option value="">全部類型</option>${Object.entries(
    names,
  )
    .map(([k, n]) => `<option value="${k}">${n}</option>`)
    .join(
      "",
    )}</select></label></div><div class="table-toolbar"><button data-ann-new>新增生日／紀念日</button><button data-ann-refresh>重新整理</button><label>每頁顯示<select data-ann-size>${pageSizeOptions(size)}</select></label></div><div data-ann-table></div>`;
  const $ = (s) => root.querySelector(s),
    table = $("[data-ann-table]");
  function discard() {
    return !editing || confirm("尚未儲存，確定放棄這一列的修改？");
  }
  function render() {
    const d = getData(),
      query = $("[data-ann-search]").value.trim().toLowerCase(),
      group = $("[data-ann-group]").value,
      kind = $("[data-ann-kind]").value;
    const rows = (d.anniversaries || [])
      .filter(
        (x) =>
          (me.role === "owner" || x.created_by === me.id) &&
          (!group || x.group_id === group) &&
          (!kind || x.kind === kind) &&
          (!query ||
            [groupName(x), memberName(x), x.name]
              .join(" ")
              .toLowerCase()
              .includes(query)),
      )
      .sort(
        (a, b) =>
          groupName(a).localeCompare(groupName(b)) ||
          memberName(a).localeCompare(memberName(b)) ||
          a.original_date.localeCompare(b.original_date) ||
          a.id.localeCompare(b.id),
      );
    const result = paginate(rows, page, size);
    page = result.page;
    table.innerHTML = `<p class="muted">共 ${result.total} 筆 · 第 ${page + 1} / ${result.pages} 頁</p><div class="table-scroll"><table class="anniversary-table"><thead><tr><th>團體</th><th>成員名字／全團</th><th>生日</th><th>出道日</th><th>其他紀念日</th><th>操作</th></tr></thead><tbody>${result.rows.map((x) => row(x, d)).join("") || '<tr><td colspan="6">沒有符合條件的紀念日</td></tr>'}</tbody></table></div><div class="form-actions"><button data-ann-prev ${page === 0 ? "disabled" : ""}>上一頁</button><button data-ann-next ${page === result.pages - 1 ? "disabled" : ""}>下一頁</button></div>`;
    $("[data-ann-prev]").onclick = () => {
      if (discard()) {
        editing = null;
        page--;
        render();
      }
    };
    $("[data-ann-next]").onclick = () => {
      if (discard()) {
        editing = null;
        page++;
        render();
      }
    };
    table.querySelectorAll("[data-ann-edit]").forEach(
      (b) =>
        (b.onclick = () => {
          if (discard()) {
            editing = b.dataset.annEdit;
            render();
          }
        }),
    );
    table.querySelectorAll("[data-ann-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          const x = d.anniversaries.find((x) => x.id === b.dataset.annDelete);
          if (!confirm(`刪除「${x.name}」？刪除後不再每年顯示。`)) return;
          b.disabled = true;
          try {
            await remove("anniversaries", x.id);
            await refresh();
            render();
            toast("已刪除紀念日");
          } catch (e) {
            toast(e.message);
            b.disabled = false;
          }
        }),
    );
    const tr = table.querySelector("[data-ann-editing]");
    if (tr) {
      const x = d.anniversaries.find((x) => x.id === editing),
        group = tr.querySelector("[data-row-group]"),
        member = tr.querySelector("[data-row-member]"),
        date = tr.querySelector("[data-row-date]"),
        unknown = tr.querySelector("[data-row-unknown]");
      const members = () => {
        member.innerHTML =
          '<option value="">全團／自行填寫</option>' +
          d.members
            .filter((m) => m.group_id === group.value)
            .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
            .join("");
      };
      group.onchange = members;
      members();
      member.value = x.member_id || "";
      if (unknown) bindBirthdayYear(date, unknown);
      tr.querySelector("[data-row-cancel]").onclick = () => {
        editing = null;
        render();
      };
      tr.querySelector("[data-row-save]").onclick = async () => {
        const b = tr.querySelector("[data-row-save]");
        b.disabled = true;
        try {
          const name = tr.querySelector("[data-row-name]").value.trim();
          if (!name || name.length > 160) throw Error("請填寫1至160字的名稱。");
          const value = {
            id: x.id,
            kind: x.kind,
            group_id: group.value,
            member_id: member.value || null,
            name,
            year_unknown: !!unknown?.checked,
            original_date: anniversaryDate(date.value, !!unknown?.checked),
            created_by: x.created_by,
          };
          await save("anniversaries", value);
          await refresh();
          editing = null;
          render();
          toast("紀念日已儲存");
        } catch (e) {
          tr.querySelector(".error").textContent = e.message;
          b.disabled = false;
        }
      };
    }
  }
  function row(x, d) {
    const editingRow = x.id === editing,
      date = x.year_unknown
        ? x.original_date.slice(5) + "（年份未知）"
        : x.original_date;
    const dateCell = editingRow
      ? `<input data-row-date aria-label="${names[x.kind]}日期" type="date" value="${x.original_date}" required>${x.kind === "birthday" ? `<label class="members-only-option"><input data-row-unknown type="checkbox" ${x.year_unknown ? "checked" : ""}>出生年份未知</label>` : ""}`
      : esc(date);
    return `<tr ${editingRow ? "data-ann-editing" : ""}><td>${editingRow ? `<select data-row-group aria-label="團體">${d.groups.map((g) => `<option value="${g.id}" ${g.id === x.group_id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>` : esc(groupName(x))}</td><td>${editingRow ? `<select data-row-member aria-label="成員"></select><label>名稱<input data-row-name maxlength="160" value="${esc(x.name)}"></label>` : esc(memberName(x))}</td><td>${x.kind === "birthday" ? dateCell : "—"}</td><td>${x.kind === "debut" ? dateCell : "—"}</td><td>${x.kind === "anniversary" ? (editingRow ? dateCell : `${esc(x.name)}<br>${dateCell}`) : "—"}</td><td>${editingRow ? '<div class="form-actions"><button data-row-save>儲存</button><button data-row-cancel>取消</button></div><p class="error" role="status"></p>' : `<div class="form-actions"><button data-ann-edit="${x.id}">修改</button><button data-ann-delete="${x.id}">刪除</button></div>`}</td></tr>`;
  }
  for (const selector of [
    "[data-ann-search]",
    "[data-ann-group]",
    "[data-ann-kind]",
    "[data-ann-size]",
  ]) {
    const control = $(selector);
    let previous = control.value;
    control.onchange = () => {
      if (!discard()) {
        control.value = previous;
        return;
      }
      previous = control.value;
      editing = null;
      size = Number($("[data-ann-size]").value);
      page = 0;
      render();
    };
  }
  $("[data-ann-new]").onclick = () => {
    if (discard()) {
      editing = null;
      openForm(null, () => {
        if (root.isConnected) render();
      });
    }
  };
  $("[data-ann-refresh]").onclick = async () => {
    if (!discard()) return;
    try {
      await refresh();
      editing = null;
      render();
    } catch (e) {
      toast(e.message);
    }
  };
  render();
}
