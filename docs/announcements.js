import {escape as esc} from './calendar.js?v=1.4-20261101b';
import {normalizeAnnouncements,pendingAnnouncements,hideAnnouncementsToday} from './announcement-core.js?v=1.4-20261101b';
export function announcementArticles(rows) {
  return rows.map(row=>`<article class="announcement-article"><h3 data-user-content>${esc(row.title)}</h3><p data-user-content>${esc(row.body)}</p></article>`).join('');
}
export function initEntryAnnouncements({settings,blocked}) {
  let storage;
  try { storage = localStorage; } catch {}
  const rows = pendingAnnouncements(settings.popup_announcements,storage);
  if (!rows.length) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'entry-announcement';
  dialog.className = 'announcement-dialog';
  dialog.setAttribute('aria-labelledby','entry-announcement-title');
  dialog.innerHTML = `<div class="announcement-heading"><h2 id="entry-announcement-title">網站公告</h2></div><div class="announcement-content">${announcementArticles(rows)}<p class="error" id="announcement-storage-error" role="status"></p></div><div class="announcement-actions"><button type="button" id="announcement-hide-today">今日不再顯示</button><button type="button" class="primary" id="announcement-close">關閉</button></div>`;
  document.body.append(dialog);
  let shown = false;
  function attempt() {
    if (shown || document.hidden || blocked() || document.querySelector('dialog[open]')) return;
    shown = true;
    dialog.showModal();
    document.removeEventListener('close',attempt,true);
    document.removeEventListener('visibilitychange',attempt);
  }
  dialog.querySelector('#announcement-close').onclick = () => dialog.close();
  dialog.querySelector('#announcement-hide-today').onclick = () => {
    if (hideAnnouncementsToday(rows,storage)) dialog.close();
    else dialog.querySelector('#announcement-storage-error').textContent = '無法保存今日隱藏設定，請允許瀏覽器儲存資料；仍可按關閉。';
  };
  document.addEventListener('close',attempt,true);
  document.addEventListener('visibilitychange',attempt);
  attempt();
}
export function announcementPage(root,{getData,getUser,persist,refresh,show,toast}) {
  if (getUser()?.role !== 'owner') return;
  const settings = getData().site_settings[0] || {};
  if (!Array.isArray(settings.popup_announcements)) {
    root.innerHTML='<h1>進站公告</h1><p>請先在 Supabase SQL Editor 執行更新包中的 upgrade-v1.4-announcements.sql，再重新整理後台。</p>';
    return;
  }
  const rows = normalizeAnnouncements(settings.popup_announcements);
  let editing = null;
  root.innerHTML=`<h1>進站公告</h1><p class="muted">只有啟用的公告會在進入網站時顯示。今日不再顯示以台灣日期計算，只保存在訪客目前裝置；修改公告內容後會重新提醒。</p><form id="announcement-form" class="settings-card"><h2 id="announcement-form-title">新增公告</h2><label>公告標題<input name="title" required maxlength="100"></label><label>公告內容<textarea name="body" required maxlength="3000" rows="7"></textarea></label><label class="announcement-enabled"><input type="checkbox" name="enabled"> 啟用公告</label><div class="actions"><button class="primary" type="submit">儲存公告</button><button type="button" id="announcement-preview">預覽公告</button><button type="button" id="announcement-reset">取消</button></div><p class="error" id="announcement-error" role="status"></p></form><div class="announcement-list">${rows.map(row=>`<article class="settings-card"><h2 data-user-content>${esc(row.title)}</h2><p>${row.enabled?'已啟用':'已停用'}</p><p class="announcement-list-body" data-user-content>${esc(row.body)}</p><div class="actions"><button type="button" data-announcement-edit="${esc(row.id)}">編輯公告</button><button type="button" data-announcement-delete="${esc(row.id)}">刪除公告</button></div></article>`).join('')||'<p>尚無公告</p>'}</div>`;
  const form = root.querySelector('#announcement-form');
  const error = root.querySelector('#announcement-error');
  function draft() {
    const values = new FormData(form);
    const row = {id:editing || crypto.randomUUID(),title:String(values.get('title')||'').trim(),body:String(values.get('body')||'').trim(),enabled:values.has('enabled')};
    if (!normalizeAnnouncements([row]).length) throw Error('請填寫公告標題（100字內）與內容（3000字內）。');
    return row;
  }
  async function commit(next) {
    if (getUser()?.role !== 'owner') throw Error('僅站主可管理公告。');
    await persist(next,settings.popup_announcements);
    await refresh();
    announcementPage(root,{getData,getUser,persist,refresh,show,toast});
    toast('公告更新成功');
  }
  form.onsubmit=async e=>{
    e.preventDefault(); error.textContent='';
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try {
      const row=draft();
      if (!editing && rows.length>=50) throw Error('最多保留50則公告，請先刪除不需要的公告。');
      await commit(editing?rows.map(old=>old.id===editing?row:old):[row,...rows]);
    } catch(e) {error.textContent=e.message;} finally {button.disabled=false;}
  };
  root.querySelector('#announcement-preview').onclick=()=>{
    try {error.textContent='';show(`<h2>公告預覽</h2>${announcementArticles([draft()])}<p class="muted">預覽不會儲存或發布公告。</p>`);}catch(e){error.textContent=e.message;}
  };
  root.querySelector('#announcement-reset').onclick=()=>{
    editing=null;form.reset();error.textContent='';root.querySelector('#announcement-form-title').textContent='新增公告';
  };
  root.querySelectorAll('[data-announcement-edit]').forEach(button=>button.onclick=()=>{
    const row=rows.find(row=>row.id===button.dataset.announcementEdit);editing=row.id;
    form.elements.title.value=row.title;form.elements.body.value=row.body;form.elements.enabled.checked=row.enabled;
    root.querySelector('#announcement-form-title').textContent='編輯公告';error.textContent='';
    form.scrollIntoView({block:'start'});form.elements.title.focus({preventScroll:true});
  });
  root.querySelectorAll('[data-announcement-delete]').forEach(button=>button.onclick=async()=>{
    if (!confirm('確定刪除這則公告？')) return;
    button.disabled=true;
    try {await commit(rows.filter(row=>row.id!==button.dataset.announcementDelete));}
    catch(e){error.textContent=e.message;button.disabled=false;}
  });
}
