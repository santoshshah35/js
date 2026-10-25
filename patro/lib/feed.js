/*
 * Notices and ads that an admin publishes without an app update.
 *
 * The app downloads content/feed.json from the GitHub repository when it
 * opens. Every entry is checked here; anything malformed, unsafe or outside
 * its dates is dropped rather than shown. See content/README.md for the
 * format.
 */
(function (root) {
  "use strict";

  // Tried in order; the first one that answers with a valid feed wins.
  var FEED_URLS = [
    "https://raw.githubusercontent.com/santoshshah35/js/main/patro/content/feed.json",
    "https://raw.githubusercontent.com/santoshshah35/js/claude/new-session-94tzzd/patro/content/feed.json"
  ];

  var SLOTS = ["top", "rashifal", "forex", "fuel"];
  var KINDS = ["notice", "ad"];
  var MAX_ITEMS = 20;
  var LIMITS = { id: 64, title: 120, body: 400, cta: 40, url: 500 };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function text(value, max) {
    return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
  }

  // A {ne, en} pair where at least one language is present; the other falls
  // back to it.
  function pair(value, max) {
    if (!value || typeof value !== "object") return null;
    var ne = text(value.ne, max);
    var en = text(value.en, max);
    if (!ne && !en) return null;
    return { ne: ne || en, en: en || ne };
  }

  function httpsUrl(value) {
    var s = text(value, LIMITS.url);
    return s && /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
  }

  function dayOf(value) {
    if (typeof value !== "string" || !DATE_RE.test(value)) return null;
    var p = value.split("-").map(Number);
    var ms = Date.UTC(p[0], p[1] - 1, p[2]);
    var d = new Date(ms);
    return d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2] ? Math.round(ms / 86400000) : null;
  }

  function cleanItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = text(raw.id, LIMITS.id);
    var slot = SLOTS.indexOf(raw.slot) >= 0 ? raw.slot : null;
    var kind = KINDS.indexOf(raw.kind) >= 0 ? raw.kind : null;
    var title = pair(raw.title, LIMITS.title);
    if (!id || !slot || !kind || !title) return null;
    var start = raw.start === undefined ? null : dayOf(raw.start);
    var end = raw.end === undefined ? null : dayOf(raw.end);
    if ((raw.start !== undefined && start === null) || (raw.end !== undefined && end === null)) return null;
    return {
      id: id,
      slot: slot,
      kind: kind,
      title: title,
      body: raw.body === undefined ? null : pair(raw.body, LIMITS.body),
      link: raw.link === undefined ? null : httpsUrl(raw.link),
      cta: raw.cta === undefined ? null : pair(raw.cta, LIMITS.cta),
      image: raw.image === undefined ? null : httpsUrl(raw.image),
      start: start,
      end: end
    };
  }

  /**
   * Checks a feed document and keeps the valid entries.
   * @param {string|object} body JSON text or parsed object
   * @returns {{items: object[], skipped: number}}
   */
  function parseFeed(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    var raw = json && Array.isArray(json.items) ? json.items : null;
    if (!raw) throw new Error("Feed has no items list");
    var items = [];
    var seen = {};
    raw.slice(0, MAX_ITEMS).forEach(function (r) {
      var item = cleanItem(r);
      if (item && !seen[item.id]) {
        seen[item.id] = true;
        items.push(item);
      }
    });
    return { items: items, skipped: raw.length - items.length };
  }

  /**
   * Entries to show in a slot on a day (Nepal date, days since 1970-01-01).
   * Dates are inclusive; dismissed ids are left out.
   */
  function activeItems(items, slot, today, dismissed) {
    return items.filter(function (item) {
      return item.slot === slot
        && (item.start === null || item.start <= today)
        && (item.end === null || today <= item.end)
        && !(dismissed && dismissed.indexOf(item.id) >= 0);
    });
  }

  var api = {
    FEED_URLS: FEED_URLS,
    SLOTS: SLOTS,
    parseFeed: parseFeed,
    activeItems: activeItems
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroFeed = api;
})(this);
