import test from "node:test";
import assert from "node:assert/strict";
import { dayKey, end, isLive, layout, escape } from "../docs/calendar.js";
const event = (id, start, finish = null) => ({
  id,
  start_at: `2026-10-09T${start}:00+08:00`,
  end_at: finish ? `2026-10-09T${finish}:00+08:00` : null,
  status: "scheduled",
});
test("Taiwan date handles UTC date boundary", () =>
  assert.equal(dayKey("2026-10-08T17:00:00Z"), "2026-10-09"));
test("Live window begins at start and ends after two hours", () => {
  const e = event("a", "20:00");
  const start = Date.parse(e.start_at);
  assert.equal(isLive(e, start - 1), false);
  assert.equal(isLive(e, start), true);
  assert.equal(isLive(e, start + 7200000 - 1), true);
  assert.equal(isLive(e, start + 7200000), false);
  assert.equal(isLive({ ...e, status: "cancelled" }, start), false);
  assert.equal(isLive({ ...e, status: "ended" }, start), false);
});
test("Explicit finish can shorten but cannot lengthen reminder", () => {
  assert.equal(
    end(event("a", "20:00", "21:00")),
    Date.parse("2026-10-09T21:00:00+08:00"),
  );
  assert.equal(
    end(event("a", "20:00", "23:00")),
    Date.parse("2026-10-09T22:00:00+08:00"),
  );
});
test("Overlapping streams never share a column; next cluster resets", () => {
  const result = layout([
    event("a", "20:00"),
    event("b", "20:30"),
    event("c", "21:00"),
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
