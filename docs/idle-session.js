export const IDLE_LIMIT = 60 * 60 * 1000;
export const WARNING_AT = 55 * 60 * 1000;
export function idleState(last, now) {
  const elapsed = Math.max(0, now - last);
  return elapsed >= IDLE_LIMIT
    ? "expired"
    : elapsed >= WARNING_AT
      ? "warning"
      : "active";
}
export function startIdleSession(
  { getUser, signOut },
  runtime = window,
  doc = document,
) {
  const now = () => runtime.now?.() ?? Date.now();
  let userId = null,
    last = 0,
    busy = false,
    lastWrite = 0;
  const banner = doc.createElement("div");
  banner.className = "idle-warning";
  banner.hidden = true;
  banner.setAttribute("role", "alert");
  banner.innerHTML =
    "<span>登入已閒置55分鐘，滿1小時將自動登出。請先儲存內容。</span><button>繼續使用</button>";
  doc.body.append(banner);
  const key = () => "calendar-idle-" + userId;
  const read = () => {
    try {
      return Number(runtime.localStorage.getItem(key())) || 0;
    } catch {
      return 0;
    }
  };
  const write = () => {
    try {
      runtime.localStorage.setItem(key(), String(last));
    } catch {}
  };
  function activity(event) {
    if (event && !event.isTrusted) return;
    if (!getUser()) return;
    if (userId && idleState(Math.max(last, read()), now()) === "expired") {
      check();
      return;
    }
    last = now();
    banner.hidden = true;
    if (last - lastWrite > 1000) {
      write();
      lastWrite = last;
    }
  }
  async function check() {
    const user = getUser();
    if (!user) {
      userId = null;
      banner.hidden = true;
      return;
    }
    if (user.id !== userId) {
      userId = user.id;
      last = read() || now();
      write();
    }
    last = Math.max(last, read());
    const state = idleState(last, now());
    banner.hidden = state !== "warning";
    if (state === "expired" && !busy) {
      busy = true;
      banner.hidden = true;
      try {
        await signOut();
        try {
          runtime.localStorage.removeItem(key());
        } catch {}
        userId = null;
      } catch {
        /* Retry on the next check; protected actions still require authentication. */
      } finally {
        busy = false;
      }
    }
  }
  banner.querySelector("button").onclick = () => activity();
  const events = ["pointerdown", "keydown", "touchstart", "scroll"];
  for (const event of events)
    doc.addEventListener(event, activity, { passive: true, capture: true });
  const timer = runtime.setInterval(check, 1000);
  runtime.addEventListener("focus", check);
  doc.addEventListener("visibilitychange", check);
  check();
  return {
    check,
    stop() {
      runtime.clearInterval(timer);
      for (const event of events)
        doc.removeEventListener(event, activity, true);
      runtime.removeEventListener("focus", check);
      doc.removeEventListener("visibilitychange", check);
      banner.remove();
    },
  };
}
