import { client } from "./data.js";
export async function addMember(data, groupId, name) {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw Error("請輸入1至80字的成員名字。");
  let member;
  if (client) {
    const { data: row, error } = await client.rpc("add_group_member", {
      target_group: groupId,
      member_name: clean,
    });
    if (error) throw error;
    member = Array.isArray(row) ? row[0] : row;
  } else throw Error("請先設定 Supabase 並登入。");
  if (!member?.id) throw Error("新增成員失敗，請確認 r5 升級 SQL 已執行。");
  if (!data.members.some((m) => m.id === member.id)) data.members.push(member);
  return member;
}
export function memberEntryHtml() {
  return '<div class="member-entry"><label>新增此團體成員<input data-member-name maxlength="80" placeholder="輸入成員名字"></label><button type="button" data-add-member>新增成員</button><span class="error" data-member-error role="status"></span></div>';
}
export function bindMemberEntry(root, data, getGroup, onAdded) {
  root.querySelector("[data-add-member]").onclick = async () => {
    const button = root.querySelector("[data-add-member]"),
      input = root.querySelector("[data-member-name]"),
      error = root.querySelector("[data-member-error]");
    button.disabled = true;
    error.textContent = "";
    try {
      const member = await addMember(data, getGroup(), input.value);
      input.value = "";
      onAdded(member);
    } catch (e) {
      error.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}
