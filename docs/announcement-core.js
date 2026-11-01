export const HIDDEN_KEY = 'calendar-announcements-hidden';
export function announcementDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Taipei'}).format(now);
}
export function normalizeAnnouncements(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0,50).filter(row => {
    if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 100 || seen.has(row.id) ||
        typeof row.title !== 'string' || typeof row.body !== 'string' || !row.title.trim() ||
        !row.body.trim() || [...row.title].length > 100 || [...row.body].length > 3000) return false;
    seen.add(row.id); return true;
  }).map(row => ({id:row.id,title:row.title.trim(),body:row.body.trim(),enabled:row.enabled === true}));
}
export function announcementKey(row) {
  // Content changes invalidate an earlier dismissal; merely refreshing does not.
  let hash = 2166136261;
  for (const char of JSON.stringify([row.title,row.body])) {
    hash ^= char.codePointAt(0); hash = Math.imul(hash,16777619);
  }
  return `${row.id}:${hash >>> 0}`;
}
export function pendingAnnouncements(value, storage, now = new Date()) {
  let hidden;
  try { hidden = JSON.parse(storage?.getItem(HIDDEN_KEY) || 'null'); } catch {}
  const keys = hidden?.date === announcementDate(now) && Array.isArray(hidden.keys) ? hidden.keys : [];
  return normalizeAnnouncements(value).filter(row => row.enabled && !keys.includes(announcementKey(row)));
}
export function hideAnnouncementsToday(rows, storage, now = new Date()) {
  const date = announcementDate(now);
  let saved;
  try { saved = JSON.parse(storage?.getItem(HIDDEN_KEY) || 'null'); } catch {}
  const keys = [...new Set([...(saved?.date === date && Array.isArray(saved.keys) ? saved.keys : []),...rows.map(announcementKey)])].slice(-100);
  try { storage.setItem(HIDDEN_KEY,JSON.stringify({date,keys})); return true; } catch { return false; }
}
