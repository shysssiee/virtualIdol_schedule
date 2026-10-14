import {eventState} from './management-state.js';
export function liveFirst(a,b,now=Date.now()) {
 return Number(eventState(b,now)==='直播中')-Number(eventState(a,now)==='直播中') || Date.parse(a.start_at)-Date.parse(b.start_at) || String(a.id).localeCompare(String(b.id));
}
export function liveBundles(bundles,now=Date.now()) {
 return bundles.sort((a,b)=>Number(b.items.some(e=>eventState(e,now)==='直播中'))-Number(a.items.some(e=>eventState(e,now)==='直播中')) || Date.parse(a.items[0].start_at)-Date.parse(b.items[0].start_at));
}
