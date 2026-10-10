# Virtual Idol 星曆 — v1.2 r4
虛擬偶像直播行程與年度紀念日網站。GitHub Pages 提供網頁，Supabase 提供資料庫與登入。

- [安裝與升級](安裝說明.md)
- [更新與使用方式](更新說明.md)
- 舊說明保留在 [文件封存/v1.2](文件封存/v1.2)，不必逐份閱讀。

## 資料夾
- docs：部署到 GitHub Pages 的完整網站，含離線年曆資料。
- database：Supabase 初始化與升級 SQL。
- tests：純函式測試，執行 node --test tests/*.test.js。
- 文件封存：以前的安裝、更新與驗證紀錄。

目前畫面版本顯示 v1.2 r3；直播提醒為開始後兩小時停止，行程不會消失。
