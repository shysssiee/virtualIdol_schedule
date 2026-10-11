import { parseBatch, prepareRow } from './batch-import-core.js';
import { escape as esc } from './calendar.js';
import { save } from './data.js';

export function batchImportPage(root, { getData, getUser, refresh }) {
  if (getUser()?.role !== 'owner') return;
  let rows = [], busy = false;
  root.innerHTML = `<h1>待新增行程匯入</h1><p>上傳查詢整理的 JSON 檔，確認官方公告與台灣時間，再勾選儲存。待確認與重複場次不會自動發布。</p><div class="actions"><button id="batch-template">下載空白範本</button><label>選擇匯入檔<input id="batch-file" type="file" accept=".json,application/json"></label></div><p class="muted">時間一律為台灣 UTC+8；成員可留空。平台留空時，來源只保存在行程說明，不當作直播連結。</p><p id="batch-message" role="status"></p><div id="batch-preview" style="overflow-x:auto"></div><button id="batch-save" class="primary" disabled>儲存勾選行程</button>`;
  const q = s => root.querySelector(s);
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
  }
  function render() {
    const data = getData();
    q('#batch-preview').innerHTML = `<table><thead><tr><th>新增</th><th>團體／成員</th><th>標題／來源</th><th>台灣日期／時間</th><th>確認與檢查</th></tr></thead><tbody>${rows.map((r, i) => `<tr data-row="${i}"><td><input type="checkbox" data-pick="${i}" aria-label="新增第 ${i+1} 筆"></td><td><select data-field="group" aria-label="團體"><option value="">選擇團體</option>${data.groups.map(g => `<option value="${esc(g.name)}" ${r.group === g.name ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select><input data-field="members" aria-label="成員，以逗號分隔" placeholder="成員，可留空" value="${esc(r.members.join(', '))}"></td><td><input data-field="title" aria-label="標題" maxlength="160" value="${esc(r.title)}" placeholder="空白使用團體 LIVE"><input data-field="source" aria-label="官方來源網址" type="url" value="${esc(r.source)}"><select data-field="platform" aria-label="直播平台"><option value="">來源僅放說明</option>${data.platforms.map(p => `<option value="${esc(p.name)}" ${p.name === r.platform ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td><td><input data-field="date" aria-label="台灣日期" type="date" value="${esc(r.date)}"><input data-field="time" aria-label="台灣時間" type="time" value="${esc(r.time)}"></td><td><label><input data-field="confirmed" type="checkbox" ${r.confirmed ? 'checked' : ''}>已確認公告與時間</label><p data-check="${i}"></p><p data-result="${i}" role="status"></p></td></tr>`).join('')}</tbody></table>`;
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
    root.querySelectorAll('input,select,button').forEach(el => el.disabled = true);
    let count = 0;
    try {
      await refresh();
      const seen = [...getData().events];
      for (const i of picks) {
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
      await refresh(); message(`本次已儲存 ${count} 筆。未儲存的項目請檢查後重試。`);
    } catch (error) { message(`已儲存 ${count} 筆；${error.message}`); }
    finally {
      busy = false;
      root.querySelectorAll('input,select,button').forEach(el => el.disabled = false);
      root.querySelectorAll('[data-row]').forEach(tr => {
        if (rows[Number(tr.dataset.row)].saved) tr.querySelectorAll('[data-field]').forEach(el => el.disabled = true);
      });
      updateChecks();
    }
  };
}
