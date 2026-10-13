import { client } from './data.js';
import { escape as esc } from './calendar.js';
export async function showAnniversaryHistory(id,data) {
 const dialog=document.createElement('dialog');
 dialog.innerHTML='<h2>生日／紀念日修改紀錄</h2><button type="button">關閉</button><div class="ann-history">讀取中…</div>';
 document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 const target=dialog.querySelector('.ann-history');
 const fields={group_id:'團體',member_id:'成員',kind:'類型',name:'名稱',original_date:'日期',year_unknown:'出生年份未知'};
 const text=(key,value)=>value==null?'無':key==='group_id'?data.groups.find(x=>x.id===value)?.name||'已移除團體':key==='member_id'?data.members.find(x=>x.id===value)?.name||'已移除成員':key==='kind'?({birthday:'生日',debut:'出道日',anniversary:'紀念日'}[value]||value):key==='year_unknown'?(value?'是':'否'):String(value);
 try {
  const {data:rows,error}=await client.rpc('anniversary_change_history',{target_anniversary:id});if(error)throw error;
  if(!target.isConnected)return;
  target.innerHTML=(rows||[]).map(row=>`<article class="record"><strong>${esc(row.nickname)} · ${esc(new Date(row.changed_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}))}</strong><p>${{INSERT:'新增',UPDATE:'修改',DELETE:'刪除'}[row.action]||'異動'}</p>${Object.entries(fields).filter(([key])=>JSON.stringify(row.before?.[key])!==JSON.stringify(row.after?.[key])).map(([key,label])=>`<p>${label}：${esc(text(key,row.before?.[key]))} → ${esc(text(key,row.after?.[key]))}</p>`).join('')}</article>`).join('')||'尚無修改紀錄；安裝本次 SQL 後開始記錄，不會推測舊資料的修改歷程。';
 }catch(e){if(target.isConnected)target.textContent='無法讀取修改紀錄，請確認本次 SQL 已執行。'+e.message;}
}
