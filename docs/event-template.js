import { localInput } from "./timezone.js";
export function defaultEventTitle(title, group, category) {
  return (
    title.trim() ||
    Array.from([group, category, "LIVE"].filter(Boolean).join(" "))
      .slice(0, 160)
      .join("")
  );
}
export function templateValues(event, selectedStart) {
  const zone = ["Asia/Taipei", "Asia/Seoul"].includes(event.input_timezone)
    ? event.input_timezone
    : "Asia/Taipei";
  return {
    zone,
    start:
      selectedStart.slice(0, 10) +
      "T" +
      localInput(event.start_at, zone).slice(11, 16),
    category: event.category_id || "",
    members: [...(event.member_ids || [])],
    membersOnly: !!event.members_only,
    links: (event.links || []).map((l) => ({ ...l })),
  };
}
