export function greeting(name, zone, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return `哈囉～${name}，${hour >= 5 && hour < 12 ? "早安" : hour >= 12 && hour < 18 ? "午安" : "晚安"}！`;
}
