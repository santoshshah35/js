/*
 * Events, public holidays and sait (auspicious days) that the admin adds in
 * content/events.json. Dates are Bikram Sambat; a yearly entry repeats on
 * the same BS month and day every year.
 */
(function (root) {
  "use strict";

  var node = typeof module !== "undefined" && module.exports;
  var BS = node ? require("./bs.js") : root.PatroBS;

  var KINDS = ["event", "holiday", "sait"];
  var MAX_EVENTS = 500;
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function text(value, max) {
    return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
  }

  function pair(value, max) {
    if (!value || typeof value !== "object") return null;
    var ne = text(value.ne, max);
    var en = text(value.en, max);
    if (!ne && !en) return null;
    return { ne: ne || en, en: en || ne };
  }

  // "2083-07-15" to {year, month, day}, or null when it isn't a real BS date.
  function bsDate(value, yearly) {
    var m = typeof value === "string" ? DATE_RE.exec(value) : null;
    if (!m) return null;
    var y = +m[1];
    var mo = +m[2];
    var d = +m[3];
    if (mo < 1 || mo > 12 || d < 1) return null;
    if (yearly) return d <= 32 ? { year: null, month: mo, day: d } : null;
    if (y < BS.FIRST_YEAR || y > BS.LAST_YEAR || d > BS.daysInMonth(y, mo)) return null;
    return { year: y, month: mo, day: d };
  }

  /**
   * Checks events.json and keeps the valid entries.
   * @returns {{events: object[], skipped: number}}
   */
  function parseEvents(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    var raw = json && Array.isArray(json.events) ? json.events : null;
    if (!raw) throw new Error("No events list");
    var events = [];
    var seen = {};
    raw.slice(0, MAX_EVENTS).forEach(function (r) {
      if (!r || typeof r !== "object") return;
      var id = text(r.id, 64);
      var kind = KINDS.indexOf(r.kind) >= 0 ? r.kind : null;
      var title = pair(r.title, 80);
      var date = bsDate(r.date, r.yearly === true);
      if (!id || !kind || !title || !date || seen[id]) return;
      seen[id] = true;
      events.push({ id: id, kind: kind, title: title, date: date, yearly: r.yearly === true });
    });
    return { events: events, skipped: raw.length - events.length };
  }

  /**
   * The admin's entries on a BS date, as calendar events.
   * @returns {{ne:string, en:string, kind:string}[]}
   */
  function eventsOn(events, bs) {
    var out = [];
    events.forEach(function (e) {
      if (e.date.month === bs.month && e.date.day === bs.day && (e.yearly || e.date.year === bs.year)) {
        out.push({ ne: e.title.ne, en: e.title.en, kind: e.kind });
      }
    });
    return out;
  }

  var api = { KINDS: KINDS, parseEvents: parseEvents, eventsOn: eventsOn };

  if (node) module.exports = api;
  else root.PatroCustomEvents = api;
})(this);
