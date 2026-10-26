/*
 * News from Nepali news sites.
 *
 * tools/fetch-news.js reads every source's RSS or Atom feed on a schedule
 * and publishes one news.json file; the app downloads that file. The same
 * feed parser runs in the Android app when the file can't be reached, so
 * both paths produce the same items.
 */
(function (root) {
  "use strict";

  // Published by .github/workflows/patro-news.yml to its own branch, so the
  // frequent updates don't fill the main history.
  var NEWS_URLS = [
    "https://raw.githubusercontent.com/santoshshah35/js/patro-data/news.json"
  ];

  var LANGS = ["ne", "en"];
  var CATEGORIES = ["politics", "economy", "sports", "entertainment", "world", "tech", "health", "society"];
  var CATEGORY_NAMES = {
    all: { ne: "सबै", en: "All" },
    politics: { ne: "राजनीति", en: "Politics" },
    economy: { ne: "अर्थ", en: "Economy" },
    sports: { ne: "खेलकुद", en: "Sports" },
    entertainment: { ne: "मनोरञ्जन", en: "Entertainment" },
    world: { ne: "विश्व", en: "World" },
    tech: { ne: "प्रविधि", en: "Tech" },
    health: { ne: "स्वास्थ्य", en: "Health" },
    society: { ne: "समाज", en: "Society" }
  };

  // Checked in order against a story's feed categories and link path; the
  // first match wins. Anything unmatched is "society".
  var CATEGORY_WORDS = [
    ["sports", ["खेल", "क्रिकेट", "फुटबल", "sport", "cricket", "football", "game"]],
    ["entertainment", ["मनोरञ्जन", "कला", "सिनेमा", "फिल्म", "entertainment", "art", "film", "movie", "music", "lifestyle"]],
    ["economy", ["अर्थ", "बजार", "बैंक", "शेयर", "व्यापार", "बिजनेस", "economy", "business", "market", "money", "finance", "bank"]],
    ["tech", ["प्रविधि", "विज्ञान", "technology", "tech", "science", "gadget", "auto"]],
    ["health", ["स्वास्थ्य", "health", "covid"]],
    ["world", ["विश्व", "अन्तर्राष्ट्रिय", "प्रवास", "world", "international", "global", "diaspora", "asia"]],
    ["politics", ["राजनीति", "निर्वाचन", "संसद", "सरकार", "politics", "political", "election", "parliament", "government"]]
  ];

  var LIMITS = { title: 300, summary: 240, url: 1000, source: 40 };
  var MAX_ITEMS = 600;

  // ---- Small text helpers ----

  var NAMED = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", hellip: "…",
    ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", zwj: "\u200d", zwnj: "\u200c" };

  function decodeEntities(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, code) {
      if (code[0] === "#") {
        var n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      var named = NAMED[code.toLowerCase()];
      return named === undefined ? all : named;
    });
  }

  function stripCdata(s) {
    return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  }

  // Feed text to plain text: CDATA unwrapped, tags removed, entities decoded.
  function plain(s) {
    var once = decodeEntities(stripCdata(s).replace(/<[^>]*>/g, " "));
    // Some feeds escape their HTML twice.
    return decodeEntities(once.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  }

  function clip(s, max) {
    if (s.length <= max) return s;
    var cut = s.slice(0, max - 1);
    var space = cut.lastIndexOf(" ");
    return (space > max * 0.6 ? cut.slice(0, space) : cut) + "…";
  }

  function httpsUrl(value) {
    if (typeof value !== "string") return null;
    var s = decodeEntities(value.trim());
    if (/^http:\/\//i.test(s)) s = "https://" + s.slice(7);
    return /^https:\/\/[^\s"'<>]+$/i.test(s) && s.length <= LIMITS.url ? s : null;
  }

  // A short stable id for a story, from its link.
  function idFor(link) {
    var h1 = 5381;
    var h2 = 52711;
    for (var i = 0; i < link.length; i++) {
      var c = link.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) + c) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
  }

  // ---- Feed parsing ----

  function tag(block, name) {
    var m = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i").exec(block);
    return m ? m[1] : null;
  }

  function tagsAll(block, name) {
    var re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "gi");
    var out = [];
    var m;
    while ((m = re.exec(block))) out.push(m[1]);
    return out;
  }

  function attr(block, tagName, attrName, extra) {
    var re = new RegExp("<" + tagName + "\\b([^>]*)>", "gi");
    var m;
    while ((m = re.exec(block))) {
      if (extra && !extra.test(m[1])) continue;
      var a = new RegExp("\\b" + attrName + "\\s*=\\s*([\"'])([^\"']*)\\1", "i").exec(m[1]);
      if (a) return a[2];
    }
    return null;
  }

  function imageOf(block) {
    var candidates = [
      attr(block, "media:content", "url", /medium\s*=\s*["']image|type\s*=\s*["']image|\.(jpe?g|png|webp|gif)/i),
      attr(block, "media:thumbnail", "url"),
      attr(block, "enclosure", "url", /type\s*=\s*["']image/i),
      attr(block, "enclosure", "url", /\.(jpe?g|png|webp|gif)/i)
    ];
    var html = decodeEntities(stripCdata([tag(block, "content:encoded"), tag(block, "description"),
      tag(block, "content"), tag(block, "summary")].filter(Boolean).join(" ")));
    var img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
    if (img) candidates.push(img[1]);
    for (var i = 0; i < candidates.length; i++) {
      var url = httpsUrl(candidates[i]);
      if (url) return url;
    }
    return null;
  }

  function linkOf(block) {
    var text = tag(block, "link");
    if (text && plain(text)) return httpsUrl(plain(text));
    var alt = attr(block, "link", "href", /rel\s*=\s*["']alternate/i) || attr(block, "link", "href");
    if (alt) return httpsUrl(alt);
    var guid = tag(block, "guid");
    return guid ? httpsUrl(plain(guid)) : null;
  }

  function dateOf(block) {
    var raw = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
    if (!raw) return null;
    var ms = Date.parse(plain(raw));
    return isNaN(ms) ? null : ms;
  }

  /**
   * Picks a category from a story's feed categories and link.
   * @param {string[]} labels the feed's <category> texts
   * @param {string} link story address
   * @returns {string} one of CATEGORIES
   */
  function categorize(labels, link) {
    var path = "";
    try { path = decodeURIComponent(String(link).replace(/^https?:\/\/[^/]+/, "")); } catch (e) { path = String(link); }
    var hay = (labels.join(" ") + " " + path.replace(/[-_/]/g, " ")).toLowerCase();
    for (var i = 0; i < CATEGORY_WORDS.length; i++) {
      var words = CATEGORY_WORDS[i][1];
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        // Latin words must stand alone ("art" is not "party"); Devanagari
        // words match inside longer words (राजनीतिक).
        var hit = /[a-z]/.test(w) ? new RegExp("(^|[^a-z])" + w + "s?([^a-z]|$)").test(hay) : hay.indexOf(w) >= 0;
        if (hit) return CATEGORY_WORDS[i][0];
      }
    }
    return "society";
  }

  /**
   * Reads stories from an RSS 2.0 or Atom document.
   * @param {string} xml feed text
   * @param {{id:string, lang:string}} source the source it came from
   * @param {number} [limit] most stories to keep from this feed
   * @returns {object[]} stories, newest first
   */
  function parseFeedXml(xml, source, limit) {
    var text = String(xml);
    var blocks = tagsAll(text, "item");
    if (!blocks.length) blocks = tagsAll(text, "entry");
    var out = [];
    var seen = {};
    blocks.forEach(function (block) {
      var link = linkOf(block);
      var title = plain(tag(block, "title") || "");
      if (!link || !title || seen[link]) return;
      seen[link] = true;
      var summaryRaw = tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded") || tag(block, "content") || "";
      var summary = clip(plain(summaryRaw), LIMITS.summary);
      if (summary === title) summary = "";
      var labels = tagsAll(block, "category").map(plain);
      out.push({
        id: idFor(link),
        source: source.id,
        lang: source.lang,
        title: clip(title, LIMITS.title),
        link: link,
        summary: summary,
        image: imageOf(block),
        published: dateOf(block),
        category: categorize(labels, link)
      });
    });
    out.sort(function (a, b) { return (b.published || 0) - (a.published || 0); });
    return limit ? out.slice(0, limit) : out;
  }

  // ---- Sources list (content/news-sources.json) ----

  function pair(value, max) {
    if (!value || typeof value !== "object") return null;
    var ne = typeof value.ne === "string" && value.ne.trim() ? value.ne.trim().slice(0, max) : null;
    var en = typeof value.en === "string" && value.en.trim() ? value.en.trim().slice(0, max) : null;
    if (!ne && !en) return null;
    return { ne: ne || en, en: en || ne };
  }

  /**
   * Checks the admin's list of news sources.
   * @returns {{sources: object[], skipped: number}}
   */
  function parseSources(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    var raw = json && Array.isArray(json.sources) ? json.sources : null;
    if (!raw) throw new Error("No sources list");
    var seen = {};
    var sources = [];
    raw.forEach(function (r) {
      if (!r || typeof r !== "object") return;
      var id = typeof r.id === "string" && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : null;
      var name = pair(r.name, LIMITS.source);
      var lang = LANGS.indexOf(r.lang) >= 0 ? r.lang : null;
      var feeds = Array.isArray(r.feeds) ? r.feeds.map(httpsUrl).filter(Boolean).slice(0, 4) : [];
      if (!id || !name || !lang || !feeds.length || seen[id]) return;
      seen[id] = true;
      sources.push({ id: id, name: name, lang: lang, feeds: feeds, site: httpsUrl(r.site), enabled: r.enabled !== false });
    });
    return { sources: sources, skipped: raw.length - sources.length };
  }

  // ---- The published news file ----

  function cleanItem(r, sourceIds) {
    if (!r || typeof r !== "object") return null;
    var link = httpsUrl(r.link);
    var title = typeof r.title === "string" ? r.title.trim() : "";
    if (!link || !title || title.length > LIMITS.title || !sourceIds[r.source] || LANGS.indexOf(r.lang) < 0) return null;
    return {
      id: typeof r.id === "string" && r.id ? r.id.slice(0, 32) : idFor(link),
      source: r.source,
      lang: r.lang,
      title: title,
      link: link,
      summary: typeof r.summary === "string" ? r.summary.slice(0, LIMITS.summary) : "",
      image: httpsUrl(r.image),
      published: typeof r.published === "number" && isFinite(r.published) ? r.published : null,
      category: CATEGORIES.indexOf(r.category) >= 0 ? r.category : "society"
    };
  }

  /**
   * Checks a news.json document.
   * @returns {{updatedAt:number|null, sources:object[], items:object[]}}
   */
  function parseNews(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    if (!json || json.version !== 1 || !Array.isArray(json.items) || !Array.isArray(json.sources)) {
      throw new Error("Unknown news file");
    }
    var sources = [];
    var ids = {};
    json.sources.forEach(function (s) {
      var name = s && pair(s.name, LIMITS.source);
      if (!name || typeof s.id !== "string" || ids[s.id] || LANGS.indexOf(s.lang) < 0) return;
      ids[s.id] = true;
      sources.push({ id: s.id, name: name, lang: s.lang, site: httpsUrl(s.site) });
    });
    var seen = {};
    var items = [];
    json.items.slice(0, MAX_ITEMS).forEach(function (r) {
      var item = cleanItem(r, ids);
      if (item && !seen[item.id]) {
        seen[item.id] = true;
        items.push(item);
      }
    });
    var at = Date.parse(json.updatedAt);
    return { updatedAt: isNaN(at) ? null : at, sources: sources, items: items };
  }

  /**
   * Stories matching the reader's choices, newest first.
   * @param {object[]} items from parseNews
   * @param {{lang?:string, source?:string, category?:string, query?:string, only?:string[]}} f
   */
  function filterNews(items, f) {
    var q = (f.query || "").trim().toLowerCase();
    return items.filter(function (it) {
      return (!f.lang || f.lang === "all" || it.lang === f.lang)
        && (!f.source || f.source === "all" || it.source === f.source)
        && (!f.category || f.category === "all" || it.category === f.category)
        && (!f.only || f.only.indexOf(it.id) >= 0)
        && (!q || it.title.toLowerCase().indexOf(q) >= 0 || it.summary.toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (b.published || 0) - (a.published || 0); });
  }

  /**
   * How long ago a moment was, in the largest whole unit.
   * @returns {{unit:"now"|"min"|"hour"|"day", n:number}}
   */
  function timeAgo(ms, now) {
    var mins = Math.floor((now - ms) / 60000);
    if (mins < 1) return { unit: "now", n: 0 };
    if (mins < 60) return { unit: "min", n: mins };
    if (mins < 24 * 60) return { unit: "hour", n: Math.floor(mins / 60) };
    return { unit: "day", n: Math.floor(mins / 1440) };
  }

  var api = {
    NEWS_URLS: NEWS_URLS,
    CATEGORIES: CATEGORIES,
    CATEGORY_NAMES: CATEGORY_NAMES,
    MAX_ITEMS: MAX_ITEMS,
    parseFeedXml: parseFeedXml,
    categorize: categorize,
    parseSources: parseSources,
    parseNews: parseNews,
    filterNews: filterNews,
    timeAgo: timeAgo,
    idFor: idFor
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroNews = api;
})(this);
