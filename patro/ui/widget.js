/*
 * Data for the Android home-screen widget. The widget can't run this page's
 * calendar code, so each time the app opens it hands over the text for the
 * next DAYS days; the widget picks today's row by Nepal's date.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Tithi = root.PatroTithi;
  var Upcoming = root.PatroUpcoming;

  var DAYS = 400;

  UI.addText({
    ne: { widgetNext: "आउँदो: {name} · {when}", widgetDaysLeft: "{n} दिनपछि", widgetTomorrow: "भोलि" },
    en: { widgetNext: "Next: {name} · {when}", widgetDaysLeft: "in {n} days", widgetTomorrow: "tomorrow" }
  });

  function names(events) {
    return events.map(UI.pick).join(", ");
  }

  // [day number, day, month and year, weekday · AD date, tithi, event line]
  function rows() {
    var today = BS.nepalToday();
    var last = BS.bsToDayNumber(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12));
    var end = Math.min(today + DAYS, last);
    var eventDays = Upcoming.upcoming(today, end - today + 60);
    var next = 0;
    var out = [];
    for (var n = today; n <= end; n++) {
      while (next < eventDays.length && eventDays[next].day < n) next++;
      var line = "";
      var ev = eventDays[next];
      if (ev && ev.day === n) {
        line = names(ev.events);
      } else if (ev) {
        var diff = ev.day - n;
        line = UI.fill(UI.t("widgetNext"), {
          name: names(ev.events),
          when: diff === 1 ? UI.t("widgetTomorrow") : UI.fill(UI.t("widgetDaysLeft"), { n: UI.num(diff) })
        });
      }
      var bs = BS.dayNumberToBs(n);
      var tithi = Tithi.tithiOn(n);
      out.push([
        n,
        UI.num(bs.day),
        UI.bsMonthName(bs.month) + " " + UI.num(bs.year),
        UI.weekdayName(BS.weekday(n)) + " · " + UI.formatAd(BS.fromDayNumber(n)),
        UI.pick(tithi.paksha) + " " + UI.pick(tithi.name),
        line
      ]);
    }
    return out;
  }

  function publish() {
    var bridge = root.PatroNative;
    if (!bridge || typeof bridge.saveWidgetData !== "function") return;
    try {
      bridge.saveWidgetData(JSON.stringify({ version: 1, rows: rows() }));
    } catch (e) { /* the widget keeps its previous data */ }
  }

  function init() {
    if (!root.PatroNative) return;
    // After the first screen has drawn, so start-up stays quick.
    setTimeout(publish, 1500);
    UI.on("lang", publish);
    UI.on("tick", publish);
  }

  UI.widget = { init: init, rows: rows };
})(this);
