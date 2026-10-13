export function byLastUpdate(a,b) {
  const stamp=x=>Date.parse(x.updated_at||x.created_at||'')||0;
  return stamp(b)-stamp(a)||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||String(a.id).localeCompare(String(b.id));
}
export const canManageAnniversary=(user,item)=>!!user && (user.role==='owner'||(user.role==='collaborator'&&item?.created_by===user.id));
export function eventState(e,now=Date.now()) {
  if(e.status==='cancelled')return '已取消';
  if(e.status==='ended'||now>=Date.parse(e.start_at)+7200000)return '已結束';
  if(now>=Date.parse(e.start_at))return '直播中';
  if(Date.parse(e.start_at)-now<=3600000)return '即將直播';
  return '預定';
}
