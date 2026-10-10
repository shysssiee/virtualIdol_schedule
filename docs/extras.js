import { anniversaryManager } from "./anniversary-manager.js";
import { anniversaryDate, bindBirthdayYear } from "./anniversaries.js";
import { createBoard } from "./board.js";
import { addMember, memberEntryHtml, bindMemberEntry } from "./member-entry.js";
import { siteTitle } from "./site-title.js";
import { calendarLines } from "./regional-calendar.js";
import { save, remove, client } from "./data.js";
import { escape as esc, dayKey, time } from "./calendar.js";
import { anniversariesOn, calendarFile } from "./anniversaries.js";
export function createExtras({
  getData,
  getUser,
  show,
  refresh,
  toast,
  render,
  getZone,
  openLive,
  openImport,
  hoverPanel,
  positionHover,
}) {
  const $ = (s) => document.querySelector(s);
  let office = null;
  fetch("./taiwan-calendar.json")
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((x) => {
      office = x;
      $("#taiwan-calendar-status").textContent =
        "行政年曆：" + x.years[0] + "–" + x.years.at(-1) + " 年。";
      if (getData()) render();
    })
    .catch(() => {
      $("#taiwan-calendar-status").textContent =
        "行政年曆載入失敗，請重新整理。";
    });
  function dayAlmanac(key) {
    return calendarLines(
      key,
      {
        taiwan: $("#taiwan-almanac").checked,
        korea: $("#korean-almanac").checked,
      },
      office,
      holidays,
      window.KoreanLunarCalendar,
    );
  }
  let holidays = {};
  fetch("./korean-holidays.json")
    .then((r) => r.json())
    .then((x) => {
      holidays = x;
      if (getData()) render();
    })
    .catch(() => {});
  let from = "",
    to = "";
  function dateExtras(key) {
    const d = getData(),
      items = anniversariesOn(d.anniversaries || [], key).filter(
        (x) =>
          document.querySelector('[data-group="' + x.group_id + '"]')
            ?.checked !== false,
      );
    let html = items.length
      ? '<button class="anniversary-icon" data-anniversary-date="' +
        key +
        '" aria-label="查看生日與紀念日">' +
        [...new Set(items.map((x) => x.icon))].join("") +
        "</button>"
      : "";
    html += dayAlmanac(key)
      .map(
        (line) =>
          '<span class="almanac' +
          (line.includes("：") ? " holiday" : "") +
          '" title="' +
          esc(line) +
          '">' +
          esc(line) +
          "</span>",
      )
      .join("");
    return '<div class="date-extras">' + html + "</div>";
  }
  function anniversaryContent(key) {
    const items = anniversariesOn(getData().anniversaries || [], key).filter(
      (x) =>
        document.querySelector('[data-group="' + x.group_id + '"]')?.checked !==
        false,
    );
    return (
      "<h2>生日／紀念日</h2>" +
      items
        .map(
          (x) =>
            "<article><h3>" +
            x.icon +
            " " +
            esc(getData().groups.find((g) => g.id === x.group_id)?.name) +
            " · " +
            esc(x.name) +
            "</h3><p>" +
            esc(
              x.year_unknown
                ? x.original_date.slice(5) + "（出生年份未知）"
                : x.original_date,
            ) +
            " · " +
            esc(x.label) +
            "</p></article>",
        )
        .join("")
    );
  }
  function bindDates() {
    document.querySelectorAll("[data-anniversary-date]").forEach((b) => {
      b.onclick = () => show(anniversaryContent(b.dataset.anniversaryDate));
      b.onmouseenter = () => {
        if (!matchMedia("(hover:hover)").matches || $("#modal").open) return;
        hoverPanel.cancel();
        const tip = $("#tooltip");
        tip.innerHTML =
          '<button class="close" aria-label="關閉浮卡">×</button>' +
          anniversaryContent(b.dataset.anniversaryDate);
        tip.style.removeProperty("--event-color");
        tip.style.background = "white";
        tip.querySelector(".close").onclick = hoverPanel.hide;
        tip.hidden = false;
        positionHover(tip, b);
      };
      b.onmouseleave = hoverPanel.leave;
    });
  }
  function manager(root) {
    anniversaryManager(root, {
      getData,
      getUser,
      openForm: form,
      refresh,
      toast,
    });
  }
  function form(item, onSaved) {
    const d = getData(),
      me = getUser();
    if (!me) return;
    show(
      "<h2>" +
        (item ? "修改" : "新增") +
        '生日／紀念日</h2><form id="ann-form"><label>類型<select name="kind"><option value="birthday">🎂 生日</option><option value="debut">🎉 出道日</option><option value="anniversary">🎉 其他紀念日</option></select></label><label>團體<select name="group_id">' +
        d.groups
          .map(
            (g) => '<option value="' + g.id + '">' + esc(g.name) + "</option>",
          )
          .join("") +
        '</select></label><label>成員（全團紀念日可不選）<select name="member_id"></select></label><label>名字／紀念日名稱<input name="name" required maxlength="160"></label><label>出生年月日／原始紀念日期<input name="original_date" type="date" required></label><label class="members-only-option" id="birthday-year"><input name="year_unknown" type="checkbox">出生年份未知（只顯示生日，不計算歲數）</label><p class="muted">僅輸入一次，未來每年自動顯示。2月29日只在閏年當天顯示。</p><button>儲存</button><p class="error"></p></form>',
    );
    const f = $("#ann-form");
    f.elements.member_id
      .closest("label")
      .insertAdjacentHTML("afterend", memberEntryHtml());
    function members() {
      f.elements.member_id.innerHTML =
        '<option value="">全團／自行填寫</option>' +
        d.members
          .filter((m) => m.group_id === f.elements.group_id.value)
          .map(
            (m) => '<option value="' + m.id + '">' + esc(m.name) + "</option>",
          )
          .join("");
    }
    bindMemberEntry(
      f,
      d,
      () => f.elements.group_id.value,
      (m) => {
        members();
        f.elements.member_id.value = m.id;
        if (f.elements.kind.value === "birthday")
          f.elements.name.value = m.name;
      },
    );
    f.elements.group_id.onchange = members;
    members();
    f.elements.member_id.onchange = () => {
      const m = d.members.find((x) => x.id === f.elements.member_id.value);
      if (m) f.elements.name.value = m.name;
    };
    if (item) {
      for (const key of ["kind", "group_id", "name", "original_date"])
        f.elements[key].value = item[key];
      members();
      f.elements.member_id.value = item.member_id || "";
    }
    const unknown = f.elements.year_unknown,
      date = f.elements.original_date;
    unknown.checked = !!item?.year_unknown;
    bindBirthdayYear(date, unknown);
    const updateKind = () => {
      $("#birthday-year").hidden = f.elements.kind.value !== "birthday";
      if (f.elements.kind.value !== "birthday" && unknown.checked) {
        unknown.checked = false;
        unknown.onchange();
      }
    };
    f.elements.kind.onchange = updateKind;
    updateKind();
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const b = f.querySelector("button:not([type=button])");
      b.disabled = true;
      try {
        const v = new FormData(f);
        const originalDate = anniversaryDate(
          v.get("original_date"),
          v.get("kind") === "birthday" && unknown.checked,
        );
        let memberId = v.get("member_id") || null;
        if (v.get("kind") === "birthday" && !memberId) {
          const m = await addMember(d, v.get("group_id"), v.get("name"));
          memberId = m.id;
        }
        await save(
          "anniversaries",
          {
            id: item?.id || crypto.randomUUID(),
            kind: v.get("kind"),
            group_id: v.get("group_id"),
            member_id: memberId,
            name: v.get("name").trim(),
            original_date: originalDate,
            year_unknown: v.get("kind") === "birthday" && unknown.checked,
            created_by: item?.created_by || me.id,
          },
          { existing: !!item },
        );
        $("#modal").close();
        await refresh();
        toast("紀念日已儲存，每年自動顯示");
        onSaved?.();
      } catch (e) {
        f.querySelector(".error").textContent = e.message;
        b.disabled = false;
      }
    };
  }
  function choose(start) {
    show(
      '<h2>新增內容</h2><div class="content-choices"><button id="choose-live">直播行程</button><button id="choose-anniversary">生日／紀念日</button><button id="my-anniversaries">管理我的紀念日</button><button id="choose-import">導入網址擷取</button></div>',
    );
    $("#choose-live").onclick = () => openLive(start);
    $("#choose-import").onclick = openImport;
    $("#choose-anniversary").onclick = () => form();
    $("#my-anniversaries").onclick = () => {
      show('<div id="my-ann-root"></div>');
      manager($("#my-ann-root"));
    };
  }
  function shareHtml(e) {
    const d = getData(),
      title =
        (d.groups.find((g) => g.id === e.group_id)?.name || "") +
        " · " +
        e.title,
      stamp = (x) =>
        new Date(x)
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "");
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: stamp(e.start_at) + "/" + stamp(e.start_at),
      details:
        (e.description || "") + "\n" + e.links.map((l) => l.url).join("\n"),
    });
    return (
      '<div class="actions"><button data-share="' +
      e.id +
      '">分享行程</button><a class="platform-link" href="https://calendar.google.com/calendar/render?' +
      esc(q.toString()) +
      '" target="_blank" rel="noopener">⏰ Google 日曆</a><button data-ics="' +
      e.id +
      '">⏰ Apple／其他日曆</button>' +
      (getUser() && getUser().role !== "owner" && e.created_by !== getUser().id
        ? '<button data-report="' + e.id + '">回報站主</button>'
        : "") +
      '</div><p class="muted">加入後請確認提醒設定；行程異動不會自動同步。iPhone 若只顯示檔案預覽，可透過 Apple Mail 開啟 .ics 匯入。</p>'
    );
  }
  function bindShare(root) {
    root.querySelectorAll("[data-share]").forEach(
      (b) =>
        (b.onclick = async () => {
          const u = new URL(location.href);
          u.hash = "event=" + b.dataset.share;
          try {
            if (navigator.share)
              await navigator.share({
                title: siteTitle(getData().site_settings[0]?.name),
                url: u.href,
              });
            else {
              await navigator.clipboard.writeText(u.href);
              toast("連結已複製");
            }
          } catch (e) {
            if (e.name !== "AbortError") toast("分享連結：" + u.href);
          }
        }),
    );
    root.querySelectorAll("[data-ics]").forEach(
      (b) =>
        (b.onclick = () => {
          const e = getData().events.find((x) => x.id === b.dataset.ics),
            a = document.createElement("a");
          a.href = URL.createObjectURL(
            new Blob(
              [
                calendarFile(
                  e,
                  (getData().groups.find((g) => g.id === e.group_id)?.name ||
                    "") +
                    " · " +
                    e.title,
                ),
              ],
              {
                type: "text/calendar;charset=utf-8",
              },
            ),
          );
          a.download = "idol-schedule.ics";
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }),
    );
    root
      .querySelectorAll("[data-report]")
      .forEach((b) => (b.onclick = () => report(b.dataset.report)));
  }
  const board = createBoard({ getUser, show, toast });
  function report(id) {
    board.form(null, id);
  }
  async function reports(root) {
    return board.list(root);
  }
  function range() {
    show(
      '<h2>日期篩選</h2><form id="range-form"><label>跳至日期<input name="date" type="date" min="2023-01-01"></label><button>跳至日期</button></form><div class="actions">' +
        [
          [30, "近30天"],
          [90, "近90天"],
          [365, "一年"],
          [1095, "三年"],
        ]
          .map(
            ([n, label]) =>
              '<button data-range="' + n + '">' + label + "</button>",
          )
          .join("") +
        '<button id="clear-range">清除區間</button></div><p class="muted">從今天往回查詢歷史行程，最早2023年1月1日。</p>',
    );
    document.querySelectorAll("[data-range]").forEach(
      (b) =>
        (b.onclick = () => {
          to = dayKey(new Date());
          const date = new Date(to + "T12:00:00Z");
          date.setUTCDate(date.getUTCDate() - Number(b.dataset.range) + 1);
          from = dayKey(date);
          if (from < "2023-01-01") from = "2023-01-01";
          $("#modal").close();
          document.querySelector('[data-view="list"]').click();
          render();
        }),
    );
    $("#clear-range").onclick = () => {
      from = "";
      to = "";
      $("#modal").close();
      render();
    };
    $("#range-form").onsubmit = (ev) => {
      ev.preventDefault();
      const v = new FormData(ev.currentTarget).get("date");
      if (v) {
        from = "";
        to = "";
        $("#jump-date").value = v;
        $("#jump-date").dispatchEvent(new Event("change"));
        $("#modal").close();
      }
    };
  }
  $("#date-range").onclick = range;
  let preferences = { taiwan: true, korea: false };
  try {
    const stored = JSON.parse(localStorage.getItem("regional-calendars-v1"));
    if (
      stored &&
      typeof stored.taiwan === "boolean" &&
      typeof stored.korea === "boolean"
    )
      preferences = stored;
  } catch {}
  $("#taiwan-almanac").checked = preferences.taiwan;
  $("#korean-almanac").checked = preferences.korea;
  for (const id of ["taiwan-almanac", "korean-almanac"])
    $("#" + id).onchange = () => {
      try {
        localStorage.setItem(
          "regional-calendars-v1",
          JSON.stringify({
            taiwan: $("#taiwan-almanac").checked,
            korea: $("#korean-almanac").checked,
          }),
        );
      } catch {}
      render();
    };
  return {
    dateExtras,
    dayAlmanac,
    bindDates,
    manager,
    form,
    choose,
    shareHtml,
    bindShare,
    reports,
    inRange: (e) =>
      !from || (dayKey(e.start_at) >= from && dayKey(e.start_at) <= to),
    rangeActive: () => Boolean(from),
    rangeLabel: () => from + " ～ " + to,
    clearRange: () => {
      from = "";
      to = "";
    },
  };
}
