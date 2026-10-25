/*
 * Date converter screen: BS -> AD and AD -> BS.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var t = UI.t;
  var $ = UI.$;

  var mode = "bs2ad";
  var lastResultDay = null;

  UI.addText({
    ne: {
      converter: "मिति रूपान्तरण",
      convert: "रूपान्तरण",
      bs2ad: "बि.सं. → ई.सं.",
      ad2bs: "ई.सं. → बि.सं.",
      year: "साल",
      month: "महिना",
      day: "गते",
      needAll: "साल, महिना र गते भर्नुहोस्।",
      invalidDate: "मान्य मिति हालिएन। समर्थित दायरा: {range}",
      estimatedYear: "यो वर्षको आधिकारिक पात्रो प्रकाशित भएको छैन, त्यसैले मिति अनुमानित हो।"
    },
    en: {
      converter: "Date converter",
      convert: "Convert",
      bs2ad: "BS → AD",
      ad2bs: "AD → BS",
      year: "Year",
      month: "Month",
      day: "Day",
      needAll: "Enter a year, month and day.",
      invalidDate: "Not a valid date. Supported range: {range}",
      estimatedYear: "No official calendar has been published for this year yet, so the date is an estimate."
    }
  });

  function fillMonths() {
    var select = $("conv-month");
    var current = select.value;
    UI.clear(select);
    for (var m = 1; m <= 12; m++) {
      var opt = UI.el("option", null, mode === "bs2ad" ? UI.bsMonthName(m) : UI.adMonthName(m));
      opt.value = String(m);
      select.appendChild(opt);
    }
    if (current) select.value = current;
  }

  function renderLabels() {
    $("converter-title").textContent = t("converter");
    $("tab-bs2ad").textContent = t("bs2ad");
    $("tab-ad2bs").textContent = t("ad2bs");
    $("tab-bs2ad").setAttribute("aria-selected", String(mode === "bs2ad"));
    $("tab-ad2bs").setAttribute("aria-selected", String(mode === "ad2bs"));
    $("conv-year").setAttribute("aria-label", t("year"));
    $("conv-year").placeholder = t("year");
    $("conv-month").setAttribute("aria-label", t("month"));
    $("conv-day").setAttribute("aria-label", t("day"));
    $("conv-day").placeholder = t("day");
    $("conv-submit").textContent = t("convert");
    $("conv-show").textContent = t("showOnCalendar");
    fillMonths();
  }

  function showResult(text, isError) {
    var out = $("conv-result");
    out.textContent = text;
    out.classList.toggle("error", Boolean(isError));
    $("conv-show").hidden = isError || !text;
  }

  function setMode(next) {
    mode = next;
    var n = UI.state.selected;
    var d = mode === "bs2ad" ? BS.dayNumberToBs(n) : BS.fromDayNumber(n);
    $("conv-month").value = "";
    renderLabels();
    $("conv-year").value = String(d.year);
    $("conv-month").value = String(d.month);
    $("conv-day").value = String(d.day);
    showResult("", false);
  }

  function convert(event) {
    event.preventDefault();
    var y = parseInt($("conv-year").value, 10);
    var m = parseInt($("conv-month").value, 10);
    var d = parseInt($("conv-day").value, 10);
    if (!y || !m || !d) {
      showResult(t("needAll"), true);
      return;
    }
    try {
      var n, text, bsYear;
      if (mode === "bs2ad") {
        n = BS.bsToDayNumber(y, m, d);
        text = UI.formatAd(BS.fromDayNumber(n)) + ", " + UI.weekdayName(BS.weekday(n));
        bsYear = y;
      } else {
        var bs = BS.toBS(y, m, d);
        n = BS.bsToDayNumber(bs.year, bs.month, bs.day);
        text = UI.formatBs(bs) + " " + t("bs") + ", " + UI.weekdayName(BS.weekday(n));
        bsYear = bs.year;
      }
      if (bsYear >= BS.PROJECTED_FROM) text += ". " + t("estimatedYear");
      lastResultDay = n;
      showResult(text, false);
    } catch (err) {
      var range = mode === "bs2ad"
        ? UI.num(BS.FIRST_YEAR) + "–" + UI.num(BS.LAST_YEAR) + " " + t("bs")
        : UI.formatAd(BS.toAD(BS.FIRST_YEAR, 1, 1)) + " – "
          + UI.formatAd(BS.toAD(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12)));
      showResult(UI.fill(t("invalidDate"), { range: range }), true);
    }
  }

  function init() {
    $("tab-bs2ad").addEventListener("click", function () { setMode("bs2ad"); });
    $("tab-ad2bs").addEventListener("click", function () { setMode("ad2bs"); });
    $("converter").addEventListener("submit", convert);
    $("conv-show").addEventListener("click", function () {
      if (lastResultDay === null) return;
      UI.selectDay(lastResultDay);
      UI.navigate("calendar");
    });
    UI.on("lang", function () { renderLabels(); showResult("", false); });
    setMode("bs2ad");
  }

  UI.converter = { init: init };
})(this);
