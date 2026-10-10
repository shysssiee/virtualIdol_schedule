const decode = (s) =>
  String(s ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const meta = (html, key) =>
  decode(
    [...html.matchAll(/<meta\b[^>]*>/gi)]
      .find(
        (m) =>
          m[0].includes(`property="${key}"`) ||
          m[0].includes(`itemprop="${key}"`),
      )?.[0]
      .match(/content="([^"]*)"/)?.[1],
  );
export function normalizeImportUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw Error("請貼上完整的直播網址");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw Error("僅支援 HTTPS 平台網址");
  const host = u.hostname.toLowerCase();
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host))
    throw Error("YouTube 已取消自動擷取，請使用直播行程手動新增");
  if (["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(host)) {
    const m = u.pathname.match(
      /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})\/?$/,
    );
    if (!m) throw Error("X 請貼上含 Space 的貼文網址");
    return { platform: "X", url: `https://x.com/${m[1]}/status/${m[2]}` };
  }
  if (host === "weverse.io" || host === "www.weverse.io")
    throw Error("Weverse 目前尚未支援自動擷取，請使用直播行程手動新增");
  throw Error("目前僅支援 X／Space 貼文網址");
}
export function parseImportHtml(html, target, now = Date.now()) {
  let title,
    timestamp,
    channel = null,
    host = null;
  if (target.platform !== "X") throw Error("目前僅支援 X／Space 貼文網址");
    const label = html.match(/aria-label="(?:Space recording|Ended Space): ([^"]+)"/)?.[1];
    const split = label?.lastIndexOf(", hosted by ") ?? -1;
    if (split >= 0) {
      title = decode(label.slice(0, split));
      host = decode(label.slice(split + 12));
    }
    timestamp = meta(html, "article:published_time");
  if (!title) throw Error(`${target.platform} 沒有回傳直播標題，可能是平台限制或頁面格式不同，請手動新增`);
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) throw Error(`${target.platform} 沒有回傳完整開播時間，可能是平台限制；不會使用上架日期代替，請手動新增`);
  return {
    platform: target.platform,
    title,
    start_at: new Date(timestamp).toISOString(),
    url: target.url,
    channel,
    host,
    status: Date.parse(timestamp) <= now ? "ended" : "scheduled",
  };
}
export function matchImportGroup(result, groups) {
  const normalized = (s) =>
    String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  const source = normalized(result.channel);
  const matches = groups.filter((g) => {
    const name = normalized(g.name);
    return name.length >= 4 && source.startsWith(name);
  });
  return matches.length === 1 ? matches[0].id : null;
}

export function matchImportPlatform(platform, name) {
 const key=String(name||'').toUpperCase().replace(/[\s/／()（）_：:－-]/g,'');
 return platform==='X' && ['X','TWITTER','XTWITTER','XSPACE','XSPACES','TWITTERSPACE','TWITTERSPACES','SPACE','SPACES','X推特'].includes(key);
}
