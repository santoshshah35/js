"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const BS = require("../lib/bs.js");

function iso(d) {
  return d.year + "-" + String(d.month).padStart(2, "0") + "-" + String(d.day).padStart(2, "0");
}

test("1 Baisakh falls on the known Gregorian dates", () => {
  assert.equal(iso(BS.toAD(2000, 1, 1)), "1943-04-14");
  assert.equal(iso(BS.toAD(2080, 1, 1)), "2023-04-14");
  assert.equal(iso(BS.toAD(2081, 1, 1)), "2024-04-13");
  assert.equal(iso(BS.toAD(2082, 1, 1)), "2025-04-14");
});

test("AD to BS inverts BS to AD across the whole supported range", () => {
  const first = BS.bsToDayNumber(BS.FIRST_YEAR, 1, 1);
  const last = BS.bsToDayNumber(BS.LAST_YEAR, 12, BS.daysInMonth(BS.LAST_YEAR, 12));
  for (let n = first; n <= last; n++) {
    const bs = BS.dayNumberToBs(n);
    const ad = BS.fromDayNumber(n);
    assert.deepEqual(BS.toBS(ad.year, ad.month, ad.day), bs);
    assert.equal(BS.bsToDayNumber(bs.year, bs.month, bs.day), n);
  }
});

test("every month has 29 to 32 days", () => {
  for (let y = BS.FIRST_YEAR; y <= BS.LAST_YEAR; y++) {
    for (let m = 1; m <= 12; m++) {
      const len = BS.daysInMonth(y, m);
      assert.ok(len >= 29 && len <= 32, y + "-" + m + " has " + len + " days");
    }
  }
});

test("weekday is 0 for Sunday", () => {
  assert.equal(BS.weekday(BS.dayNumber(2024, 4, 14)), 0); // Sunday
  assert.equal(BS.weekday(BS.dayNumber(2026, 10, 24)), 6); // Saturday
});

test("out-of-range and invalid dates are rejected", () => {
  assert.throws(() => BS.toAD(1999, 12, 30), RangeError);
  assert.throws(() => BS.toAD(BS.LAST_YEAR + 1, 1, 1), RangeError);
  assert.throws(() => BS.toAD(2081, 13, 1), RangeError);
  assert.throws(() => BS.toAD(2081, 1, 33), RangeError);
  assert.throws(() => BS.toBS(2025, 2, 30), RangeError);
  assert.throws(() => BS.toBS(1943, 4, 13), RangeError);
});

test("Nepal's date follows UTC+05:45, not the viewer's time zone", () => {
  // 18:14 UTC is 23:59 in Kathmandu; 18:15 UTC is the next day there.
  assert.equal(BS.nepalToday(new Date("2026-10-24T18:14:00Z")), BS.dayNumber(2026, 10, 24));
  assert.equal(BS.nepalToday(new Date("2026-10-24T18:15:00Z")), BS.dayNumber(2026, 10, 25));
});

test("Devanagari digits", () => {
  assert.equal(BS.toNepaliDigits(2083), "२०८३");
  assert.equal(BS.toNepaliDigits("07:45"), "०७:४५");
});
