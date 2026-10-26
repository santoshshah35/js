/*
 * Breaking news and announcements from the admin (lib/alerts.js): a strip
 * under the header while an alert is fresh, and the notifications switch
 * in the settings sheet. On Android the app itself checks for alerts in the
 * background and shows phone notifications; in a browser, notifications
 * show while Patro is open.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var Alerts = root.PatroAlerts;
  var Config = root.PatroConfig;
  var Rates = root.PatroRates;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var CACHE_KEY = "patro.alerts";
  var CLOSED_KEY = "patro.alerts.closed";
  var NOTIFIED_KEY = "patro.alerts.notified";
  var SETTING_KEY = "patro.notifications";
  var REFRESH_MS = 5 * 60 * 1000;

  var alerts = [];

  UI.addText({
    ne: {
      alertBreaking: "ब्रेकिङ",
      alertImportant: "महत्वपूर्ण",
      alertInfo: "सूचना",
      alertClose: "बन्द गर्नुहोस्",
      notifications: "ब्रेकिङ न्युज सूचना (नोटिफिकेसन)",
      notifyOn: "खुला",
      notifyOff: "बन्द",
      notifyBlocked: "यो ब्राउजरले सूचना रोकेको छ। ब्राउजरको सेटिङबाट अनुमति दिनुहोस्।",
      notifyWebNote: "ब्राउजरमा Patro खुला हुँदा मात्र सूचना आउँछ। एन्ड्रोइड एपमा बन्द हुँदा पनि आउँछ।"
    },
    en: {
      alertBreaking: "Breaking",
      alertImportant: "Important",
      alertInfo: "Notice",
      alertClose: "Close",
      notifications: "Breaking news notifications",
      notifyOn: "On",
      notifyOff: "Off",
      notifyBlocked: "This browser has blocked notifications. Allow them in the browser's settings.",
      notifyWebNote: "In a browser, notifications arrive while Patro is open. The Android app gets them even when closed."
    }
  });

  var LEVEL_TEXT = { breaking: "alertBreaking", important: "alertImportant", info: "alertInfo" };

  function readJson(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not saved */ }
  }

  function enabled() {
    return readJson(SETTING_KEY, true) !== false;
  }

  function native() {
    var b = root.PatroNative;
    return b && typeof b.setNotifications === "function" ? b : null;
  }

  // ---- The strip under the header ----

  function render() {
    var strip = $("alert-strip");
    var closed = readJson(CLOSED_KEY, []);
    var current = Alerts.freshAlerts(alerts, Date.now()).filter(function (a) { return closed.indexOf(a.id) < 0; })[0];
    UI.clear(strip);
    strip.hidden = !current;
    if (!current) return;
    strip.className = "alert-strip level-" + current.level;
    var body = el(current.link ? "a" : "div", "alert-body");
    if (current.link) {
      body.href = current.link;
      body.target = "_blank";
      body.rel = "noopener";
    }
    body.appendChild(el("span", "alert-label", t(LEVEL_TEXT[current.level])));
    body.appendChild(el("span", "alert-title", UI.pick(current.title)));
    if (current.body) body.appendChild(el("span", "alert-text", UI.pick(current.body)));
    strip.appendChild(body);
    var close = el("button", "alert-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("alertClose"));
    close.addEventListener("click", function () {
      writeJson(CLOSED_KEY, closed.concat([current.id]).slice(-50));
      render();
    });
    strip.appendChild(close);
  }

  // ---- Browser notifications while the page is open ----

  function notifyInBrowser() {
    if (native() || !enabled() || !("Notification" in root) || root.Notification.permission !== "granted") return;
    var done = readJson(NOTIFIED_KEY, []);
    Alerts.freshAlerts(alerts, Date.now()).filter(function (a) { return done.indexOf(a.id) < 0; }).forEach(function (a) {
      try {
        var n = new root.Notification(t(LEVEL_TEXT[a.level]) + ": " + UI.pick(a.title), {
          body: a.body ? UI.pick(a.body) : "",
          tag: a.id,
          icon: "icons/icon-180.png"
        });
        n.onclick = function () {
          root.focus();
          if (a.link) root.open(a.link, "_blank", "noopener");
        };
      } catch (e) { /* some browsers only allow notifications from a service worker */ }
      done.push(a.id);
    });
    writeJson(NOTIFIED_KEY, done.slice(-50));
  }

  // ---- Loading ----

  function use(body) {
    alerts = Alerts.parseAlerts(body).alerts;
    render();
    notifyInBrowser();
  }

  function fetchAlerts(urls, i) {
    return Rates.httpGet(urls[i]).then(function (body) {
      use(body);
      writeJson(CACHE_KEY, body);
    }).catch(function () {
      if (i + 1 < urls.length) return fetchAlerts(urls, i + 1);
      return null;
    });
  }

  function refresh() {
    fetchAlerts(Config.contentUrls("alerts.json"), 0);
  }

  // ---- Settings switch ----

  function renderSetting() {
    $("notify-label").textContent = t("notifications");
    var on = enabled();
    $("notify-on").textContent = t("notifyOn");
    $("notify-off").textContent = t("notifyOff");
    $("notify-on").setAttribute("aria-checked", String(on));
    $("notify-off").setAttribute("aria-checked", String(!on));
    var note = "";
    if (!native()) {
      var blocked = "Notification" in root && root.Notification.permission === "denied";
      note = on && blocked ? t("notifyBlocked") : t("notifyWebNote");
    }
    $("notify-note").textContent = note;
  }

  function setEnabled(on) {
    writeJson(SETTING_KEY, on);
    var bridge = native();
    if (bridge) bridge.setNotifications(on, UI.state.lang);
    else if (on && "Notification" in root && root.Notification.permission === "default") {
      root.Notification.requestPermission().then(function () { renderSetting(); notifyInBrowser(); });
    }
    renderSetting();
  }

  function init() {
    var cached = readJson(CACHE_KEY, null);
    if (cached) {
      try { use(cached); } catch (e) { /* a broken saved copy is ignored */ }
    }
    $("notify-on").addEventListener("click", function () { setEnabled(true); });
    $("notify-off").addEventListener("click", function () { setEnabled(false); });
    // Tell the Android app the current choice and language for its
    // background checks.
    var bridge = native();
    if (bridge) bridge.setNotifications(enabled(), UI.state.lang);
    UI.on("lang", function () {
      render();
      renderSetting();
      if (native()) native().setNotifications(enabled(), UI.state.lang);
    });
    UI.on("tick", render);
    renderSetting();
    refresh();
    setInterval(function () {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") refresh();
    });
  }

  UI.alerts = { init: init };
})(this);
