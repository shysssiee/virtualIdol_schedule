export function occurrence(item, key) {
  const y = Number(key.slice(0, 4)),
    original = Number(item.original_date.slice(0, 4));
  if (
    key.slice(5) !== item.original_date.slice(5) ||
    (!item.year_unknown && y < original)
  )
    return null;
  const years =
    item.year_unknown && item.kind === "birthday" ? null : y - original;
  return {
    ...item,
    years,
    icon: item.kind === "birthday" ? "🎂" : "🎉",
    label:
      item.kind === "birthday"
        ? item.year_unknown
          ? "生日"
          : years
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

export function anniversaryDate(value, unknown = false) {
  const raw = value.trim(),
    date = unknown ? "2000-" + raw : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw Error(unknown ? "請輸入月日，例如05-26。" : "請輸入完整年月日。");
  const parsed = new Date(date + "T12:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw Error("日期不正確。");
  return date;
}
export function bindBirthdayYear(input, checkbox) {
  const update = () => {
    const value = input.value;
    input.type = checkbox.checked ? "text" : "date";
    if (checkbox.checked) {
      input.placeholder = "MM-DD，例如05-26";
      input.pattern = "[0-9]{2}-[0-9]{2}";
      input.value = value.slice(-5);
    } else {
      input.removeAttribute("pattern");
      input.value = /^\d{4}-/.test(value) ? value : "";
    }
  };
  checkbox.onchange = update;
  update();
}
