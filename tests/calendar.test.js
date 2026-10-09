import test from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  end,
  isLive,
  layout,
  escape,
  MAX_DURATION,
  groupOptions,
} from "../docs/calendar.js";
const event = (id, start, finish = null) => ({
  id,
  start_at: `2026-10-09T${start}:00+08:00`,
  end_at: finish ? `2026-10-09T${finish}:00+08:00` : null,
  status: "scheduled",
});
test("Taiwan date handles UTC date boundary", () =>
  assert.equal(dayKey("2026-10-08T17:00:00Z"), "2026-10-09"));
test("Live window begins at start and ends after four hours", () => {
  const e = event("a", "20:00");
  const start = Date.parse(e.start_at);
  assert.equal(isLive(e, start - 1), false);
  assert.equal(isLive(e, start), true);
  assert.equal(isLive(e, start + MAX_DURATION - 1), true);
  assert.equal(isLive(e, start + MAX_DURATION), false);
  assert.equal(isLive({ ...e, status: "cancelled" }, start), false);
  assert.equal(isLive({ ...e, status: "ended" }, start), false);
});
test("Explicit finish can shorten but cannot lengthen reminder", () => {
  assert.equal(
    end(event("a", "20:00", "21:00")),
    Date.parse("2026-10-09T21:00:00+08:00"),
  );
  assert.equal(
    end({ ...event("a", "20:00"), end_at: "2026-10-10T01:00:00+08:00" }),
    Date.parse("2026-10-10T00:00:00+08:00"),
  );
});
test("Overlapping streams never share a column; next cluster resets", () => {
  const result = layout([
    event("a", "18:00"),
    event("b", "18:30"),
    event("c", "19:00"),
    event("d", "23:00"),
  ]);
  assert.deepEqual(
    result.map((r) => r.columns),
    [3, 3, 3, 1],
  );
  assert.deepEqual(
    result.map((r) => r.column),
    [0, 1, 2, 0],
  );
});
test("Adjacent streams reuse a column", () =>
  assert.deepEqual(
    layout([event("a", "20:00", "21:00"), event("b", "21:00", "22:00")]).map(
      (r) => r.columns,
    ),
    [1, 1],
  ));
test("User text is escaped", () =>
  assert.equal(escape('<script>"&'), "&lt;script&gt;&quot;&amp;"));
test("Group options use only assigned items in their group order", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    groupOptions({ category_ids: ["c", "a"] }, items, "category_ids"),
    [items[2], items[0]],
  );
  assert.deepEqual(
    groupOptions({ category_ids: [] }, items, "category_ids"),
    [],
  );
});
