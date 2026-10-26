/*
 * Trending news: stories that several different sites are covering at the
 * same time. Words (and two-word phrases) in recent headlines are counted
 * by how many sources use them; a story scores by its widely shared words,
 * and only the best story about each topic is kept.
 */
(function (root) {
  "use strict";

  var WINDOW_HOURS = 18;
  var MIN_SOURCES = 3;
  var MAX_STORIES = 12;
  var MAX_TOPICS = 10;

  // Common words that say nothing about the story.
  var STOP = {};
  ("र को का की के मा ले लाई बाट सँग देखि सम्म लागि पनि नै यो त्यो ती यी छ छन् हो हुन् थियो थिए भयो भए भएको भएका " +
    "गर्न गर्ने गरेको गरेका गरी गर्दै गरे हुने हुँदै भन्छन् भने भन्ने भन्दै एक दुई तीन नयाँ आज भोलि हिजो अब फेरि " +
    "माथि तल बीच प्रति अनुसार सबै केही कुनै धेरै थप वटा जना रहेको रहेका रहेछ दिन बजे साल वर्ष महिना " +
    "the a an and or of to in on for at by with from as is are was were be been has have had it its this that " +
    "these those after before over under into about says said say new will can could may more most than not " +
    "who what when where how why his her their our your nepal nepali nepal's kathmandu government minister day year " +
    "must urges urged calls called amid set likely expected rises out up people today week first second third")
    .split(/\s+/).forEach(function (w) { STOP[w] = true; });

  // Postpositions joined to Nepali words: "एनपीएलको" counts as "एनपीएल".
  var SUFFIXES = ["हरूलाई", "हरूको", "हरूले", "द्वारा", "हरू", "हरु", "लाई", "बाट", "सँग", "को", "का", "की", "ले", "मा"];

  function stem(word) {
    if (/[a-z]/.test(word)) return word.replace(/'s$/, "");
    for (var i = 0; i < SUFFIXES.length; i++) {
      var s = SUFFIXES[i];
      if (word.length > s.length + 2 && word.slice(-s.length) === s) return word.slice(0, -s.length);
    }
    return word;
  }

  /** A headline's meaningful words, in order. */
  function words(title) {
    return String(title).toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9ऀ-ॣ०-ॿ']+/g, " ")
      .split(" ").map(stem).filter(function (w) {
        if (!w || STOP[w] || /^[0-9०-९']+$/.test(w)) return false;
        return /[a-z]/.test(w) ? w.length >= 3 : w.length >= 2;
      });
  }

  // Words and adjacent pairs, each once.
  function terms(title) {
    var w = words(title);
    var out = {};
    w.forEach(function (x, i) {
      out[x] = true;
      if (i > 0) out[w[i - 1] + " " + x] = true;
    });
    return Object.keys(out);
  }

  /**
   * The trending stories and topics among recent items.
   * @param {object[]} items stories with id, source, lang, title, published
   * @param {number} now current time (ms)
   * @returns {{ids: string[], topics: {text:string, lang:string}[]}}
   */
  function trending(items, now) {
    var since = now - WINDOW_HOURS * 3600000;
    var recent = items.filter(function (it) { return it.published && it.published >= since; });
    // "lang|term" -> the sources using it
    var spread = {};
    var itemTerms = {};
    recent.forEach(function (it) {
      var list = terms(it.title);
      itemTerms[it.id] = list;
      list.forEach(function (term) {
        var key = it.lang + "|" + term;
        (spread[key] = spread[key] || {})[it.source] = true;
      });
    });
    var width = {};
    Object.keys(spread).forEach(function (key) {
      var n = Object.keys(spread[key]).length;
      if (n >= MIN_SOURCES) width[key] = n;
    });

    function bestTerm(it) {
      var best = null;
      itemTerms[it.id].forEach(function (term) {
        var n = width[it.lang + "|" + term] || 0;
        // A shared phrase beats its single words at the same spread.
        if (n && (!best || n > best.n || (n === best.n && term.indexOf(" ") > 0 && best.term.indexOf(" ") < 0))) {
          best = { term: term, n: n };
        }
      });
      return best;
    }

    var scored = recent.map(function (it) {
      var score = 0;
      itemTerms[it.id].forEach(function (term) {
        var n = width[it.lang + "|" + term];
        if (n) score += (n - 1) * (term.indexOf(" ") > 0 ? 2 : 1);
      });
      return { it: it, score: score, top: bestTerm(it) };
    }).filter(function (s) { return s.score > 0; });
    scored.sort(function (a, b) { return (b.score - a.score) || (b.it.published - a.it.published); });

    // One story per topic, so the list isn't five copies of the same news:
    // once a story is picked, every shared term in it is used up.
    var used = {};
    var ids = [];
    var topics = [];
    scored.forEach(function (s) {
      if (ids.length >= MAX_STORIES || used[s.it.lang + "|" + s.top.term]) return;
      itemTerms[s.it.id].forEach(function (term) {
        if (width[s.it.lang + "|" + term]) used[s.it.lang + "|" + term] = true;
      });
      ids.push(s.it.id);
      if (topics.length < MAX_TOPICS) topics.push({ text: s.top.term, lang: s.it.lang });
    });
    return { ids: ids, topics: topics };
  }

  var api = { trending: trending, words: words };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroTrending = api;
})(this);
