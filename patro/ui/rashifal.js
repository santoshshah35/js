/*
 * Rashifal screen: daily, weekly and monthly readings for the twelve rashis.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Rashifal = root.PatroRashifal;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var WEEKDAYS_SHORT_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
  var WEEKDAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var period = "day";

  UI.addText({
    ne: {
      rashifal: "राशिफल",
      daily: "दैनिक",
      weekly: "साप्ताहिक",
      monthly: "मासिक",
      moonIn: "चन्द्रमा {sign} राशिमा",
      moonMoves: "{time} बजे {sign}मा प्रवेश",
      weekBasis: "हप्ताका सातै दिनको चन्द्र गोचरबाट।",
      monthBasis: "सूर्य {sign} राशिमा · महिनाको फल सूर्यको गोचरबाट।",
      good: "शुभ",
      mixed: "मिश्रित",
      bad: "सावधान",
      weekGood: "धेरैजसो राम्रो हप्ता।",
      weekMixed: "मिश्रित हप्ता: जरुरी काम राम्रा दिनमा गर्नुहोस्।",
      weekBad: "सावधानीको हप्ता: ठूला निर्णय र जोखिम पर्खनुहोस्।",
      goodDays: "शुभ दिन: {days}",
      carefulDays: "सावधानी: {days}",
      chandrashtama: "चन्द्राष्टम: {days}",
      dayCounts: "{g} शुभ · {m} मिश्रित · {b} सावधानीका दिन",
      periodPrev: "अघिल्लो",
      periodNext: "अर्को",
      rashifalNote: "चन्द्रमा र सूर्यको गोचरका आधारमा परम्परागत सामान्य फल। व्यक्तिगत कुण्डलीको फल होइन।"
    },
    en: {
      rashifal: "Rashifal",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      moonIn: "Moon in {sign}",
      moonMoves: "enters {sign} at {time}",
      weekBasis: "From the Moon's transit on each of the seven days.",
      monthBasis: "Sun in {sign} · the month's reading follows the Sun's transit.",
      good: "Good",
      mixed: "Mixed",
      bad: "Careful",
      weekGood: "A mostly favourable week.",
      weekMixed: "A mixed week: keep important work for the good days.",
      weekBad: "A week for caution: put off big decisions and risks.",
      goodDays: "Good days: {days}",
      carefulDays: "Take care: {days}",
      chandrashtama: "Chandrashtama: {days}",
      dayCounts: "{g} good · {m} mixed · {b} careful days",
      periodPrev: "Previous",
      periodNext: "Next",
      rashifalNote: "General readings from the transits of the Moon and Sun (gochar), the traditional rule of thumb. Not a personal horoscope."
    }
  });

  function shortWeekday(n) {
    return (UI.state.lang === "ne" ? WEEKDAYS_SHORT_NE : WEEKDAYS_SHORT_EN)[BS.weekday(n)];
  }

  // Consecutive days as BS day ranges: "५–६, २१".
  function dayRanges(days) {
    var parts = [];
    for (var i = 0; i < days.length; i++) {
      var start = days[i];
      while (i + 1 < days.length && days[i + 1] === days[i] + 1) i++;
      var a = UI.num(BS.dayNumberToBs(start).day);
      parts.push(days[i] === start ? a : a + "–" + UI.num(BS.dayNumberToBs(days[i]).day));
    }
    return parts.join(", ");
  }

  function rangeLabel(first, last) {
    var a = BS.dayNumberToBs(first);
    var b = BS.dayNumberToBs(last);
    if (a.month === b.month) return UI.num(a.year) + " " + UI.bsMonthName(a.month) + " " + UI.num(a.day) + "–" + UI.num(b.day);
    return UI.formatBs(a) + " – " + UI.bsMonthName(b.month) + " " + UI.num(b.day);
  }

  function card(rashi, tone, lines) {
    var li = el("li", "rashi");
    var top = el("div", "rashi-top");
    top.appendChild(el("span", "rashi-name", UI.pick(rashi)));
    top.appendChild(el("span", "tone " + tone, t(tone)));
    li.appendChild(top);
    lines.forEach(function (line, i) {
      if (line) li.appendChild(el("p", i === 0 ? null : "rashi-detail", line));
    });
    return li;
  }

  function counts(r) {
    return UI.fill(t("dayCounts"), { g: UI.num(r.good.length), m: UI.num(r.mixed.length), b: UI.num(r.bad.length) });
  }

  function renderDay(grid) {
    var n = UI.state.selected;
    var day = Rashifal.rashifalOn(n);
    var moon = day.moon;
    var line = UI.fill(t("moonIn"), { sign: UI.pick(Rashifal.RASHIS[moon.sign]) });
    if (moon.changesAt) {
      line += ", " + UI.fill(t("moonMoves"), { sign: UI.pick(Rashifal.RASHIS[moon.next]), time: UI.nepalTime(moon.changesAt) });
    }
    $("rashifal-date").textContent = UI.formatBs(BS.dayNumberToBs(n)) + ", " + UI.weekdayName(BS.weekday(n));
    $("rashifal-moon").textContent = line;
    day.readings.forEach(function (r) { grid.appendChild(card(r.rashi, r.tone, [UI.pick(r)])); });
  }

  function renderWeek(grid) {
    var first = UI.state.selected - BS.weekday(UI.state.selected);
    var week = Rashifal.weeklyFor(first);
    $("rashifal-date").textContent = rangeLabel(week.first, week.last);
    $("rashifal-moon").textContent = t("weekBasis");
    var summary = { good: "weekGood", mixed: "weekMixed", bad: "weekBad" };
    week.readings.forEach(function (r) {
      grid.appendChild(card(r.rashi, r.tone, [
        t(summary[r.tone]),
        r.good.length ? UI.fill(t("goodDays"), { days: r.good.map(shortWeekday).join(", ") }) : "",
        r.bad.length ? UI.fill(t("carefulDays"), { days: r.bad.map(shortWeekday).join(", ") }) : ""
      ]));
    });
  }

  function renderMonth(grid) {
    var bs = BS.dayNumberToBs(UI.state.selected);
    var first = BS.bsToDayNumber(bs.year, bs.month, 1);
    var last = first + BS.daysInMonth(bs.year, bs.month) - 1;
    var month = Rashifal.monthlyFor(first, last, bs.month);
    $("rashifal-date").textContent = UI.bsMonthName(bs.month) + " " + UI.num(bs.year);
    $("rashifal-moon").textContent = UI.fill(t("monthBasis"), { sign: UI.pick(Rashifal.RASHIS[month.sunSign]) });
    month.readings.forEach(function (r) {
      grid.appendChild(card(r.rashi, r.tone, [
        UI.pick(r),
        counts(r),
        r.chandrashtama.length ? UI.fill(t("chandrashtama"), { days: dayRanges(r.chandrashtama) }) : ""
      ]));
    });
  }

  function render() {
    $("rashifal-title").textContent = t("rashifal");
    $("rashifal-note").textContent = t("rashifalNote");
    [["day", "daily"], ["week", "weekly"], ["month", "monthly"]].forEach(function (pair) {
      var b = $("period-" + pair[0]);
      var locked = pair[0] !== "day" && UI.account.isLocked("rashifalPeriods");
      b.textContent = (locked ? "🔒 " : "") + t(pair[1]);
      b.setAttribute("aria-selected", String(period === pair[0]));
    });
    $("rashifal-prev").setAttribute("aria-label", t("periodPrev"));
    $("rashifal-next").setAttribute("aria-label", t("periodNext"));
    var grid = $("rashi-grid");
    UI.clear(grid);
    if (period === "week") renderWeek(grid);
    else if (period === "month") renderMonth(grid);
    else renderDay(grid);
  }

  function firstDay() { return BS.bsToDayNumber(BS.FIRST_YEAR, 1, 1); }
  function lastDay() { return BS.bsToDayNumber(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12)); }

  function step(delta) {
    var n = UI.state.selected;
    if (period === "week") {
      n += 7 * delta;
    } else if (period === "month") {
      var bs = BS.dayNumberToBs(n);
      var y = bs.year, m = bs.month + delta;
      if (m < 1) { y--; m = 12; }
      if (m > 12) { y++; m = 1; }
      if (y < BS.FIRST_YEAR || y > BS.LAST_YEAR) return;
      n = BS.bsToDayNumber(y, m, Math.min(bs.day, BS.daysInMonth(y, m)));
    } else {
      n += delta;
    }
    if (n >= firstDay() && n <= lastDay()) UI.selectDay(n);
  }

  function setPeriod(p) {
    // Weekly and monthly readings can be members-only (config.json).
    if (p !== "day") {
      UI.account.requireLogin("rashifalPeriods", function () { period = p; render(); });
      return;
    }
    period = p;
    render();
  }

  // Back to the daily reading if the periods became members-only.
  function checkPeriod() {
    if (period !== "day" && UI.account.isLocked("rashifalPeriods")) period = "day";
    render();
  }

  function init() {
    $("rashifal-prev").addEventListener("click", function () { step(-1); });
    $("rashifal-next").addEventListener("click", function () { step(1); });
    ["day", "week", "month"].forEach(function (p) {
      $("period-" + p).addEventListener("click", function () { setPeriod(p); });
    });
    UI.on("day", render);
    UI.on("lang", render);
    UI.on("user", checkPeriod);
    UI.on("config", checkPeriod);
    render();
  }

  UI.rashifal = { init: init };
})(this);
