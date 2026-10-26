/*
 * Admin-managed files the app reads at start-up: config.json (login keys and
 * members-only features) and events.json (events, holidays and sait).
 * The last good copy of each is kept so the app works offline.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var Config = root.PatroConfig;
  var Custom = root.PatroCustomEvents;
  var Upcoming = root.PatroUpcoming;
  var Rates = root.PatroRates;

  var REFRESH_MS = 30 * 60 * 1000;
  var lastAttempt = 0;

  UI.state.config = Config.DEFAULTS;

  function readCache(key) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(key, body) {
    try { root.localStorage.setItem(key, JSON.stringify({ at: Date.now(), body: body })); } catch (e) { /* not cached */ }
  }

  // Each file: how it's checked, and what using it does.
  var FILES = [
    {
      name: "config.json",
      parse: Config.parseConfig,
      use: function (config) {
        UI.state.config = config;
        UI.emit("config");
      }
    },
    {
      name: "events.json",
      parse: Custom.parseEvents,
      use: function (parsed) {
        Upcoming.setSource("admin", parsed.events.length ? function (bs) { return Custom.eventsOn(parsed.events, bs); } : null);
        UI.emit("events");
      }
    }
  ];

  function apply(file, body) {
    try {
      file.use(file.parse(body));
      return true;
    } catch (e) {
      return false;
    }
  }

  function fetchFile(file, urls, i) {
    return Rates.httpGet(urls[i]).then(function (body) {
      if (apply(file, body)) writeCache("patro.remote." + file.name, body);
      else throw new Error("Invalid " + file.name);
    }).catch(function () {
      // Offline, or nothing valid at this address: try the next, then keep
      // the saved copy.
      if (i + 1 < urls.length) return fetchFile(file, urls, i + 1);
      return null;
    });
  }

  function refresh() {
    lastAttempt = Date.now();
    FILES.forEach(function (file) { fetchFile(file, Config.contentUrls(file.name), 0); });
  }

  // Saved copies are applied at once, before the screens draw.
  function loadSaved() {
    FILES.forEach(function (file) {
      var cached = readCache("patro.remote." + file.name);
      if (cached && cached.body) apply(file, cached.body);
    });
  }

  function init() {
    refresh();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt > REFRESH_MS) refresh();
    });
  }

  UI.remote = { loadSaved: loadSaved, init: init };
})(this);
