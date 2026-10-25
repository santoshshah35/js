"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const BS = require("../lib/bs.js");
const L = require("../lib/lunar.js");
const R = require("../lib/rashifal.js");
const Rates = require("../lib/rates.js");

test("the Moon is opposite the Sun at full moon", () => {
  for (const iso of ["2024-04-23T23:49:00Z", "2025-03-14T06:55:00Z"]) {
    const ms = Date.parse(iso);
    const sun = Math.floor(L.siderealSun(ms) / 30);
    const moon = Math.floor(R.siderealMoon(ms) / 30);
    assert.equal(moon, (sun + 6) % 12, iso);
  }
});

test("the Moon changes sign about every 2.3 days", () => {
  let changes = 0;
  const start = BS.dayNumber(2025, 1, 1);
  for (let n = start; n < start + 365; n++) {
    const m = R.moonOn(n);
    if (m.changesAt) {
      changes++;
      assert.equal(m.next, (m.sign + 1) % 12);
      assert.ok(m.changesAt > n * 86400000 - 6 * 3600000);
    }
  }
  assert.ok(changes >= 158 && changes <= 162, String(changes));
});

test("each rashi gets the house the Moon is in, counted from it", () => {
  const day = R.rashifalOn(BS.dayNumber(2025, 10, 2));
  assert.equal(day.readings.length, 12);
  // The rashi the Moon is in has it in house 1; the one after has house 12.
  assert.equal(day.readings[day.moon.sign].house, 1);
  assert.equal(day.readings[(day.moon.sign + 1) % 12].house, 12);
  // Chandrashtama is the eighth house.
  const eighth = day.readings[(day.moon.sign + 5) % 12];
  assert.equal(eighth.house, 8);
  assert.equal(eighth.tone, "bad");
});

test("NRB forex responses are read from the newest published day", () => {
  const body = JSON.stringify({
    status: { code: 200 },
    data: {
      payload: [
        { date: "2026-10-23", published_on: "2026-10-23 00:00:05", rates: [
          { currency: { iso3: "USD", name: "U.S. Dollar", unit: 1 }, buy: "140.00", sell: "140.60" }
        ] },
        { date: "2026-10-25", published_on: "2026-10-25 00:00:09", rates: [
          { currency: { iso3: "INR", name: "Indian Rupee", unit: 100 }, buy: "160.00", sell: "160.15" },
          { currency: { iso3: "USD", name: "U.S. Dollar", unit: 1 }, buy: "141.10", sell: "141.70" },
          { currency: { iso3: "JPY", name: "Japanese Yen", unit: 10 }, buy: "9.38", sell: "9.42" }
        ] }
      ]
    }
  });
  const fx = Rates.parseForex(body);
  assert.equal(fx.date, "2026-10-25");
  assert.deepEqual(fx.rates.map((r) => r.iso3), ["INR", "USD", "JPY"]);
  assert.equal(fx.rates[0].unit, 100);
  assert.equal(fx.rates[1].sell, 141.7);
});

test("an empty forex response gives null", () => {
  assert.equal(Rates.parseForex({ data: { payload: [] } }), null);
});

test("gold and silver prices per tola are read from page text", () => {
  const html = `
    <div class="rate-gold"><p>FINE GOLD (9999)</p><span>per 1 tola</span> <b>रु 1,75,300</b></div>
    <div class="rate-gold"><p>FINE GOLD (9999)</p><span>per 10 grm</span> <b>रु 1,50,290</b></div>
    <div class="rate-gold"><p>TEJABI GOLD</p><span>per 1 tola</span> <b>रु 1,74,600</b></div>
    <div class="rate-silver"><p>SILVER</p><span>per 1 tola</span> <b>रु 2,135</b></div>`;
  assert.deepEqual(Rates.parseGold(html), { fineGold: 175300, tejabiGold: 174600, silver: 2135 });
});

test("a page without recognisable prices gives null", () => {
  assert.equal(Rates.parseGold("<html><body>Site under maintenance</body></html>"), null);
  // Implausible numbers are rejected rather than shown.
  assert.equal(Rates.parseGold("FINE GOLD per 1 tola 12"), null);
});

test("a flat list of rates is accepted too", () => {
  const fx = Rates.parseForex({ data: [
    { iso3: "USD", name: "U.S. Dollar", unit: 1, buy: 141.1, sell: 141.7 },
    { currency: { iso3: "INR", name: "Indian Rupee", unit: 100 }, buying: "160", selling: "160.15" },
    { iso3: "BAD" }
  ], date: "2026-10-25" });
  assert.deepEqual(fx.rates.map((r) => r.iso3), ["USD", "INR"]);
  assert.equal(fx.rates[1].sell, 160.15);
});

test("a web page instead of JSON gives a readable reason", () => {
  assert.throws(() => Rates.parseForex("<!doctype html><title>Just a moment</title>"), /web page/);
});

test("weekly rashifal counts each of the seven days once per rashi", () => {
  const sunday = BS.dayNumber(2026, 10, 25);
  const week = R.weeklyFor(sunday);
  assert.equal(week.readings.length, 12);
  for (const r of week.readings) {
    assert.equal(r.good.length + r.mixed.length + r.bad.length, 7);
    assert.ok(r.chandrashtama.every((d) => r.bad.includes(d)));
    assert.ok(["good", "mixed", "bad"].includes(r.tone));
  }
  // Across the twelve rashis the Moon's eighth house falls somewhere every day.
  const all = week.readings.flatMap((r) => r.chandrashtama).sort((a, b) => a - b);
  for (let d = sunday; d <= sunday + 6; d++) assert.ok(all.includes(d));
});

test("monthly rashifal follows the Sun's sign for the BS month", () => {
  const first = BS.bsToDayNumber(2083, 7, 1); // Kartik: Sun in Tula (sign 6)
  const last = first + BS.daysInMonth(2083, 7) - 1;
  const month = R.monthlyFor(first, last, 7);
  assert.equal(month.sunSign, 6);
  assert.equal(month.readings[6].sunHouse, 1); // Tula itself
  assert.equal(month.readings[3].sunHouse, 4); // Karkat
  assert.equal(month.readings[3 + 1].sunHouse, 3); // Singha: favourable
  assert.equal(month.readings[4].tone, "good");
  for (const r of month.readings) {
    assert.equal(r.good.length + r.mixed.length + r.bad.length, last - first + 1);
  }
});
