import { client } from "./data.js";
import { normalizeImportUrl } from "./url-import-core.js";
export function showUrlImport({ show, openEvent, openManual }) {
  show(
    '<h2>導入網址擷取</h2><form id="url-import-form"><label>直播網址<input name="url" type="url" required maxlength="2048" placeholder="貼上 X／Space 貼文網址"></label><p class="muted">僅支援 X／Space 貼文。擷取後請確認團體、成員與時間，再儲存行程。YouTube 與 Weverse 請手動新增。</p><p id="url-import-error" class="error" role="alert"></p><div class="actions"><button type="submit" class="primary">擷取資料</button><button type="button" id="import-manual">手動新增</button></div></form>',
  );
  const form = document.querySelector("#url-import-form");
  document.querySelector("#import-manual").onclick = openManual;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector("[type=submit]"),
      error = form.querySelector("#url-import-error");
    button.disabled = true;
    button.textContent = "擷取中…";
    error.textContent = "";
    try {
      const target = normalizeImportUrl(form.elements.url.value.trim());
      if (!client?.functions) throw Error("請先完成 Supabase 擷取服務部署");
      const { data, error: err } = await client.functions.invoke(
        "import-event",
        { body: { url: target.url } },
      );
      if (!form.isConnected) return;
      if (err)
        throw Error(
          "擷取服務無法使用，請確認已部署 import-event、目前仍登入，或改用手動新增",
        );
      if (data?.error) throw Error(data.error);
      if (!data?.title || !Number.isFinite(Date.parse(data.start_at)))
        throw Error("沒有取得完整資料，請手動新增");
      openEvent(data);
    } catch (e) {
      if (form.isConnected) error.textContent = e.message;
    } finally {
      if (form.isConnected) {
        button.disabled = false;
        button.textContent = "擷取資料";
      }
    }
  };
}
