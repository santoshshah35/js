/*
 * Observances that fall on a fixed calendar date every year.
 *
 * Festivals set by the lunar calendar (Dashain, Tihar, Holi, Teej, ...) move
 * from year to year and are not listed here. Which days are public holidays is
 * decided by the Government of Nepal each year, so no holiday status is
 * claimed; only Saturdays are marked as the weekly holiday.
 */
(function (root) {
  "use strict";

  // [month, day, Nepali name, English name]
  var BS_FIXED = [
    [1, 1, "नयाँ वर्ष", "Nepali New Year"],
    [1, 11, "लोकतन्त्र दिवस", "Loktantra Diwas (Democracy Day)"],
    [2, 15, "गणतन्त्र दिवस", "Ganatantra Diwas (Republic Day)"],
    [3, 15, "राष्ट्रिय धान दिवस", "National Paddy Day"],
    [4, 1, "साउने संक्रान्ति", "Saune Sankranti"],
    [6, 3, "संविधान दिवस", "Sambidhan Diwas (Constitution Day)"],
    [9, 27, "पृथ्वी जयन्ती", "Prithvi Jayanti (National Unity Day)"],
    [10, 1, "माघे संक्रान्ति", "Maghe Sankranti"],
    [10, 16, "शहीद दिवस", "Shahid Diwas (Martyrs' Day)"],
    [11, 7, "प्रजातन्त्र दिवस", "Prajatantra Diwas (Democracy Day)"]
  ];

  var AD_FIXED = [
    [1, 1, "अंग्रेजी नयाँ वर्ष", "New Year's Day"],
    [3, 8, "अन्तर्राष्ट्रिय महिला दिवस", "International Women's Day"],
    [5, 1, "अन्तर्राष्ट्रिय श्रमिक दिवस", "International Labour Day"],
    [12, 25, "क्रिसमस", "Christmas"]
  ];

  function toEvent(row) {
    return { ne: row[2], en: row[3] };
  }

  /**
   * Fixed-date observances on a day.
   * @param {{month:number, day:number}} bs Bikram Sambat date
   * @param {{month:number, day:number}} ad Gregorian date
   * @returns {{ne:string, en:string}[]}
   */
  function eventsOn(bs, ad) {
    var out = [];
    BS_FIXED.forEach(function (r) {
      if (r[0] === bs.month && r[1] === bs.day) out.push(toEvent(r));
    });
    AD_FIXED.forEach(function (r) {
      if (r[0] === ad.month && r[1] === ad.day) out.push(toEvent(r));
    });
    return out;
  }

  var api = { eventsOn: eventsOn };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroEvents = api;
})(this);
