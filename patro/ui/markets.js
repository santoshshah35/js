/*
 * Exchange rates (with a calculator), gold and silver, and fuel prices.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Rates = root.PatroRates;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  // Shown first in the table and the calculator, in this order; the rest follow.
  var MAIN_CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "CNY",
    "SAR", "QAR", "AED", "MYR", "KRW", "KWD"];
  var COLLAPSED_ROWS = 8;

  var data = { forex: null, gold: null, fuel: null, showAll: false };
  var calc = { direction: "toNpr" };

  UI.addText({
    ne: {
      forex: "विदेशी विनिमय दर",
      currency: "मुद्रा",
      buy: "खरिद",
      sell: "बिक्री",
      showAll: "सबै मुद्रा देखाउनुहोस्",
      showFewer: "कम देखाउनुहोस्",
      calculator: "विनिमय हिसाब",
      amount: "रकम",
      toNpr: "विदेशी → रु",
      fromNpr: "रु → विदेशी",
      calcToNpr: "बैंकले {iso} किन्ने दर ({rate} प्रति {unit}) अनुसार",
      calcFromNpr: "बैंकले {iso} बेच्ने दर ({rate} प्रति {unit}) अनुसार",
      calcUnavailable: "आजको दर लोड भएपछि हिसाब गर्न मिल्छ।",
      gold: "सुन चाँदी",
      fineGold: "छापावाल सुन",
      tejabiGold: "तेजाबी सुन",
      silver: "चाँदी",
      perTola: "प्रति तोला",
      fuel: "इन्धनको मूल्य",
      petrol: "पेट्रोल",
      diesel: "डिजेल",
      kerosene: "मट्टितेल",
      lpg: "एलपी ग्यास",
      perLitre: "प्रति लिटर",
      perCylinder: "प्रति सिलिन्डर",
      fuelNote: "काठमाडौं उपत्यकाको खुद्रा मूल्य। अन्य डिपोमा केही फरक हुन सक्छ।",
      loading: "लोड हुँदैछ…",
      publishedOn: "प्रकाशित {date}",
      savedCopy: "{date} मा अद्यावधिक गरिएको",
      forexError: "यहाँबाट दर लोड गर्न सकिएन। नेपाल राष्ट्र बैंकको वेबसाइटमा हेर्नुहोस्:",
      goldError: "यहाँबाट मूल्य लोड गर्न सकिएन। महासंघको वेबसाइटमा हेर्नुहोस्:",
      fuelError: "यहाँबाट मूल्य लोड गर्न सकिएन। नेपाल आयल निगमको वेबसाइटमा हेर्नुहोस्:",
      appHint: "Patro एन्ड्रोइड एपमा यी दर आफैं लोड हुन्छन्।",
      reason: "कारण",
      midRate: "बजार दर",
      marketNote: "नेपाल राष्ट्र बैंकसँग जोडिन सकिएन, त्यसैले यी अन्तर्राष्ट्रिय बजारका औसत दर हुन्, बैंकको खरिद/बिक्री दर होइनन्।",
      marketDate: "बजार दर · {date}",
      calcMarket: "{iso} को बजार दर ({rate} प्रति {unit}) अनुसार",
      goldSource: "स्रोत: नेपाल सुनचाँदी व्यवसायी महासंघ",
      forexSource: "स्रोत: नेपाल राष्ट्र बैंक",
      fuelSource: "स्रोत: नेपाल आयल निगम"
    },
    en: {
      forex: "Exchange rates",
      currency: "Currency",
      buy: "Buy",
      sell: "Sell",
      showAll: "Show all currencies",
      showFewer: "Show fewer",
      calculator: "Exchange calculator",
      amount: "Amount",
      toNpr: "Foreign → NPR",
      fromNpr: "NPR → foreign",
      calcToNpr: "at the bank buying rate for {iso} ({rate} per {unit})",
      calcFromNpr: "at the bank selling rate for {iso} ({rate} per {unit})",
      calcUnavailable: "The calculator works once today's rates have loaded.",
      gold: "Gold and silver",
      fineGold: "Fine gold (24K)",
      tejabiGold: "Tejabi gold",
      silver: "Silver",
      perTola: "per tola",
      fuel: "Fuel prices",
      petrol: "Petrol",
      diesel: "Diesel",
      kerosene: "Kerosene",
      lpg: "LPG gas",
      perLitre: "per litre",
      perCylinder: "per cylinder",
      fuelNote: "Retail prices for the Kathmandu valley. Other depots can differ slightly.",
      loading: "Loading…",
      publishedOn: "Published {date}",
      savedCopy: "Last updated {date}",
      forexError: "Couldn't load rates here. See Nepal Rastra Bank:",
      goldError: "Couldn't load prices here. See FENEGOSIDA:",
      fuelError: "Couldn't load prices here. See Nepal Oil Corporation:",
      appHint: "The Patro Android app loads these rates automatically.",
      reason: "Reason",
      midRate: "Market rate",
      marketNote: "Couldn't reach Nepal Rastra Bank, so these are international market mid-rates, not the bank's buying and selling rates.",
      marketDate: "Market rates · {date}",
      calcMarket: "at the market rate for {iso} ({rate} per {unit})",
      goldSource: "Source: Federation of Nepal Gold and Silver Dealers' Association",
      forexSource: "Source: Nepal Rastra Bank",
      fuelSource: "Source: Nepal Oil Corporation"
    }
  });

  function renderError(box, message, href, reason) {
    var p = el("p", "notice", message + " ");
    p.appendChild(UI.link(href));
    box.appendChild(p);
    if (!root.PatroNative) box.appendChild(el("p", "fineprint", t("appHint")));
    else if (reason) box.appendChild(el("p", "fineprint", t("reason") + ": " + reason));
  }

  function sortedRates() {
    return data.forex.data.rates.slice().sort(function (a, b) {
      var ia = MAIN_CURRENCIES.indexOf(a.iso3), ib = MAIN_CURRENCIES.indexOf(b.iso3);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  // ---- Exchange rates ----

  function renderForex() {
    $("forex-title").textContent = t("forex");
    var box = $("forex-body");
    var meta = $("forex-meta");
    UI.clear(box);
    var f = data.forex;
    if (!f) { meta.textContent = t("loading"); return; }
    if (f.error) {
      meta.textContent = "";
      renderError(box, t("forexError"), Rates.NRB_PAGE, f.reason);
      return;
    }
    var market = f.data.source === "market";
    var parts = f.data.date.split("-").map(Number);
    var dateText = UI.formatBs(BS.toBS(parts[0], parts[1], parts[2]));
    meta.textContent = f.cachedAt
      ? UI.fill(t("savedCopy"), { date: UI.dateOfMoment(f.cachedAt) })
      : UI.fill(t(market ? "marketDate" : "publishedOn"), { date: dateText });
    if (market) {
      box.appendChild(el("p", "notice market-note", t("marketNote")));
      if (f.data.nrbError) box.appendChild(el("p", "fineprint", t("reason") + ": " + f.data.nrbError));
    }

    var list = sortedRates();
    var shown = data.showAll ? list : list.slice(0, COLLAPSED_ROWS);
    var wrap = el("div", "rates-scroll");
    var table = el("table", "rates-table");
    var thead = el("thead");
    var head = el("tr");
    (market ? [t("currency"), t("midRate")] : [t("currency"), t("buy"), t("sell")]).forEach(function (h) {
      var th = el("th", null, h);
      th.scope = "col";
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);
    var tbody = el("tbody");
    shown.forEach(function (r) {
      var tr = el("tr");
      var name = el("td");
      name.title = r.name;
      name.appendChild(document.createTextNode(r.iso3));
      name.appendChild(el("span", "unit", UI.num(r.unit)));
      tr.appendChild(name);
      tr.appendChild(el("td", null, UI.money(r.buy, 2)));
      if (!market) tr.appendChild(el("td", null, UI.money(r.sell, 2)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    if (list.length > COLLAPSED_ROWS) {
      var toggle = el("button", "link-btn", data.showAll ? t("showFewer") : t("showAll"));
      toggle.type = "button";
      toggle.addEventListener("click", function () {
        data.showAll = !data.showAll;
        renderForex();
      });
      box.appendChild(toggle);
    }
    if (!market) box.appendChild(el("p", "fineprint", t("forexSource")));
  }

  // ---- Calculator ----

  function renderCalculator() {
    $("calc-title").textContent = t("calculator");
    $("calc-amount").setAttribute("aria-label", t("amount"));
    $("calc-amount").placeholder = t("amount");
    $("calc-currency").setAttribute("aria-label", t("currency"));
    $("calc-to-npr").textContent = t("toNpr");
    $("calc-from-npr").textContent = t("fromNpr");
    $("calc-to-npr").setAttribute("aria-pressed", String(calc.direction === "toNpr"));
    $("calc-from-npr").setAttribute("aria-pressed", String(calc.direction === "fromNpr"));

    var ready = data.forex && !data.forex.error;
    var fields = [$("calc-amount"), $("calc-currency"), $("calc-to-npr"), $("calc-from-npr")];
    fields.forEach(function (f) { f.disabled = !ready; });
    if (!ready) {
      $("calc-result").textContent = "";
      $("calc-basis").textContent = data.forex ? t("calcUnavailable") : t("loading");
      return;
    }

    var select = $("calc-currency");
    var current = select.value || "USD";
    UI.clear(select);
    sortedRates().forEach(function (r) {
      var opt = el("option", null, r.iso3 + " · " + r.name);
      opt.value = r.iso3;
      select.appendChild(opt);
    });
    select.value = current;
    if (!select.value) select.selectedIndex = 0;
    calculate();
  }

  function calculate() {
    if (!data.forex || data.forex.error) return;
    var iso = $("calc-currency").value;
    var rate = data.forex.data.rates.filter(function (r) { return r.iso3 === iso; })[0];
    var amount = parseFloat($("calc-amount").value);
    var result = Rates.convertCurrency(rate, amount, calc.direction);
    var out = $("calc-result");
    if (result === null || !isFinite(result)) {
      out.textContent = "";
      $("calc-basis").textContent = "";
      return;
    }
    var amountText = UI.money(amount, amount % 1 ? 2 : 0);
    out.textContent = calc.direction === "toNpr"
      ? amountText + " " + iso + " = रु " + UI.money(result, 2)
      : "रु " + amountText + " = " + UI.money(result, 2) + " " + iso;
    var basisKey = data.forex.data.source === "market" ? "calcMarket"
      : calc.direction === "toNpr" ? "calcToNpr" : "calcFromNpr";
    $("calc-basis").textContent = UI.fill(t(basisKey), {
      iso: iso,
      rate: UI.money(calc.direction === "toNpr" ? rate.buy : rate.sell, 2),
      unit: UI.num(rate.unit) + " " + iso
    });
  }

  function setDirection(direction) {
    calc.direction = direction;
    renderCalculator();
  }

  // ---- Gold and fuel ----

  function renderPriceList(prefix, entry, rows, errorKey, href, sourceKey, unitNote) {
    $(prefix + "-title").textContent = t(prefix === "gold" ? "gold" : "fuel");
    var box = $(prefix + "-body");
    var meta = $(prefix + "-meta");
    UI.clear(box);
    if (!entry) { meta.textContent = t("loading"); return; }
    if (entry.error) {
      meta.textContent = "";
      renderError(box, t(errorKey), href, entry.reason);
      return;
    }
    meta.textContent = entry.cachedAt ? UI.fill(t("savedCopy"), { date: UI.dateOfMoment(entry.cachedAt) }) : unitNote;
    var ul = el("ul", "price-list");
    rows.forEach(function (row) {
      var value = entry.data[row[0]];
      if (value === null || value === undefined) return;
      var li = el("li");
      var label = el("span", "price-label", t(row[0]));
      if (row[1]) label.appendChild(el("span", "price-unit", t(row[1])));
      li.appendChild(label);
      li.appendChild(el("span", "price", "रु " + UI.money(value, value % 1 ? 2 : 0)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    if (prefix === "fuel") box.appendChild(el("p", "fineprint", t("fuelNote")));
    box.appendChild(el("p", "fineprint", t(sourceKey)));
  }

  function renderGold() {
    renderPriceList("gold", data.gold, [["fineGold"], ["tejabiGold"], ["silver"]],
      "goldError", Rates.GOLD_URL, "goldSource", t("perTola"));
  }

  function renderFuel() {
    renderPriceList("fuel", data.fuel,
      [["petrol", "perLitre"], ["diesel", "perLitre"], ["kerosene", "perLitre"], ["lpg", "perCylinder"]],
      "fuelError", Rates.FUEL_PAGE, "fuelSource", "");
  }

  function renderAll() {
    renderForex();
    renderCalculator();
    renderGold();
    renderFuel();
  }

  function load() {
    function settle(key, promise, render) {
      promise
        .then(function (r) { data[key] = r; })
        .catch(function (err) { data[key] = { error: true, reason: err && err.message }; })
        .then(render);
    }
    settle("forex", Rates.loadForex(BS.nepalToday()), function () { renderForex(); renderCalculator(); });
    settle("gold", Rates.loadGold(), renderGold);
    settle("fuel", Rates.loadFuel(), renderFuel);
  }

  function init() {
    $("calc-amount").value = "100";
    $("calc-amount").addEventListener("input", calculate);
    $("calc-currency").addEventListener("change", calculate);
    $("calc-to-npr").addEventListener("click", function () { setDirection("toNpr"); });
    $("calc-from-npr").addEventListener("click", function () { setDirection("fromNpr"); });
    $("calc-form").addEventListener("submit", function (e) { e.preventDefault(); });
    UI.on("lang", renderAll);
    renderAll();
    load();
  }

  UI.markets = { init: init };
})(this);
