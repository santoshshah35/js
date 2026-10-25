/*
 * Tithi (lunar day) at sunrise in Kathmandu.
 *
 * A tithi is each 12° step of the Moon's elongation from the Sun, so day 1
 * (Pratipada) starts at new moon and day 15 (Purnima) ends at full moon. Nepali
 * calendars name a civil day after the tithi in force at local sunrise.
 *
 * Positions use the truncated series from Jean Meeus, "Astronomical
 * Algorithms" (2nd ed.): chapter 25 for the Sun and the 60 longitude terms of
 * chapter 47 for the Moon. That is good to roughly 0.01°, which puts tithi
 * boundaries within a few minutes of a full ephemeris. A day whose tithi
 * changes within minutes of sunrise can still disagree with a published
 * panchang.
 */
(function (root) {
  "use strict";

  var DEG = Math.PI / 180;
  var KATHMANDU = { lat: 27.7172, lon: 85.3240 };

  var NAMES_NE = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी", "षष्ठी", "सप्तमी",
    "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी"];
  var NAMES_EN = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami",
    "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"];

  // Meeus table 47.A, longitude terms: D, M, M', F, coefficient (1e-6 degrees).
  var MOON_TERMS = [
    [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314],
    [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
    [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322],
    [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
    [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
    [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
    [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766],
    [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
    [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
    [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
    [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120],
    [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
    [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110],
    [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
    [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
    [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
    [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399],
    [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
    [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323],
    [1, 1, -1, 0, 299], [2, 0, 3, 0, 294]
  ];

  function norm360(x) {
    x %= 360;
    return x < 0 ? x + 360 : x;
  }

  // Julian Day for a millisecond timestamp (UT; the few-second TT offset is ignored
  // here and handled by deltaT() where it matters).
  function julianDay(ms) {
    return ms / 86400000 + 2440587.5;
  }

  // TT - UT in days. A smooth fit is plenty: it moves the Moon by under 0.001°
  // per second of error, and the fit is within a few seconds over 1943-2027.
  function deltaT(jd) {
    var y = 2000 + (jd - 2451545) / 365.25;
    var t = y - 2000;
    var seconds = y < 2005
      ? 63.86 + 0.3345 * t - 0.060374 * t * t
      : 62.92 + 0.32217 * t + 0.005589 * t * t;
    if (y < 1986) {
      var u = y - 1975;
      seconds = 45.45 + 1.067 * u - u * u / 260 - u * u * u / 718;
    }
    return seconds / 86400;
  }

  function nutationInLongitude(T) {
    var omega = (125.04452 - 1934.136261 * T) * DEG;
    var L = (280.4665 + 36000.7698 * T) * DEG;
    var Lp = (218.3165 + 481267.8813 * T) * DEG;
    return (-17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * L)
      - 0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * omega)) / 3600;
  }

  // Apparent geocentric longitude of the Sun, degrees (Meeus ch. 25).
  function sunLongitude(jde) {
    var T = (jde - 2451545) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
      + 0.000289 * Math.sin(3 * M);
    var omega = (125.04 - 1934.136 * T) * DEG;
    return norm360(L0 + C - 0.00569 - 0.00478 * Math.sin(omega));
  }

  // Apparent geocentric longitude of the Moon, degrees (Meeus ch. 47).
  function moonLongitude(jde) {
    var T = (jde - 2451545) / 36525;
    var Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T
      + T * T * T / 538841 - T * T * T * T / 65194000);
    var D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T
      + T * T * T / 545868 - T * T * T * T / 113065000);
    var M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T
      + T * T * T / 24490000);
    var Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T
      + T * T * T / 69699 - T * T * T * T / 14712000);
    var F = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T
      - T * T * T / 3526000 + T * T * T * T / 863310000);
    var A1 = norm360(119.75 + 131.849 * T);
    var A2 = norm360(53.09 + 479264.290 * T);
    var E = 1 - 0.002516 * T - 0.0000074 * T * T;

    var sum = 0;
    for (var i = 0; i < MOON_TERMS.length; i++) {
      var t = MOON_TERMS[i];
      var arg = (t[0] * D + t[1] * M + t[2] * Mp + t[3] * F) * DEG;
      var coeff = t[4];
      if (Math.abs(t[1]) === 1) coeff *= E;
      else if (Math.abs(t[1]) === 2) coeff *= E * E;
      sum += coeff * Math.sin(arg);
    }
    sum += 3958 * Math.sin(A1 * DEG) + 1962 * Math.sin((Lp - F) * DEG) + 318 * Math.sin(A2 * DEG);

    return norm360(Lp + sum / 1e6 + nutationInLongitude(T));
  }

  // Moon minus Sun, 0-360°, at a UT timestamp.
  function elongation(ms) {
    var jd = julianDay(ms);
    var jde = jd + deltaT(jd);
    return norm360(moonLongitude(jde) - sunLongitude(jde));
  }

  // Sunrise or sunset (UT ms) at a place on a civil date, NOAA solar position
  // method. dayNumber counts days since 1970-01-01.
  function riseOrSet(dayNumber, place, setting) {
    place = place || KATHMANDU;
    var noonGuess = dayNumber * 86400000 + (12 - place.lon / 15) * 3600000;
    var ms = noonGuess + (setting ? 6 : -6) * 3600000;
    for (var i = 0; i < 3; i++) {
      var T = (julianDay(ms) - 2451545) / 36525;
      var L0 = norm360(280.46646 + 36000.76983 * T);
      var M = 357.52911 + 35999.05029 * T;
      var e = 0.016708634 - 0.000042037 * T;
      var C = 1.914602 * Math.sin(M * DEG) + 0.019993 * Math.sin(2 * M * DEG)
        + 0.000289 * Math.sin(3 * M * DEG);
      var lambda = (L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * DEG)) * DEG;
      var eps = (23.439291 - 0.0130042 * T + 0.00256 * Math.cos((125.04 - 1934.136 * T) * DEG)) * DEG;
      var decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
      var y = Math.pow(Math.tan(eps / 2), 2);
      var eqTime = 4 / DEG * (y * Math.sin(2 * L0 * DEG) - 2 * e * Math.sin(M * DEG)
        + 4 * e * y * Math.sin(M * DEG) * Math.cos(2 * L0 * DEG)
        - 0.5 * y * y * Math.sin(4 * L0 * DEG) - 1.25 * e * e * Math.sin(2 * M * DEG));
      var lat = place.lat * DEG;
      var cosH = (Math.cos(90.833 * DEG) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
      var hourAngle = Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG;
      var minutes = 720 - 4 * (place.lon + (setting ? -hourAngle : hourAngle)) - eqTime;
      ms = dayNumber * 86400000 + minutes * 60000;
    }
    return ms;
  }

  function sunrise(dayNumber, place) {
    return riseOrSet(dayNumber, place, false);
  }

  function sunset(dayNumber, place) {
    return riseOrSet(dayNumber, place, true);
  }

  // Tithi in force at Kathmandu sunrise on a civil date.
  function tithiOn(dayNumber) {
    var rise = sunrise(dayNumber);
    var index = Math.floor(elongation(rise) / 12); // 0-29
    var shukla = index < 15;
    var inPaksha = index % 15; // 0-14
    var name;
    if (index === 14) name = { ne: "पूर्णिमा", en: "Purnima" };
    else if (index === 29) name = { ne: "औंसी", en: "Aunsi" };
    else name = { ne: NAMES_NE[inPaksha], en: NAMES_EN[inPaksha] };
    return {
      number: index + 1,
      paksha: shukla ? { ne: "शुक्ल पक्ष", en: "Shukla Paksha" } : { ne: "कृष्ण पक्ष", en: "Krishna Paksha" },
      name: name,
      sunrise: rise
    };
  }

  var api = {
    KATHMANDU: KATHMANDU,
    julianDay: julianDay,
    sunLongitude: sunLongitude,
    moonLongitude: moonLongitude,
    elongation: elongation,
    sunrise: sunrise,
    sunset: sunset,
    tithiOn: tithiOn
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroTithi = api;
})(this);
