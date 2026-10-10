export const ONLINE_WINDOW = 95000;
export function isOnline(rows, userId, now = Date.now()) {
  return rows.some(
    (row) =>
      row.user_id === userId &&
      now - Date.parse(row.last_seen) < ONLINE_WINDOW &&
      now - Date.parse(row.last_seen) >= -5000,
  );
}
export function createPresence(client, getUser) {
  const session = crypto.randomUUID();
  let userId = null,
    interval = null;
  async function signal(active) {
    if (!client || !userId) return;
    try {
      await client.rpc("presence_signal", {
        session_id: session,
        is_active: active,
      });
    } catch {}
  }
  async function stop() {
    clearInterval(interval);
    interval = null;
    await signal(false);
    userId = null;
  }
  function start() {
    const next = getUser()?.id || null;
    if (next === userId) return;
    if (userId) signal(false);
    clearInterval(interval);
    userId = next;
    if (!userId) return;
    const beat = () => signal(document.visibilityState === "visible");
    beat();
    interval = setInterval(beat, 30000);
  }
  document.addEventListener("visibilitychange", () =>
    signal(document.visibilityState === "visible"),
  );
  window.addEventListener("pagehide", () => signal(false));
  async function badges(root) {
    if (!client || !root?.isConnected) return;
    let data = [],
      error = null;
    try {
      const result = await client
        .from("user_presence")
        .select("user_id,last_seen");
      data = result.data;
      error = result.error;
    } catch (cause) {
      error = cause;
    }
    root.querySelectorAll("[data-presence-user]").forEach((el) => {
      const online = !error && isOnline(data || [], el.dataset.presenceUser);
      el.classList.toggle("online", online);
      el.classList.toggle("unavailable", Boolean(error));
      el.title = error
        ? "在線狀態不可用，請確認已執行 r4 升級 SQL"
        : online
          ? "在線（近95秒有連線）"
          : "離線";
      el.setAttribute("aria-label", el.title);
    });
  }
  return { start, stop, badges };
}
