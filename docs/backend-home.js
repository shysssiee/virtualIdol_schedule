import { VERSION } from "./calendar.js";
export function backendHome(root) {
  root.innerHTML = `<h1>首頁</h1><h2>版本更新功能</h2><section class="settings-card"><h3>${VERSION}</h3><ul><li>站主與協作者可在「我的帳號」修改自己的暱稱。</li><li>本站後台新增首頁，站主與協作者都能查看版本更新。</li><li>行程管理名稱簡化；站主新增網站資料備份下載。</li><li>月曆右上角顯示目前在線人數，包含訪客與登入使用者。</li><li>開播前一小時顯示「即將直播」，到預定時間顯示「直播中」。</li><li>直播開始後兩小時停止提示；站主及原作者可提早手動結束，行程保留。</li><li>登入連續閒置一小時自動登出，提前五分鐘提醒。</li><li>月曆簡潔色線與淡色底；電腦前三場、手機前兩場，其餘點開完整列表。</li><li>手機點日期在月曆下方顯示當日行程。</li></ul></section><details class="settings-card"><summary>v1.2 更新紀錄</summary><p>生日／紀念日每年顯示、獨立表格與分頁管理，協作者申請與問題回報、協作後台與權限、行程分享與日曆匯出、手機月曆、LIVE提示、三分鐘自動更新。</p></details>`;
}
