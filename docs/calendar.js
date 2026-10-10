import { dateKey, clockTime, dayBounds, civilKey } from "./timezone.js";
let zone = "Asia/Taipei";
export const setZone = (value) => {
  zone = value;
};
export const dayKey = (date, tz = zone) => dateKey(date, tz);
export const time = (date, tz = zone) => clockTime(date, tz);
export const MAX_DURATION = 2 * 60 * 60 * 1000;
export const end = (e) => new Date(e.start_at).getTime() + MAX_DURATION;
export const VERSION = "v1.4 r2";
export function groupOptions(group, items, field) {
  return (group?.[field] || [])
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);
}
export const isLive = (e, now = Date.now()) =>
  e.status === "scheduled" &&
  new Date(e.start_at).getTime() <= now &&
  now < end(e);
export const isUpcoming = (e, now = Date.now()) =>
  e.status === "scheduled" &&
  Date.parse(e.start_at) > now &&
  Date.parse(e.start_at) - now <= 60 * 60 * 1000;
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
  const [start, finish] = dayBounds(civilKey(d), zone);
  return events.filter(
    (e) => Date.parse(e.start_at) >= start && Date.parse(e.start_at) < finish,
  );
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
