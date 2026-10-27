/*
 * Everyday converters: land area in Nepali units, and numbers in words
 * (Nepali and English, counted in lakh and crore).
 */
(function (root) {
  "use strict";

  var node = typeof module !== "undefined" && module.exports;

  // ---- Land area ----

  // Square feet in each unit. Hill: 1 ropani = 16 aana = 64 paisa = 256 daam
  // = 5476 sq ft. Terai: 1 bigha = 20 kattha = 400 dhur = 72900 sq ft.
  var SQFT = {
    ropani: 5476, aana: 342.25, paisa: 85.5625, daam: 21.390625,
    bigha: 72900, kattha: 3645, dhur: 182.25,
    sqft: 1, sqm: 1 / 0.09290304
  };
  var LAND_UNITS = Object.keys(SQFT);

  // Splits an area into whole big units and a decimal last unit,
  // e.g. ropani-aana-paisa-daam. Rounded to 0.01 of the last unit first so
  // 1 ropani never shows as 0-15-3-3.99.
  function split(sqft, units) {
    var last = units[units.length - 1];
    var rest = Math.round(sqft / SQFT[last] * 100);
    return units.map(function (u, i) {
      if (i === units.length - 1) return rest / 100;
      var per = Math.round(SQFT[u] / SQFT[last] * 100);
      var whole = Math.floor(rest / per);
      rest -= whole * per;
      return whole;
    });
  }

  /** An area given as value + unit, in every unit. Null for a bad value. */
  function convertLand(value, unit) {
    if (!SQFT[unit] || typeof value !== "number" || !isFinite(value) || value < 0) return null;
    var sqft = value * SQFT[unit];
    var out = { hill: split(sqft, ["ropani", "aana", "paisa", "daam"]), terai: split(sqft, ["bigha", "kattha", "dhur"]) };
    LAND_UNITS.forEach(function (u) { out[u] = sqft / SQFT[u]; });
    return out;
  }

  // ---- Numbers in words ----

  var NE_1_99 = ("एक दुई तीन चार पाँच छ सात आठ नौ दश एघार बाह्र तेह्र चौध पन्ध्र सोह्र सत्र अठार उन्नाइस बीस "
    + "एक्काइस बाइस तेइस चौबीस पच्चीस छब्बीस सत्ताइस अठ्ठाइस उनन्तीस तीस एकतीस बत्तीस तेत्तीस चौँतीस पैँतीस "
    + "छत्तीस सैँतीस अठतीस उनन्चालीस चालीस एकचालीस बयालीस त्रिचालीस चवालीस पैँतालीस छयालीस सतचालीस अठचालीस "
    + "उनन्पचास पचास एकाउन्न बाउन्न त्रिपन्न चउन्न पचपन्न छपन्न सन्ताउन्न अन्ठाउन्न उनन्साठी साठी एकसट्ठी "
    + "बयसट्ठी त्रिसट्ठी चौसट्ठी पैँसट्ठी छयसट्ठी सतसट्ठी अठसट्ठी उनन्सत्तरी सत्तरी एकहत्तर बहत्तर त्रिहत्तर "
    + "चौहत्तर पचहत्तर छयहत्तर सतहत्तर अठहत्तर उनासी असी एकासी बयासी त्रियासी चौरासी पचासी छयासी सतासी "
    + "अठासी उनान्नब्बे नब्बे एकान्नब्बे बयान्नब्बे त्रियान्नब्बे चौरान्नब्बे पन्चानब्बे छयान्नब्बे सन्तान्नब्बे "
    + "अन्ठान्नब्बे उनान्सय").split(" ");
  var EN_ONES = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
  var EN_TENS = "twenty thirty forty fifty sixty seventy eighty ninety".split(" ");

  // Largest first: kharab, arab, crore, lakh, thousand, hundred.
  var SCALES = [
    { size: 1e11, ne: "खर्ब", en: "kharab" },
    { size: 1e9, ne: "अर्ब", en: "arab" },
    { size: 1e7, ne: "करोड", en: "crore" },
    { size: 1e5, ne: "लाख", en: "lakh" },
    { size: 1e3, ne: "हजार", en: "thousand" },
    { size: 100, ne: "सय", en: "hundred" }
  ];
  // 99 kharab, 99 arab, ... : the largest number these words can say.
  var MAX_WORDS = 1e13 - 1;

  function under100(n, lang) {
    if (lang === "ne") return NE_1_99[n - 1];
    if (n < 20) return EN_ONES[n - 1];
    var tens = EN_TENS[Math.floor(n / 10) - 2];
    return n % 10 ? tens + "-" + EN_ONES[n % 10 - 1] : tens;
  }

  /**
   * A whole number from 0 to 9,999,999,999,999 in words, or null.
   * @param {number} n
   * @param {"ne"|"en"} lang
   */
  function numberToWords(n, lang) {
    if (typeof n !== "number" || !isFinite(n) || n < 0 || n > MAX_WORDS || Math.floor(n) !== n) return null;
    if (n === 0) return lang === "ne" ? "शून्य" : "zero";
    var words = [];
    var rest = n;
    SCALES.forEach(function (s) {
      var count = Math.floor(rest / s.size);
      if (!count) return;
      rest -= count * s.size;
      words.push(under100(count, lang) + " " + s[lang]);
    });
    if (rest) words.push(under100(rest, lang));
    return words.join(" ");
  }

  /**
   * An amount of money in words: "एक सय पाँच रुपैयाँ पचास पैसा".
   * Accepts up to two decimals; null for anything else.
   */
  function amountToWords(text, lang) {
    var m = /^\s*(\d{1,13})(?:\.(\d{1,2}))?\s*$/.exec(String(text).replace(/,/g, ""));
    if (!m) return null;
    var rupees = numberToWords(Number(m[1]), lang);
    if (rupees === null) return null;
    var paisa = m[2] ? Number((m[2] + "0").slice(0, 2)) : 0;
    var out = rupees + (lang === "ne" ? " रुपैयाँ" : " rupees");
    if (paisa) out += " " + numberToWords(paisa, lang) + (lang === "ne" ? " पैसा" : " paisa");
    return out;
  }

  var api = {
    LAND_UNITS: LAND_UNITS,
    convertLand: convertLand,
    numberToWords: numberToWords,
    amountToWords: amountToWords,
    MAX_WORDS: MAX_WORDS
  };

  if (node) module.exports = api;
  else root.PatroTools = api;
})(this);
