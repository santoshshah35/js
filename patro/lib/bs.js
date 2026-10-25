/*
 * Bikram Sambat <-> Gregorian conversion.
 *
 * Dates are plain { year, month, day } objects with 1-based months. Gregorian
 * dates are civil dates (no time zone); internally they are counted as days
 * since 1970-01-01 so that no Date object's local time zone can shift them.
 */
(function (root) {
  "use strict";

  var DATA = typeof module !== "undefined" && module.exports
    ? require("./bs-data.js")
    : root.PatroBSData;

  var MS_PER_DAY = 86400000;
  var FIRST_YEAR = DATA.firstYear;
  var LAST_YEAR = DATA.firstYear + DATA.monthLengths.length - 1;

  var MONTHS_NE = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
    "कार्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"];
  var MONTHS_EN = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var WEEKDAYS_NE = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];
  var WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DEVANAGARI_DIGITS = "०१२३४५६७८९";

  /**
   * Days since 1970-01-01 for a Gregorian civil date.
   * @param {number} year @param {number} month 1-12 @param {number} day
   * @returns {number}
   */
  function dayNumber(year, month, day) {
    return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
  }

  function fromDayNumber(n) {
    var d = new Date(n * MS_PER_DAY);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  var EPOCH = dayNumber(DATA.epochAD.year, DATA.epochAD.month, DATA.epochAD.day);

  // Day number of 1 Baisakh for every supported year, plus one past the end.
  var yearStarts = [EPOCH];
  DATA.monthLengths.forEach(function (lengths) {
    var total = lengths.reduce(function (a, b) { return a + b; }, 0);
    yearStarts.push(yearStarts[yearStarts.length - 1] + total);
  });

  function daysInMonth(year, month) {
    if (year < FIRST_YEAR || year > LAST_YEAR) {
      throw new RangeError("Bikram Sambat year " + year + " is outside " + FIRST_YEAR + "-" + LAST_YEAR);
    }
    if (month < 1 || month > 12) throw new RangeError("Month " + month + " is not 1-12");
    return DATA.monthLengths[year - FIRST_YEAR][month - 1];
  }

  function bsToDayNumber(year, month, day) {
    var length = daysInMonth(year, month);
    if (day < 1 || day > length) {
      throw new RangeError(MONTHS_EN[month - 1] + " " + year + " has " + length + " days");
    }
    var n = yearStarts[year - FIRST_YEAR];
    for (var m = 1; m < month; m++) n += daysInMonth(year, m);
    return n + day - 1;
  }

  function dayNumberToBs(n) {
    if (n < yearStarts[0] || n >= yearStarts[yearStarts.length - 1]) {
      var ad = fromDayNumber(n);
      throw new RangeError(ad.year + "-" + ad.month + "-" + ad.day + " AD is outside the supported range");
    }
    var i = 0;
    while (yearStarts[i + 1] <= n) i++;
    var year = FIRST_YEAR + i;
    var offset = n - yearStarts[i];
    var month = 1;
    while (offset >= daysInMonth(year, month)) {
      offset -= daysInMonth(year, month);
      month++;
    }
    return { year: year, month: month, day: offset + 1 };
  }

  function toAD(year, month, day) {
    return fromDayNumber(bsToDayNumber(year, month, day));
  }

  function toBS(year, month, day) {
    var n = dayNumber(year, month, day);
    var check = fromDayNumber(n);
    if (check.month !== month || check.day !== day) {
      throw new RangeError(year + "-" + month + "-" + day + " is not a valid Gregorian date");
    }
    return dayNumberToBs(n);
  }

  // 0 = Sunday. 1970-01-01 was a Thursday.
  function weekday(n) {
    return ((n % 7) + 7 + 4) % 7;
  }

  function toNepaliDigits(value) {
    return String(value).replace(/[0-9]/g, function (d) { return DEVANAGARI_DIGITS[d]; });
  }

  // Today's civil date in Nepal (UTC+05:45) as a day number, whatever the
  // viewer's time zone.
  function nepalToday(now) {
    var ms = (now ? now.getTime() : Date.now()) + (5 * 60 + 45) * 60000;
    return Math.floor(ms / MS_PER_DAY);
  }

  var api = {
    FIRST_YEAR: FIRST_YEAR,
    LAST_YEAR: LAST_YEAR,
    MONTHS_NE: MONTHS_NE,
    MONTHS_EN: MONTHS_EN,
    WEEKDAYS_NE: WEEKDAYS_NE,
    WEEKDAYS_EN: WEEKDAYS_EN,
    daysInMonth: daysInMonth,
    dayNumber: dayNumber,
    fromDayNumber: fromDayNumber,
    bsToDayNumber: bsToDayNumber,
    dayNumberToBs: dayNumberToBs,
    toAD: toAD,
    toBS: toBS,
    weekday: weekday,
    toNepaliDigits: toNepaliDigits,
    nepalToday: nepalToday
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroBS = api;
})(this);
