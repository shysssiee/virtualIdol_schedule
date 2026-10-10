// Refresh data without reloading the page or interrupting an open form.
export function startAutoRefresh(
  { refresh, canRefresh },
  runtime = globalThis,
) {
  let lastUpdate = runtime.Date.now(),
    busy = false;
  async function check() {
    if (
      busy ||
      runtime.document.hidden ||
      !canRefresh() ||
      runtime.Date.now() - lastUpdate < 180_000
    )
      return;
    busy = true;
    try {
      await refresh();
      lastUpdate = runtime.Date.now();
    } catch {
      // Keep the existing calendar if offline; retry on the next check.
    } finally {
      busy = false;
    }
  }
  // Short checks also let a postponed update run after a hover panel closes.
  const timer = runtime.setInterval(check, 15_000);
  runtime.document.addEventListener("visibilitychange", check);
  runtime.addEventListener("focus", check);
  runtime.addEventListener("online", check);
  return {
    check,
    stop() {
      runtime.clearInterval(timer);
      runtime.document.removeEventListener("visibilitychange", check);
      runtime.removeEventListener("focus", check);
      runtime.removeEventListener("online", check);
    },
  };
}
