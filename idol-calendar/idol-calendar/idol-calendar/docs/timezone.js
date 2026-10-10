// Stored timestamps are absolute instants. Calendar dates are floating UTC dates.
export const INPUT_ZONES = ["Asia/Taipei", "Asia/Seoul"];
export function validZone(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return Boolean(zone);
  } catch {
    return false;
  }
}
export function deviceZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
}
export function parts(date, zone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(date))
      .map((p) => [p.type, p.value]),
  );
}
export function dateKey(date, zone) {
  const p = parts(date, zone);
  return `${p.year}-${p.month}-${p.day}`;
}
export function clockTime(date, zone) {
  const p = parts(date, zone);
  return `${p.hour}:${p.minute}`;
}
export const civilKey = (d) => new Date(d).toISOString().slice(0, 10);
export const civilDate = (key) => new Date(key + "T12:00:00Z");
export const localInput = (date, zone) =>
  dateKey(date, zone) + "T" + clockTime(date, zone);
// Iteration resolves timezone offsets, including daylight saving at day boundaries.
export function fromLocal(value, zone) {
  const target = Date.parse(value.slice(0, 16) + ":00Z");
  if (!Number.isFinite(target) || !validZone(zone))
    throw Error("日期或時區無效");
  let instant = target;
  for (let i = 0; i < 6; i++) {
    const p = parts(instant, zone);
    const wall = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    const next = instant + target - wall;
    if (next === instant) return new Date(instant);
    instant = next;
  }
  throw Error("此當地時間不存在，請調整時間");
}
export function dayBounds(key, zone) {
  const next = civilDate(key);
  next.setUTCDate(next.getUTCDate() + 1);
  return [dayStart(key, zone), dayStart(civilKey(next), zone)];
}
// A few regions change clocks at midnight. Use the first real instant of the date.
const midnightCache = new Map();
function dayStart(key, zone) {
  const cacheKey = zone + "/" + key;
  if (midnightCache.has(cacheKey)) return midnightCache.get(cacheKey);
  let result;
  try {
    result = fromLocal(key + "T00:00", zone).getTime();
    if (dateKey(result - 1000, zone) === key) result = undefined;
  } catch {
    /* A skipped midnight is resolved below. */
  }
  if (result === undefined) {
    const target = Date.parse(key + "T00:00:00Z");
    let low = target - 36 * 3600000,
      high = target + 36 * 3600000;
    while (low < high) {
      const middle = Math.floor((low + high) / 2000) * 1000;
      if (dateKey(middle, zone) < key) low = middle + 1000;
      else high = middle;
    }
    result = low;
  }
  if (midnightCache.size >= 512)
    midnightCache.delete(midnightCache.keys().next().value);
  midnightCache.set(cacheKey, result);
  return result;
}
export function zoneLabel(zone, date = new Date()) {
  const offset = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")
    .value.replace("GMT", "UTC");
  return `${zone === "Asia/Taipei" ? "台灣" : zone === "Asia/Seoul" ? "韓國" : zone}（${offset}）`;
}
