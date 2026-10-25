#!/usr/bin/env node
/*
 * Fetches today's exchange, gold and fuel rates from their official sources
 * and writes content/rates.json, which the app reads first. Run on a
 * schedule by .github/workflows/patro-rates.yml, so phones never have to
 * reach the source sites themselves (NRB refuses many networks).
 *
 * A source that fails keeps its last good value in the file; the run logs
 * what each site returned so parsing problems can be fixed.
 *
 *   node tools/fetch-rates.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Rates = require("../lib/rates.js");

const OUT = path.join(__dirname, "..", "content", "rates.json");
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const NRB = "https://www.nrb.org.np/api/forex/v1/rates";
const NRB_APP = "https://www.nrb.org.np/api/forex/v1/app-rate";
const GOLD = ["https://www.fenegosida.org/", "https://fenegosida.org/"];
const FUEL = ["https://noc.org.np/retailprice", "https://noc.org.np/"];
const MARKET = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/npr.json",
  "https://latest.currency-api.pages.dev/v1/currencies/npr.json"
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function preview(text) {
  return String(text).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 700);
}

// Raw HTML (scripts included) so the log shows where a page loads its data from.
function rawStart(body) {
  return String(body).replace(/\s+/g, " ").slice(0, 1500);
}

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json, text/html;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(30000),
    redirect: "follow"
  });
  const body = await res.text();
  console.log(`  ${url} -> HTTP ${res.status}, ${body.length} bytes`);
  if (!res.ok) {
    console.log("  raw page: " + rawStart(body));
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return body;
}

// Tries each url with its parser; returns the first result, logging failures.
async function firstGood(label, urls, parse) {
  console.log(label + ":");
  let lastError = null;
  for (const url of urls) {
    try {
      const body = await get(url);
      const data = parse(body);
      if (data) return data;
      console.log("  parsed nothing. Page text: " + preview(body));
      console.log("  raw page: " + rawStart(body));
      lastError = new Error("Prices not found on " + url);
    } catch (err) {
      console.log("  failed: " + err.message + (err.cause ? " (" + err.cause.message + ")" : ""));
      lastError = err;
    }
  }
  throw lastError;
}

async function main() {
  const now = new Date();
  const nepalToday = new Date(now.getTime() + (5 * 60 + 45) * 60000);
  const from = new Date(nepalToday.getTime() - 7 * 86400000);
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch (e) { /* first run */ }

  const out = { version: 1, updatedAt: now.toISOString(), forex: null, gold: null, fuel: null, errors: {} };
  const stamp = (data) => ({ fetchedAt: now.toISOString(), data });

  try {
    const nrbUrl = `${NRB}?page=1&per_page=10&from=${isoDate(from)}&to=${isoDate(nepalToday)}`;
    const data = await firstGood("NRB forex", [nrbUrl, NRB_APP], Rates.parseForex);
    data.source = "nrb";
    out.forex = stamp(data);
  } catch (err) {
    out.errors.forex = err.message;
    try {
      const data = await firstGood("Market rates (fallback)", MARKET, Rates.parseMarket);
      if (!data.date) data.date = isoDate(nepalToday);
      // Keep a fresh NRB copy over market rates; otherwise use the market rates.
      const prev = previous.forex;
      const prevAgeH = prev ? (now - new Date(prev.fetchedAt)) / 3600000 : Infinity;
      out.forex = prev && prev.data.source === "nrb" && prevAgeH < 48 ? prev : stamp(data);
    } catch (err2) {
      out.forex = previous.forex || null;
    }
  }

  try {
    out.gold = stamp(await firstGood("FENEGOSIDA gold", GOLD, Rates.parseGold));
  } catch (err) {
    out.errors.gold = err.message;
    out.gold = previous.gold || null;
  }

  try {
    out.fuel = stamp(await firstGood("NOC fuel", FUEL, Rates.parseFuel));
  } catch (err) {
    out.errors.fuel = err.message;
    out.fuel = previous.fuel || null;
  }

  // Only rewrite the file (and so commit) when a rate changed, or once a day
  // so the app can tell the copy is still fresh.
  const strip = (doc) => JSON.stringify(["forex", "gold", "fuel"].map((k) => doc[k] && doc[k].data));
  const ageH = previous.updatedAt ? (now - new Date(previous.updatedAt)) / 3600000 : Infinity;
  if (strip(out) === strip(previous) && ageH < 20) {
    console.log("Rates unchanged since " + previous.updatedAt + "; file left as it is.");
    return;
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote " + OUT);
  console.log(JSON.stringify({
    forex: out.forex && { source: out.forex.data.source, date: out.forex.data.date, currencies: out.forex.data.rates.length },
    gold: out.gold && out.gold.data,
    fuel: out.fuel && out.fuel.data,
    errors: out.errors
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
