/*
 * Breaking news and important announcements the admin sends from the admin
 * panel (content/alerts.json). The Android app checks for new ones in the
 * background and shows a phone notification; inside the app they show as
 * a strip under the header.
 */
(function (root) {
  "use strict";

  var LEVELS = ["breaking", "important", "info"];
  var MAX_ALERTS = 20;
  // An alert older than this is no longer shown or notified.
  var FRESH_HOURS = 24;

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

  /**
   * Checks alerts.json and keeps the valid alerts, newest first.
   * @returns {{alerts: object[], skipped: number}}
   */
  function parseAlerts(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    var raw = json && Array.isArray(json.alerts) ? json.alerts : null;
    if (!raw) throw new Error("No alerts list");
    var seen = {};
    var alerts = [];
    raw.slice(0, MAX_ALERTS).forEach(function (r) {
      if (!r || typeof r !== "object") return;
      var id = text(r.id, 64);
      var title = pair(r.title, 120);
      var sentAt = typeof r.sentAt === "string" ? Date.parse(r.sentAt) : NaN;
      var link = text(r.link, 500);
      if (!id || !title || isNaN(sentAt) || seen[id] || (link && !/^https:\/\/[^\s"'<>]+$/i.test(link))) return;
      seen[id] = true;
      alerts.push({
        id: id,
        level: LEVELS.indexOf(r.level) >= 0 ? r.level : "breaking",
        title: title,
        body: r.body === undefined ? null : pair(r.body, 300),
        link: link,
        sentAt: sentAt
      });
    });
    alerts.sort(function (a, b) { return b.sentAt - a.sentAt; });
    return { alerts: alerts, skipped: raw.length - alerts.length };
  }

  /** Alerts sent within the last day (and not in the future by much). */
  function freshAlerts(alerts, now) {
    return alerts.filter(function (a) {
      return a.sentAt <= now + 3600000 && now - a.sentAt < FRESH_HOURS * 3600000;
    });
  }

  var api = { LEVELS: LEVELS, MAX_ALERTS: MAX_ALERTS, FRESH_HOURS: FRESH_HOURS, parseAlerts: parseAlerts, freshAlerts: freshAlerts };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroAlerts = api;
})(this);
