import {anniversariesOn} from './anniversaries.js?v=1.4-20261101b';
import {civilDate,civilKey} from './timezone.js?v=1.4-20261101b';
// Calendar dates, not elapsed 24-hour periods: handles year changes and DST.
export function upcomingAnniversaries(items,today,selected,memberSelection=new Map()) {
 const results=[];
 const date=civilDate(today);
 for(let days=0;days<=7;days++) {
  const next=new Date(date);next.setUTCDate(next.getUTCDate()+days);
  const key=civilKey(next);
  for(const item of anniversariesOn(items,key)) {
   if(!selected.includes(item.group_id))continue;
   if(item.member_id && memberSelection.has(item.group_id) && !memberSelection.get(item.group_id).includes(item.member_id))continue;
   results.push({...item,date:key,days});
  }
 }
 return results;
}
