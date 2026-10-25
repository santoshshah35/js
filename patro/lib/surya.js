/*
 * Bikram Sambat month starts from Surya Siddhanta sankrantis.
 *
 * Nepal's official calendar places each BS month at the solar sankranti,
 * computed with the traditional Surya Siddhanta model rather than modern
 * astronomy. This file reproduces that: the Sun's sidereal longitude from the
 * Surya Siddhanta mean motion and equation of centre, the moment it enters
 * each sign, and the civil day the month starts on:
 *
 *   - normally the day (midnight to midnight, Nepal Time) containing the
 *     sankranti;
 *   - for Karka sankranti (1 Shrawan), a sankranti in the night before sunrise
 *     belongs to the previous day;
 *   - for Makara sankranti (1 Magh), a sankranti after sunset belongs to the
 *     next day.
 *
 * The epicycle, apogee and time offset in PARAMS were fitted to the
 * published calendars for 2000-2083 BS; tests/surya.test.js checks how many
 * of those 1008 month starts the model reproduces. It is used only to
 * generate years after 2083, which have no published calendar yet.
 */
(function (root) {
  "use strict";

  var node = typeof module !== "undefined" && module.exports;
  var Tithi = node ? require("./tithi.js") : root.PatroTithi;

  var MS_PER_DAY = 86400000;
  var NPT_MS = (5 * 60 + 45) * 60000;
  var DEG = Math.PI / 180;

  var KALI_EPOCH_JD = 588465.5; // start of Kali Yuga, midnight at Ujjain
  var SIDEREAL_YEAR = 1577917828 / 4320000; // days per revolution of the Sun
  var UJJAIN_LON = 75.77;

  var PARAMS = { periphery: 13.75, apogee: 77.5, shiftHours: -0.15 };

  /** Surya Siddhanta true sidereal longitude of the Sun at a UT moment. */
  function sunLongitude(ms, params) {
    var p = params || PARAMS;
    var jd = ms / MS_PER_DAY + 2440587.5 + UJJAIN_LON / 15 / 24;
    var mean = (((jd - KALI_EPOCH_JD) / SIDEREAL_YEAR) * 360) % 360;
    var eq = Math.asin((p.periphery / 360) * Math.sin((mean - p.apogee) * DEG)) / DEG;
    return ((mean - eq) % 360 + 360) % 360;
  }

  /** Moment the Sun enters sign (0 = Mesha), searching ±3 days of approxMs. */
  function sankranti(sign, approxMs, params) {
    var p = params || PARAMS;
    var target = sign * 30;
    var lo = approxMs - 3 * MS_PER_DAY;
    var hi = approxMs + 3 * MS_PER_DAY;
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      var d = ((sunLongitude(mid, p) - target + 540) % 360) - 180;
      if (d < 0) lo = mid; else hi = mid;
    }
    return lo + p.shiftHours * 3600000;
  }

  /** Civil day (days since 1970-01-01) on which BS month m (1-12) starts. */
  function monthStart(month, approxDay, params) {
    var t = sankranti(month - 1, approxDay * MS_PER_DAY, params);
    var day = Math.floor((t + NPT_MS) / MS_PER_DAY);
    if (month === 4 && t < Tithi.sunrise(day)) return day - 1;
    if (month === 10 && t > Tithi.sunset(day)) return day + 1;
    return day;
  }

  /**
   * Month lengths for BS years firstYear..lastYear.
   * @param {number} firstDay civil day of 1 Baisakh firstYear
   * @returns {number[][]} twelve month lengths per year
   */
  function projectYears(firstYear, lastYear, firstDay, params) {
    var starts = [firstDay];
    var approx = firstDay;
    for (var y = firstYear; y <= lastYear + 1; y++) {
      for (var m = 1; m <= 12; m++) {
        if (y === firstYear && m === 1) continue;
        if (y === lastYear + 1 && m > 1) break;
        var d = monthStart(m, Math.round(approx + 30.4), params);
        starts.push(d);
        approx = d;
      }
    }
    var years = [];
    for (var i = 0; i + 12 < starts.length; i += 12) {
      var row = [];
      for (var k = 0; k < 12; k++) row.push(starts[i + k + 1] - starts[i + k]);
      years.push(row);
    }
    return years;
  }

  var api = {
    PARAMS: PARAMS,
    sunLongitude: sunLongitude,
    sankranti: sankranti,
    monthStart: monthStart,
    projectYears: projectYears
  };

  if (node) module.exports = api;
  else root.PatroSurya = api;
})(this);
