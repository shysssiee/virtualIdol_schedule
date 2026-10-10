import { client } from "./data.js";
import { escape as esc } from "./calendar.js";
import { renderLoginHistory } from "./login-history.js";
export function accountPage(root, { getUser, refresh, toast, passwordForm }) {
  root.innerHTML = `<h1>我的帳號</h1><form id="nickname-form" class="settings-card"><label>暱稱<input name="nickname" required maxlength="80" value="${esc(getUser().display_name)}" autocomplete="nickname"></label><p class="muted">站主與協作者都可修改自己的暱稱，最多 80 字。</p><div class="actions"><button class="primary" type="submit">儲存暱稱</button><button id="account-password" type="button">修改密碼</button></div><p class="error" role="alert" id="nickname-error"></p></form><section id="login-history" class="login-history"></section>`;
  root.querySelector("#account-password").onclick = passwordForm;
  root.querySelector("#nickname-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector('[type="submit"]'),
      message = root.querySelector("#nickname-error"),
      nickname = form.elements.nickname.value.trim();
    message.textContent = "";
    if (!nickname || Array.from(nickname).length > 80) {
      message.textContent = "請填寫 1～80 字的暱稱。";
      return;
    }
    button.disabled = true;
    try {
      const { error } = await client.rpc("change_my_nickname", { nickname });
      if (error) throw error;
      await refresh();
      form.elements.nickname.value = getUser().display_name;
      toast("暱稱已更新");
    } catch (error) {
      message.textContent = error.message || "暱稱更新失敗，請稍後再試。";
    } finally {
      button.disabled = false;
    }
  };
  renderLoginHistory(root.querySelector("#login-history")).catch((error) =>
    toast(error.message),
  );
}
