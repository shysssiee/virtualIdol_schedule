import { client, configured } from "./data.js";
export function visitorForm(kind, { show, toast }) {
  const application = kind === "application";
  show(
    `<h2>${application ? "協作者申請" : "問題回報"}</h2><p class="muted">${application ? "申請資料只供站主查看；送出不會自動建立帳號或授權。" : "問題會送到後台留言板，由站主與協作者查看。"}</p><form id="visitor-form">${application ? '<label>申請暱稱<input name="nickname" maxlength="80" required autocomplete="nickname"></label><label>申請信箱<input name="email" type="email" maxlength="254" required autocomplete="email"></label><label>聯絡方式<input name="contact" maxlength="300" required placeholder="例如社群帳號或其他可聯絡方式"></label>' : '<label>問題類型<select name="type"><option>網站BUG</option><option>行程直播時間錯誤</option><option>名稱錯誤</option><option>其他</option></select></label><label>內容（100字內）<textarea name="content" rows="4" required></textarea></label><p class="muted" data-word-count>0 / 100 字</p>'}<div class="form-honeypot" aria-hidden="true"><label>網站<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="form-actions"><button type="submit" class="primary">送出</button><button type="button" data-cancel>取消</button></div><p class="error" role="status"></p></form>`,
  );
  const form = document.querySelector("#visitor-form");
  form.querySelector("[data-cancel]").onclick = () =>
    document.querySelector("#modal").close();
  if (!application)
    form.elements.content.oninput = () => {
      form.elements.content.value = Array.from(form.elements.content.value)
        .slice(0, 100)
        .join("");
      form.querySelector("[data-word-count]").textContent =
        Array.from(form.elements.content.value).length + " / 100 字";
    };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      if (!configured || !client)
        throw Error("尚未設定資料服務，暫時無法送出。");
      const f = new FormData(form),
        { error } = await client.rpc("visitor_submit", {
          message_kind: kind,
          applicant_name: f.get("nickname") || "",
          applicant_email: f.get("email") || "",
          applicant_contact: f.get("contact") || "",
          report_type: f.get("type") || "",
          report_content: f.get("content") || "",
          website: f.get("website") || "",
        });
      if (error) throw error;
      document.querySelector("#modal").close();
      show(
        `<h2>送出成功</h2><p>${application ? "申請已送交站主，請等待站主透過你提供的聯絡方式通知。" : "問題已送至留言板，謝謝你的回報。"}</p><button id="visitor-done">關閉</button>`,
      );
      document.querySelector("#visitor-done").onclick = () =>
        document.querySelector("#modal").close();
    } catch (error) {
      form.querySelector(".error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
