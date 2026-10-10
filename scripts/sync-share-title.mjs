import fs from "node:fs/promises";
import vm from "node:vm";
// config.js only contains public browser settings. Never log its contents.
const context = { window: {} };
try {
  vm.runInNewContext(await fs.readFile("docs/config.js", "utf8"), context, {
    timeout: 1000,
  });
} catch {
  /* Actions secrets remain the preferred source. */
}
const config = context.window.CALENDAR_CONFIG || {};
const url = process.env.SUPABASE_URL || config.supabaseUrl,
  key = process.env.SUPABASE_PUBLISHABLE_KEY || config.supabasePublishableKey;
if (!url || !key)
  throw Error(
    "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Actions secrets",
  );
const response = await fetch(
  new URL("/rest/v1/site_settings?select=name&singleton=eq.true", url),
  { headers: { apikey: key, Authorization: "Bearer " + key } },
);
if (!response.ok)
  throw Error("Site settings request failed: " + response.status);
const rows = await response.json(),
  name = rows[0]?.name?.trim();
if (!name) throw Error("Site name unavailable");
const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const title = esc(name + " · 直播行程");
let html = await fs.readFile("docs/index.html", "utf8");
html = html.replace(
  /<title>[\s\S]*?<\/title>/,
  () => "<title>" + title + "</title>",
);
for (const [attr, id, value] of [
  ["property", "og:title", title],
  ["property", "og:site_name", esc(name)],
  ["name", "twitter:title", title],
]) {
  const pattern = new RegExp("<meta\\s+" + attr + '="' + id + '"[^>]*>');
  if (!pattern.test(html)) throw Error("Missing metadata: " + id);
  html = html.replace(
    pattern,
    () => "<meta " + attr + '="' + id + '" content="' + value + '" />',
  );
}
html = html.replace(
  /(<span id="site-name">)[\s\S]*?(<\/span\s*>)/,
  () => '<span id="site-name">' + esc(name) + "</span>",
);
for (const id of ["site-name", "calendar-nav", "history-nav", "login-greeting", "login-button"]) {
  if (!html.includes('id="' + id + '"')) throw Error("Homepage structure missing: " + id + "; upload the complete index.html before deploying");
}
await fs.writeFile("docs/index.html", html);
console.log("Share title synchronized");
