import test from "node:test";
import assert from "node:assert/strict";
import { isOnline } from "../docs/presence.js";
import { lunarLabel, holidayLabel } from "../docs/almanac.js";
test("Presence expires and is scoped to the actual user; other sessions preserve online status", () => {
  const now = Date.parse("2026-10-10T00:00:00Z");
  const rows = [
    { user_id: "a", last_seen: new Date(now - 100000).toISOString() },
    { user_id: "a", last_seen: new Date(now - 20000).toISOString() },
  ];
  assert.equal(isOnline(rows, "a", now), true);
  assert.equal(isOnline(rows, "a", now + 95000), false);
  assert.equal(isOnline(rows, "b", now), false);
});
test("Korean calendar retains Korean calculation but labels dates and leap months in Traditional Chinese", () => {
  assert.equal(
    lunarLabel({ month: 8, day: 30, intercalation: false }),
    "韓曆八月三十",
  );
  assert.equal(
    lunarLabel({ month: 6, day: 1, intercalation: true }),
    "韓曆閏六月初一",
  );
  assert.equal(holidayLabel("개천절 (대체공휴일)"), "開天節 (補假)");
  assert.equal(holidayLabel("3·1절"), "三一節");
});
