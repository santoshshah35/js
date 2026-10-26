/*
 * The event strip under the header and the upcoming events screen.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Upcoming = root.PatroUpcoming;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var LOOKAHEAD_DAYS = 400;
  var LIST_LIMIT = 40;

  UI.addText({
    ne: {
      todayIs: "आज",
      next: "आउँदो",
      daysLeft: "{n} दिनपछि",
      tomorrow: "भोलि",
      upcomingTitle: "आउँदा चाडपर्व र दिवसहरू",
      upcomingNone: "आउँदा दिनमा कुनै चाडपर्व भेटिएन।",
      showOnCalendar: "पात्रोमा हेर्नुहोस्"
    },
    en: {
      todayIs: "Today",
      next: "Next",
      daysLeft: "in {n} days",
      tomorrow: "tomorrow",
      upcomingTitle: "Upcoming festivals and days",
      upcomingNone: "No festivals found in the coming days.",
      showOnCalendar: "Show on calendar"
    }
  });

  function whenText(day, today) {
    var diff = day - today;
    if (diff === 0) return t("todayIs");
    if (diff === 1) return t("tomorrow");
    return UI.fill(t("daysLeft"), { n: UI.num(diff) });
  }

  function names(events) {
    return events.map(UI.pick).join(", ");
  }

  function renderStrip() {
    var today = BS.nepalToday();
    var strip = $("event-strip");
    UI.clear(strip);
    var list = Upcoming.upcoming(today, LOOKAHEAD_DAYS, 1);
    if (!list.length) { strip.hidden = true; return; }
    strip.hidden = false;
    var item = list[0];
    var isToday = item.day === today;
    strip.appendChild(el("span", "strip-label", isToday ? t("todayIs") : t("next")));
    strip.appendChild(el("span", "strip-name", names(item.events)));
    if (!isToday) {
      strip.appendChild(el("span", "strip-when",
        UI.formatBs(BS.dayNumberToBs(item.day)) + " · " + whenText(item.day, today)));
    }
    strip.appendChild(el("span", "strip-chevron", "›"));
    strip.setAttribute("aria-label", t("upcomingTitle") + ": " + strip.textContent);
  }

  function renderList() {
    var today = BS.nepalToday();
    $("upcoming-title").textContent = t("upcomingTitle");
    var box = $("upcoming-list");
    UI.clear(box);
    var list = Upcoming.upcoming(today, LOOKAHEAD_DAYS, LIST_LIMIT);
    if (!list.length) {
      box.appendChild(el("p", "muted", t("upcomingNone")));
      return;
    }
    var currentMonth = null;
    var ul = null;
    list.forEach(function (item) {
      var bs = BS.dayNumberToBs(item.day);
      var key = bs.year * 100 + bs.month;
      if (key !== currentMonth) {
        currentMonth = key;
        box.appendChild(el("h3", "month-label", UI.bsMonthName(bs.month) + " " + UI.num(bs.year)));
        ul = el("ul", "upcoming");
        box.appendChild(ul);
      }
      var li = el("li");
      var btn = el("button", "upcoming-item" + (item.day === today ? " is-today" : ""));
      btn.type = "button";
      btn.dataset.day = String(item.day);
      var date = el("span", "upcoming-date");
      date.appendChild(el("span", "upcoming-day", UI.num(bs.day)));
      date.appendChild(el("span", "upcoming-weekday", UI.weekdayName(BS.weekday(item.day))));
      btn.appendChild(date);
      var body = el("span", "upcoming-body");
      body.appendChild(el("span", "upcoming-name", names(item.events)));
      body.appendChild(el("span", "upcoming-meta",
        UI.formatAd(BS.fromDayNumber(item.day)) + " · " + whenText(item.day, today)));
      btn.appendChild(body);
      btn.setAttribute("aria-label", UI.formatBs(bs) + ", " + names(item.events) + ", " + t("showOnCalendar"));
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function init() {
    $("event-strip").addEventListener("click", function () { UI.navigate("events"); });
    $("upcoming-list").addEventListener("click", function (e) {
      var btn = e.target.closest(".upcoming-item");
      if (!btn) return;
      UI.selectDay(parseInt(btn.dataset.day, 10));
      UI.navigate("calendar");
    });
    UI.on("lang", function () { renderStrip(); renderList(); });
    UI.on("tick", function () { renderStrip(); renderList(); });
    UI.on("events", function () { renderStrip(); renderList(); });
    renderStrip();
    renderList();
  }

  UI.upcoming = { init: init };
})(this);
