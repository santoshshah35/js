/*
 * Foreign exchange (Nepal Rastra Bank) and gold/silver (FENEGOSIDA) rates.
 *
 * Inside the Android app, requests go through the app's native HTTP bridge,
 * which is not subject to browser CORS rules. In a plain browser the request
 * uses fetch() and can be refused by the source site or the page's sandbox;
 * the caller then shows a link to the source. The last good result is kept in
 * localStorage so it can still be shown offline, marked with its date.
 */
(function (root) {
  "use strict";

  var NRB_API = "https://www.nrb.org.np/api/forex/v1/rates";
  var NRB_PAGE = "https://www.nrb.org.np/forex/";
  var GOLD_URL = "https://www.fenegosida.org/";

  // ---- Parsing (pure; tested in Node) ----

  function toNumber(value) {
    var n = parseFloat(String(value).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }

  /**
   * Latest day of rates from an NRB forex API response.
   * @param {string|object} body JSON text or parsed object
   * @returns {{date:string, published:string, rates:{iso3:string, name:string, unit:number, buy:number, sell:number}[]}|null}
   */
  function parseForex(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    var payload = json && json.data && json.data.payload;
    if (!payload || !payload.length) return null;
    var latest = payload.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    var rates = (latest.rates || []).map(function (r) {
      var c = r.currency || {};
      return {
        iso3: c.iso3,
        name: c.name,
        unit: Number(c.unit) || 1,
        buy: toNumber(r.buy),
        sell: toNumber(r.sell)
      };
    }).filter(function (r) { return r.iso3 && r.buy !== null && r.sell !== null; });
    if (!rates.length) return null;
    return { date: latest.date, published: latest.published_on || latest.date, rates: rates };
  }

  /**
   * Gold and silver prices per tola from the FENEGOSIDA home page.
   * The site has no API, so this reads the page's visible text. A value that
   * is missing or outside a plausible range is left null.
   * @param {string} html
   * @returns {{fineGold:number|null, tejabiGold:number|null, silver:number|null}|null}
   */
  function parseGold(html) {
    var text = String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");

    function perTola(label, min, max) {
      // An optional purity in brackets may follow the label: "FINE GOLD (9999)".
      var re = new RegExp(label + "(?:\\s*\\(\\s*[0-9.]+\\s*\\))?[^0-9]{0,60}?per\\s*1\\s*tola[^0-9]{0,20}([0-9][0-9,]*(?:\\.[0-9]+)?)", "i");
      var m = text.match(re);
      var n = m ? toNumber(m[1]) : null;
      return n !== null && n >= min && n <= max ? n : null;
    }

    var result = {
      fineGold: perTola("FINE\\s*GOLD", 10000, 2000000),
      tejabiGold: perTola("TEJABI\\s*GOLD", 10000, 2000000),
      silver: perTola("SILVER", 100, 100000)
    };
    return result.fineGold || result.tejabiGold || result.silver ? result : null;
  }

  // ---- Fetching (browser / Android app) ----

  var pending = {};
  var nextId = 1;

  // Called by the Android app when a native request finishes.
  root.__patroNativeDone = function (id, ok, body) {
    var p = pending[id];
    if (!p) return;
    delete pending[id];
    if (ok) p.resolve(body); else p.reject(new Error(body || "Request failed"));
  };

  function httpGet(url) {
    var bridge = root.PatroNative;
    if (bridge && typeof bridge.httpGet === "function") {
      return new Promise(function (resolve, reject) {
        var id = String(nextId++);
        pending[id] = { resolve: resolve, reject: reject };
        bridge.httpGet(id, url);
      });
    }
    if (typeof fetch !== "function") return Promise.reject(new Error("No network access"));
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  function isoDate(dayNumber) {
    return new Date(dayNumber * 86400000).toISOString().slice(0, 10);
  }

  function saveCache(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify({ at: Date.now(), value: value })); } catch (e) { /* not cached */ }
  }

  function readCache(key) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Latest published rates up to a day. NRB does not publish every day, so
   * this asks for the last week and keeps the newest.
   * @param {number} dayNumber Nepal's date as days since 1970-01-01
   * @returns {Promise<{data:object, cachedAt:number|null}>}
   */
  function loadForex(dayNumber) {
    var url = NRB_API + "?page=1&per_page=10&from=" + isoDate(dayNumber - 7) + "&to=" + isoDate(dayNumber);
    return httpGet(url).then(function (body) {
      var data = parseForex(body);
      if (!data) throw new Error("No rates published");
      saveCache("patro.forex", data);
      return { data: data, cachedAt: null };
    }).catch(function (err) {
      var cached = readCache("patro.forex");
      if (cached) return { data: cached.value, cachedAt: cached.at };
      throw err;
    });
  }

  function loadGold() {
    return httpGet(GOLD_URL).then(function (html) {
      var data = parseGold(html);
      if (!data) throw new Error("Prices not found on the page");
      saveCache("patro.gold", data);
      return { data: data, cachedAt: null };
    }).catch(function (err) {
      var cached = readCache("patro.gold");
      if (cached) return { data: cached.value, cachedAt: cached.at };
      throw err;
    });
  }

  var api = {
    NRB_PAGE: NRB_PAGE,
    GOLD_URL: GOLD_URL,
    parseForex: parseForex,
    parseGold: parseGold,
    loadForex: loadForex,
    loadGold: loadGold
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroRates = api;
})(this);
