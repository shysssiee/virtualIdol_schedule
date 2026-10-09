import test from "node:test";
import assert from "node:assert/strict";
import {
  fromLocal,
  localInput,
  dayBounds,
  civilDate,
  dateKey,
} from "../docs/timezone.js";
import { dayEvents, setZone, end } from "../docs/calendar.js";
test("A skipped midnight still renders the full local date", () => {
  const [a, b] = dayBounds("2026-09-06", "America/Santiago");
  assert.equal(dateKey(a, "America/Santiago"), "2026-09-06");
  assert.equal(dateKey(a - 1000, "America/Santiago"), "2026-09-05");
  assert.equal(b - a, 23 * 3600000);
});
test("Korean announcement converts to the same absolute instant and retains input format", () => {
  const instant = fromLocal("2026-10-10T20:00", "Asia/Seoul");
  assert.equal(instant.toISOString(), "2026-10-10T11:00:00.000Z");
  assert.equal(localInput(instant, "Asia/Taipei"), "2026-10-10T19:00");
  assert.equal(localInput(instant, "Asia/Seoul"), "2026-10-10T20:00");
});
test("Reader timezone changes dates across the date line", () => {
  const instant = "2026-10-09T17:00:00Z";
  assert.equal(dateKey(instant, "Asia/Seoul"), "2026-10-10");
  assert.equal(dateKey(instant, "America/Los_Angeles"), "2026-10-09");
});
test("Midnight does not remove past, cancelled or future events", () => {
  setZone("Asia/Taipei");
  const events = ["scheduled", "ended", "cancelled"].map((status, i) => ({
    id: String(i),
    status,
    start_at: "2026-10-09T23:00:00+08:00",
    end_at: "2026-10-10T02:00:00+08:00",
  }));
  assert.equal(dayEvents(events, civilDate("2026-10-09")).length, 3);
  assert.equal(dayEvents(events, civilDate("2026-10-10")).length, 3);
  assert.equal(dayEvents(events, civilDate("2026-10-11")).length, 0);
  assert.equal(
    dayEvents(
      [{ ...events[0], start_at: "2030-01-01T20:00:00+08:00", end_at: null }],
      civilDate("2030-01-01"),
    ).length,
    1,
  );
});
test("Exclusive end at midnight does not spill into the following day", () => {
  setZone("Asia/Taipei");
  assert.equal(
    dayEvents(
      [{ start_at: "2026-10-09T20:00:00+08:00", end_at: null }],
      civilDate("2026-10-10"),
    ).length,
    0,
  );
});
test("DST day bounds support 23 and 25 hour days", () => {
  for (const [key, hours] of [
    ["2026-03-08", 23],
    ["2026-11-01", 25],
  ]) {
    const [a, b] = dayBounds(key, "America/New_York");
    assert.equal(b - a, hours * 3600000);
  }
});
test("The four hour cap measures elapsed time across a timezone change", () => {
  const e = {
    start_at: fromLocal("2026-10-10T22:00", "Asia/Seoul").toISOString(),
    end_at: null,
  };
  assert.equal(end(e) - Date.parse(e.start_at), 4 * 3600000);
});
