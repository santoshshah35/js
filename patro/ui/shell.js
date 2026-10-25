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
  // The bottom-menu tabs in order, for swiping between them.
  var TABS = ["calendar", "rashifal", "converter", "forex", "fuel"];
  var SWIPE_MIN_PX = 60;
  var SWIPE_MAX_MS = 700;
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

  function show(view, from) {
    UI.state.view = view;
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (section) {
      section.hidden = section.getAttribute("data-view") !== view;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".nav-item[data-target]"), function (item) {
      if (item.getAttribute("data-target") === view) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    root.scrollTo(0, 0);
    if (from) {
      var section = document.querySelector('[data-view="' + view + '"]');
      section.classList.remove("slide-from-left", "slide-from-right");
      void section.offsetWidth; // restart the animation
      section.classList.add(from === "right" ? "slide-from-right" : "slide-from-left");
    }
  }

  // Switching screens replaces the address instead of adding a history entry,
  // so the phone's back button leaves the app rather than stepping back
  // through every tab visited.
  UI.navigate = function (view, from) {
    if (view === UI.state.view) { root.scrollTo(0, 0); return; }
    try {
      root.history.replaceState(null, "", "#" + view);
    } catch (e) { /* some embedded views refuse it; the screen still switches */ }
    show(view, from);
  };

  // ---- Swipe between tabs ----

  // Drag left for the next tab (towards Fuel), right for the previous one
  // (towards Calendar). Ignored on controls and sideways-scrolling tables.
  function enableSwipe() {
    var start = null;
    document.addEventListener("touchstart", function (e) {
      start = null;
      if (e.touches.length !== 1 || !$("more-sheet").hidden) return;
      if (e.target.closest("input, select, textarea, .rates-scroll, .bottom-nav")) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!start || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - start.x;
      var dy = e.changedTouches[0].clientY - start.y;
      var quick = Date.now() - start.time <= SWIPE_MAX_MS;
      start = null;
      if (!quick || Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
      var current = TABS.indexOf(UI.state.view);
      if (current < 0) current = 0; // the events list sits with the calendar
      var next = current + (dx < 0 ? 1 : -1);
      if (next < 0 || next >= TABS.length) return;
      UI.navigate(TABS[next], dx < 0 ? "right" : "left");
    }, { passive: true });
  }

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
    if ($("more-sheet").hidden) return false;
    $("more-sheet").hidden = true;
    $("nav-more").setAttribute("aria-expanded", "false");
    $("nav-more").focus();
    return true;
  }

  // The Android app asks this before closing on the back button: true means
  // the page used the press (to close the settings sheet).
  root.__patroBack = function () {
    return closeSheet();
  };

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
    UI.feed.init();
    UI.widget.init();
    renderNav();
    renderSheet();
    show(viewFromHash());
    tickClock();
    registerOfflineSupport();
    enableSwipe();

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
