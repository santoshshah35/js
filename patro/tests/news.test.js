"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const News = require("../lib/news.js");

const source = { id: "demo", lang: "ne" };

const RSS = `<?xml version="1.0"?><rss><channel><title>Demo</title>
<item>
  <title><![CDATA[बजेट &amp; कर]]></title>
  <link>http://example.com/2026/10/budget</link>
  <pubDate>Mon, 26 Oct 2026 04:00:00 +0000</pubDate>
  <category><![CDATA[अर्थ]]></category>
  <description><![CDATA[<p><img src="https://example.com/a.jpg"> सरकारले &#2348;जेट ल्यायो।</p>]]></description>
</item>
<item>
  <title>Older match</title>
  <link>https://example.com/sports/cricket-win</link>
  <pubDate>Sun, 25 Oct 2026 04:00:00 +0000</pubDate>
  <media:content url="https://example.com/b.png" medium="image"/>
</item>
<item><title>No link</title></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

const ATOM = `<feed><entry><title>Atom story</title><link rel="alternate" href="https://example.com/world/x"/>
<updated>2026-10-26T01:00:00Z</updated><summary>Short</summary></entry></feed>`;

test("RSS items become stories with plain text, https links, images, dates and categories", () => {
  const items = News.parseFeedXml(RSS, source);
  assert.equal(items.length, 2);
  const [first, second] = items;
  assert.equal(first.title, "बजेट & कर");
  assert.equal(first.link, "https://example.com/2026/10/budget");
  assert.equal(first.image, "https://example.com/a.jpg");
  assert.equal(first.summary, "सरकारले बजेट ल्यायो।");
  assert.equal(first.published, Date.parse("2026-10-26T04:00:00Z"));
  assert.equal(first.category, "economy");
  assert.equal(first.lang, "ne");
  assert.equal(second.image, "https://example.com/b.png");
  assert.equal(second.category, "sports");
});

test("Atom entries are read too, and a per-feed limit keeps the newest", () => {
  const [item] = News.parseFeedXml(ATOM, { id: "a", lang: "en" });
  assert.equal(item.link, "https://example.com/world/x");
  assert.equal(item.category, "world");
  assert.equal(News.parseFeedXml(RSS, source, 1)[0].title, "बजेट & कर");
});

test("categories need whole English words", () => {
  assert.equal(News.categorize([], "https://x.com/party-news"), "society");
  assert.equal(News.categorize(["Art & Culture"], "https://x.com/1"), "entertainment");
  assert.equal(News.categorize(["राजनीतिक"], "https://x.com/1"), "politics");
});

test("the sources list in the repository is valid", () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "content", "news-sources.json"), "utf8");
  const { sources, skipped } = News.parseSources(text);
  assert.equal(skipped, 0);
  assert.ok(sources.some((s) => s.lang === "ne"));
  assert.ok(sources.some((s) => s.lang === "en"));
});

test("a news file is checked item by item", () => {
  const doc = {
    version: 1,
    updatedAt: "2026-10-26T05:00:00Z",
    sources: [{ id: "demo", name: { ne: "डेमो" }, lang: "ne" }],
    items: [
      { id: "1", source: "demo", lang: "ne", title: "ok", link: "https://e.com/1", published: 5, category: "sports" },
      { id: "2", source: "other", lang: "ne", title: "unknown source", link: "https://e.com/2" },
      { id: "3", source: "demo", lang: "ne", title: "bad", link: "ftp://e.com/3" },
      { id: "1", source: "demo", lang: "ne", title: "duplicate", link: "https://e.com/1b" }
    ]
  };
  const parsed = News.parseNews(doc);
  assert.deepEqual(parsed.items.map((i) => i.title), ["ok"]);
  assert.deepEqual(parsed.sources[0].name, { ne: "डेमो", en: "डेमो" });
  assert.throws(() => News.parseNews({ version: 2, items: [], sources: [] }));
});

test("filters combine language, source, category, search and saved ids", () => {
  const items = [
    { id: "a", source: "s1", lang: "ne", category: "sports", title: "क्रिकेट", summary: "", published: 1 },
    { id: "b", source: "s2", lang: "en", category: "sports", title: "Cricket final", summary: "", published: 3 },
    { id: "c", source: "s2", lang: "en", category: "world", title: "Summit", summary: "cricket diplomacy", published: 2 }
  ];
  assert.deepEqual(News.filterNews(items, { lang: "en" }).map((i) => i.id), ["b", "c"]);
  assert.deepEqual(News.filterNews(items, { category: "sports" }).map((i) => i.id), ["b", "a"]);
  assert.deepEqual(News.filterNews(items, { query: "CRICKET" }).map((i) => i.id), ["b", "c"]);
  assert.deepEqual(News.filterNews(items, { source: "s1" }).map((i) => i.id), ["a"]);
  assert.deepEqual(News.filterNews(items, { only: ["c"] }).map((i) => i.id), ["c"]);
});

test("time ago uses the largest whole unit", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  assert.deepEqual(News.timeAgo(now - 20000, now), { unit: "now", n: 0 });
  assert.deepEqual(News.timeAgo(now - 5 * 60000, now), { unit: "min", n: 5 });
  assert.deepEqual(News.timeAgo(now - 3 * 3600000, now), { unit: "hour", n: 3 });
  assert.deepEqual(News.timeAgo(now - 50 * 3600000, now), { unit: "day", n: 2 });
});
