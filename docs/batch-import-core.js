import { duplicates, newEventStatus } from './v14.js';

export function parseBatch(text) {
  const input = JSON.parse(text);
  if (input.version !== 1 || !Array.isArray(input.events) || input.events.length > 100)
    throw Error('請使用版本 1 的匯入檔，一次最多 100 筆。');
  return input.events.map((row) => ({
    group: String(row.group || ''), title: String(row.title || ''),
    date: String(row.date || ''), time: String(row.time || ''),
    source: String(row.source || ''), platform: String(row.platform || ''),
    members: Array.isArray(row.members) ? row.members.map(String) : [],
    confirmed: row.confirmed === true,
  }));
}
export function prepareRow(row, data, existing = data.events, now = Date.now()) {
  const errors = [];
  const group = data.groups.find(g => g.name === row.group);
  if (!group) errors.push('請選擇已建立的團體');
  const start = `${row.date}T${row.time}:00+08:00`;
  const stamp = Date.parse(start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) ||
      !Number.isFinite(stamp) || new Date(stamp + 8 * 3600000).toISOString().slice(0, 16) !== `${row.date}T${row.time}`)
    errors.push('日期／時間無效');
  if (!row.confirmed) errors.push('公告或時間尚未確認');
  let source;
  try { source = new URL(row.source); if (source.protocol !== 'https:' || source.username || source.password) throw Error(); }
  catch { errors.push('請填入有效的 HTTPS 官方來源'); }
  const title = row.title.trim() || `${group?.name || row.group} LIVE`;
  if ([...title].length > 160) errors.push('標題不可超過 160 字');
  if (row.source.length > 2000) errors.push('來源網址過長');
  const member_ids = [];
  for (const name of row.members) {
    const member = data.members.find(m => m.group_id === group?.id && m.name.toUpperCase() === name.toUpperCase());
    if (member) member_ids.push(member.id); else errors.push(`無法辨識成員：${name}，請清空或改用已建立名稱`);
  }
  const item = { title, group_id: group?.id, member_ids: [...new Set(member_ids)],
    start_at: Number.isFinite(stamp) ? new Date(stamp).toISOString() : null,
    input_timezone: 'Asia/Taipei', end_at: null, category_id: null,
    members_only: false, status: newEventStatus(start, now),
    description: `官方公告來源：${row.source}`, links: [] };
  if (group && Number.isFinite(stamp) && duplicates(existing, { ...item, id: null }).length) errors.push('同團／同時間已有行程');
  if (row.platform) {
    const p = data.platforms.find(p => p.name.toUpperCase() === row.platform.toUpperCase());
    if (!p || !(group?.platform_ids || []).includes(p.id)) errors.push('團體尚未啟用此平台');
    else if (source) item.links.push({ platform_id: p.id, url: source.href });
  }
  return { item, errors };
}
