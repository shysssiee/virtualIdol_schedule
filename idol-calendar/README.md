# 星曆 · 虛擬偶像直播日曆

靜態網站放 GitHub Pages，登入與資料放 Supabase。純 HTML、CSS、JavaScript，沒有前端框架、沒有建置步驟。網站名稱「星曆」是可修改的暫定名稱。

## 目前交付狀態

- 未填設定時為**唯讀示範**，團體、成員、行程皆為虛構。沒有示範管理員或假登入。
- 已提供正式登入、行程編輯、站主管理程式，以及資料庫權限 SQL。
- 尚未連接你的 Supabase、尚未上傳你的 GitHub；真實帳號、資料儲存及資料庫權限需要完成以下設定後驗證。
- 新資料庫沒有示範行程；由站主建立團體與分類後開始登記。

## 一、準備免費資料服務

1. 到 https://supabase.com 建立帳號，選擇 **Free** 方案建立新專案。資料庫密碼請自行保存，不放進網站。
2. 開啟 SQL Editor → New query，貼上 `database/schema.sql` 全文並執行。這份 SQL 僅用於新的空專案，勿重複執行。
3. 到 Authentication 設定中關閉 **Allow new users to sign up**（公開註冊）。保留 Email 登入。
4. 到 Authentication → Users，使用 **Add user / Create user** 人工建立你自己的帳號。密碼由你自行設定；若需要可啟用自動確認 Email。
5. 在 SQL Editor 貼上 `database/create-owner.sql`，將 `REPLACE_WITH_YOUR_EMAIL` 換成你剛建立的 Email，再執行。確認 `profiles` 表中出現你的資料且 `role` 為 `owner`。
6. 在 Project Settings / Connect / API Keys 找到 **Project URL** 和**可公開的 publishable key**（或 legacy anon key）。修改 `docs/config.js`：

```js
window.CALENDAR_CONFIG = {
  supabaseUrl: 'https://你的專案.supabase.co',
  supabasePublishableKey: '你的 publishable key 或 anon key'
};
```

這兩個值設計上可放在瀏覽器，真正權限由資料庫 RLS 保護。**不要填入 secret key、service_role key 或資料庫密碼。**

## 二、放到 GitHub Pages（不需要安裝 Node.js）

1. 解壓縮交付的 ZIP。
2. 在 GitHub 建立一個公開 repository，例如 `idol-calendar`。免費 GitHub Pages 的可用性取決於帳號與 repository 條件，這份指南使用公開 repository。
3. 使用 Add file → Upload files，把 `idol-calendar` 資料夾**裡面的內容**上傳到 repository 根目錄。根目錄應直接看見 `docs`、`database`、`README.md`，不要再包一層 `idol-calendar`。
4. 開啟 Settings → Pages，Source 選 **Deploy from a branch**，Branch 選 `main`，資料夾選 **`/docs`**，按 Save。
5. 等待 GitHub 完成部署，從 Pages 設定頁開啟實際網站網址，通常是 `https://你的帳號.github.io/idol-calendar/`。
6. 回 Supabase → Authentication → URL Configuration：Site URL 填入完整網站網址（包含 repository 路徑及結尾 `/`）；Redirect URLs 加入相同網址。若本機測試登入，也加入 `http://127.0.0.1:8765/`。
7. 用你的站主帳號登入網站，確認上方出現「站主管理」與「新增行程」。

網站檔案更新需要再次上傳 GitHub；登入後新增行程、修改分類不需要重新部署網站。新行程儲存成功後立即進入共用資料庫；其他已開啟的頁面每分鐘更新一次，也可重新整理立即查看。

## 三、站主第一次使用

1. 點「站主管理」。
2. 新增團體，設定固定顏色。
3. 新增成員，選擇所屬團體。
4. 新增活動分類，例如雜談、遊戲、歌回、聯動。
5. 新增直播平台，例如 YouTube、Twitch。
6. 點「新增行程」，填入標題、團體、成員、分類、時間、平台連結及說明，按「儲存並公開」。至少需要一個直播連結。

所有時間採用台灣時間 UTC+8。新建團體後，訪客若已保存追蹤清單，需要自行勾選或按「全選」才會看到新團體。

### 邀請協作者

為了保持網站簡單，**帳號建立與寄送邀請在 Supabase 後台操作**；網站提供授權及停用功能，不把管理金鑰放進前端。若目前不設定寄信服務，優先採用下面第 5 點的人工建立方式。

1. Supabase → Authentication → Users → Invite user，填協作者 Email。寄信設定需正常；內建寄信服務有收件人及寄信額度限制，若邀請失敗，請依官方要求設定自己的 SMTP。
2. 複製該使用者的 UUID。
3. 回網站「站主管理」，貼上 UUID、輸入顯示名稱，按「授權為協作者」。**不要在此填站主 UUID。**
4. 協作者打開邀請信，設定自己的密碼，再登入網站。不需要 GitHub 帳號。
5. 若不使用邀請信，可由你在 Users 人工 Create user，勾選確認 Email，於網站授權後，私下交付初始帳號資料。協作者登入後使用「修改密碼」設定自己的密碼，不需要寄信服務。忘記密碼則由你在後台重設，或另行設定 SMTP 啟用自助找回。

若停止合作，在網站「站主管理」停用該協作者。即使他仍有登入 session，資料庫也會拒絕其新增與修改，原本行程保留。

## 四、協作者使用方法

- 點「協作者登入」，輸入 Email 和密碼。
- 點「新增行程」填表，儲存後立即公開，不需審核。
- 點擊自己登記的行程 →「編輯行程」，可以修改資料、標記已結束或取消。
- 不勾成員表示全團；勾選成員表示指定參與者。
- 每個有填連結的平台都會顯示在行程上。
- 不可修改別人的行程、團體顏色、分類、成員或平台。
- 不可刪除行程，請聯絡站主。站主在行程詳細資訊中可刪除。

## 五、訪客使用方法

- 勾選想看的團體，可複選；展開團體可選成員。
- 團體追蹤選擇記在目前瀏覽器；成員、平台、活動篩選目前僅在這次瀏覽期間保留。
- 月：日曆格內顯示三場，超過時點「還有 N 場」開啟當日。
- 週／日：時間軸並排顯示重疊直播，可以上下捲動查看時段。
- 列表：顯示所選月份的完整行程；手機首次開啟預設列表。
- 手機的篩選預設收起，點「團體與平台篩選」展開，避免清單占滿畫面。
- 電腦滑鼠移上行程查看資訊浮卡；手機點擊查看詳細資訊。
- 搜尋團體後展開「成員 / 紀錄」，點「查看過往紀錄」，可看到該團體由新到舊的登記紀錄；也能從上方「過往紀錄」查看目前勾選的所有團體。
- 過往紀錄使用日期列表及月份篩選，不提供月／週／日檢視切換。
- 到開始時間自動標記「直播中」。有結束時間就於該時間停止，沒填則兩小時停止；填寫的結束時間不能超過兩小時。頁面每 30 秒更新提醒，所以切換最多延遲約 30 秒。
- 「直播中」依排程時間計算，不會向平台偵測真實開播；過往紀錄是已登記行程，不代表平台確認播出。
- 跨團聯動使用主辦團體配色，其他團體／成員列於說明；第一版不使用多團混色。

## 六、本機預覽（選用）

有 Python 時，在 `idol-calendar` 資料夾開終端機：

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory docs
```

瀏覽 http://127.0.0.1:8765/ 。請透過 HTTP 預覽，不要直接雙擊 HTML（瀏覽器會限制 JavaScript 模組）。按 Ctrl+C 關閉。未填 `config.js` 就是唯讀示範；若只想看畫面，不必先申請 Supabase。

## 七、正式啟用前的驗收

以下必須在你自己的新資料庫完成，交付時未有帳號連線，不能代替這些檢查：

1. 訪客能看公開行程，無登入時不能寫入。
2. 站主建立團體、分類、平台、成員；新增及刪除測試行程。
3. 建立兩個協作者 A、B。A 新增行程，B 可閱讀但沒有編輯或刪除按鈕。
4. 使用 A 的登入 session 向資料 API 嘗試修改 B 的行程，應無資料變更；嘗試刪除 A 的行程應無資料變更，新增團體應被拒絕。只檢查隱藏按鈕不能替代資料庫驗證。
5. 站主停用 A 後，A 即使尚未登出，也不能新增或修改行程。
6. 驗證邀請信、設定密碼、忘記密碼的返回網址包含正確的 GitHub repository 路徑。
7. 驗證相同時段兩場直播並排，以及開始／結束時間的標籤切換。

## 八、程式結構與維護

```text
docs/
  index.html   頁面骨架
  style.css    版面、配色、少量動畫
  app.js       日曆、篩選、表單與管理介面
  calendar.js  共用日期、直播提醒、重疊分欄規則
  data.js      共用資料讀寫與登入服務、唯讀示範
  config.js    你的公開資料服務設定
database/
  schema.sql        資料表、驗證及 RLS 權限
  create-owner.sql  第一次授權站主
tests/
  calendar.test.js  日期、直播提醒及重疊分欄測試
```

登入 SDK 固定版本從 esm.sh 載入，其他功能不依賴 UI 套件。一般使用者不用安裝套件；有 Node.js 的維護者可執行 `node --test tests/calendar.test.js`。修改時直接整理既有邏輯，不保留重複版本。舊版本交由 Git 保存。

後端改結構時，請新增獨立 SQL migration，不要對使用中的資料庫重跑初始 `schema.sql`。自行定期備份資料，免費方案不是無限制或保證永久免費。

## 免費服務限制與官方參考

Supabase 免費專案可能因一段時間低活動而暫停，重新啟用需至後台處理；寄信亦有額度與設定限制，正式邀請協作者前請先測試。

- GitHub Pages 部署：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Supabase 方案：https://supabase.com/pricing
- 免費專案暫停：https://supabase.com/docs/guides/platform/free-project-pausing
- 使用者與金鑰：https://supabase.com/docs/guides/auth/users
- Email / SMTP：https://supabase.com/docs/guides/auth/auth-smtp
- RLS：https://supabase.com/docs/guides/database/postgres/row-level-security

## 驗證紀錄

已在本機執行日期／直播提醒／重疊分欄／文字 escaping 共 6 項測試；另用本機 PostgreSQL 相容引擎執行初始 SQL，驗證匿名讀取、協作者只能編輯自己的行程、無法刪除或自行提升權限、停用帳號不能寫入、站主能修改及刪除、建立者不可被轉移、結束時間限制。這是本機資料庫測試，真實 Supabase 登入與邀請流程仍需完成設定後驗證。
