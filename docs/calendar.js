export const dayKey = (d) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(
    new Date(d),
  );
export const time = (d) =>
  new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
export const end = (e) =>
  Math.min(
    e.end_at ? new Date(e.end_at).getTime() : Infinity,
    new Date(e.start_at).getTime() + MAX_DURATION,
  );
export const MAX_DURATION = 4 * 60 * 60 * 1000;
export const VERSION = "v1.1";
export function groupOptions(group, items, field) {
  return (group?.[field] || [])
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);
}
export const isLive = (e, now = Date.now()) =>
  e.status === "scheduled" &&
  new Date(e.start_at).getTime() <= now &&
  now < end(e);
export const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function shift(d, n) {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}
export function dayEvents(events, d) {
  return events.filter((e) => dayKey(e.start_at) === dayKey(d));
}
// Connected overlap clusters share their column width. No cards cover each other.
export function layout(events) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at) - new Date(b.start_at),
  );
  const result = [];
  let cluster = [],
    limit = 0;
  function flush() {
    const occupied = [];
    let columns = 0;
    for (const e of cluster) {
      let column = occupied.findIndex(
        (t) => t <= new Date(e.start_at).getTime(),
      );
      if (column < 0) column = occupied.length;
      occupied[column] = end(e);
      columns = Math.max(columns, column + 1);
      result.push({ event: e, column, cluster: cluster[0].id });
    }
    result
      .filter((r) => r.cluster === cluster[0]?.id)
      .forEach((r) => (r.columns = columns));
    cluster = [];
  }
  for (const e of sorted) {
    const start = new Date(e.start_at).getTime();
    if (cluster.length && start >= limit) flush();
    cluster.push(e);
    limit = Math.max(cluster.length === 1 ? 0 : limit, end(e));
  }
  if (cluster.length) flush();
  return result;
}
