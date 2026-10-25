(function () {
  "use strict";

  var BS = window.PatroBS;
  var Tithi = window.PatroTithi;
  var Events = window.PatroEvents;
  var Lunar = window.PatroLunar;
  var Rashifal = window.PatroRashifal;
  var Rates = window.PatroRates;

  // Shown first in the forex table, in this order; the rest follow.
  var MAIN_CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "CNY",
    "SAR", "QAR", "AED", "MYR", "KRW", "KWD"];

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
      rashifal: "राशिफल",
      moonIn: "चन्द्रमा {sign} राशिमा",
      moonMoves: "{time} बजे {sign}मा प्रवेश",
      good: "शुभ",
      mixed: "मिश्रित",
      bad: "सावधान",
      rashifalNote: "चन्द्रमाको गोचरका आधारमा परम्परागत सामान्य फल। व्यक्तिगत कुण्डलीको फल होइन।",
      forex: "विदेशी विनिमय दर",
      currency: "मुद्रा",
      buy: "खरिद",
      sell: "बिक्री",
      showAll: "सबै मुद्रा देखाउनुहोस्",
      showFewer: "कम देखाउनुहोस्",
      gold: "सुन चाँदी",
      fineGold: "छापावाल सुन",
      tejabiGold: "तेजाबी सुन",
      silver: "चाँदी",
      perTola: "प्रति तोला",
      loading: "लोड हुँदैछ…",
      publishedOn: "प्रकाशित {date}",
      savedCopy: "इन्टरनेट नभएकाले {date} मा सुरक्षित गरिएको दर",
      forexError: "यहाँबाट दर लोड गर्न सकिएन। नेपाल राष्ट्र बैंकको वेबसाइटमा हेर्नुहोस्:",
      goldError: "यहाँबाट मूल्य लोड गर्न सकिएन। महासंघको वेबसाइटमा हेर्नुहोस्:",
      appHint: "Patro एन्ड्रोइड एपमा यी दर आफैं लोड हुन्छन्।",
      goldSource: "स्रोत: नेपाल सुनचाँदी व्यवसायी महासंघ",
      forexSource: "स्रोत: नेपाल राष्ट्र बैंक",
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
      rashifal: "Rashifal",
      moonIn: "Moon in {sign}",
      moonMoves: "enters {sign} at {time}",
      good: "Good",
      mixed: "Mixed",
      bad: "Careful",
      rashifalNote: "General readings from the Moon's transit (gochar), the traditional rule of thumb. Not a personal horoscope.",
      forex: "Exchange rates",
      currency: "Currency",
      buy: "Buy",
      sell: "Sell",
      showAll: "Show all currencies",
      showFewer: "Show fewer",
      gold: "Gold and silver",
      fineGold: "Fine gold (24K)",
      tejabiGold: "Tejabi gold",
      silver: "Silver",
      perTola: "per tola",
      loading: "Loading…",
      publishedOn: "Published {date}",
      savedCopy: "Offline: rates saved on {date}",
      forexError: "Couldn't load rates here. See Nepal Rastra Bank:",
      goldError: "Couldn't load prices here. See FENEGOSIDA:",
      appHint: "The Patro Android app loads these rates automatically.",
      goldSource: "Source: Federation of Nepal Gold and Silver Dealers' Association",
      forexSource: "Source: Nepal Rastra Bank",
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

  // ---- Rashifal ----

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (_, k) { return values[k]; });
  }

  function renderRashifal() {
    var day = Rashifal.rashifalOn(state.selected);
    var moon = day.moon;
    var sign = pick(Rashifal.RASHIS[moon.sign]);
    var line = fill(t("moonIn"), { sign: sign });
    if (moon.changesAt) {
      line += ", " + fill(t("moonMoves"), {
        sign: pick(Rashifal.RASHIS[moon.next]),
        time: nepalTimeString(moon.changesAt)
      });
    }
    $("rashifal-title").textContent = t("rashifal") + " · " + formatBs(BS.dayNumberToBs(state.selected));
    $("rashifal-moon").textContent = line;
    $("rashifal-note").textContent = t("rashifalNote");

    var grid = $("rashi-grid");
    clearChildren(grid);
    day.readings.forEach(function (r) {
      var li = el("li", "rashi");
      var top = el("div", "rashi-top");
      top.appendChild(el("span", "rashi-name", pick(r.rashi)));
      top.appendChild(el("span", "tone " + r.tone, t(r.tone)));
      li.appendChild(top);
      li.appendChild(el("p", null, pick(r)));
      grid.appendChild(li);
    });
  }

  // ---- Forex and gold ----

  var rates = { forex: null, gold: null, showAll: false };

  function money(n, decimals) {
    var text = n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return num(text);
  }

  function dateText(ms) {
    var n = Math.floor((ms + (5 * 60 + 45) * 60000) / 86400000);
    return formatBs(BS.dayNumberToBs(n));
  }

  function sourceLink(href) {
    var a = el("a", null, href.replace(/^https:\/\//, "").replace(/\/$/, ""));
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function renderError(box, message, href) {
    var p = el("p", "notice", message + " ");
    p.appendChild(sourceLink(href));
    box.appendChild(p);
    if (!window.PatroNative) box.appendChild(el("p", "fineprint", t("appHint")));
  }

  function renderForex() {
    $("forex-title").textContent = t("forex");
    var box = $("forex-body");
    var meta = $("forex-meta");
    clearChildren(box);
    var f = rates.forex;
    if (!f) { meta.textContent = t("loading"); return; }
    if (f.error) {
      meta.textContent = "";
      renderError(box, t("forexError"), Rates.NRB_PAGE);
      return;
    }
    var parts = f.data.date.split("-").map(Number);
    var published = formatBs(BS.toBS(parts[0], parts[1], parts[2]));
    meta.textContent = f.cachedAt
      ? fill(t("savedCopy"), { date: dateText(f.cachedAt) })
      : fill(t("publishedOn"), { date: published });

    var list = f.data.rates.slice().sort(function (a, b) {
      var ia = MAIN_CURRENCIES.indexOf(a.iso3), ib = MAIN_CURRENCIES.indexOf(b.iso3);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var shown = rates.showAll ? list : list.slice(0, 8);

    var wrap = el("div", "rates-scroll");
    var table = el("table", "rates-table");
    var head = el("tr");
    [t("currency"), t("buy"), t("sell")].forEach(function (h) {
      var th = el("th", null, h);
      th.scope = "col";
      head.appendChild(th);
    });
    var thead = el("thead");
    thead.appendChild(head);
    table.appendChild(thead);
    var tbody = el("tbody");
    shown.forEach(function (r) {
      var tr = el("tr");
      var name = el("td");
      name.title = r.name;
      name.appendChild(document.createTextNode(r.iso3));
      name.appendChild(el("span", "unit", num(r.unit)));
      tr.appendChild(name);
      tr.appendChild(el("td", null, money(r.buy, 2)));
      tr.appendChild(el("td", null, money(r.sell, 2)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    if (list.length > 8) {
      var toggle = el("button", "link-btn", rates.showAll ? t("showFewer") : t("showAll"));
      toggle.type = "button";
      toggle.addEventListener("click", function () {
        rates.showAll = !rates.showAll;
        renderForex();
      });
      box.appendChild(toggle);
    }
    box.appendChild(el("p", "fineprint", t("forexSource")));
  }

  function renderGold() {
    $("gold-title").textContent = t("gold");
    var box = $("gold-body");
    var meta = $("gold-meta");
    clearChildren(box);
    var g = rates.gold;
    if (!g) { meta.textContent = t("loading"); return; }
    if (g.error) {
      meta.textContent = "";
      renderError(box, t("goldError"), Rates.GOLD_URL);
      return;
    }
    meta.textContent = g.cachedAt ? fill(t("savedCopy"), { date: dateText(g.cachedAt) }) : t("perTola");
    var ul = el("ul", "gold-list");
    [["fineGold", g.data.fineGold], ["tejabiGold", g.data.tejabiGold], ["silver", g.data.silver]].forEach(function (row) {
      if (row[1] === null) return;
      var li = el("li");
      li.appendChild(el("span", null, t(row[0])));
      li.appendChild(el("span", "price", "रु " + money(row[1], 0)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.appendChild(el("p", "fineprint", t("goldSource")));
  }

  function loadRates() {
    Rates.loadForex(BS.nepalToday())
      .then(function (r) { rates.forex = r; })
      .catch(function () { rates.forex = { error: true }; })
      .then(renderForex);
    Rates.loadGold()
      .then(function (r) { rates.gold = r; })
      .catch(function () { rates.gold = { error: true }; })
      .then(renderGold);
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
    renderRashifal();
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
    renderRashifal();
    renderForex();
    renderGold();
    $("footer-note").textContent = t("footer");
    tickClock();
  }

  // Lets the installed web app (iPhone "Add to Home Screen") open offline.
  // Service workers need HTTPS; the Android app and file:// pages skip this.
  function registerOfflineSupport() {
    if (window.PatroNative || !("serviceWorker" in navigator) || (location.protocol !== "https:" && location.hostname !== "localhost")) return;
    try {
      navigator.serviceWorker.register("sw.js").catch(function () { /* runs without offline support */ });
    } catch (e) { /* runs without offline support */ }
  }

  function init() {
    var today = BS.nepalToday();
    var bs = BS.dayNumberToBs(today);
    state.year = bs.year;
    state.month = bs.month;
    state.selected = today;
    renderAll();
    setConverterMode("bs2ad");
    loadRates();
    registerOfflineSupport();

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
