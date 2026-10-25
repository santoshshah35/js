/*
 * Rashifal screen: the twelve readings for the selected day.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Rashifal = root.PatroRashifal;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  UI.addText({
    ne: {
      rashifal: "राशिफल",
      moonIn: "चन्द्रमा {sign} राशिमा",
      moonMoves: "{time} बजे {sign}मा प्रवेश",
      good: "शुभ",
      mixed: "मिश्रित",
      bad: "सावधान",
      prevDay: "अघिल्लो दिन",
      nextDay: "अर्को दिन",
      rashifalNote: "चन्द्रमाको गोचरका आधारमा परम्परागत सामान्य फल। व्यक्तिगत कुण्डलीको फल होइन।"
    },
    en: {
      rashifal: "Rashifal",
      moonIn: "Moon in {sign}",
      moonMoves: "enters {sign} at {time}",
      good: "Good",
      mixed: "Mixed",
      bad: "Careful",
      prevDay: "Previous day",
      nextDay: "Next day",
      rashifalNote: "General readings from the Moon's transit (gochar), the traditional rule of thumb. Not a personal horoscope."
    }
  });

  function render() {
    var n = UI.state.selected;
    var day = Rashifal.rashifalOn(n);
    var moon = day.moon;
    var line = UI.fill(t("moonIn"), { sign: UI.pick(Rashifal.RASHIS[moon.sign]) });
    if (moon.changesAt) {
      line += ", " + UI.fill(t("moonMoves"), {
        sign: UI.pick(Rashifal.RASHIS[moon.next]),
        time: UI.nepalTime(moon.changesAt)
      });
    }
    $("rashifal-title").textContent = t("rashifal");
    $("rashifal-date").textContent = UI.formatBs(BS.dayNumberToBs(n)) + ", " + UI.weekdayName(BS.weekday(n));
    $("rashifal-moon").textContent = line;
    $("rashifal-note").textContent = t("rashifalNote");
    $("rashifal-prev").setAttribute("aria-label", t("prevDay"));
    $("rashifal-next").setAttribute("aria-label", t("nextDay"));

    var grid = $("rashi-grid");
    UI.clear(grid);
    day.readings.forEach(function (r) {
      var li = el("li", "rashi");
      var top = el("div", "rashi-top");
      top.appendChild(el("span", "rashi-name", UI.pick(r.rashi)));
      top.appendChild(el("span", "tone " + r.tone, t(r.tone)));
      li.appendChild(top);
      li.appendChild(el("p", null, UI.pick(r)));
      grid.appendChild(li);
    });
  }

  function step(delta) {
    var n = UI.state.selected + delta;
    var first = BS.bsToDayNumber(BS.FIRST_YEAR, 1, 1);
    var last = BS.bsToDayNumber(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12));
    if (n >= first && n <= last) UI.selectDay(n);
  }

  function init() {
    $("rashifal-prev").addEventListener("click", function () { step(-1); });
    $("rashifal-next").addEventListener("click", function () { step(1); });
    UI.on("day", render);
    UI.on("lang", render);
    render();
  }

  UI.rashifal = { init: init };
})(this);
