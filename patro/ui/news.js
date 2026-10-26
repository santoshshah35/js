/*
 * News screen and the latest headlines on the calendar page.
 *
 * Stories come from news.json, published every 30 minutes by a GitHub job
 * that reads the Nepali and English news sites' RSS feeds (lib/news.js).
 * When that file is old or out of reach, the Android app reads the feeds
 * itself. Saving stories is members-only when the admin says so.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var News = root.PatroNews;
  var Trending = root.PatroTrending;
  var Config = root.PatroConfig;
  var Rates = root.PatroRates;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var CACHE_KEY = "patro.news";
  var FILTER_KEY = "patro.news.filter";
  var PAGE = 25;
  var HOME_COUNT = 5;
  var MAX_SAVED = 200;
  var REFRESH_MS = 15 * 60 * 1000;
  // Older than this, the Android app reads the feeds itself.
  var STALE_MS = 2 * 3600 * 1000;
  var DIRECT_PER_SOURCE = 20;
  var DIRECT_PARALLEL = 4;

  var data = { updatedAt: null, sources: [], items: [], trending: [], topics: [] };
  var TRENDING_SHOWN = 8;
  var filter = { lang: "all", source: "all", category: "all", query: "" };
  var shown = PAGE;
  var loading = false;
  var lastAttempt = 0;

  UI.addText({
    ne: {
      navNews: "समाचार",
      newsTitle: "समाचार",
      homeNews: "ताजा समाचार",
      allNews: "सबै समाचार ›",
      newsAllLang: "सबै",
      newsAllSources: "सबै स्रोत",
      newsSaved: "★ सेभ गरिएका",
      newsTrending: "🔥 ट्रेन्डिङ",
      trendingTitle: "🔥 ट्रेन्डिङ समाचार",
      trendingTopics: "चर्चित विषय",
      newsNoneTrending: "अहिले कुनै समाचार ट्रेन्डिङमा छैन।",
      newsSearch: "समाचार खोज्नुहोस्",
      newsUpdated: "{time} अद्यावधिक",
      newsLoading: "समाचार ल्याउँदै…",
      newsNone: "कुनै समाचार भेटिएन।",
      newsNoneSaved: "तपाईंले अहिलेसम्म कुनै समाचार सेभ गर्नुभएको छैन।",
      newsOffline: "समाचार ल्याउन सकिएन। इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।",
      newsMore: "थप समाचार",
      newsRefresh: "नयाँ समाचार ल्याउनुहोस्",
      newsSave: "सेभ गर्नुहोस्",
      newsUnsave: "सेभबाट हटाउनुहोस्",
      newsShare: "सेयर गर्नुहोस्",
      newsCopied: "लिंक कपी भयो",
      agoNow: "भर्खरै",
      agoMin: "{n} मिनेट अगाडि",
      agoHour: "{n} घण्टा अगाडि",
      agoDay: "{n} दिन अगाडि"
    },
    en: {
      navNews: "News",
      newsTitle: "News",
      homeNews: "Latest news",
      allNews: "All news ›",
      newsAllLang: "All",
      newsAllSources: "All sources",
      newsSaved: "★ Saved",
      newsTrending: "🔥 Trending",
      trendingTitle: "🔥 Trending news",
      trendingTopics: "Hot topics",
      newsNoneTrending: "Nothing is trending right now.",
      newsSearch: "Search news",
      newsUpdated: "Updated {time}",
      newsLoading: "Getting the news…",
      newsNone: "No stories found.",
      newsNoneSaved: "You haven't saved any stories yet.",
      newsOffline: "Couldn't get the news. Check the internet connection and try again.",
      newsMore: "More stories",
      newsRefresh: "Get new stories",
      newsSave: "Save",
      newsUnsave: "Remove from saved",
      newsShare: "Share",
      newsCopied: "Link copied",
      agoNow: "just now",
      agoMin: "{n} min ago",
      agoHour: "{n} h ago",
      agoDay: "{n} d ago"
    }
  });

  // ---- Storage ----

  function readJson(key) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJson(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not saved */ }
  }

  function savedKey() {
    return "patro.saved." + UI.account.userKey();
  }

  function savedItems() {
    var list = readJson(savedKey());
    return Array.isArray(list) ? list.filter(function (it) { return it && it.id && it.link && it.title; }) : [];
  }

  function isSaved(id) {
    return savedItems().some(function (it) { return it.id === id; });
  }

  function toggleSaved(item) {
    var list = savedItems();
    var without = list.filter(function (it) { return it.id !== item.id; });
    writeJson(savedKey(), without.length === list.length ? [item].concat(list).slice(0, MAX_SAVED) : without);
  }

  // ---- Loading ----

  function useDoc(doc) {
    data = doc;
    renderAll();
  }

  function fromJson(body) {
    var doc = News.parseNews(body);
    writeJson(CACHE_KEY, { at: Date.now(), body: body });
    return doc;
  }

  function fetchPublished(i) {
    return Rates.httpGet(News.NEWS_URLS[i]).then(fromJson).catch(function (err) {
      if (i + 1 < News.NEWS_URLS.length) return fetchPublished(i + 1);
      throw err;
    });
  }

  function firstGood(urls, i) {
    return Rates.httpGet(urls[i]).catch(function (err) {
      if (i + 1 < urls.length) return firstGood(urls, i + 1);
      throw err;
    });
  }

  // Android only: read every source's feed through the app's own connection.
  function fetchDirect() {
    return firstGood(Config.contentUrls("news-sources.json"), 0).then(function (body) {
      var sources = News.parseSources(body).sources.filter(function (s) { return s.enabled; });
      var queue = sources.slice();
      var items = [];
      var ok = {};
      function worker() {
        var s = queue.shift();
        if (!s) return Promise.resolve();
        return firstGood(s.feeds, 0).then(function (xml) {
          var got = News.parseFeedXml(xml, s, DIRECT_PER_SOURCE);
          if (got.length) ok[s.id] = true;
          items = items.concat(got);
        }).catch(function () { /* this source is skipped */ }).then(worker);
      }
      var workers = [];
      for (var i = 0; i < DIRECT_PARALLEL; i++) workers.push(worker());
      return Promise.all(workers).then(function () {
        if (!items.length) throw new Error("No feed could be read");
        var doc = {
          version: 1,
          updatedAt: new Date().toISOString(),
          sources: sources.map(function (s) {
            return { id: s.id, name: s.name, lang: s.lang, site: s.site, priority: s.priority, ok: !!ok[s.id] };
          }),
          items: items.sort(function (a, b) { return (b.published || 0) - (a.published || 0); }).slice(0, News.MAX_ITEMS)
        };
        var hot = Trending.trending(doc.items, Date.now());
        doc.trending = hot.ids;
        doc.topics = hot.topics;
        return fromJson(JSON.stringify(doc));
      });
    });
  }

  function refresh() {
    if (loading) return;
    loading = true;
    lastAttempt = Date.now();
    renderMeta();
    var canDirect = root.PatroNative && typeof root.PatroNative.httpGet === "function";
    fetchPublished(0).then(function (doc) {
      useDoc(doc);
      if (canDirect && (!doc.updatedAt || Date.now() - doc.updatedAt > STALE_MS)) return fetchDirect().then(useDoc);
      return null;
    }).catch(function () {
      return canDirect ? fetchDirect().then(useDoc) : Promise.reject(new Error("offline"));
    }).catch(function () {
      if (!data.items.length) $("news-meta").textContent = t("newsOffline");
    }).then(function () {
      loading = false;
      renderMeta();
    });
  }

  // ---- Rendering ----

  function ago(ms) {
    if (!ms) return "";
    var a = News.timeAgo(ms, Date.now());
    var key = { now: "agoNow", min: "agoMin", hour: "agoHour", day: "agoDay" }[a.unit];
    return UI.fill(t(key), { n: UI.num(a.n) });
  }

  function sourceName(id) {
    for (var i = 0; i < data.sources.length; i++) {
      if (data.sources[i].id === id) return UI.pick(data.sources[i].name);
    }
    return id;
  }

  function share(item) {
    var bridge = root.PatroNative;
    if (navigator.share) {
      navigator.share({ title: item.title, url: item.link }).catch(function () { /* cancelled */ });
    } else if (bridge && typeof bridge.share === "function") {
      bridge.share(item.title + "\n" + item.link);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(item.link).then(function () { $("news-meta").textContent = t("newsCopied"); });
    }
  }

  function storyCard(item, compact) {
    var li = el("li", "news-item" + (compact ? " compact" : ""));
    var a = el("a", "news-link");
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener";
    if (item.image && !compact) {
      var img = el("img", "news-thumb");
      img.src = item.image;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () { img.remove(); });
      a.appendChild(img);
    }
    var text = el("div", "news-text");
    text.appendChild(el("h3", "news-headline", item.title));
    if (item.summary && !compact) text.appendChild(el("p", "news-summary", item.summary));
    text.appendChild(el("p", "news-meta", sourceName(item.source) + (item.published ? " · " + ago(item.published) : "")));
    a.appendChild(text);
    li.appendChild(a);
    if (compact) return li;

    var actions = el("div", "news-actions");
    var saved = isSaved(item.id);
    var save = el("button", "news-action" + (saved ? " on" : ""), saved ? "★" : "☆");
    save.type = "button";
    save.setAttribute("aria-label", t(saved ? "newsUnsave" : "newsSave") + ": " + item.title);
    save.setAttribute("aria-pressed", String(saved));
    save.addEventListener("click", function () {
      UI.account.requireLogin("newsSave", function () {
        toggleSaved(item);
        renderList();
      });
    });
    var sh = el("button", "news-action", "↗");
    sh.type = "button";
    sh.setAttribute("aria-label", t("newsShare") + ": " + item.title);
    sh.addEventListener("click", function () { share(item); });
    actions.appendChild(save);
    actions.appendChild(sh);
    li.appendChild(actions);
    return li;
  }

  function renderMeta() {
    var meta = $("news-meta");
    if (loading && !data.items.length) meta.textContent = t("newsLoading");
    else if (data.updatedAt) meta.textContent = UI.fill(t("newsUpdated"), { time: ago(data.updatedAt) });
    $("news-refresh").classList.toggle("spinning", loading);
  }

  function renderFilters() {
    $("news-title").textContent = t("newsTitle");
    $("news-refresh").setAttribute("aria-label", t("newsRefresh"));
    [["all", t("newsAllLang")], ["ne", "नेपाली"], ["en", "English"]].forEach(function (pair) {
      var b = $("news-lang-" + pair[0]);
      b.textContent = pair[1];
      b.setAttribute("aria-pressed", String(filter.lang === pair[0]));
    });

    var cats = $("news-cats");
    UI.clear(cats);
    ["all", "trending"].concat(News.CATEGORIES).concat(["saved"]).forEach(function (c) {
      var label = c === "saved" ? t("newsSaved") : c === "trending" ? t("newsTrending") : UI.pick(News.CATEGORY_NAMES[c]);
      var chip = el("button", "chip" + (c === "trending" ? " chip-hot" : ""), label);
      chip.type = "button";
      chip.dataset.category = c;
      chip.setAttribute("aria-pressed", String(filter.category === c));
      cats.appendChild(chip);
    });

    var select = $("news-source");
    UI.clear(select);
    var all = el("option", null, t("newsAllSources"));
    all.value = "all";
    select.appendChild(all);
    data.sources.filter(function (s) { return filter.lang === "all" || s.lang === filter.lang; }).forEach(function (s) {
      var o = el("option", null, UI.pick(s.name));
      o.value = s.id;
      select.appendChild(o);
    });
    if (!select.querySelector('option[value="' + filter.source + '"]')) filter.source = "all";
    select.value = filter.source;
    $("news-search").placeholder = t("newsSearch");
    $("news-search").setAttribute("aria-label", t("newsSearch"));
  }

  function priorityIds() {
    return data.sources.filter(function (s) { return s.priority; }).map(function (s) { return s.id; });
  }

  function byId() {
    var map = {};
    data.items.forEach(function (it) { map[it.id] = it; });
    return map;
  }

  // Trending stories in the order the news job ranked them.
  function trendingItems() {
    var map = byId();
    return data.trending.map(function (id) { return map[id]; }).filter(Boolean);
  }

  function currentList() {
    var c = filter.category;
    var f = {
      lang: filter.lang,
      source: filter.source,
      category: c === "saved" || c === "trending" ? "all" : c,
      query: filter.query
    };
    if (c === "trending") {
      var ranked = trendingItems();
      var keep = News.filterNews(ranked, f).map(function (it) { return it.id; });
      return ranked.filter(function (it) { return keep.indexOf(it.id) >= 0; });
    }
    if (c !== "saved") f.priority = { ids: priorityIds(), now: Date.now() };
    return News.filterNews(c === "saved" ? savedItems() : data.items, f);
  }

  // The trending strip at the top of the news screen: hot topics to search
  // for, and the trending stories side by side.
  function renderTrending() {
    var box = $("news-trending");
    var stories = trendingItems().filter(function (it) { return filter.lang === "all" || it.lang === filter.lang; });
    var topics = data.topics.filter(function (tp) { return filter.lang === "all" || tp.lang === filter.lang; });
    var show = filter.category === "all" && !filter.query && filter.source === "all" && stories.length > 0;
    box.hidden = !show;
    if (!show) return;
    UI.clear(box);
    box.appendChild(el("h2", "trending-title", t("trendingTitle")));
    if (topics.length) {
      var row = el("div", "chips topic-chips");
      row.setAttribute("aria-label", t("trendingTopics"));
      topics.forEach(function (tp) {
        var chip = el("button", "chip topic", "#" + tp.text);
        chip.type = "button";
        chip.addEventListener("click", function () {
          $("news-search").value = tp.text;
          setFilter({ query: tp.text });
        });
        row.appendChild(chip);
      });
      box.appendChild(row);
    }
    var strip = el("ul", "trending-strip");
    stories.slice(0, TRENDING_SHOWN).forEach(function (item, i) {
      var li = el("li", "trend-card");
      var a = el("a", "trend-link");
      a.href = item.link;
      a.target = "_blank";
      a.rel = "noopener";
      if (item.image) {
        var img = el("img", "trend-image");
        img.src = item.image;
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", function () { img.remove(); });
        a.appendChild(img);
      }
      a.appendChild(el("span", "trend-rank", UI.num(i + 1)));
      a.appendChild(el("span", "trend-headline", item.title));
      a.appendChild(el("span", "news-meta", sourceName(item.source) + (item.published ? " · " + ago(item.published) : "")));
      li.appendChild(a);
      strip.appendChild(li);
    });
    box.appendChild(strip);
  }

  function renderList() {
    var list = currentList();
    var ul = $("news-list");
    UI.clear(ul);
    if (!list.length) {
      var empty = filter.category === "saved" ? t("newsNoneSaved")
        : filter.category === "trending" ? t("newsNoneTrending") : (loading ? t("newsLoading") : t("newsNone"));
      ul.appendChild(el("li", "news-empty muted", empty));
    }
    list.slice(0, shown).forEach(function (item) { ul.appendChild(storyCard(item, false)); });
    var more = $("news-more");
    more.hidden = list.length <= shown;
    more.textContent = t("newsMore");
  }

  function renderHome() {
    var box = $("home-news");
    var ordered = News.filterNews(data.items, { priority: { ids: priorityIds(), now: Date.now() } });
    var mine = ordered.filter(function (it) { return it.lang === UI.state.lang; });
    var list = (mine.length >= HOME_COUNT ? mine : ordered).slice(0, HOME_COUNT);
    box.hidden = !list.length;
    if (!list.length) return;
    $("home-news-title").textContent = t("homeNews");
    $("home-news-all").textContent = t("allNews");
    var ul = $("home-news-list");
    UI.clear(ul);
    list.forEach(function (item) { ul.appendChild(storyCard(item, true)); });
  }

  function renderAll() {
    renderFilters();
    renderMeta();
    renderTrending();
    renderList();
    renderHome();
  }

  function setFilter(change) {
    Object.keys(change).forEach(function (k) { filter[k] = change[k]; });
    shown = PAGE;
    writeJson(FILTER_KEY, { lang: filter.lang });
    renderFilters();
    renderTrending();
    renderList();
  }

  function init() {
    var saved = readJson(FILTER_KEY);
    if (saved && ["all", "ne", "en"].indexOf(saved.lang) >= 0) filter.lang = saved.lang;
    var cached = readJson(CACHE_KEY);
    if (cached && cached.body) {
      try { data = News.parseNews(cached.body); } catch (e) { /* a broken saved copy is ignored */ }
    }

    ["all", "ne", "en"].forEach(function (lang) {
      $("news-lang-" + lang).addEventListener("click", function () { setFilter({ lang: lang }); });
    });
    $("news-cats").addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var c = chip.dataset.category;
      if (c === "saved") UI.account.requireLogin("newsSave", function () { setFilter({ category: c }); });
      else setFilter({ category: c });
    });
    $("news-source").addEventListener("change", function (e) { setFilter({ source: e.target.value }); });
    var typing = null;
    $("news-search").addEventListener("input", function (e) {
      clearTimeout(typing);
      typing = setTimeout(function () { setFilter({ query: e.target.value }); }, 200);
    });
    $("news-more").addEventListener("click", function () {
      shown += PAGE;
      renderList();
    });
    $("news-refresh").addEventListener("click", refresh);
    $("home-news-all").addEventListener("click", function () { UI.navigate("news"); });

    UI.on("lang", renderAll);
    UI.on("user", renderList);
    UI.on("config", renderList);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt > REFRESH_MS) refresh();
    });
    renderAll();
    refresh();
  }

  UI.news = { init: init };
})(this);
