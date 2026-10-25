/*
 * Lunar months (amanta: new moon to new moon) and the festivals set by them.
 *
 * A lunar month is named after the sidereal solar month (sankranti) that
 * begins during it: the month in which the Sun enters Mesha is Chaitra, the
 * one in which it enters Tula is Asoj, and so on. A lunar month with no
 * sankranti is adhik (intercalary); it takes the next month's name and has
 * no festivals.
 *
 * A day carries the tithi in force at Kathmandu sunrise. When a tithi starts
 * and ends between two sunrises it is skipped; its festival goes on the day it
 * occurred. When one tithi covers two sunrises, its festival goes on the first.
 * Real panchangs refine some festivals with other rules (for example Shivaratri
 * follows the midnight tithi), so a festival can land a day off now and then.
 */
(function (root) {
  "use strict";

  var Tithi = typeof module !== "undefined" && module.exports
    ? require("./tithi.js")
    : root.PatroTithi;

  var MS_PER_DAY = 86400000;
  var SYNODIC_MS = 29.530588853 * MS_PER_DAY;
  // New moon of 2000-01-06 18:14 UTC; lunations are counted from it.
  var REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

  // Same order as Bikram Sambat months: Baisakh = 0.
  var MONTHS_NE = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
    "कार्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"];
  var MONTHS_EN = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

  // Lahiri ayanamsa, degrees: 23.853° at J2000, precessing 50.29"/year.
  function ayanamsa(ms) {
    var years = (ms - Date.UTC(2000, 0, 1, 12)) / (365.25 * MS_PER_DAY);
    return 23.853 + years * 50.29 / 3600;
  }

  function siderealSun(ms) {
    var jd = Tithi.julianDay(ms);
    var s = Tithi.sunLongitude(jd) - ayanamsa(ms);
    return ((s % 360) + 360) % 360;
  }

  // The new moon nearest to lunation number k.
  function newMoon(k) {
    var ms = REF_NEW_MOON + k * SYNODIC_MS;
    for (var i = 0; i < 6; i++) {
      var e = Tithi.elongation(ms);
      if (e > 180) e -= 360;
      ms -= e / 12.19 * MS_PER_DAY;
    }
    return ms;
  }

  // Lunation number of the lunar month in force at a moment.
  function lunationAt(ms) {
    var k = Math.floor((ms - REF_NEW_MOON) / SYNODIC_MS);
    while (newMoon(k + 1) <= ms) k++;
    while (newMoon(k) > ms) k--;
    return k;
  }

  var monthCache = {};

  /**
   * Name and status of lunation k.
   * @returns {{lunation:number, start:number, end:number, month:number, adhik:boolean}}
   *   month is 0-11 in Bikram Sambat order (0 = Baisakh).
   */
  function lunarMonth(k) {
    if (monthCache[k]) return monthCache[k];
    var start = newMoon(k);
    var end = newMoon(k + 1);
    var s0 = Math.floor(siderealSun(start) / 30);
    var s1 = Math.floor(siderealSun(end) / 30);
    var info;
    if (s0 === s1) {
      var next = lunarMonth(k + 1);
      info = { lunation: k, start: start, end: end, month: next.month, adhik: true };
    } else {
      // The sign entered during the month; Mesha (0) -> Chaitra (11).
      var entered = (s0 + 1) % 12;
      info = { lunation: k, start: start, end: end, month: (entered + 11) % 12, adhik: false };
    }
    monthCache[k] = info;
    return info;
  }

  // Lunar position of a civil day at Kathmandu sunrise.
  // ordinal counts tithis continuously: lunation * 30 + (tithi - 1).
  var dayCache = {};
  function lunarDay(dayNumber) {
    if (dayCache[dayNumber]) return dayCache[dayNumber];
    var t = Tithi.tithiOn(dayNumber);
    var k = lunationAt(t.sunrise);
    var info = { tithi: t, lunation: k, ordinal: k * 30 + t.number - 1 };
    dayCache[dayNumber] = info;
    return info;
  }

  // Moment of a day at which a festival's tithi is judged, as UTC ms.
  // Nepal Time is UTC+05:45; the fixed clock times below are close enough to
  // the true afternoon (aparahna), evening (pradosh) and midnight (nishita)
  // periods in Kathmandu, which drift by under half an hour over the year.
  var NPT_MS = (5 * 60 + 45) * 60000;
  var KALA_HOURS = { aparahna: 14.5, pradosh: 19, nishita: 24 };

  var kalaCache = {};
  function ordinalAt(dayNumber, kala) {
    if (!kala || kala === "sunrise") return lunarDay(dayNumber).ordinal;
    var key = kala + ":" + dayNumber;
    if (kalaCache[key] === undefined) {
      var ms = dayNumber * MS_PER_DAY - NPT_MS + KALA_HOURS[kala] * 3600000;
      kalaCache[key] = lunationAt(ms) * 30 + Math.floor(Tithi.elongation(ms) / 12);
    }
    return kalaCache[key];
  }

  // [month (0 = Baisakh), tithi 1-30, Nepali, English, time of day judged]
  // Tithi 16-30 are the Krishna Paksha of the amanta month; in the purnimanta
  // naming often used for these festivals that half belongs to the next month.
  // The time of day defaults to sunrise.
  var FESTIVALS = [
    [0, 15, "बुद्ध जयन्ती", "Buddha Jayanti"],
    [3, 5, "नाग पञ्चमी", "Nag Panchami"],
    [3, 15, "जनै पूर्णिमा / रक्षाबन्धन", "Janai Purnima / Raksha Bandhan"],
    [3, 16, "गाईजात्रा", "Gai Jatra"],
    [3, 23, "श्रीकृष्ण जन्माष्टमी", "Krishna Janmashtami"],
    [3, 30, "कुशे औंसी (बुवाको मुख हेर्ने दिन)", "Kushe Aunsi (Father's Day)"],
    [4, 3, "हरितालिका तीज", "Haritalika Teej"],
    [4, 5, "ऋषि पञ्चमी", "Rishi Panchami"],
    [5, 1, "घटस्थापना", "Ghatasthapana"],
    [5, 7, "फूलपाती", "Fulpati"],
    [5, 8, "महाअष्टमी", "Maha Ashtami"],
    [5, 9, "महानवमी", "Maha Navami"],
    [5, 10, "विजया दशमी", "Vijaya Dashami", "aparahna"],
    [5, 15, "कोजाग्रत पूर्णिमा", "Kojagrat Purnima"],
    [5, 28, "काग तिहार", "Kag Tihar"],
    [5, 29, "कुकुर तिहार", "Kukur Tihar"],
    [5, 30, "लक्ष्मी पूजा", "Laxmi Puja"],
    [6, 1, "गोवर्धन पूजा / म्ह पूजा", "Govardhan Puja / Mha Puja"],
    [6, 2, "भाइटीका", "Bhai Tika"],
    [6, 6, "छठ पर्व", "Chhath", "pradosh"],
    [6, 11, "हरिबोधिनी एकादशी", "Haribodhini Ekadashi"],
    [9, 5, "बसन्त पञ्चमी (सरस्वती पूजा)", "Basanta Panchami (Saraswati Puja)"],
    [9, 29, "महाशिवरात्रि", "Maha Shivaratri", "nishita"],
    [10, 15, "फागु पूर्णिमा (होली)", "Fagu Purnima (Holi)", "pradosh"],
    [10, 30, "घोडेजात्रा", "Ghode Jatra"],
    [11, 9, "राम नवमी", "Ram Navami"],
    [11, 30, "मातातीर्थ औंसी (आमाको मुख हेर्ने दिन)", "Matatirtha Aunsi (Mother's Day)"]
  ];

  /**
   * Lunar festivals that fall on a civil day.
   * @param {number} dayNumber days since 1970-01-01
   * @returns {{ne:string, en:string}[]}
   */
  function festivalsOn(dayNumber) {
    var out = [];
    FESTIVALS.forEach(function (f) {
      var kala = f[4] || "sunrise";
      var prev = ordinalAt(dayNumber - 1, kala);
      var cur = ordinalAt(dayNumber, kala);
      var next = ordinalAt(dayNumber + 1, kala);
      // This day owns the tithis that begin with it: its own tithi unless the
      // previous day already had it, plus any skipped before the next day.
      for (var o = Math.max(prev + 1, cur); o < next; o++) {
        var month = lunarMonth(Math.floor(o / 30));
        if (!month.adhik && f[0] === month.month && f[1] === (o % 30) + 1) {
          out.push({ ne: f[2], en: f[3] });
        }
      }
    });
    return out;
  }

  // Display name of the lunar month a day falls in. Nepali calendars name the
  // Krishna Paksha after the following month (purnimanta), so Laxmi Puja is
  // "Kartik Krishna Aunsi" although it ends the amanta month of Asoj.
  function monthName(dayNumber) {
    var day = lunarDay(dayNumber);
    var krishna = day.tithi.number > 15;
    var m = lunarMonth(day.lunation + (krishna ? 1 : 0));
    return {
      ne: (m.adhik ? "अधिक " : "") + MONTHS_NE[m.month],
      en: (m.adhik ? "Adhik " : "") + MONTHS_EN[m.month],
      adhik: m.adhik
    };
  }

  var api = {
    ayanamsa: ayanamsa,
    siderealSun: siderealSun,
    newMoon: newMoon,
    lunationAt: lunationAt,
    lunarMonth: lunarMonth,
    lunarDay: lunarDay,
    festivalsOn: festivalsOn,
    monthName: monthName
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroLunar = api;
})(this);
