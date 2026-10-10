// Keep the panel open while the pointer crosses the gap or a link has focus.
export function createHoverPanel(panel, timers = globalThis) {
  let pending;
  const cancel = () => {
    timers.clearTimeout(pending);
    pending = undefined;
  };
  const hide = () => {
    cancel();
    panel.hidden = true;
  };
  const leave = () => {
    cancel();
    pending = timers.setTimeout(() => {
      if (
        !panel.matches(":hover") &&
        !panel.contains(panel.ownerDocument.activeElement)
      )
        hide();
    }, 350);
  };
  panel.onmouseenter = cancel;
  panel.onmouseleave = leave;
  panel.onfocusin = cancel;
  panel.onfocusout = leave;
  return { cancel, hide, leave };
}
