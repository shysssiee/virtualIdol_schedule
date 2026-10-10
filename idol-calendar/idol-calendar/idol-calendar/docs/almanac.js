const numbers = [
  "",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
];
export function lunarLabel(l) {
  const month =
    l.month === 1
      ? "正"
      : l.month === 11
        ? "冬"
        : l.month === 12
          ? "臘"
          : l.month <= 10
            ? numbers[l.month]
            : "十一";
  const day =
    l.day <= 10
      ? "初" + numbers[l.day]
      : l.day < 20
        ? "十" + numbers[l.day - 10]
        : l.day === 20
          ? "二十"
          : l.day < 30
            ? "廿" + numbers[l.day - 20]
            : "三十";
  return "韓曆" + (l.intercalation ? "閏" : "") + month + "月" + day;
}
const translations = {
  신정: "元旦",
  "3·1절": "三一節",
  새해: "元旦",
  설날: "韓國春節",
  삼일절: "三一節",
  어린이날: "兒童節",
  "부처님 오신 날": "佛誕日",
  석가탄신일: "佛誕日",
  현충일: "顯忠日",
  광복절: "光復節",
  추석: "秋夕",
  개천절: "開天節",
  한글날: "韓文日",
  기독탄신일: "聖誕節",
  크리스마스: "聖誕節",
  성탄절: "聖誕節",
  제헌절: "制憲節",
  대체공휴일: "補假",
  "대통령 선거일": "總統選舉日",
  "국회의원 선거일": "國會選舉日",
  전국동시지방선거: "地方選舉日",
  임시공휴일: "臨時假日",
};
export function holidayLabel(value) {
  let label = value;
  for (const [k, v] of Object.entries(translations))
    label = label.replaceAll(k, v);
  return label;
}
