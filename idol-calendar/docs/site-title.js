export function siteTitle(name) {
  return (String(name || "").trim() || "星曆") + " · 直播行程";
}
export function updateSiteMetadata(doc, name) {
  doc.title = siteTitle(name);
  for (const [attribute, key, content] of [
    ["property", "og:title", doc.title],
    ["property", "og:site_name", String(name || "").trim() || "星曆"],
    ["name", "twitter:title", doc.title],
  ]) {
    let tag = doc.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!tag) {
      tag = doc.createElement("meta");
      tag.setAttribute(attribute, key);
      doc.head.append(tag);
    }
    tag.setAttribute("content", content);
  }
}
export async function downloadSharePage(name) {
  const response = await fetch(new URL("index.html", document.baseURI), {
    cache: "no-store",
  });
  if (!response.ok) throw Error("下載失敗，請稍後重試。");
  const doc = new DOMParser().parseFromString(
    await response.text(),
    "text/html",
  );
  updateSiteMetadata(doc, name);
  doc.querySelector("#site-name").textContent =
    String(name || "").trim() || "星曆";
  const url = URL.createObjectURL(
    new Blob(["<!doctype html>\n" + doc.documentElement.outerHTML], {
      type: "text/html;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "index.html";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
