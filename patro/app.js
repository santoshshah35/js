(function () {
  "use strict";

  var BS = window.PatroBS;
  var Tithi = window.PatroTithi;
  var Events = window.PatroEvents;
  var Lunar = window.PatroLunar;

  var AD_MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var AD_MONTHS_NE = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट",
    "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];
  var WEEKDAYS_SHORT_NE = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
  var WEEKDAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var TEXT = {
    ne: {
      today: "आज",
      convert: "रूपान्तरण",
      converter: "मिति रूपान्तरण",
      bs2ad: "बि.सं. → ई.सं.",
      ad2bs: "ई.सं. → बि.सं.",
      year: "साल",
      day: "गते",
      events: "यस महिनाका चाडपर्व र दिवसहरू",
      noEvents: "यस महिनामा कुनै चाडपर्व वा दिवस छैन।",
      lunarMonth: "चन्द्र मास",
      sunrise: "सूर्योदय",
      saturday: "सार्वजनिक बिदा (शनिबार)",
      bs: "बि.सं.",
      langButton: "English",
      footer: "तिथि र चाडपर्व काठमाडौंका लागि खगोलीय गणनाबाट निकालिएका हुन्। तिथि सूर्योदयको नजिक फेरिने वर्ष चाडपर्व प्रकाशित पात्रोभन्दा एक दिन फरक पर्न सक्छ। सरकारी बिदा समावेश छैनन्।"
    },
    en: {
      today: "Today",
      convert: "Convert",
      converter: "Date converter",
      bs2ad: "BS → AD",
      ad2bs: "AD → BS",
      year: "Year",
      day: "Day",
      events: "Festivals and national days this month",
      noEvents: "No festivals or national days this month.",
      lunarMonth: "Lunar month",
      sunrise: "Sunrise",
      saturday: "Weekly holiday (Saturday)",
      bs: "BS",
      langButton: "नेपाली",
      footer: "Tithi and festivals are computed astronomically for Kathmandu. In a year when the tithi changes close to sunrise, a festival can be a day off from a printed panchang. Government holidays are not included."
    }
  };

  var state = {
    lang: readLang(),
    year: 0,
    month: 0,
    selected: 0,
    convMode: "bs2ad"
  };

  function readLang() {
    try {
      var saved = window.localStorage.getItem("patro.lang");
      if (saved === "ne" || saved === "en") return saved;
    } catch (e) { /* storage unavailable: fall back to default */ }
    return "ne";
  }

  function saveLang(lang) {
    try { window.localStorage.setItem("patro.lang", lang); } catch (e) { /* not persisted */ }
  }

  function $(id) { return document.getElementById(id); }

  function t(key) { return TEXT[state.lang][key]; }

  function num(n) { return state.lang === "ne" ? BS.toNepaliDigits(n) : String(n); }

  function bsMonthName(m) { return (state.lang === "ne" ? BS.MONTHS_NE : BS.MONTHS_EN)[m - 1]; }

  function adMonthName(m) { return (state.lang === "ne" ? AD_MONTHS_NE : AD_MONTHS_EN)[m - 1]; }

  function weekdayName(w) { return (state.lang === "ne" ? BS.WEEKDAYS_NE : BS.WEEKDAYS_EN)[w]; }

  function pick(pair) { return pair[state.lang]; }

  function formatBs(d) {
    return num(d.year) + " " + bsMonthName(d.month) + " " + num(d.day);
  }

  function formatAd(d) {
    return state.lang === "ne"
      ? num(d.year) + " " + adMonthName(d.month) + " " + num(d.day)
      : AD_MONTHS_EN[d.month - 1] + " " + d.day + ", " + d.year;
  }

  function nepalTimeString(ms) {
    var d = new Date(ms + (5 * 60 + 45) * 60000);
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
    var text = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    return num(text);
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---- Header ----

  function renderHeader() {
    var today = BS.nepalToday();
    var bs = BS.dayNumberToBs(today);
    var ad = BS.fromDayNumber(today);
    var tithi = Tithi.tithiOn(today);
    $("today-bs").textContent = formatBs(bs) + ", " + weekdayName(BS.weekday(today));
    $("today-meta").textContent = formatAd(ad) + " · " + pick(tithi.paksha) + " " + pick(tithi.name);
    $("lang-toggle").textContent = t("langButton");
    document.documentElement.lang = state.lang;
  }

  function tickClock() {
    $("clock").textContent = nepalTimeString(Date.now()) + " NPT";
  }

  // ---- Calendar ----

  function dayEvents(n, bs, ad) {
    return Lunar.festivalsOn(n).concat(Events.eventsOn(bs, ad));
  }

  function renderControls() {
    var yearSelect = $("year-select");
    clearChildren(yearSelect);
    for (var y = BS.FIRST_YEAR; y <= BS.LAST_YEAR; y++) {
      var opt = el("option", null, num(y));
      opt.value = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = String(state.year);

    fillMonthSelect($("month-select"), BS.MONTHS_NE, BS.MONTHS_EN);
    $("month-select").value = String(state.month);
    $("go-today").textContent = t("today");
  }

  function fillMonthSelect(select, namesNe, namesEn) {
    var current = select.value;
    clearChildren(select);
    var names = state.lang === "ne" ? namesNe : namesEn;
    names.forEach(function (name, i) {
      var opt = el("option", null, name);
      opt.value = String(i + 1);
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function renderCalendar() {
    var year = state.year;
    var month = state.month;
    var first = BS.bsToDayNumber(year, month, 1);
    var length = BS.daysInMonth(year, month);
    var last = first + length - 1;
    var adFirst = BS.fromDayNumber(first);
    var adLast = BS.fromDayNumber(last);
    var today = BS.nepalToday();

    $("month-title").textContent = bsMonthName(month) + " " + num(year);
    var sub = adMonthName(adFirst.month) + (adFirst.year !== adLast.year ? " " + num(adFirst.year) : "")
      + " – " + adMonthName(adLast.month) + " " + num(adLast.year);
    $("month-subtitle").textContent = sub;
    $("prev-month").disabled = year === BS.FIRST_YEAR && month === 1;
    $("next-month").disabled = year === BS.LAST_YEAR && month === 12;

    var weekdayRow = $("weekday-row");
    clearChildren(weekdayRow);
    (state.lang === "ne" ? WEEKDAYS_SHORT_NE : WEEKDAYS_SHORT_EN).forEach(function (name, i) {
      var cell = el("div", "weekday" + (i === 6 ? " sat" : ""), name);
      cell.setAttribute("aria-hidden", "true");
      weekdayRow.appendChild(cell);
    });

    var days = $("days");
    clearChildren(days);
    var lead = BS.weekday(first);
    for (var i = 0; i < lead; i++) days.appendChild(el("div", "day empty"));

    var monthEvents = [];
    for (var n = first; n <= last; n++) {
      var bs = BS.dayNumberToBs(n);
      var ad = BS.fromDayNumber(n);
      var tithi = Tithi.tithiOn(n);
      var events = dayEvents(n, bs, ad);
      var w = BS.weekday(n);

      var classes = ["day"];
      if (w === 6) classes.push("sat");
      if (events.length) classes.push("has-event");
      if (tithi.number === 15) classes.push("full-moon");
      if (tithi.number === 30) classes.push("new-moon");
      if (n === today) classes.push("is-today");
      if (n === state.selected) classes.push("selected");

      var cell = el("button", classes.join(" "));
      cell.type = "button";
      cell.dataset.day = String(n);
      cell.setAttribute("aria-label", weekdayName(w) + ", " + formatBs(bs) + ", " + formatAd(ad) + ", " + pick(tithi.name)
        + (events.length ? ", " + events.map(pick).join(", ") : ""));
      if (n === state.selected) cell.setAttribute("aria-pressed", "true");
      cell.appendChild(el("span", "bs", num(bs.day)));
      cell.appendChild(el("span", "ad", String(ad.day)));
      cell.appendChild(events.length
        ? el("span", "tithi festival", pick(events[0]))
        : el("span", "tithi", pick(tithi.name)));
      days.appendChild(cell);

      events.forEach(function (ev) { monthEvents.push({ day: bs.day, event: ev }); });
    }

    renderEvents(monthEvents);
  }

  function renderEvents(list) {
    $("events-title").textContent = t("events");
    var ul = $("event-list");
    clearChildren(ul);
    if (!list.length) {
      ul.appendChild(el("li", "empty", t("noEvents")));
      return;
    }
    list.forEach(function (item) {
      var li = el("li");
      li.appendChild(el("span", "date", num(item.day)));
      li.appendChild(el("span", null, pick(item.event)));
      ul.appendChild(li);
    });
  }

  function renderDetail() {
    var n = state.selected;
    var bs = BS.dayNumberToBs(n);
    var ad = BS.fromDayNumber(n);
    var w = BS.weekday(n);
    var tithi = Tithi.tithiOn(n);
    var events = dayEvents(n, bs, ad);
    var lunarMonth = Lunar.monthName(n);

    var box = $("day-detail");
    clearChildren(box);
    box.appendChild(el("div", "big", num(bs.day)));
    box.appendChild(el("p", "line", bsMonthName(bs.month) + " " + num(bs.year) + " " + t("bs") + ", " + weekdayName(w)));
    box.appendChild(el("p", "line muted", formatAd(ad)));
    box.appendChild(el("p", "line", pick(lunarMonth) + " " + pick(tithi.paksha) + " · " + pick(tithi.name)));
    box.appendChild(el("p", "line muted", t("sunrise") + " " + nepalTimeString(tithi.sunrise)));

    var tags = el("div", "tags");
    if (w === 6) tags.appendChild(el("span", "tag", t("saturday")));
    events.forEach(function (ev) { tags.appendChild(el("span", "tag", pick(ev))); });
    if (tags.childNodes.length) box.appendChild(tags);
  }

  // ---- Converter ----

  function renderConverterLabels() {
    $("converter-title").textContent = t("converter");
    $("tab-bs2ad").textContent = t("bs2ad");
    $("tab-ad2bs").textContent = t("ad2bs");
    $("tab-bs2ad").setAttribute("aria-selected", String(state.convMode === "bs2ad"));
    $("tab-ad2bs").setAttribute("aria-selected", String(state.convMode === "ad2bs"));
    $("conv-year").setAttribute("aria-label", t("year"));
    $("conv-year").placeholder = t("year");
    $("conv-day").setAttribute("aria-label", t("day"));
    $("conv-day").placeholder = t("day");
    $("conv-month").setAttribute("aria-label", state.convMode === "bs2ad" ? "BS month" : "AD month");
    if (state.convMode === "bs2ad") fillMonthSelect($("conv-month"), BS.MONTHS_NE, BS.MONTHS_EN);
    else fillMonthSelect($("conv-month"), AD_MONTHS_NE, AD_MONTHS_EN);
    $("conv-submit").textContent = t("convert");
  }

  function setConverterMode(mode) {
    state.convMode = mode;
    var n = state.selected;
    var d = mode === "bs2ad" ? BS.dayNumberToBs(n) : BS.fromDayNumber(n);
    $("conv-month").value = "";
    renderConverterLabels();
    $("conv-year").value = String(d.year);
    $("conv-month").value = String(d.month);
    $("conv-day").value = String(d.day);
    showResult("", false);
  }

  function showResult(text, isError) {
    var out = $("conv-result");
    out.textContent = text;
    out.classList.toggle("error", Boolean(isError));
  }

  function convert(event) {
    event.preventDefault();
    var y = parseInt($("conv-year").value, 10);
    var m = parseInt($("conv-month").value, 10);
    var d = parseInt($("conv-day").value, 10);
    if (!y || !m || !d) {
      showResult(state.lang === "ne" ? "साल, महिना र गते भर्नुहोस्।" : "Enter a year, month and day.", true);
      return;
    }
    try {
      var n;
      if (state.convMode === "bs2ad") {
        n = BS.bsToDayNumber(y, m, d);
        showResult(formatAd(BS.fromDayNumber(n)) + ", " + weekdayName(BS.weekday(n)), false);
      } else {
        var bs = BS.toBS(y, m, d);
        n = BS.bsToDayNumber(bs.year, bs.month, bs.day);
        showResult(formatBs(bs) + " " + t("bs") + ", " + weekdayName(BS.weekday(n)), false);
      }
      selectDay(n);
    } catch (err) {
      var range = state.convMode === "bs2ad"
        ? num(BS.FIRST_YEAR) + "–" + num(BS.LAST_YEAR) + " " + t("bs")
        : formatAd(BS.toAD(BS.FIRST_YEAR, 1, 1)) + " – " + formatAd(BS.toAD(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12)));
      showResult((state.lang === "ne" ? "मान्य मिति हालिएन। समर्थित दायरा: " : "Not a valid date. Supported range: ") + range, true);
    }
  }

  // ---- Navigation ----

  function selectDay(n) {
    var bs = BS.dayNumberToBs(n);
    state.selected = n;
    var monthChanged = bs.year !== state.year || bs.month !== state.month;
    state.year = bs.year;
    state.month = bs.month;
    if (monthChanged) {
      $("year-select").value = String(state.year);
      $("month-select").value = String(state.month);
    }
    renderCalendar();
    renderDetail();
  }

  function showMonth(year, month) {
    if (month < 1) { year--; month = 12; }
    if (month > 12) { year++; month = 1; }
    if (year < BS.FIRST_YEAR || year > BS.LAST_YEAR) return;
    var today = BS.nepalToday();
    var tb = BS.dayNumberToBs(today);
    var day = tb.year === year && tb.month === month ? tb.day : 1;
    selectDay(BS.bsToDayNumber(year, month, day));
  }

  function renderAll() {
    renderHeader();
    renderControls();
    renderCalendar();
    renderDetail();
    renderConverterLabels();
    $("footer-note").textContent = t("footer");
    tickClock();
  }

  function init() {
    var today = BS.nepalToday();
    var bs = BS.dayNumberToBs(today);
    state.year = bs.year;
    state.month = bs.month;
    state.selected = today;
    renderAll();
    setConverterMode("bs2ad");

    $("prev-month").addEventListener("click", function () { showMonth(state.year, state.month - 1); });
    $("next-month").addEventListener("click", function () { showMonth(state.year, state.month + 1); });
    $("go-today").addEventListener("click", function () { selectDay(BS.nepalToday()); });
    $("year-select").addEventListener("change", function (e) { showMonth(parseInt(e.target.value, 10), state.month); });
    $("month-select").addEventListener("change", function (e) { showMonth(state.year, parseInt(e.target.value, 10)); });
    $("days").addEventListener("click", function (e) {
      var cell = e.target.closest(".day[data-day]");
      if (cell) selectDay(parseInt(cell.dataset.day, 10));
    });
    $("lang-toggle").addEventListener("click", function () {
      state.lang = state.lang === "ne" ? "en" : "ne";
      saveLang(state.lang);
      renderAll();
      showResult("", false);
    });
    $("tab-bs2ad").addEventListener("click", function () { setConverterMode("bs2ad"); });
    $("tab-ad2bs").addEventListener("click", function () { setConverterMode("ad2bs"); });
    $("converter").addEventListener("submit", convert);
    document.addEventListener("keydown", function (e) {
      if (e.target.closest("input, select, textarea")) return;
      if (e.key === "ArrowLeft" && e.altKey) showMonth(state.year, state.month - 1);
      if (e.key === "ArrowRight" && e.altKey) showMonth(state.year, state.month + 1);
    });

    // Refresh the header when Nepal's date rolls over at midnight NPT.
    var shownDay = today;
    setInterval(function () {
      tickClock();
      var now = BS.nepalToday();
      if (now !== shownDay) {
        shownDay = now;
        renderHeader();
        renderCalendar();
      }
    }, 15000);
  }

  init();
})();
