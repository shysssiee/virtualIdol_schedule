const config = window.CALENDAR_CONFIG || {};
export const authFlow = /type=(invite|recovery)/.test(location.hash);
export const configured = Boolean(
  config.supabaseUrl && config.supabasePublishableKey,
);
export let client;
if (configured) {
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2.57.4"
  );
  client = createClient(config.supabaseUrl, config.supabasePublishableKey);
}
const groups = [
  { id: "aurora", name: "AURORA", color: "#9678ca" },
  { id: "orbit", name: "ORBIT", color: "#d16d98" },
  { id: "lumi", name: "LUMI", color: "#448ba5" },
];
const members = [
  { id: "a1", group_id: "aurora", name: "星野奈奈" },
  { id: "a2", group_id: "aurora", name: "月城澪" },
  { id: "o1", group_id: "orbit", name: "桃音" },
  { id: "l1", group_id: "lumi", name: "光羽" },
];
groups.forEach((g, index) => {
  g.category_ids = ["chat", "game"];
  g.platform_ids = index === 2 ? ["youtube"] : ["youtube", "twitch"];
  g.sort_order = index;
});
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Taipei",
}).format(new Date());
const date = new Date(today + "T12:00:00+08:00");
const events = Array.from({ length: 20 }, (_, i) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + i - 8);
  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
  }).format(d);
  return {
    id: "demo" + i,
    group_id: groups[i % 3].id,
    member_ids: i % 3 === 0 ? ["a1"] : [],
    category_id: i % 2 ? "chat" : "game",
    title: [
      "一起來玩！週末遊戲夜",
      "深夜雜談 · 今天也辛苦了",
      "歌回｜把星光唱給你",
      "全員集合！特別企劃",
    ][i % 4],
    start_at: day + "T" + (i % 3 === 0 ? "20" : "21") + ":00:00+08:00",
    end_at: null,
    status: "scheduled",
    description: "這是介面示範行程，並非真實直播。",
    links: [{ platform_id: "youtube", url: "https://www.youtube.com/" }],
    created_by: "demo",
  };
});
export async function loadData() {
  if (!configured)
    return {
      groups,
      members,
      categories: [
        { id: "chat", name: "雜談" },
        { id: "game", name: "遊戲" },
      ],
      platforms: [
        { id: "youtube", name: "YouTube" },
        { id: "twitch", name: "Twitch" },
      ],
      events,
      site_settings: [{ singleton: true, name: "星曆" }],
    };
  const tables = [
    "groups",
    "members",
    "categories",
    "platforms",
    "events",
    "site_settings",
  ];
  const result = await Promise.all(
    tables.map(async (table) => {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        let query = client.from(table).select("*");
        if (table === "events") query = query.order("start_at").order("id");
        else if (table !== "site_settings")
          query = query.order("sort_order").order("name").order("id");
        const { data, error } = await query.range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    }),
  );
  return Object.fromEntries(tables.map((t, i) => [t, result[i]]));
}
export async function profile() {
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !data.active || data.revoked) return null;
  return { ...data, email: user.email };
}
export async function save(table, value) {
  const { error } = await client
    .from(table)
    .upsert(value)
    .select("id")
    .single();
  if (error) throw error;
}
export async function remove(table, id) {
  const { error } = await client
    .from(table)
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

export async function loadProfiles() {
  if (!client) return [];
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .order("display_name")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
