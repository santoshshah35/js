/*
 * Foreign exchange (Nepal Rastra Bank), gold/silver (FENEGOSIDA) and fuel
 * (Nepal Oil Corporation) prices.
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
  // Tried when the main endpoint fails: the feed NRB's own mobile app uses.
  var NRB_APP_API = "https://www.nrb.org.np/api/forex/v1/app-rate";
  var NRB_PAGE = "https://www.nrb.org.np/forex/";
  var GOLD_URL = "https://www.fenegosida.org/";
  var FUEL_URLS = ["https://noc.org.np/retailprice", "https://noc.org.np/"];
  var FUEL_PAGE = "https://noc.org.np/";

  // ---- Parsing (pure; tested in Node) ----

  var DEVANAGARI_DIGITS = "०१२३४५६७८९";

  function asciiDigits(text) {
    return String(text).replace(/[०-९]/g, function (d) { return String(DEVANAGARI_DIGITS.indexOf(d)); });
  }

  function pageText(html) {
    return asciiDigits(String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " "));
  }

  function toNumber(value) {
    var n = parseFloat(String(value).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }

  /**
   * Latest day of rates from an NRB forex API response.
   * @param {string|object} body JSON text or parsed object
   * @returns {{date:string, published:string, rates:{iso3:string, name:string, unit:number, buy:number, sell:number}[]}|null}
   */
  function toRate(r) {
    if (!r || typeof r !== "object") return null;
    var c = r.currency && typeof r.currency === "object" ? r.currency : r;
    var rate = {
      iso3: c.iso3 || c.ISO3 || c.code,
      name: c.name || c.iso3 || c.code,
      unit: Number(c.unit) || 1,
      buy: toNumber(r.buy !== undefined ? r.buy : r.buying),
      sell: toNumber(r.sell !== undefined ? r.sell : r.selling)
    };
    return rate.iso3 && rate.buy !== null && rate.sell !== null ? rate : null;
  }

  function validRates(list) {
    return (Array.isArray(list) ? list : []).map(toRate).filter(Boolean);
  }

  /**
   * Latest day of rates from an NRB forex API response. Accepts the rates
   * nested by day ({data: {payload: [{date, rates: [...]}]}}) or a flat list
   * of rates, since NRB's endpoints differ.
   * @param {string|object} body JSON text or parsed object
   * @returns {{date:string|null, published:string|null, rates:{iso3:string, name:string, unit:number, buy:number, sell:number}[]}|null}
   */
  function parseForex(body) {
    var json = body;
    if (typeof body === "string") {
      try {
        json = JSON.parse(body);
      } catch (e) {
        throw new Error(/^\s*</.test(body) ? "The bank sent a web page instead of rates" : "The bank's reply was not readable");
      }
    }
    var list = json && json.data && Array.isArray(json.data.payload) ? json.data.payload
      : json && Array.isArray(json.payload) ? json.payload
      : json && Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json : null;
    if (!list || !list.length) return null;

    var days = list.some(function (d) { return d && Array.isArray(d.rates); })
      ? list.filter(function (d) { return d && Array.isArray(d.rates); })
      : [{ date: (json.data && json.data.date) || json.date || null, rates: list }];
    days.sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });
    for (var i = 0; i < days.length; i++) {
      var rates = validRates(days[i].rates);
      if (rates.length) {
        return { date: days[i].date || null, published: days[i].published_on || days[i].date || null, rates: rates };
      }
    }
    return null;
  }

  /**
   * Gold and silver prices per tola from the FENEGOSIDA home page.
   * The site has no API, so this reads the page's visible text. A value that
   * is missing or outside a plausible range is left null.
   * @param {string} html
   * @returns {{fineGold:number|null, tejabiGold:number|null, silver:number|null}|null}
   */
  function parseGold(html) {
    var text = pageText(html);

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

  var FUEL_ITEMS = [
    // key, label pattern, plausible range in rupees
    ["petrol", "Petrol|पेट्रोल", 80, 400],
    ["diesel", "Diesel|डिजेल|डिजल", 80, 400],
    ["kerosene", "Kerosene|मट्टितेल", 80, 400],
    ["lpg", "LPG|L\\.P\\.G|एल\\.?\\s*पी\\.?\\s*जी|ग्यास|ग्याँस", 800, 5000]
  ];

  function inRange(n, min, max) {
    return n !== null && n >= min && n <= max ? n : null;
  }

  // Prices from an HTML table: the header row names the products, and the
  // row for Kathmandu (or else the first row of numbers) holds the prices.
  function fuelFromTable(html) {
    var rows = String(html).match(/<tr[\s\S]*?<\/tr>/gi) || [];
    var header = null;
    var data = null;
    rows.forEach(function (row) {
      var cells = (row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || []).map(pageText).map(function (c) { return c.trim(); });
      if (!header && cells.some(function (c) { return /Petrol|पेट्रोल/i.test(c); })) {
        header = cells;
      } else if (header && cells.length === header.length) {
        var isKathmandu = cells.some(function (c) { return /Kathmandu|काठमाडौ/i.test(c); });
        if (!data || isKathmandu) data = cells;
      }
    });
    if (!header || !data) return null;
    var out = {};
    FUEL_ITEMS.forEach(function (item) {
      var re = new RegExp(item[1], "i");
      var i = header.findIndex(function (h) { return re.test(h); });
      out[item[0]] = i < 0 ? null : inRange(toNumber(data[i]), item[2], item[3]);
    });
    return out;
  }

  // Prices written next to their labels, as in "Petrol: Rs 174 per litre".
  function fuelFromText(html) {
    var text = pageText(html);
    var out = {};
    FUEL_ITEMS.forEach(function (item) {
      var re = new RegExp("(?:" + item[1] + ")[^0-9]{0,60}?([0-9][0-9,]*(?:\\.[0-9]+)?)", "i");
      var m = text.match(re);
      out[item[0]] = m ? inRange(toNumber(m[1]), item[2], item[3]) : null;
    });
    return out;
  }

  /**
   * Retail fuel prices from a Nepal Oil Corporation page.
   * @param {string} html
   * @returns {{petrol:number|null, diesel:number|null, kerosene:number|null, lpg:number|null}|null}
   */
  function parseFuel(html) {
    var table = fuelFromTable(html);
    var result = table && (table.petrol || table.diesel) ? table : fuelFromText(html);
    return result.petrol || result.diesel ? result : null;
  }

  /**
   * Converts with a published NRB rate. Rates are quoted per `unit` of the
   * foreign currency (e.g. per 100 INR). Selling foreign currency to a bank
   * uses its buying rate; buying foreign currency uses its selling rate.
   * @param {{unit:number, buy:number, sell:number}} rate
   * @param {number} amount
   * @param {"toNpr"|"fromNpr"} direction
   * @returns {number|null}
   */
  function convertCurrency(rate, amount, direction) {
    if (!rate || !isFinite(amount) || amount < 0) return null;
    if (direction === "toNpr") return amount * rate.buy / rate.unit;
    return amount * rate.unit / rate.sell;
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
    var urls = [
      NRB_API + "?page=1&per_page=10&from=" + isoDate(dayNumber - 7) + "&to=" + isoDate(dayNumber),
      NRB_APP_API
    ];
    function attempt(i) {
      return httpGet(urls[i]).then(function (body) {
        var data = parseForex(body);
        if (!data) throw new Error("No rates published");
        if (!data.date) data.date = isoDate(dayNumber);
        return data;
      }).catch(function (err) {
        if (i + 1 < urls.length) {
          return attempt(i + 1).catch(function () { throw err; });
        }
        throw err;
      });
    }
    return attempt(0).then(function (data) {
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

  function loadFuel() {
    function attempt(i) {
      return httpGet(FUEL_URLS[i]).then(function (html) {
        var data = parseFuel(html);
        if (!data) throw new Error("Prices not found on the page");
        return data;
      }).catch(function (err) {
        if (i + 1 < FUEL_URLS.length) return attempt(i + 1);
        throw err;
      });
    }
    return attempt(0).then(function (data) {
      saveCache("patro.fuel", data);
      return { data: data, cachedAt: null };
    }).catch(function (err) {
      var cached = readCache("patro.fuel");
      if (cached) return { data: cached.value, cachedAt: cached.at };
      throw err;
    });
  }

  var api = {
    httpGet: httpGet,
    FUEL_PAGE: FUEL_PAGE,
    parseFuel: parseFuel,
    convertCurrency: convertCurrency,
    loadFuel: loadFuel,
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
