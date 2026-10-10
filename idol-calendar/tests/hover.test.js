import test from "node:test";
import assert from "node:assert/strict";
import { createHoverPanel } from "../docs/hover.js";
function fixture() {
  let callback;
  const timers = {
    setTimeout(fn) {
      callback = fn;
      return 1;
    },
    clearTimeout() {
      callback = undefined;
    },
  };
  const panel = {
    hidden: false,
    hover: false,
    focus: false,
    ownerDocument: { activeElement: null },
    matches() {
      return this.hover;
    },
    contains() {
      return this.focus;
    },
  };
  return {
    panel,
    controller: createHoverPanel(panel, timers),
    tick() {
      const fn = callback;
      callback = undefined;
      fn?.();
    },
  };
}
test("Moving from a card into its panel cancels delayed dismissal", () => {
  const f = fixture();
  f.controller.leave();
  f.panel.onmouseenter();
  f.tick();
  assert.equal(f.panel.hidden, false);
  f.panel.onmouseleave();
  f.tick();
  assert.equal(f.panel.hidden, true);
});
test("Focused links retain the panel, and explicit close always closes it", () => {
  const f = fixture();
  f.panel.focus = true;
  f.controller.leave();
  f.tick();
  assert.equal(f.panel.hidden, false);
  f.controller.hide();
  assert.equal(f.panel.hidden, true);
});
