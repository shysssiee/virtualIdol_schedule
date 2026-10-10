import { lunarLabel, holidayLabel } from "./almanac.js";
const formatter = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Taipei",
});
export function taiwanLunar(key) {
  const parts = formatter.formatToParts(new Date(key + "T12:00:00Z"));
  const month = parts.find((p) => p.type === "month").value;
  return lunarLabel({
    month: Number(month.replace(/[^0-9]/g, "")),
    day: Number(parts.find((p) => p.type === "day").value),
    intercalation: month.includes("閏") || month.includes("bis"),
  }).replace(/^韓曆/, "");
}
export function calendarLines(
  key,
  { taiwan, korea },
  office,
  koreanHolidays,
  KoreanCalendar,
) {
  const lines = [],
    tw = taiwan ? taiwanLunar(key) : null;
  let kr = null;
  if (korea && KoreanCalendar) {
    const l = new KoreanCalendar();
    if (l.setSolarDate(...key.split("-").map(Number)))
      kr = lunarLabel(l.getLunarCalendar()).replace(/^韓曆/, "");
  }
  if (tw && kr && tw === kr) lines.push("農曆" + tw);
  else {
    if (tw) lines.push((korea ? "台：" : "農曆") + tw);
    if (kr) lines.push((taiwan ? "韓：" : "韓曆") + kr);
  }
  if (taiwan) {
    const day = office?.days?.[key],
      weekday = new Date(key + "T12:00Z").getUTCDay();
    if (day) {
      if (day.note) lines.push("台：" + day.note);
      else if (!day.off && (weekday === 0 || weekday === 6))
        lines.push("台：補班");
      else if (day.off && weekday !== 0 && weekday !== 6)
        lines.push("台：放假");
    } else if (office) lines.push("台：行政年曆尚未收錄");
  }
  if (korea && koreanHolidays[key])
    lines.push("韓：" + koreanHolidays[key].map(holidayLabel).join("、"));
  return lines;
}
