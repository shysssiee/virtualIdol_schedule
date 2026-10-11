import { prepareRow } from './batch-import-core.js?v=1.4-r3';
import { escape as esc } from './calendar.js';
import { save } from './data.js';

export const MAX_BATCH = 10;
export const blankEntry = () => ({title:'',date:'',time:'',members:[],source:'',platform:'',members_only:false});
export function batchItems(rows, group, data, existing = data.events) {
  if (!group) throw Error('請先選擇團體。');
  if (rows.length > MAX_BATCH) throw Error('一次最多 10 筆。');
  const active = rows.map((row,index)=>({row,index})).filter(({row})=>!row.saved &&
    (row.title.trim() || row.date || row.time || row.source.trim() || row.members.length || row.members_only));
  if (!active.length) throw Error('請至少填寫一筆行程。');
  const seen=[...existing];
  return active.map(({row,index})=>{
    const result=prepareRow({...row,group:group.name,confirmed:true},data,seen,Date.now(),{optionalSource:true});
    if(result.errors.length) throw Error(`第 ${index+1} 筆：${result.errors.join('；')}`);
    result.item.members_only=!!row.members_only;
    seen.push(result.item);
    return {index,item:result.item};
  });
}

export function batchEntryPage(root,{getData,getUser,refresh,onReturn}) {
  const user=getUser();
  if(!['owner','collaborator'].includes(user?.role))return;
  let rows=Array.from({length:3},blankEntry), groupId='',busy=false;
  const q=s=>root.querySelector(s);
  const group=()=>getData().groups.find(g=>g.id===groupId);
  function dialog(title,text,actions,onDismiss=()=>{}){
    const d=document.createElement('dialog');d.className='batch-dialog';
    d.innerHTML=`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions">${actions.map((a,i)=>`<button type="button" data-action="${i}" ${i===0?'class="primary"':''}>${esc(a.label)}</button>`).join('')}</div>`;
    document.body.append(d);
    let run=onDismiss;
    d.querySelectorAll('button').forEach(b=>b.onclick=()=>{run=actions[Number(b.dataset.action)].run;d.close();});
    d.addEventListener('close',()=>{d.remove();run();},{once:true});d.showModal();
  }
  function render(){
    const data=getData(),g=group();
    root.innerHTML=`<div class="batch-entry"><h1>批次匯入行程</h1><p>一次一個團體，最多 10 筆。完全空白列略過；日期與時間使用台灣 UTC+8。</p><label class="batch-group">團體<select id="batch-group"><option value="">請選擇團體</option>${data.groups.map(x=>`<option value="${esc(x.id)}" ${x.id===groupId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><div class="batch-cards">${rows.map((r,i)=>`<section class="batch-card" data-entry="${i}"><div class="batch-card-heading"><h2>第 ${i+1} 筆${r.saved?' · 已儲存':''}</h2><button type="button" data-delete="${i}" ${r.saved?'disabled':''}>刪除此筆</button></div><fieldset ${r.saved?'disabled':''}><label>成員<select data-field="members"><option value="">全團／未指定</option>${data.members.filter(m=>m.group_id===groupId).map(m=>`<option value="${esc(m.name)}" ${r.members.includes(m.name)?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><label>標題<input data-field="title" maxlength="160" value="${esc(r.title)}" placeholder="留空顯示團體 LIVE"></label><label>直播日期<input data-field="date" type="date" value="${esc(r.date)}"></label><label>直播時間<input data-field="time" type="time" value="${esc(r.time)}"></label><label>直播網址（選填）<input data-field="source" type="url" value="${esc(r.source)}" placeholder="https://…"></label><label>直播平台<select data-field="platform"><option value="">自動辨識／無網址</option><option value="source-only" ${r.platform==='source-only'?'selected':''}>來源僅放說明</option>${data.platforms.filter(p=>(g?.platform_ids||[]).includes(p.id)).map(p=>`<option value="${esc(p.name)}" ${r.platform===p.name?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label class="batch-members-only"><input data-field="members_only" type="checkbox" ${r.members_only?'checked':''}>會員限定</label></fieldset><p class="batch-result" role="status">${esc(r.result||'')}</p></section>`).join('')}</div><div class="actions batch-actions"><button id="batch-add" type="button" ${rows.length>=MAX_BATCH?'disabled':''}>新增一筆（${rows.length}/10）</button></div><p id="batch-entry-status" role="status"></p><div class="actions batch-actions"><button id="batch-submit" class="primary" type="button">儲存</button><button id="batch-cancel" type="button">取消</button></div></div>`;
    q('#batch-group').disabled=rows.some(r=>r.saved);
    q('#batch-group').onchange=e=>{groupId=e.target.value;rows.forEach(r=>{r.members=[];r.platform='';});render();};
    root.querySelectorAll('[data-entry]').forEach(card=>{
      const row=rows[Number(card.dataset.entry)];
      card.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{
        row[input.dataset.field]=input.dataset.field==='members'?(input.value?[input.value]:[]):input.dataset.field==='members_only'?input.checked:input.value;
      });
    });
    root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(busy)return;rows.splice(Number(b.dataset.delete),1);render();});
    q('#batch-add').onclick=()=>{if(!busy&&rows.length<MAX_BATCH){rows.push(blankEntry());render();}};
    q('#batch-cancel').onclick=()=>{if(!busy)onReturn();};
    q('#batch-submit').onclick=()=>{
      if(busy)return;
      try{
        const items=batchItems(rows,group(),getData());
        dialog('內容正確嗎？',`將新增 ${group().name} 的 ${items.length} 筆行程。請確認成員、標題與台灣日期／時間。`,[{label:'確定送出',run:submit},{label:'返回修改',run:()=>{}}]);
      }catch(e){q('#batch-entry-status').textContent=e.message;}
    };
  }
  async function submit(){
    if(busy)return;busy=true;
    const navigation=[...document.querySelectorAll('#admin-nav button')].map(el=>({el,disabled:el.disabled}));
    navigation.forEach(({el})=>el.disabled=true);
    root.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
    let count=0,error='';
    try{
      await refresh();
      const items=batchItems(rows,group(),getData());
      for(const {index,item} of items){
        if(getUser()?.id!==user.id||!['owner','collaborator'].includes(getUser()?.role))throw Error('登入已失效，請重新登入。');
        q('#batch-entry-status').textContent=`儲存中：${count}/${items.length}`;
        try{await save('events',{...item,id:crypto.randomUUID(),created_by:user.id});rows[index].saved=true;rows[index].result='儲存成功';count++;}
        catch(e){rows[index].result=`未儲存：${e.message}`;error='部分行程未儲存，請依各筆提示修正後重試。';}
      }
      await refresh();
    }catch(e){error=e.message;}
    finally{busy=false;navigation.forEach(({el,disabled})=>el.disabled=disabled);render();}
    if(error)q('#batch-entry-status').textContent=`已儲存 ${count} 筆；${error}`;
    else dialog('更新成功',`已新增 ${count} 筆行程。`,[{label:'回到原本頁面',run:onReturn}],onReturn);
  }
  render();
}
