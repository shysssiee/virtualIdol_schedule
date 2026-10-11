import { parseBatch, prepareRow } from './batch-import-core.js?v=1.4-batch4';
import { escape as esc } from './calendar.js';
import { save } from './data.js';

export function batchImportPage(root, { getData, getUser, refresh, onComplete = () => {} }) {
  if (getUser()?.role !== 'owner') return;
  let rows = [], busy = false;
  root.innerHTML = `<h1>待新增行程匯入</h1><p>上傳查詢整理的 JSON 檔，確認官方公告與台灣時間，再勾選儲存。待確認與重複場次不會自動發布。</p><div class="actions"><button id="batch-template">下載空白範本</button><label>選擇匯入檔<input id="batch-file" type="file" accept=".json,application/json"></label></div><p class="muted">時間一律為台灣 UTC+8；成員可留空。YouTube、X 貼文／Space、Weverse 單場直播網址會自動建立直播按鈕；其他來源僅放說明。也可選擇「來源僅放說明」。</p><p id="batch-message" role="status"></p><div id="batch-preview" style="overflow-x:auto"></div><button id="batch-save" class="primary" disabled>儲存勾選行程</button>`;
  const q = s => root.querySelector(s);
  const controls = document.createElement('div');
  controls.className = 'actions';
  controls.innerHTML = '<button id="batch-all" disabled>全選</button><button id="batch-none" disabled>取消全選</button><span id="batch-selection" role="status"></span>';
  q('#batch-preview').before(controls);
  const message = text => { q('#batch-message').textContent = text; };
  function checks() {
    const seen = [...getData().events];
    return rows.map(row => {
      if (row.saved) return { errors: ['已儲存'] };
      const result = prepareRow(row, getData(), seen);
      if (!result.errors.length) seen.push(result.item);
      return result;
    });
  }
  function updateChecks() {
    const results = checks();
    results.forEach((result, i) => {
      const box = q(`[data-pick="${i}"]`);
      box.disabled = busy || !!result.errors.length;
      if (box.disabled) box.checked = false;
      q(`[data-check="${i}"]`).textContent = result.errors.join('；') || '可新增';
    });
    q('#batch-save').disabled = busy || !root.querySelector('[data-pick]:checked');
    const eligible = [...root.querySelectorAll('[data-pick]')].filter(box => !box.disabled);
    const selected = eligible.filter(box => box.checked).length;
    q('#batch-all').disabled = busy || !eligible.length || selected === eligible.length;
    q('#batch-none').disabled = busy || !selected;
    q('#batch-selection').textContent = `已勾選 ${selected}／${eligible.length} 筆可新增行程`;
  }
  q('#batch-all').onclick = () => {
    if (busy) return;
    root.querySelectorAll('[data-pick]').forEach(box => { if (!box.disabled) box.checked = true; });
    updateChecks();
  };
  q('#batch-none').onclick = () => {
    if (busy) return;
    root.querySelectorAll('[data-pick]').forEach(box => { box.checked = false; });
    updateChecks();
  };
  function success(count) {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'batch-success-title');
    dialog.innerHTML = `<h2 id="batch-success-title">更新成功</h2><p>已成功新增 ${count} 筆行程。</p><button class="primary" autofocus>返回行程管理</button>`;
    document.body.append(dialog);
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { dialog.remove(); onComplete(); }, { once: true });
    dialog.showModal();
  }
  function render() {
    const data = getData();
    q('#batch-preview').innerHTML = `<table><thead><tr><th>新增</th><th>團體／成員</th><th>標題／來源</th><th>台灣日期／時間</th><th>確認與檢查</th></tr></thead><tbody>${rows.map((r, i) => `<tr data-row="${i}"><td><input type="checkbox" data-pick="${i}" aria-label="新增第 ${i+1} 筆"></td><td><select data-field="group" aria-label="團體"><option value="">選擇團體</option>${data.groups.map(g => `<option value="${esc(g.name)}" ${r.group === g.name ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select><input data-field="members" aria-label="成員，以逗號分隔" placeholder="成員，可留空" value="${esc(r.members.join(', '))}"></td><td><input data-field="title" aria-label="標題" maxlength="160" value="${esc(r.title)}" placeholder="空白使用團體 LIVE"><input data-field="source" aria-label="官方來源網址" type="url" value="${esc(r.source)}"><select data-field="platform" aria-label="直播平台"><option value="">自動辨識直播平台／其他來源僅放說明</option><option value="source-only" ${r.platform === 'source-only' ? 'selected' : ''}>來源僅放說明</option>${data.platforms.map(p => `<option value="${esc(p.name)}" ${p.name === r.platform ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td><td><input data-field="date" aria-label="台灣日期" type="date" value="${esc(r.date)}"><input data-field="time" aria-label="台灣時間" type="time" value="${esc(r.time)}"></td><td><label><input data-field="confirmed" type="checkbox" ${r.confirmed ? 'checked' : ''}>已確認公告與時間</label><p data-check="${i}"></p><p data-result="${i}" role="status"></p></td></tr>`).join('')}</tbody></table>`;
    root.querySelectorAll('[data-row]').forEach(tr => {
      const row = rows[Number(tr.dataset.row)];
      tr.querySelectorAll('[data-field]').forEach(input => {
        input.disabled = !!row.saved;
        input.onchange = () => {
          const field = input.dataset.field;
          row[field] = field === 'confirmed' ? input.checked : field === 'members' ? input.value.split(/[,，]/).map(x => x.trim()).filter(Boolean) : input.value;
          updateChecks();
        };
      });
    });
    root.querySelectorAll('[data-pick]').forEach(box => box.onchange = updateChecks);
    updateChecks();
  }
  q('#batch-template').onclick = () => {
    const blob = new Blob([JSON.stringify({version:1, events:[{group:'',title:'',date:'',time:'',source:'',platform:'',members:[],confirmed:false}]}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = '待新增行程範本.json'; a.click(); URL.revokeObjectURL(url);
  };
  q('#batch-file').onchange = async e => {
    if (busy) return;
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 256000) throw Error('檔案不能超過 256 KB。');
      const next = parseBatch(await file.text());
      rows = next; render(); message(`已讀取 ${rows.length} 筆，請檢查並勾選要儲存的場次。`);
    } catch (error) { rows = []; render(); message(error.message); }
  };
  q('#batch-save').onclick = async () => {
    if (busy || getUser()?.role !== 'owner') return;
    const picks = [...root.querySelectorAll('[data-pick]:checked')].map(b => Number(b.dataset.pick));
    if (!picks.length) return;
    busy = true;
    q('#batch-save').textContent = '儲存中…';
    message(`正在儲存 ${picks.length} 筆，請稍候…`);
    root.querySelectorAll('input,select,button').forEach(el => el.disabled = true);
    let count = 0, completed = false;
    try {
      await refresh();
      const seen = [...getData().events];
      for (const i of picks) {
        message(`正在處理第 ${picks.indexOf(i) + 1}／${picks.length} 筆，已儲存 ${count} 筆…`);
        if (getUser()?.role !== 'owner') throw Error('站主登入已失效，請重新登入。');
        const result = prepareRow(rows[i], getData(), seen);
        try {
          if (result.errors.length) throw Error(result.errors.join('；'));
          const item = {...result.item, id: crypto.randomUUID(), created_by: getUser().id};
          await save('events', item);
          seen.push(item); rows[i].saved = true; count++;
          q(`[data-result="${i}"]`).textContent = '儲存成功';
        } catch (error) { q(`[data-result="${i}"]`).textContent = `未儲存：${error.message}`; }
      }
      await refresh();
      completed = count === picks.length;
      message(completed ? `更新成功！已新增 ${count} 筆行程。` : `已儲存 ${count} 筆；${picks.length - count} 筆未儲存，請依各列提示修正後重試。`);
    } catch (error) { message(`已儲存 ${count} 筆；${error.message}`); }
    finally {
      busy = false;
      q('#batch-save').textContent = '儲存勾選行程';
      root.querySelectorAll('input,select,button').forEach(el => el.disabled = false);
      root.querySelectorAll('[data-row]').forEach(tr => {
        if (rows[Number(tr.dataset.row)].saved) tr.querySelectorAll('[data-field]').forEach(el => el.disabled = true);
      });
      updateChecks();
    }
    if (completed) success(count);
  };
}
