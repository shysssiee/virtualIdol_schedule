/* Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039 */
/* Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070 */

export function createToasts(root) {

  var zone = root.querySelector('.u070-zone'), empty = root.querySelector('.u070-empty'), live = root.querySelector('.u070-live');
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICON = { ok: '<svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg>', err: '<svg viewBox="0 0 18 18"><path d="M9 5v5M9 13h.01"/></svg>', info: '<svg viewBox="0 0 18 18"><path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>', wait: '<i></i>' };
  var K = {ok:['var(--ux-mint)','更新成功',''],err:['var(--ux-danger)','操作失敗',''],info:['var(--ux-accent)','通知','']};
  var list = [], open = false, DUR = 4500, seq = 0;
  function layout() {
    var acc = 0;
    list.forEach(function (t, i) {
      var el = t.el;
      el.classList.toggle('back', !open && i > 0);
      if (open) { el.style.setProperty('--y', -acc + 'px'); el.style.setProperty('--s', 1); el.style.setProperty('--o', 1); acc += el.offsetHeight + 8; }
      else { el.style.setProperty('--y', -(i * 14) + 'px'); el.style.setProperty('--s', (1 - i * 0.06).toFixed(2)); el.style.setProperty('--o', i > 2 ? 0 : 1); }
      el.style.zIndex = 50 - i;
      el.inert = !open && i > 0;
    });
    empty.style.opacity = list.length ? '0' : '1';
  }
  function remove(t, dir) {
    var i = list.indexOf(t);
    if (i < 0) return;
    list.splice(i, 1);
    t.el.classList.add('leave');
    if (dir) { t.el.style.setProperty('--dir', dir); t.el.classList.add('side'); }
    setTimeout(function () { t.el.remove(); }, 450);
    layout();
  }
  function push(message, k = "info") {
    var d = [...K[k]]; d[2] = String(message); var el = document.createElement('div');
    el.className = 'u070-t enter';
    el.style.setProperty('--c', d[0]);
    el.setAttribute('role', k === 'err' ? 'alert' : 'status');
    el.innerHTML = '<span class="u070-ic" aria-hidden="true">' + ICON[k] + '</span><span class="u070-tx"><b></b><small></small></span>' + (d[3] ? '<button class="u070-act" type="button"></button>' : '') + '<button class="u070-x" type="button" aria-label="Dismiss"><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span class="u070-bar" aria-hidden="true"></span>';
    el.querySelector('b').textContent = d[1]; el.querySelector('small').textContent = d[2];
    if (d[3]) el.querySelector('.u070-act').textContent = d[3];
    var t = { el: el, left: DUR, id: ++seq, k: k };
    zone.appendChild(el);
    list.unshift(t);
    if(list.length > 5) remove(list[list.length - 1]);
    void el.offsetWidth;
    el.classList.remove('enter');
    layout();
    live.textContent = d[1] + '：' + d[2];
    el.querySelector('.u070-x').setAttribute('aria-label','關閉通知');
    el.querySelector('.u070-x').addEventListener('click', function () { remove(t); });
    if (d[3]) el.querySelector('.u070-act').addEventListener('click', function () { remove(t); if (k === 'err') push('wait'); });
    var sx = 0, dx = 0, down = false;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; down = true; sx = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
    el.addEventListener('pointermove', function (e) { if (!down) return; dx = e.clientX - sx; el.style.setProperty('--dx', dx + 'px'); el.style.setProperty('--o', Math.max(0.2, 1 - Math.abs(dx) / 260)); });
    var end = function () { if (!down) return; down = false; el.classList.remove('drag'); if (Math.abs(dx) > 90) remove(t, dx > 0 ? 1 : -1); else { el.style.setProperty('--dx', '0px'); layout(); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  var last = performance.now();
  (function loop(now) {
    if (!root.isConnected) return;
    var dt = now - last; last = now;
    if (!open) list.slice().forEach(function (t, i) {
      if (i > 0 || t.left === Infinity) return;
      t.left -= dt;
      t.el.style.setProperty('--left', Math.max(0, t.left / DUR).toFixed(3));
      if (t.left <= 0) remove(t);
    });
    requestAnimationFrame(loop);
  })(last);
  function setOpen(v) { if (open === v) return; open = v; layout(); }
  zone.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setOpen(true); });
  zone.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !zone.contains(document.activeElement)) setOpen(false); });
  zone.addEventListener('focusin', function () { setOpen(true); });
  zone.addEventListener('focusout', function (e) { if (!zone.contains(e.relatedTarget)) setOpen(false); });
  zone.addEventListener('click', function (e) { if (!e.target.closest('button') && list.length > 1) setOpen(!open); });
  return push;
}

export function syncTabs(root, value) {
 const tabs=[...root.querySelectorAll('[data-view]')];
 tabs.forEach(t=>{const active=t.dataset.view===value;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
 const selected=tabs.find(t=>t.dataset.view===value), pill=root.querySelector('.u039-pill');
 if(selected&&pill){pill.style.setProperty('--x',selected.offsetLeft+'px');pill.style.setProperty('--w',selected.offsetWidth+'px');}
}
export function bindTabs(root, onSelect) {
 root.addEventListener('keydown',e=>{
  const tabs=[...root.querySelectorAll('[data-view]')], index=tabs.indexOf(e.target);
  if(index<0)return;
  const dir=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:dir?(index+dir+tabs.length)%tabs.length:-1;
  if(next<0)return;e.preventDefault();tabs[next].focus();onSelect(tabs[next].dataset.view);
 });
 new ResizeObserver(()=>syncTabs(root,root.querySelector('[aria-selected="true"]')?.dataset.view)).observe(root);
}
