export const memberName = (name) =>
  String(name || "").replace(/[a-z]/g, (c) => c.toUpperCase());
export function groupDay(events) {
  const groups = new Map();
  for (const e of events) {
    if (!groups.has(e.group_id)) groups.set(e.group_id, []);
    groups.get(e.group_id).push(e);
  }
  return [...groups].map(([id, items]) => ({
    id,
    items: items.sort(
      (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
    ),
  }));
}
export const newEventStatus = (start, now = Date.now()) =>
  Date.parse(start) <= now ? "ended" : "scheduled";
export function duplicates(events, item) {
  return events.filter(
    (e) =>
      e.id !== item.id &&
      e.group_id === item.group_id &&
      e.status !== "cancelled" &&
      Date.parse(e.start_at) === Date.parse(item.start_at) &&
      (!e.member_ids.length ||
        !item.member_ids.length ||
        e.member_ids.some((id) => item.member_ids.includes(id))),
  );
}
export function eventChanges(previous, current) {
  if (!previous) return [];
  const old = new Map(previous.map((e) => [e.id, e]));
  return current.flatMap((e) => {
    const prior = old.get(e.id);
    if (!prior) return [{ kind: "新增", event: e }];
    const clean = (x) => {
      const { updated_at, ...rest } = x;
      return rest;
    };
    return JSON.stringify(clean(prior)) !== JSON.stringify(clean(e))
      ? [{ kind: "修改", event: e, prior }]
      : [];
  });
}
