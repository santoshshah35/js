/*
 * Festivals and national days on a day, and the ones coming up.
 */
(function (root) {
  "use strict";

  var node = typeof module !== "undefined" && module.exports;
  var BS = node ? require("./bs.js") : root.PatroBS;
  var Lunar = node ? require("./lunar.js") : root.PatroLunar;
  var Events = node ? require("./events.js") : root.PatroEvents;

  /**
   * Every festival and observance on a civil day.
   * @param {number} dayNumber days since 1970-01-01
   * @returns {{ne:string, en:string}[]}
   */
  function eventsOn(dayNumber) {
    var bs = BS.dayNumberToBs(dayNumber);
    var ad = BS.fromDayNumber(dayNumber);
    return Lunar.festivalsOn(dayNumber).concat(Events.eventsOn(bs, ad));
  }

  /**
   * Days with events from a day onward.
   * @param {number} fromDay first day to look at (included)
   * @param {number} maxDays how many days ahead to look
   * @param {number} [limit] stop after this many days with events
   * @returns {{day:number, events:{ne:string, en:string}[]}[]}
   */
  function upcoming(fromDay, maxDays, limit) {
    var lastDay = BS.bsToDayNumber(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12));
    var out = [];
    for (var n = fromDay; n < fromDay + maxDays && n <= lastDay; n++) {
      var events = eventsOn(n);
      if (events.length) {
        out.push({ day: n, events: events });
        if (limit && out.length >= limit) break;
      }
    }
    return out;
  }

  var api = { eventsOn: eventsOn, upcoming: upcoming };

  if (node) module.exports = api;
  else root.PatroUpcoming = api;
})(this);
