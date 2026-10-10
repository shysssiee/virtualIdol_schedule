import { client } from "./data.js";
export function backupPage(root, toast) {
  root.innerHTML =
    '<h1>網站備份下載</h1><p>下載目前網站資料為 JSON 備份，包含行程、團體、成員、分類、生日／紀念日、網站設定、帳號基本資料與留言。僅站主可下載。</p><p class="muted">備份含申請人的信箱與聯絡方式，請妥善保存。帳號密碼、登入金鑰與網站程式檔案不包含在內；程式檔案請另外由 GitHub 下載。此備份供保存，尚未提供自動還原功能。</p><button id="download-backup">下載目前資料備份</button><p id="backup-result" role="status"></p>';
  const button = root.querySelector("#download-backup"),
    status = root.querySelector("#backup-result");
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = "正在產生備份…";
    try {
      const { data, error } = await client.rpc("website_backup");
      if (error) throw error;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "calendar-v1.3-backup-" +
        new Date().toISOString().replace(/[:.]/g, "-") +
        ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "備份已產生，請確認下載檔案已保存。";
    } catch (e) {
      status.textContent = "備份失敗：" + e.message;
      toast(e.message);
    } finally {
      button.disabled = false;
    }
  };
}
