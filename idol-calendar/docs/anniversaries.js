export function occurrence(item, key) {
  const y = Number(key.slice(0, 4)),
    original = Number(item.original_date.slice(0, 4));
  if (key.slice(5) !== item.original_date.slice(5) || y < original) return null;
  const years = y - original;
  return {
    ...item,
    years,
    icon: item.kind === "birthday" ? "🎂" : "🎉",
    label:
      item.kind === "birthday"
        ? years
          ? years + " 歲生日"
          : "出生紀念日"
        : item.kind === "debut"
          ? years
            ? "出道 " + years + " 週年"
            : "正式出道"
          : years
            ? years + " 週年"
            : "紀念日",
  };
}
export function anniversariesOn(items, key) {
  return items.map((x) => occurrence(x, key)).filter(Boolean);
}
export function calendarFile(e, title) {
  const stamp = (d) =>
    new Date(d)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (x) =>
    String(x || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Virtual Idol Calendar//ZH-TW",
    "BEGIN:VEVENT",
    "UID:" + e.id + "@virtual-idol-calendar",
    "DTSTAMP:" + stamp(new Date()),
    "DTSTART:" + stamp(e.start_at),
    "SUMMARY:" + escape(title),
    "DESCRIPTION:" +
      escape(e.description + "\n" + e.links.map((l) => l.url).join("\n")),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT10M",
    "DESCRIPTION:" + escape(title),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let out = "",
          len = 0;
        for (const c of line) {
          const n = new TextEncoder().encode(c).length;
          if (len + n > 73) {
            out += "\r\n ";
            len = 1;
          }
          out += c;
          len += n;
        }
        return out;
      })
      .join("\r\n") + "\r\n"
  );
}
