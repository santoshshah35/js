#!/usr/bin/env node
/*
 * Reads every enabled source in content/news-sources.json and writes one
 * news.json for the app. Run on a schedule by .github/workflows/patro-news.yml.
 *
 * A source that fails this time keeps its stories from the previous file
 * (when given), so one site being down doesn't empty its section.
 *
 *   node tools/fetch-news.js <out.json> [previous.json]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const News = require("../lib/news.js");

const SOURCES = path.join(__dirname, "..", "content", "news-sources.json");
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const PER_SOURCE = 30;
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;
const TIMEOUT_MS = 25000;

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow"
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return body;
}

// The first of a source's feed addresses that gives stories.
async function readSource(source) {
  const notes = [];
  for (const url of source.feeds) {
    try {
      const xml = await get(url);
      const items = News.parseFeedXml(xml, source, PER_SOURCE);
      if (items.length) {
        // Shows the raw item when dates or pictures weren't found, so the
        // parser can be taught that feed's format.
        if (items.some((it) => !it.published || !it.image)) {
          const first = /<(item|entry)[\s>][\s\S]*?<\/\1>/i.exec(xml);
          notes.push(`some stories lack a date or picture; first item: ${first ? first[0].replace(/\s+/g, " ").slice(0, 600) : "?"}`);
        }
        return { items, notes: notes.concat(`${url} -> ${items.length} stories`) };
      }
      notes.push(`${url} -> no stories (starts: ${xml.replace(/\s+/g, " ").slice(0, 160)})`);
    } catch (err) {
      notes.push(`${url} -> ${err.message}${err.cause ? " (" + err.cause.message + ")" : ""}`);
    }
  }
  return { items: [], notes };
}

function readPrevious(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return News.parseNews(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.log(`Previous file ignored: ${err.message}`);
    return null;
  }
}

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: fetch-news.js <out.json> [previous.json]");
  const previous = readPrevious(process.argv[3]);
  const { sources } = News.parseSources(fs.readFileSync(SOURCES, "utf8"));
  const enabled = sources.filter((s) => s.enabled);
  const now = Date.now();

  const results = await Promise.all(enabled.map(readSource));
  let items = [];
  const summary = [];
  enabled.forEach((source, i) => {
    const r = results[i];
    let got = r.items;
    const ok = got.length > 0;
    if (!ok && previous) got = previous.items.filter((it) => it.source === source.id);
    console.log(`${ok ? "OK  " : "FAIL"} ${source.id}: ${r.notes.join(" | ")}${!ok && got.length ? ` (kept ${got.length} earlier)` : ""}`);
    summary.push({ id: source.id, name: source.name, lang: source.lang, site: source.site, ok, count: got.length });
    items = items.concat(got);
  });

  // Some feeds (Kathmandu Post, Annapurna Express) give no dates: such a
  // story is dated when this job first saw it, remembered across runs.
  const firstSeen = new Map((previous ? previous.items : []).map((it) => [it.id, it.published]));
  items = items.map((it) => (it.published ? it : { ...it, published: firstSeen.get(it.id) || now }))
    .map((it) => (it.published > now ? { ...it, published: now } : it))
    .filter((it) => now - it.published < MAX_AGE_MS);
  const seen = new Set();
  items = items.filter((it) => !seen.has(it.id) && seen.add(it.id));
  items.sort((a, b) => b.published - a.published);
  items = items.slice(0, News.MAX_ITEMS);

  const doc = { version: 1, updatedAt: new Date(now).toISOString(), sources: summary, items };
  // Checked with the app's own reader before publishing.
  const check = News.parseNews(JSON.stringify(doc));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc));
  const working = summary.filter((s) => s.ok).length;
  console.log(`\n${check.items.length} stories from ${working}/${summary.length} sources written to ${out}`);
  if (!check.items.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
