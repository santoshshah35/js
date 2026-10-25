"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const BS = require("../lib/bs.js");
const Surya = require("../lib/surya.js");

test("Surya Siddhanta month starts match the published calendar", () => {
  const misses = [];
  for (let y = BS.FIRST_YEAR; y < BS.PROJECTED_FROM; y++) {
    for (let m = 1; m <= 12; m++) {
      const day = BS.bsToDayNumber(y, m, 1);
      if (Surya.monthStart(m, day) !== day) misses.push(y + "-" + m);
    }
  }
  // 1002 of 1008 at the time of fitting; every miss had its sankranti
  // within about 25 minutes of the day boundary.
  assert.ok(misses.length <= 6, misses.join(" "));
});

test("computed years agree with nepali-date-converter where it publishes them", () => {
  // nepali-date-converter@3.4.0 lists 2084-2086; the model was not fitted to these.
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => BS.daysInMonth(2084, m)),
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => BS.daysInMonth(2085, m)),
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => BS.daysInMonth(2086, m)),
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]);
});

test("the calendar runs to the end of 2100 BS with plausible years", () => {
  assert.equal(BS.LAST_YEAR, 2100);
  assert.equal(BS.PROJECTED_FROM, 2084);
  for (let y = BS.PROJECTED_FROM; y <= BS.LAST_YEAR; y++) {
    let total = 0;
    for (let m = 1; m <= 12; m++) total += BS.daysInMonth(y, m);
    assert.ok(total === 365 || total === 366, y + " has " + total + " days");
  }
  const end = BS.toAD(2100, 12, BS.daysInMonth(2100, 12));
  assert.deepEqual(end, { year: 2044, month: 4, day: 13 });
});
