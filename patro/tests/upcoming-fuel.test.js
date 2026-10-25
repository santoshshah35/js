"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const BS = require("../lib/bs.js");
const Up = require("../lib/upcoming.js");
const Rates = require("../lib/rates.js");

test("eventsOn combines lunar festivals and fixed-date days", () => {
  const names = (y, m, d) => Up.eventsOn(BS.dayNumber(y, m, d)).map((e) => e.en);
  assert.ok(names(2025, 10, 21).includes("Laxmi Puja"));
  // 1 Baisakh 2082 = 14 April 2025: Nepali New Year.
  assert.ok(names(2025, 4, 14).includes("Nepali New Year"));
  assert.ok(names(2025, 12, 25).includes("Christmas"));
});

test("upcoming lists event days in order from the start day", () => {
  const start = BS.dayNumber(2025, 10, 15);
  const list = Up.upcoming(start, 60, 5);
  assert.equal(list.length, 5);
  for (let i = 1; i < list.length; i++) assert.ok(list[i].day > list[i - 1].day);
  assert.ok(list[0].day >= start);
  const all = list.flatMap((d) => d.events.map((e) => e.en));
  assert.ok(all.includes("Laxmi Puja") && all.includes("Bhai Tika"), all.join(", "));
});

test("upcoming stops at the end of the calendar", () => {
  const last = BS.bsToDayNumber(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12));
  const list = Up.upcoming(last - 10, 400);
  assert.ok(list.every((d) => d.day <= last));
});

test("fuel prices are read from a price table, preferring Kathmandu", () => {
  const html = `<table>
    <tr><th>Depot</th><th>Petrol (Rs/L)</th><th>Diesel (Rs/L)</th><th>Kerosene (Rs/L)</th><th>LPG (Rs/Cyl)</th></tr>
    <tr><td>Surajpura</td><td>172.50</td><td>155.50</td><td>155.50</td><td>1,860</td></tr>
    <tr><td>Kathmandu, Pokhara, Dipayal</td><td>174.00</td><td>157.00</td><td>157.00</td><td>1,910</td></tr>
  </table>`;
  assert.deepEqual(Rates.parseFuel(html), { petrol: 174, diesel: 157, kerosene: 157, lpg: 1910 });
});

test("fuel prices are read from Nepali text with Devanagari digits", () => {
  const html = "<p>पेट्रोल: रु १७४ प्रति लिटर</p><p>डिजेल: रु १५७</p><p>एलपी ग्याँस: रु १,९१०</p>";
  const fuel = Rates.parseFuel(html);
  assert.equal(fuel.petrol, 174);
  assert.equal(fuel.diesel, 157);
  assert.equal(fuel.lpg, 1910);
});

test("pages without plausible fuel prices give null", () => {
  assert.equal(Rates.parseFuel("<p>Nepal Oil Corporation Limited</p>"), null);
  assert.equal(Rates.parseFuel("<p>Petrol 5 Diesel 7</p>"), null);
});

test("currency conversion uses the buying rate in and the selling rate out", () => {
  const inr = { unit: 100, buy: 160, sell: 160.15 };
  assert.equal(Rates.convertCurrency(inr, 1000, "toNpr"), 1600);
  const usd = { unit: 1, buy: 141.1, sell: 141.7 };
  assert.ok(Math.abs(Rates.convertCurrency(usd, 14170, "fromNpr") - 100) < 1e-9);
  assert.equal(Rates.convertCurrency(usd, -5, "toNpr"), null);
  assert.equal(Rates.convertCurrency(null, 5, "toNpr"), null);
});
