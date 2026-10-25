"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../lib/tithi.js");
const BS = require("../lib/bs.js");

function close(actual, expected, tolerance, label) {
  let diff = Math.abs(actual - expected) % 360;
  if (diff > 180) diff = 360 - diff;
  assert.ok(diff <= tolerance, label + ": " + actual + " vs " + expected);
}

test("Sun longitude matches Meeus example 25.a", () => {
  // 1992 October 13.0 TD
  close(T.sunLongitude(2448908.5), 199.90895, 0.0005, "sun");
});

test("Moon longitude matches Meeus example 47.a", () => {
  // 1992 April 12.0 TD: lambda 133.162655 plus nutation 0.004610 gives the apparent value
  close(T.moonLongitude(2448724.5), 133.167265, 0.001, "moon");
});

test("elongation is ~0 at new moons and ~180 at full moons", () => {
  // Times of eclipses, so the syzygy times are well established.
  close(T.elongation(Date.parse("2024-04-08T18:21:00Z")), 0, 0.05, "new moon 2024-04-08");
  close(T.elongation(Date.parse("2024-04-23T23:49:00Z")), 180, 0.05, "full moon 2024-04-23");
  close(T.elongation(Date.parse("2025-03-14T06:55:00Z")), 180, 0.05, "full moon 2025-03-14");
  close(T.elongation(Date.parse("2025-03-29T10:58:00Z")), 0, 0.05, "new moon 2025-03-29");
});

test("Kathmandu sunrise at the June solstice is about 05:08 NPT", () => {
  const rise = T.sunrise(BS.dayNumber(2024, 6, 21));
  const npt = new Date(rise + (5 * 60 + 45) * 60000);
  const minutes = npt.getUTCHours() * 60 + npt.getUTCMinutes();
  assert.ok(Math.abs(minutes - (5 * 60 + 8)) <= 3, "sunrise at " + npt.toISOString());
});

test("tithi on well-known festival days", () => {
  // Vijaya Dashami 2025 (Ashwin Shukla Dashami)
  const dashain = T.tithiOn(BS.dayNumber(2025, 10, 2));
  assert.equal(dashain.number, 10);
  assert.equal(dashain.name.en, "Dashami");
  // Laxmi Puja 2025 (Kartik Aunsi)
  const laxmiPuja = T.tithiOn(BS.dayNumber(2025, 10, 21));
  assert.equal(laxmiPuja.number, 30);
  assert.equal(laxmiPuja.name.en, "Aunsi");
});

test("tithi moves forward by about one per day", () => {
  let prev = T.tithiOn(BS.dayNumber(2025, 1, 1)).number;
  for (let i = 1; i < 400; i++) {
    const cur = T.tithiOn(BS.dayNumber(2025, 1, 1) + i).number;
    const step = (cur - prev + 30) % 30;
    // A tithi can be skipped (step 2) or repeated (step 0), never more.
    assert.ok(step <= 2, "day " + i + ": " + prev + " -> " + cur);
    prev = cur;
  }
});
