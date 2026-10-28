import {getLanguage} from './i18n.js?v=1.4-20261028';
export function greeting(name, zone, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const period=hour>=5&&hour<12?0:hour>=12&&hour<18?1:2;
  if(getLanguage()==="en")return `${["Good morning","Good afternoon","Good evening"][period]}, ${name}!`;
  if(getLanguage()==="ko")return `${name}님, ${["좋은 아침이에요","좋은 오후예요","좋은 저녁이에요"][period]}!`;
  if(getLanguage()==="ja")return `${name}さん、${["おはようございます","こんにちは","こんばんは"][period]}！`;
  return `哈囉～${name}，${hour >= 5 && hour < 12 ? "早安" : hour >= 12 && hour < 18 ? "午安" : "晚安"}！`;
}
