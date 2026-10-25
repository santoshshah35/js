/*
 * Header, month calendar and the selected day's details.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Tithi = root.PatroTithi;
  var Lunar = root.PatroLunar;
  var Upcoming = root.PatroUpcoming;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var WEEKDAYS_SHORT_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
  var WEEKDAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  UI.addText({
    ne: {
      today: "आज",
      events: "यस महिनाका चाडपर्व र दिवसहरू",
      noEvents: "यस महिनामा कुनै चाडपर्व वा दिवस छैन।",
      sunrise: "सूर्योदय",
      sunset: "सूर्यास्त",
      saturday: "सार्वजनिक बिदा (शनिबार)",
      bs: "बि.सं.",
      estimated: "{year} सालको आधिकारिक पात्रो अझै प्रकाशित भएको छैन। यहाँका महिनाका दिन सूर्य सिद्धान्तबाट गणना गरिएका अनुमान हुन्।",
      footer: "तिथि र चाडपर्व काठमाडौंका लागि खगोलीय गणनाबाट निकालिएका हुन्। तिथि सूर्योदयको नजिक फेरिने वर्ष चाडपर्व प्रकाशित पात्रोभन्दा एक दिन फरक पर्न सक्छ। सरकारी बिदा समावेश छैनन्।"
    },
    en: {
      today: "Today",
      events: "Festivals and national days this month",
      noEvents: "No festivals or national days this month.",
      sunrise: "Sunrise",
      sunset: "Sunset",
      saturday: "Weekly holiday (Saturday)",
      bs: "BS",
      estimated: "No official calendar for {year} BS has been published yet. Month lengths here are estimates computed from the Surya Siddhanta.",
      footer: "Tithi and festivals are computed astronomically for Kathmandu. In a year when the tithi changes close to sunrise, a festival can be a day off from a printed panchang. Government holidays are not included."
    }
  });

  function renderHeader() {
    var today = BS.nepalToday();
    var tithi = Tithi.tithiOn(today);
    $("today-bs").textContent = UI.formatBs(BS.dayNumberToBs(today)) + ", " + UI.weekdayName(BS.weekday(today));
    $("today-meta").textContent = UI.formatAd(BS.fromDayNumber(today)) + " · " + UI.pick(tithi.paksha) + " " + UI.pick(tithi.name);
  }

  function fillSelect(select, labels, value) {
    UI.clear(select);
    labels.forEach(function (label, i) {
      var opt = el("option", null, label);
      opt.value = String(i);
      select.appendChild(opt);
    });
    select.value = String(value);
  }

  function renderCalendar() {
    var sel = BS.dayNumberToBs(UI.state.selected);
    var year = sel.year;
    var month = sel.month;
    var first = BS.bsToDayNumber(year, month, 1);
    var last = first + BS.daysInMonth(year, month) - 1;
    var adFirst = BS.fromDayNumber(first);
    var adLast = BS.fromDayNumber(last);
    var today = BS.nepalToday();

    var years = [];
    for (var y = BS.FIRST_YEAR; y <= BS.LAST_YEAR; y++) years.push(UI.num(y));
    fillSelect($("year-select"), years, year - BS.FIRST_YEAR);
    fillSelect($("month-select"), BS.MONTHS_EN.map(function (_, i) { return UI.bsMonthName(i + 1); }), month - 1);
    $("go-today").textContent = t("today");

    $("month-title").textContent = UI.bsMonthName(month) + " " + UI.num(year);
    $("month-subtitle").textContent = UI.adMonthName(adFirst.month)
      + (adFirst.year !== adLast.year ? " " + UI.num(adFirst.year) : "")
      + " – " + UI.adMonthName(adLast.month) + " " + UI.num(adLast.year);
    $("prev-month").disabled = year === BS.FIRST_YEAR && month === 1;
    $("next-month").disabled = year === BS.LAST_YEAR && month === 12;

    var notice = $("estimate-note");
    notice.hidden = year < BS.PROJECTED_FROM;
    notice.textContent = UI.fill(t("estimated"), { year: UI.num(year) });

    var weekdayRow = $("weekday-row");
    UI.clear(weekdayRow);
    (UI.state.lang === "ne" ? WEEKDAYS_SHORT_NE : WEEKDAYS_SHORT_EN).forEach(function (name, i) {
      var cell = el("div", "weekday" + (i === 6 ? " sat" : ""), name);
      cell.setAttribute("aria-hidden", "true");
      weekdayRow.appendChild(cell);
    });

    var days = $("days");
    UI.clear(days);
    for (var i = 0; i < BS.weekday(first); i++) days.appendChild(el("div", "day empty"));

    var monthEvents = [];
    for (var n = first; n <= last; n++) {
      var bs = BS.dayNumberToBs(n);
      var ad = BS.fromDayNumber(n);
      var tithi = Tithi.tithiOn(n);
      var events = Upcoming.eventsOn(n);
      var w = BS.weekday(n);

      var classes = ["day"];
      if (w === 6) classes.push("sat");
      if (events.length) classes.push("has-event");
      if (tithi.number === 15) classes.push("full-moon");
      if (tithi.number === 30) classes.push("new-moon");
      if (n === today) classes.push("is-today");
      if (n === UI.state.selected) classes.push("selected");

      var cell = el("button", classes.join(" "));
      cell.type = "button";
      cell.dataset.day = String(n);
      cell.setAttribute("aria-label", UI.weekdayName(w) + ", " + UI.formatBs(bs) + ", " + UI.formatAd(ad)
        + ", " + UI.pick(tithi.name) + (events.length ? ", " + events.map(UI.pick).join(", ") : ""));
      if (n === UI.state.selected) cell.setAttribute("aria-pressed", "true");
      cell.appendChild(el("span", "bs", UI.num(bs.day)));
      cell.appendChild(el("span", "ad", String(ad.day)));
      cell.appendChild(events.length
        ? el("span", "tithi festival", UI.pick(events[0]))
        : el("span", "tithi", UI.pick(tithi.name)));
      days.appendChild(cell);

      events.forEach(function (ev) { monthEvents.push({ day: bs.day, event: ev }); });
    }
    renderMonthEvents(monthEvents);
  }

  function renderMonthEvents(list) {
    $("events-title").textContent = t("events");
    var ul = $("event-list");
    UI.clear(ul);
    if (!list.length) {
      ul.appendChild(el("li", "empty", t("noEvents")));
      return;
    }
    list.forEach(function (item) {
      var li = el("li");
      li.appendChild(el("span", "date", UI.num(item.day)));
      li.appendChild(el("span", null, UI.pick(item.event)));
      ul.appendChild(li);
    });
  }

  function renderDetail() {
    var n = UI.state.selected;
    var bs = BS.dayNumberToBs(n);
    var w = BS.weekday(n);
    var tithi = Tithi.tithiOn(n);
    var events = Upcoming.eventsOn(n);

    var box = $("day-detail");
    UI.clear(box);
    box.appendChild(el("div", "big", UI.num(bs.day)));
    box.appendChild(el("p", "line", UI.bsMonthName(bs.month) + " " + UI.num(bs.year) + " " + t("bs") + ", " + UI.weekdayName(w)));
    box.appendChild(el("p", "line muted", UI.formatAd(BS.fromDayNumber(n))));
    box.appendChild(el("p", "line", UI.pick(Lunar.monthName(n)) + " " + UI.pick(tithi.paksha) + " · " + UI.pick(tithi.name)));
    box.appendChild(el("p", "line muted", t("sunrise") + " " + UI.nepalTime(tithi.sunrise)
      + " · " + t("sunset") + " " + UI.nepalTime(Tithi.sunset(n))));

    var tags = el("div", "tags");
    if (w === 6) tags.appendChild(el("span", "tag", t("saturday")));
    events.forEach(function (ev) { tags.appendChild(el("span", "tag", UI.pick(ev))); });
    if (tags.childNodes.length) box.appendChild(tags);
  }

  function showMonth(year, month) {
    if (month < 1) { year--; month = 12; }
    if (month > 12) { year++; month = 1; }
    if (year < BS.FIRST_YEAR || year > BS.LAST_YEAR) return;
    var tb = BS.dayNumberToBs(BS.nepalToday());
    var day = tb.year === year && tb.month === month ? tb.day : 1;
    UI.selectDay(BS.bsToDayNumber(year, month, day));
  }

  function render() {
    renderHeader();
    renderCalendar();
    renderDetail();
    $("footer-note").textContent = t("footer");
  }

  function init() {
    var sel = function () { return BS.dayNumberToBs(UI.state.selected); };
    $("prev-month").addEventListener("click", function () { showMonth(sel().year, sel().month - 1); });
    $("next-month").addEventListener("click", function () { showMonth(sel().year, sel().month + 1); });
    $("go-today").addEventListener("click", function () { UI.selectDay(BS.nepalToday()); });
    $("year-select").addEventListener("change", function (e) {
      showMonth(BS.FIRST_YEAR + parseInt(e.target.value, 10), sel().month);
    });
    $("month-select").addEventListener("change", function (e) {
      showMonth(sel().year, parseInt(e.target.value, 10) + 1);
    });
    $("days").addEventListener("click", function (e) {
      var cell = e.target.closest(".day[data-day]");
      if (cell) UI.selectDay(parseInt(cell.dataset.day, 10));
    });
    document.addEventListener("keydown", function (e) {
      if (UI.state.view !== "calendar" || e.target.closest("input, select, textarea")) return;
      if (e.key === "ArrowLeft" && e.altKey) showMonth(sel().year, sel().month - 1);
      if (e.key === "ArrowRight" && e.altKey) showMonth(sel().year, sel().month + 1);
    });
    UI.on("day", function () { renderCalendar(); renderDetail(); });
    UI.on("lang", render);
    UI.on("tick", function () { renderHeader(); renderCalendar(); });
    render();
  }

  UI.calendar = { init: init, renderHeader: renderHeader };
})(this);
