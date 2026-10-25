/*
 * Shared state, text and helpers for the Patro screens (ui/*.js).
 * Screens register their own text with addText() and listen for changes with
 * on("day" | "lang", fn).
 */
(function (root) {
  "use strict";

  var BS = root.PatroBS;

  var AD_MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var AD_MONTHS_NE = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट",
    "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];

  var TEXT = { ne: {}, en: {} };
  var listeners = {};

  function readSetting(key, allowed, fallback) {
    try {
      var v = root.localStorage.getItem(key);
      if (allowed.indexOf(v) >= 0) return v;
    } catch (e) { /* storage unavailable */ }
    return fallback;
  }

  function saveSetting(key, value) {
    try { root.localStorage.setItem(key, value); } catch (e) { /* not persisted */ }
  }

  var state = {
    lang: readSetting("patro.lang", ["ne", "en"], "ne"),
    theme: readSetting("patro.theme", ["system", "light", "dark"], "system"),
    selected: BS.nepalToday(),
    view: "calendar"
  };

  var UI = {
    state: state,
    AD_MONTHS_NE: AD_MONTHS_NE,
    AD_MONTHS_EN: AD_MONTHS_EN,
    saveSetting: saveSetting,

    addText: function (texts) {
      Object.keys(texts.ne).forEach(function (k) { TEXT.ne[k] = texts.ne[k]; });
      Object.keys(texts.en).forEach(function (k) { TEXT.en[k] = texts.en[k]; });
    },
    t: function (key) { return TEXT[state.lang][key]; },
    fill: function (template, values) {
      return template.replace(/\{(\w+)\}/g, function (_, k) { return values[k]; });
    },
    pick: function (pair) { return pair[state.lang]; },
    num: function (n) { return state.lang === "ne" ? BS.toNepaliDigits(n) : String(n); },
    money: function (n, decimals) {
      return UI.num(n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    },

    bsMonthName: function (m) { return (state.lang === "ne" ? BS.MONTHS_NE : BS.MONTHS_EN)[m - 1]; },
    adMonthName: function (m) { return (state.lang === "ne" ? AD_MONTHS_NE : AD_MONTHS_EN)[m - 1]; },
    weekdayName: function (w) { return (state.lang === "ne" ? BS.WEEKDAYS_NE : BS.WEEKDAYS_EN)[w]; },
    formatBs: function (d) { return UI.num(d.year) + " " + UI.bsMonthName(d.month) + " " + UI.num(d.day); },
    formatAd: function (d) {
      return state.lang === "ne"
        ? UI.num(d.year) + " " + AD_MONTHS_NE[d.month - 1] + " " + UI.num(d.day)
        : AD_MONTHS_EN[d.month - 1] + " " + d.day + ", " + d.year;
    },
    nepalTime: function (ms) {
      var d = new Date(ms + (5 * 60 + 45) * 60000);
      var h = d.getUTCHours();
      var m = d.getUTCMinutes();
      return UI.num((h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m);
    },
    // Nepal's calendar date of a moment, as text.
    dateOfMoment: function (ms) {
      return UI.formatBs(BS.dayNumberToBs(Math.floor((ms + (5 * 60 + 45) * 60000) / 86400000)));
    },

    $: function (id) { return document.getElementById(id); },
    el: function (tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    },
    clear: function (node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    },
    link: function (href, text) {
      var a = UI.el("a", null, text || href.replace(/^https:\/\//, "").replace(/\/$/, ""));
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      return a;
    },

    on: function (event, fn) { (listeners[event] = listeners[event] || []).push(fn); },
    emit: function (event) { (listeners[event] || []).forEach(function (fn) { fn(); }); },

    selectDay: function (n) {
      state.selected = n;
      UI.emit("day");
    },
    setLang: function (lang) {
      state.lang = lang;
      saveSetting("patro.lang", lang);
      document.documentElement.lang = lang;
      UI.emit("lang");
    }
  };

  root.PatroUI = UI;
})(this);
