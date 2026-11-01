// Phone navigation uses the existing controls and data; no parallel forms or state.
export function initMobileShell({ onToday, onCalendar }) {
  const phone = matchMedia('(max-width:700px)');
  const body = document.body;
  const filters = document.querySelector('#filter-panel');
  const account = document.querySelector('header .account');
  const filterHome = document.createComment('filter home');
  const accountHome = document.createComment('account home');
  filters.before(filterHome);
  account.before(accountHome);
  body.insertAdjacentHTML('beforeend', `
    <nav id="mobile-nav" aria-label="手機導覽">
      <button type="button" data-mobile-page="calendar"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/></svg><span>行事曆</span></button>
      <button type="button" data-mobile-page="today"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>今日</span></button>
      <button type="button" data-mobile-sheet="filters" aria-haspopup="dialog" aria-controls="mobile-filters"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg><span>篩選</span></button>
      <button type="button" data-mobile-sheet="more" aria-haspopup="dialog" aria-controls="mobile-more"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><span>更多</span></button>
    </nav>
    <dialog id="mobile-filters" class="mobile-sheet" aria-labelledby="mobile-filter-title">
      <div class="sheet-heading"><h2 id="mobile-filter-title">團體與平台篩選</h2><button type="button" class="sheet-close" aria-label="關閉">×</button></div>
      <div class="sheet-content" id="mobile-filter-content"></div>
      <div class="sheet-footer"><button type="button" class="primary" id="mobile-apply">套用篩選</button></div>
    </dialog>
    <dialog id="mobile-more" class="mobile-sheet" aria-labelledby="mobile-more-title">
      <div class="sheet-heading"><h2 id="mobile-more-title">更多</h2><button type="button" class="sheet-close" aria-label="關閉">×</button></div>
      <div class="sheet-content"><button type="button" id="mobile-history">過往紀錄</button><div id="mobile-account"></div></div>
    </dialog>`);
  const nav = document.querySelector('#mobile-nav');
  const filterDialog = document.querySelector('#mobile-filters');
  const moreDialog = document.querySelector('#mobile-more');
  let current = 'today';
  const positions = { today: 0, calendar: 0 };
  let locked = false, scrollY = 0;
  function syncLock() {
    const open = phone.matches && !!document.querySelector('dialog[open]');
    if (open && !locked) {
      scrollY = window.scrollY;
      body.style.setProperty('--sheet-scroll', `-${scrollY}px`);
      body.classList.add('mobile-scroll-lock');
      locked = true;
    } else if (!open && locked) {
      body.classList.remove('mobile-scroll-lock');
      body.style.removeProperty('--sheet-scroll');
      locked = false;
      window.scrollTo(0, scrollY);
    }
  }
  const observer = new MutationObserver(syncLock);
  observer.observe(body, {subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('close',syncLock,true);
  function setPage(page, remember = true) {
    if (remember) positions[current] = window.scrollY;
    current = page;
    body.dataset.mobilePage = page;
    nav.querySelectorAll('[data-mobile-page]').forEach(b => {
      if (b.dataset.mobilePage === page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (phone.matches) requestAnimationFrame(() => window.scrollTo(0, positions[page] || 0));
  }
  function showSheet(dialog) {
    if (!phone.matches) return;
    dialog.showModal();
    syncLock();
  }
  nav.querySelector('[data-mobile-page="today"]').onclick = () => {
    setPage('today');
    onToday();
    document.querySelector('#today-details').open = true;
  };
  nav.querySelector('[data-mobile-page="calendar"]').onclick = () => {
    setPage('calendar');
    onCalendar();
  };
  nav.querySelector('[data-mobile-sheet="filters"]').onclick = () => showSheet(filterDialog);
  nav.querySelector('[data-mobile-sheet="more"]').onclick = () => showSheet(moreDialog);
  document.querySelector('#mobile-apply').onclick = () => filterDialog.close();
  document.querySelector('#mobile-history').onclick = () => {
    moreDialog.close();
    setPage('calendar');
    document.querySelector('#history-nav').click();
  };
  [filterDialog, moreDialog].forEach(d => {
    d.querySelector('.sheet-close').onclick = () => d.close();
    d.addEventListener('click', e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  });
  // Close the account sheet before an existing login/form opens another dialog.
  account.addEventListener('click', e => {
    if (e.target.closest('button') && moreDialog.open) moreDialog.close();
  }, true);
  filters.addEventListener('click', e => {
    if (e.target.closest('[data-history]')) {
      filterDialog.close();
      setPage('calendar');
    }
  }, true);
  function layout() {
    if (phone.matches) {
      document.querySelector('#mobile-filter-content').append(filters);
      document.querySelector('#mobile-account').append(account);
      document.querySelector('#today-details').open = true;
    } else {
      filterDialog.close(); moreDialog.close();
      filterHome.after(filters); accountHome.after(account);
    }
    syncLock();
  }
  phone.addEventListener('change', layout);
  function viewport() {
    body.style.setProperty('--mobile-viewport', `${window.visualViewport?.height || innerHeight}px`);
  }
  window.visualViewport?.addEventListener('resize', viewport);
  viewport();
  setPage('today', false);
  layout();
  return {
    sync({ history, admin }) {
      body.classList.toggle('mobile-admin', admin);
      if (history && current !== 'calendar') setPage('calendar');
    }
  };
}
