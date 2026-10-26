/*
 * Admin notices and ads (lib/feed.js) shown in the page's feed slots.
 * The last good feed is kept so banners show offline. Readers can't close
 * or hide a banner: it stays until the admin changes or ends it.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Feed = root.PatroFeed;
  var Rates = root.PatroRates;
  var t = UI.t;
  var el = UI.el;

  var CACHE_KEY = "patro.feed";
  // Banners closed in versions before 1.8; cleared so they show again.
  var OLD_DISMISSED_KEY = "patro.feed.dismissed";
  var REFRESH_MS = 30 * 60 * 1000;
  var WIDE_RATIO = 2;

  var items = [];
  var lastAttempt = 0;

  UI.addText({
    ne: { feedAd: "विज्ञापन", feedNotice: "सूचना", feedMore: "थप जान्नुहोस्" },
    en: { feedAd: "Sponsored", feedNotice: "Notice", feedMore: "Learn more" }
  });

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

  function card(item) {
    var box = el("article", "feed-card feed-" + item.kind + (item.image ? "" : " no-image"));
    if (item.image) {
      var img = el("img", "feed-image");
      img.src = item.image;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () {
        img.hidden = true;
        box.classList.add("no-image");
      });
      // Wide banners (like 2160x300) run full width above the text instead of
      // being cropped into the small square on the left.
      img.addEventListener("load", function () {
        if (img.naturalHeight && img.naturalWidth / img.naturalHeight >= WIDE_RATIO) box.classList.add("feed-wide");
      });
      box.appendChild(img);
    }
    var body = el("div", "feed-body");
    body.appendChild(el("span", "feed-label", t(item.kind === "ad" ? "feedAd" : "feedNotice")));
    body.appendChild(el("h3", "feed-title", UI.pick(item.title)));
    if (item.body) body.appendChild(el("p", "feed-text", UI.pick(item.body)));
    if (item.link) {
      var a = UI.link(item.link, item.cta ? UI.pick(item.cta) : t("feedMore"));
      a.className = "feed-link";
      a.rel = item.kind === "ad" ? "noopener sponsored" : "noopener";
      body.appendChild(a);
    }
    box.appendChild(body);
    return box;
  }

  function render() {
    var today = BS.nepalToday();
    Array.prototype.forEach.call(document.querySelectorAll("[data-feed-slot]"), function (slot) {
      UI.clear(slot);
      var shown = Feed.activeItems(items, slot.getAttribute("data-feed-slot"), today);
      shown.forEach(function (item) { slot.appendChild(card(item)); });
      slot.hidden = !shown.length;
    });
  }

  function useFeed(body) {
    items = Feed.parseFeed(body).items;
    render();
  }

  function fetchFeed(i) {
    return Rates.httpGet(Feed.FEED_URLS[i]).then(function (body) {
      useFeed(body);
      writeJson(CACHE_KEY, { at: Date.now(), body: body });
    }).catch(function () {
      if (i + 1 < Feed.FEED_URLS.length) return fetchFeed(i + 1);
      // Offline or no valid feed: keep showing the saved copy.
      return null;
    });
  }

  function refresh() {
    lastAttempt = Date.now();
    fetchFeed(0);
  }

  function init() {
    try { root.localStorage.removeItem(OLD_DISMISSED_KEY); } catch (e) { /* nothing stored */ }
    var cached = readJson(CACHE_KEY);
    if (cached && cached.body) {
      try { useFeed(cached.body); } catch (e) { /* a broken saved copy is ignored */ }
    } else {
      render();
    }
    refresh();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && Date.now() - lastAttempt > REFRESH_MS) refresh();
    });
    UI.on("lang", render);
    UI.on("tick", render);
  }

  UI.feed = { init: init };
})(this);
