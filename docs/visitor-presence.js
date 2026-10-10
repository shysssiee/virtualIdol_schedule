export function startVisitorPresence(client, target) {
  let token;
  try {
    token = localStorage.getItem("calendar-visitor-id");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("calendar-visitor-id", token);
    }
  } catch {
    token = crypto.randomUUID();
  }
  let busy = false,
    stopped = false;
  async function beat() {
    if (busy || stopped || document.hidden || !client) return;
    busy = true;
    try {
      const { data, error } = await client.rpc("visitor_online", {
        visitor_id: token,
      });
      if (error) throw error;
      target.textContent = "目前在線：" + data + " 人";
    } catch {
      target.textContent = "目前在線：暫無法取得";
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(beat, 30000);
  document.addEventListener("visibilitychange", beat);
  window.addEventListener("online", beat);
  beat();
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", beat);
    window.removeEventListener("online", beat);
  };
}
