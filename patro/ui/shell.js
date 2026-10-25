/*
 * App shell: bottom menu, screens, the settings sheet (theme and language),
 * the clock and start-up.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var t = UI.t;
  var $ = UI.$;

  var VIEWS = ["calendar", "rashifal", "converter", "forex", "fuel", "events"];
  var THEME_COLORS = { light: "#c8102e", dark: "#1d1c1a" };
  var themeSetByApp = false;

  UI.addText({
    ne: {
      navCalendar: "पात्रो",
      navRashifal: "राशिफल",
      navConverter: "मिति",
      navForex: "विनिमय",
      navFuel: "इन्धन",
      navMore: "थप",
      settings: "सेटिङ",
      theme: "रङ",
      themeSystem: "फोन अनुसार",
      themeLight: "उज्यालो",
      themeDark: "अँध्यारो",
      language: "भाषा",
      close: "बन्द गर्नुहोस्",
      langButton: "English",
      about: "Patro: नेपाली पात्रो। तिथि, चाडपर्व र राशिफल यही उपकरणमा गणना हुन्छन्; विनिमय दर नेपाल राष्ट्र बैंक, सुनचाँदी महासंघ र नेपाल आयल निगमबाट आउँछन्।"
    },
    en: {
      navCalendar: "Calendar",
      navRashifal: "Rashifal",
      navConverter: "Dates",
      navForex: "Exchange",
      navFuel: "Fuel",
      navMore: "More",
      settings: "Settings",
      theme: "Theme",
      themeSystem: "Phone setting",
      themeLight: "Light",
      themeDark: "Dark",
      language: "Language",
      close: "Close",
      langButton: "नेपाली",
      about: "Patro: a Nepali calendar. Tithi, festivals and rashifal are computed on this device; rates come from Nepal Rastra Bank, FENEGOSIDA and Nepal Oil Corporation."
    }
  });

  // ---- Screens ----

  function viewFromHash() {
    var h = (root.location.hash || "").replace("#", "");
    return VIEWS.indexOf(h) >= 0 ? h : "calendar";
  }

  function show(view) {
    UI.state.view = view;
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (section) {
      section.hidden = section.getAttribute("data-view") !== view;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".nav-item[data-target]"), function (item) {
      if (item.getAttribute("data-target") === view) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    root.scrollTo(0, 0);
  }

  // Each screen gets a history entry, so the phone's back button returns to
  // the previous one.
  UI.navigate = function (view) {
    if (view === UI.state.view) { root.scrollTo(0, 0); return; }
    root.location.hash = view;
  };

  // ---- Theme ----

  function applyTheme(mode) {
    var html = document.documentElement;
    if (mode === "system") {
      if (themeSetByApp) html.removeAttribute("data-theme");
      themeSetByApp = false;
    } else {
      html.setAttribute("data-theme", mode);
      themeSetByApp = true;
    }
    var dark = mode === "dark" || (mode === "system" && root.matchMedia &&
      root.matchMedia("(prefers-color-scheme: dark)").matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? THEME_COLORS.dark : THEME_COLORS.light);
    if (root.PatroNative && typeof root.PatroNative.setThemeMode === "function") {
      root.PatroNative.setThemeMode(mode);
    }
  }

  function setTheme(mode) {
    UI.state.theme = mode;
    UI.saveSetting("patro.theme", mode);
    applyTheme(mode);
    renderSheet();
  }

  // ---- Settings sheet ----

  function renderSheet() {
    $("more-title").textContent = t("settings");
    $("theme-label").textContent = t("theme");
    $("lang-label").textContent = t("language");
    $("sheet-close").textContent = t("close");
    $("about-text").textContent = t("about");
    [["system", "themeSystem"], ["light", "themeLight"], ["dark", "themeDark"]].forEach(function (pair) {
      var b = $("theme-" + pair[0]);
      b.textContent = t(pair[1]);
      b.setAttribute("aria-checked", String(UI.state.theme === pair[0]));
    });
    $("lang-ne").setAttribute("aria-checked", String(UI.state.lang === "ne"));
    $("lang-en").setAttribute("aria-checked", String(UI.state.lang === "en"));
  }

  function openSheet() {
    renderSheet();
    $("more-sheet").hidden = false;
    $("nav-more").setAttribute("aria-expanded", "true");
    $("theme-" + UI.state.theme).focus();
  }

  function closeSheet() {
    if ($("more-sheet").hidden) return;
    $("more-sheet").hidden = true;
    $("nav-more").setAttribute("aria-expanded", "false");
    $("nav-more").focus();
  }

  function renderNav() {
    [["calendar", "navCalendar"], ["rashifal", "navRashifal"], ["converter", "navConverter"],
      ["forex", "navForex"], ["fuel", "navFuel"], ["more", "navMore"]].forEach(function (pair) {
      $("nav-" + pair[0]).querySelector(".nav-label").textContent = t(pair[1]);
    });
    $("lang-toggle").textContent = t("langButton");
  }

  // ---- Start-up ----

  function tickClock() {
    $("clock").textContent = UI.nepalTime(Date.now()) + " NPT";
  }

  // Lets the installed web app (iPhone "Add to Home Screen") open offline.
  // Service workers need HTTPS; the Android app and file:// pages skip this.
  function registerOfflineSupport() {
    if (root.PatroNative || !("serviceWorker" in navigator) ||
      (root.location.protocol !== "https:" && root.location.hostname !== "localhost")) return;
    try {
      navigator.serviceWorker.register("sw.js").catch(function () { /* runs without offline support */ });
    } catch (e) { /* runs without offline support */ }
  }

  function init() {
    document.documentElement.lang = UI.state.lang;
    applyTheme(UI.state.theme);
    UI.calendar.init();
    UI.upcoming.init();
    UI.rashifal.init();
    UI.converter.init();
    UI.markets.init();
    renderNav();
    renderSheet();
    show(viewFromHash());
    tickClock();
    registerOfflineSupport();

    Array.prototype.forEach.call(document.querySelectorAll(".nav-item[data-target]"), function (item) {
      item.addEventListener("click", function () { UI.navigate(item.getAttribute("data-target")); });
    });
    root.addEventListener("hashchange", function () { show(viewFromHash()); });

    $("nav-more").addEventListener("click", openSheet);
    $("sheet-close").addEventListener("click", closeSheet);
    $("more-sheet").addEventListener("click", function (e) {
      if (e.target === $("more-sheet")) closeSheet();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSheet();
    });
    ["system", "light", "dark"].forEach(function (mode) {
      $("theme-" + mode).addEventListener("click", function () { setTheme(mode); });
    });
    $("lang-ne").addEventListener("click", function () { UI.setLang("ne"); });
    $("lang-en").addEventListener("click", function () { UI.setLang("en"); });
    $("lang-toggle").addEventListener("click", function () {
      UI.setLang(UI.state.lang === "ne" ? "en" : "ne");
    });
    UI.on("lang", function () { renderNav(); renderSheet(); tickClock(); });

    if (root.matchMedia) {
      var query = root.matchMedia("(prefers-color-scheme: dark)");
      var follow = function () { if (UI.state.theme === "system") applyTheme("system"); };
      if (query.addEventListener) query.addEventListener("change", follow);
      else if (query.addListener) query.addListener(follow);
    }

    // Keep the clock moving and roll the date over at midnight Nepal Time.
    var shownDay = BS.nepalToday();
    setInterval(function () {
      tickClock();
      var now = BS.nepalToday();
      if (now !== shownDay) {
        shownDay = now;
        UI.emit("tick");
      }
    }, 15000);
  }

  init();
})(this);
