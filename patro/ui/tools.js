/*
 * Land area and number-in-words converters, under the date converter.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var Tools = root.PatroTools;
  var t = UI.t;
  var $ = UI.$;

  UI.addText({
    ne: {
      landTitle: "जग्गा नाप",
      landValue: "क्षेत्रफल",
      ropani: "रोपनी", aana: "आना", paisa: "पैसा", daam: "दाम",
      bigha: "बिघा", kattha: "कट्ठा", dhur: "धुर",
      sqft: "वर्ग फिट", sqm: "वर्ग मिटर",
      landHill: "रोपनी-आना-पैसा-दाम",
      landTerai: "बिघा-कट्ठा-धुर",
      landBad: "शून्य वा बढी संख्या हाल्नुहोस्।",
      wordsTitle: "अंकलाई शब्दमा",
      wordsValue: "रकम वा संख्या",
      wordsBad: "बढीमा ९९ खर्ब र दुई दशमलवसम्मको संख्या हाल्नुहोस्।"
    },
    en: {
      landTitle: "Land area",
      landValue: "Area",
      ropani: "Ropani", aana: "Aana", paisa: "Paisa", daam: "Daam",
      bigha: "Bigha", kattha: "Kattha", dhur: "Dhur",
      sqft: "Sq. ft", sqm: "Sq. m",
      landHill: "Ropani-Aana-Paisa-Daam",
      landTerai: "Bigha-Kattha-Dhur",
      landBad: "Enter a number of zero or more.",
      wordsTitle: "Number in words",
      wordsValue: "Amount or number",
      wordsBad: "Enter a number up to 99 kharab with at most two decimals."
    }
  });

  // Up to two decimals, without trailing zeros.
  function fmt(n) {
    return UI.num(String(Math.round(n * 100) / 100));
  }

  function row(label, value) {
    var li = UI.el("li");
    li.appendChild(UI.el("span", null, label));
    li.appendChild(UI.el("strong", null, value));
    return li;
  }

  function renderLand() {
    var list = $("land-result");
    UI.clear(list);
    var raw = $("land-value").value.trim();
    if (!raw) return;
    var area = Tools.convertLand(Number(raw), $("land-unit").value);
    if (!area) {
      list.appendChild(UI.el("li", "error", t("landBad")));
      return;
    }
    list.appendChild(row(t("landHill"), area.hill.map(fmt).join("-")));
    list.appendChild(row(t("landTerai"), area.terai.map(fmt).join("-")));
    list.appendChild(row(t("sqft"), fmt(area.sqft)));
    list.appendChild(row(t("sqm"), fmt(area.sqm)));
  }

  function renderWords() {
    var list = $("words-result");
    UI.clear(list);
    var raw = $("words-value").value.trim();
    if (!raw) return;
    var ne = Tools.amountToWords(raw, "ne");
    if (ne === null) {
      list.appendChild(UI.el("li", "error", t("wordsBad")));
      return;
    }
    // Both languages: a cheque or form may need either.
    list.appendChild(UI.el("li", null, ne));
    list.appendChild(UI.el("li", null, Tools.amountToWords(raw, "en")));
  }

  function renderLabels() {
    $("land-title").textContent = t("landTitle");
    $("land-value").setAttribute("aria-label", t("landValue"));
    $("land-value").placeholder = t("landValue");
    var unit = $("land-unit");
    var current = unit.value || "ropani";
    UI.clear(unit);
    Tools.LAND_UNITS.forEach(function (u) {
      var opt = UI.el("option", null, t(u));
      opt.value = u;
      unit.appendChild(opt);
    });
    unit.value = current;
    $("words-title").textContent = t("wordsTitle");
    $("words-value").setAttribute("aria-label", t("wordsValue"));
    $("words-value").placeholder = t("wordsValue");
    renderLand();
    renderWords();
  }

  function init() {
    $("land-value").addEventListener("input", renderLand);
    $("land-unit").addEventListener("change", renderLand);
    $("words-value").addEventListener("input", renderWords);
    UI.on("lang", renderLabels);
    renderLabels();
  }

  UI.tools = { init: init };
})(this);
