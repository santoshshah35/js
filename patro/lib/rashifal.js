/*
 * Daily rashifal from the Moon's transit (gochar).
 *
 * The Moon spends about two and a quarter days in each sidereal sign. For each
 * of the twelve rashis the day's reading follows the house the Moon occupies
 * counted from that rashi: houses 1, 3, 6, 7, 10 and 11 are traditionally
 * favourable, 4, 8 and 12 unfavourable, and 2, 5 and 9 mixed. This is the
 * classical rule of thumb, not a personal horoscope, and is shown for
 * interest only.
 */
(function (root) {
  "use strict";

  var node = typeof module !== "undefined" && module.exports;
  var Tithi = node ? require("./tithi.js") : root.PatroTithi;
  var Lunar = node ? require("./lunar.js") : root.PatroLunar;

  var RASHIS = [
    { ne: "मेष", en: "Mesh (Aries)" },
    { ne: "वृष", en: "Brish (Taurus)" },
    { ne: "मिथुन", en: "Mithun (Gemini)" },
    { ne: "कर्कट", en: "Karkat (Cancer)" },
    { ne: "सिंह", en: "Singha (Leo)" },
    { ne: "कन्या", en: "Kanya (Virgo)" },
    { ne: "तुला", en: "Tula (Libra)" },
    { ne: "वृश्चिक", en: "Brischik (Scorpio)" },
    { ne: "धनु", en: "Dhanu (Sagittarius)" },
    { ne: "मकर", en: "Makar (Capricorn)" },
    { ne: "कुम्भ", en: "Kumbha (Aquarius)" },
    { ne: "मीन", en: "Meen (Pisces)" }
  ];

  // Moon in house 1-12 counted from the rashi.
  var READINGS = [
    { tone: "good", ne: "मन प्रसन्न रहनेछ। सुख, आराम र मीठो भोजनको योग छ।", en: "A settled, cheerful day. Comfort and good food are indicated." },
    { tone: "mixed", ne: "खर्च बढ्न सक्छ। पैसा र बोलीमा संयम राख्नुहोस्।", en: "Spending may rise. Be careful with money and with words at home." },
    { tone: "good", ne: "आँट र मेहनतले सफलता दिलाउनेछ। साथीभाइबाट सहयोग मिल्नेछ।", en: "Effort pays off and courage brings success. Friends and siblings help." },
    { tone: "bad", ne: "मन अलि अशान्त हुन सक्छ। यात्रा र घरायसी काममा सावधानी अपनाउनुहोस्।", en: "Some unease. Take care with travel and matters at home." },
    { tone: "mixed", ne: "योजना ढिलो हुन सक्छन्। ठूला निर्णय पर्खेर गर्नुहोस्।", en: "Plans may be delayed. Hold off on big decisions." },
    { tone: "good", ne: "स्वास्थ्य राम्रो रहनेछ। प्रतिस्पर्धा र विवादमा जित हुनेछ।", en: "Good health, and the upper hand over rivals and problems." },
    { tone: "good", ne: "साथ, सम्मान र रमाइलोको दिन। साझेदारीका काम बन्नेछन्।", en: "Good company and respect. Partnerships go well." },
    { tone: "bad", ne: "चन्द्राष्टम: जोखिम नलिनुहोस्, स्वास्थ्य र यात्रामा ध्यान दिनुहोस्।", en: "Chandrashtama: avoid risks and look after your health on the move." },
    { tone: "mixed", ne: "काममा केही अवरोध आउन सक्छन्। धैर्य र पूजापाठले मन शान्त होला।", en: "Some obstacles at work. Patience and quiet reflection help." },
    { tone: "good", ne: "काम र पेसामा सफलता। अधिकारीहरूबाट सहयोग मिल्नेछ।", en: "Success at work. Support from people in charge." },
    { tone: "good", ne: "आम्दानी र लाभको योग। साथीहरूसँग खुसीका पल बित्नेछन्।", en: "Gains and income are indicated, and happy time with friends." },
    { tone: "bad", ne: "खर्च र थकान बढ्न सक्छ। पर्याप्त आराम लिनुहोस्।", en: "Expenses and tiredness may rise. Get enough rest." }
  ];

  function siderealMoon(ms) {
    var s = Tithi.moonLongitude(Tithi.julianDay(ms)) - Lunar.ayanamsa(ms);
    return ((s % 360) + 360) % 360;
  }

  function signAt(ms) {
    return Math.floor(siderealMoon(ms) / 30);
  }

  /**
   * The Moon's sign at Kathmandu sunrise, and when it moves on before the next
   * sunrise (if it does).
   * @param {number} dayNumber days since 1970-01-01
   * @returns {{sign:number, next:number|null, changesAt:number|null}}
   */
  function moonOn(dayNumber) {
    var start = Tithi.sunrise(dayNumber);
    var end = Tithi.sunrise(dayNumber + 1);
    var sign = signAt(start);
    if (signAt(end) === sign) return { sign: sign, next: null, changesAt: null };
    var lo = start, hi = end;
    while (hi - lo > 30000) {
      var mid = (lo + hi) / 2;
      if (signAt(mid) === sign) lo = mid; else hi = mid;
    }
    return { sign: sign, next: (sign + 1) % 12, changesAt: hi };
  }

  /**
   * Readings for all twelve rashis on a day.
   * @returns {{moon:object, readings:{rashi:object, house:number, tone:string, ne:string, en:string}[]}}
   */
  function rashifalOn(dayNumber) {
    var moon = moonOn(dayNumber);
    var readings = RASHIS.map(function (rashi, i) {
      var house = ((moon.sign - i + 12) % 12) + 1;
      var r = READINGS[house - 1];
      return { rashi: rashi, house: house, tone: r.tone, ne: r.ne, en: r.en };
    });
    return { moon: moon, readings: readings };
  }

  // The Sun in house 1-12 from the rashi, for the monthly reading. Classical
  // gochar favours houses 3, 6, 10 and 11; 8 and 12 call for most care.
  var SUN_READINGS = [
    { tone: "mixed", ne: "सूर्य जन्म राशिमा: थकान र झर्को बढ्न सक्छ। स्वास्थ्य र आरामलाई प्राथमिकता दिनुहोस्।", en: "Sun in your sign: fatigue and short temper are possible. Put health and rest first." },
    { tone: "mixed", ne: "खर्च र परिवारमा तनाव बढ्न सक्छ। बोली र बजेटमा ध्यान दिनुहोस्।", en: "Spending and family friction may rise. Watch your words and your budget." },
    { tone: "good", ne: "आँट, स्वास्थ्य र सफलताको महिना। अड्केका काम अघि बढ्नेछन्।", en: "A month of courage, good health and success. Stalled work moves forward." },
    { tone: "mixed", ne: "घर, सवारी र यात्रामा बाधा आउन सक्छ। मन शान्त राख्नुहोस्।", en: "Home, vehicles and travel may meet obstacles. Keep a calm mind." },
    { tone: "mixed", ne: "मन अशान्त र सन्तानको चिन्ता हुन सक्छ। ठूला लगानी पर्खनुहोस्।", en: "Worry and concern about children are possible. Hold off on big investments." },
    { tone: "good", ne: "रोग, शत्रु र ऋणमाथि विजय। प्रतिस्पर्धामा सफलता मिल्नेछ।", en: "Victory over illness, rivals and debts. Success in competition." },
    { tone: "mixed", ne: "यात्राले थकाउन सक्छ। साझेदारी र दाम्पत्यमा धैर्य राख्नुहोस्।", en: "Travel may tire you. Be patient with partners and your spouse." },
    { tone: "bad", ne: "स्वास्थ्य र विवादमा विशेष सावधानी। जोखिमपूर्ण काम नगर्नुहोस्।", en: "Take special care with health and disputes. Avoid risky ventures." },
    { tone: "mixed", ne: "काममा अवरोध र आत्मविश्वासमा कमी आउन सक्छ। बुझेर मात्र निर्णय गर्नुहोस्।", en: "Obstacles and lower confidence are possible. Decide only after careful thought." },
    { tone: "good", ne: "काम र पेसामा सफलता, पद र मान बढ्नेछ।", en: "Success at work, with recognition and standing." },
    { tone: "good", ne: "आम्दानी, लाभ र सम्मानको महिना। इच्छा पूरा हुने योग।", en: "A month of income, gains and honour. Wishes tend to come true." },
    { tone: "bad", ne: "खर्च र भ्रमण बढ्नेछ, आराम कम हुन सक्छ। फजुल खर्चबाट बच्नुहोस्।", en: "More spending and travel, less rest. Avoid needless expense." }
  ];

  function house(sign, rashi) {
    return ((sign - rashi + 12) % 12) + 1;
  }

  function overallTone(good, bad) {
    if (bad >= 3) return "bad";
    if (good >= 4 && bad <= 1) return "good";
    return "mixed";
  }

  /**
   * The Moon's day-by-day transit over a run of days, for each rashi: which
   * days read good, mixed or bad, and the chandrashtama (eighth house) days.
   * @param {number} firstDay @param {number} lastDay inclusive
   */
  function daysFor(firstDay, lastDay) {
    var signs = [];
    for (var n = firstDay; n <= lastDay; n++) signs.push(moonOn(n).sign);
    return RASHIS.map(function (rashi, i) {
      var r = { rashi: rashi, good: [], mixed: [], bad: [], chandrashtama: [] };
      signs.forEach(function (sign, k) {
        var h = house(sign, i);
        r[READINGS[h - 1].tone].push(firstDay + k);
        if (h === 8) r.chandrashtama.push(firstDay + k);
      });
      return r;
    });
  }

  /** Weekly reading for the seven days from firstDay (a Sunday). */
  function weeklyFor(firstDay) {
    return {
      first: firstDay,
      last: firstDay + 6,
      readings: daysFor(firstDay, firstDay + 6).map(function (r) {
        r.tone = overallTone(r.good.length, r.bad.length);
        return r;
      })
    };
  }

  /**
   * Monthly reading for a BS month: the Sun's transit house from each rashi
   * (the Sun spends the month in sign month - 1) plus the Moon's days.
   * @param {number} firstDay first day of the month @param {number} lastDay last day
   * @param {number} month BS month 1-12
   */
  function monthlyFor(firstDay, lastDay, month) {
    var sunSign = month - 1;
    return {
      first: firstDay,
      last: lastDay,
      sunSign: sunSign,
      readings: daysFor(firstDay, lastDay).map(function (r, i) {
        var h = house(sunSign, i);
        var sun = SUN_READINGS[h - 1];
        r.sunHouse = h;
        r.tone = sun.tone;
        r.ne = sun.ne;
        r.en = sun.en;
        return r;
      })
    };
  }

  var api = {
    RASHIS: RASHIS,
    siderealMoon: siderealMoon,
    moonOn: moonOn,
    rashifalOn: rashifalOn,
    weeklyFor: weeklyFor,
    monthlyFor: monthlyFor
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroRashifal = api;
})(this);
