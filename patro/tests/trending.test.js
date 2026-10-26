"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../lib/trending.js");
const News = require("../lib/news.js");

const now = Date.parse("2026-10-26T12:00:00Z");
const story = (id, source, title, hoursAgo = 1, lang = "ne") =>
  ({ id, source, lang, title, summary: "", category: "society", published: now - hoursAgo * 3600000 });

test("a story covered by three or more sites trends, once", () => {
  const items = [
    story("a", "s1", "प्रधानमन्त्रीबाट एनपीएलको उद्घाटन"),
    story("b", "s2", "एनपीएल उद्घाटन खेल सुरु"),
    story("c", "s3", "कीर्तिपुरमा एनपीएल उद्घाटन"),
    story("d", "s1", "एनपीएल उद्घाटन: अर्को समाचार"),
    story("e", "s4", "बजेट पारित"),
    story("f", "s5", "बजेट पारित भयो")
  ];
  const r = T.trending(items, now);
  assert.equal(r.ids.length, 1);
  assert.ok(["a", "b", "c", "d"].includes(r.ids[0]));
  assert.equal(r.topics[0].text, "एनपीएल उद्घाटन");
});

test("old stories and one site repeating itself don't trend", () => {
  const items = [
    story("a", "s1", "Flood in Koshi"), story("b", "s1", "Koshi flood update"), story("c", "s1", "Koshi flood rescue"),
    story("d", "s2", "Koshi flood", 30), story("e", "s3", "Koshi flood", 30), story("f", "s4", "Koshi flood", 30)
  ];
  assert.deepEqual(T.trending(items, now).ids, []);
});

test("Nepali postpositions and stop words are ignored when matching", () => {
  assert.deepEqual(T.words("एनपीएलको उद्घाटन र खेल"), ["एनपीएल", "उद्घाटन", "खेल"]);
  assert.deepEqual(T.words("Nepal's NPL opens in Kirtipur"), ["npl", "opens", "kirtipur"]);
});

test("recent stories from priority sources come first", () => {
  const items = [story("x", "big", "x", 1), story("p", "pri", "p", 5), story("q", "pri", "q", 20)];
  const order = News.filterNews(items, { priority: { ids: ["pri"], now } }).map((i) => i.id);
  assert.deepEqual(order, ["p", "x", "q"]);
  assert.deepEqual(News.filterNews(items, {}).map((i) => i.id), ["x", "p", "q"]);
});

test("the news file keeps trending ids that exist, and topics", () => {
  const doc = News.parseNews({
    version: 1, updatedAt: "2026-10-26T12:00:00Z",
    sources: [{ id: "s", name: { en: "S" }, lang: "en", priority: true }],
    items: [{ id: "a", source: "s", lang: "en", title: "t", link: "https://e.com/a" }],
    trending: ["a", "gone"], topics: [{ text: "npl", lang: "en" }, { text: 5 }]
  });
  assert.deepEqual(doc.trending, ["a"]);
  assert.deepEqual(doc.topics, [{ text: "npl", lang: "en" }]);
  assert.equal(doc.sources[0].priority, true);
});
