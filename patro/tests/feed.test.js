"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Feed = require("../lib/feed.js");

const day = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
const base = { id: "a", slot: "top", kind: "ad", title: { ne: "शीर्षक" } };

test("the published feed file is valid", () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "content", "feed.json"), "utf8");
  const feed = Feed.parseFeed(text);
  assert.equal(feed.skipped, 0);
  assert.ok(feed.items.length >= 1);
});

test("a title in one language is used for both", () => {
  const [item] = Feed.parseFeed({ items: [base] }).items;
  assert.deepEqual(item.title, { ne: "शीर्षक", en: "शीर्षक" });
});

test("entries with missing or unknown required fields are skipped", () => {
  const feed = Feed.parseFeed({ items: [
    { ...base, id: "" },
    { ...base, id: "b", slot: "sidebar" },
    { ...base, id: "c", kind: "popup" },
    { ...base, id: "d", title: {} },
    { ...base, id: "e", start: "25-10-2026" },
    { ...base, id: "f", end: "2026-02-30" },
    "not an object",
    { ...base, id: "ok" }
  ] });
  assert.deepEqual(feed.items.map((i) => i.id), ["ok"]);
  assert.equal(feed.skipped, 7);
});

test("only https links and images are kept", () => {
  const [item] = Feed.parseFeed({ items: [{
    ...base,
    link: "javascript:alert(1)",
    image: "http://example.com/a.png"
  }] }).items;
  assert.equal(item.link, null);
  assert.equal(item.image, null);
  const [ok] = Feed.parseFeed({ items: [{ ...base, link: "https://example.com/x", image: "https://example.com/a.png" }] }).items;
  assert.equal(ok.link, "https://example.com/x");
});

test("duplicate ids keep the first entry, and at most 20 are read", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ ...base, id: "x" + i }));
  assert.equal(Feed.parseFeed({ items: many }).items.length, 20);
  const dup = Feed.parseFeed({ items: [{ ...base, title: { en: "first" } }, { ...base, title: { en: "second" } }] });
  assert.equal(dup.items.length, 1);
  assert.equal(dup.items[0].title.en, "first");
});

test("active items respect slot, inclusive dates and dismissals", () => {
  const items = Feed.parseFeed({ items: [
    { ...base, id: "now", start: "2026-11-01", end: "2026-11-12" },
    { ...base, id: "later", start: "2026-12-01" },
    { ...base, id: "other-slot", slot: "fuel" },
    { ...base, id: "always" }
  ] }).items;
  const ids = (d, dismissed) => Feed.activeItems(items, "top", day(d), dismissed).map((i) => i.id);
  assert.deepEqual(ids("2026-11-01"), ["now", "always"]);
  assert.deepEqual(ids("2026-11-12"), ["now", "always"]);
  assert.deepEqual(ids("2026-11-13"), ["always"]);
  assert.deepEqual(ids("2026-12-01"), ["later", "always"]);
  assert.deepEqual(ids("2026-11-05", ["now"]), ["always"]);
});

test("a feed without an items list is rejected", () => {
  assert.throws(() => Feed.parseFeed({}));
  assert.throws(() => Feed.parseFeed("not json"));
});
