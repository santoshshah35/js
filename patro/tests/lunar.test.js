"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const BS = require("../lib/bs.js");
const L = require("../lib/lunar.js");

const MONTHS = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

function isoOf(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

test("every Bikram Sambat month starts at its solar sankranti", () => {
  // BS month m begins when the sidereal Sun enters sign m - 1. Checking all
  // 1008 months against the published month lengths also checks the ayanamsa.
  for (let y = BS.FIRST_YEAR; y <= BS.LAST_YEAR; y++) {
    for (let m = 1; m <= 12; m++) {
      const start = BS.bsToDayNumber(y, m, 1) * 86400000;
      const sign = (ms) => Math.floor(L.siderealSun(ms) / 30);
      // In the sign before at 36 hours before the day starts,
      // in the new sign 36 hours after.
      assert.equal(sign(start - 36 * 3600000), (m + 10) % 12, y + "-" + m + " before");
      assert.equal(sign(start + 36 * 3600000), m - 1, y + "-" + m + " after");
    }
  }
});

test("2023 has Adhik Shrawan", () => {
  const names = [];
  for (let k = L.lunationAt(Date.UTC(2023, 4, 1)); k < L.lunationAt(Date.UTC(2023, 9, 1)); k++) {
    const m = L.lunarMonth(k);
    names.push((m.adhik ? "Adhik " : "") + MONTHS[m.month]);
  }
  assert.deepEqual(names, ["Baisakh", "Jestha", "Asar", "Adhik Shrawan", "Shrawan"]);
});

test("festivals land on the dates observed in Nepal in 2024 and 2025", () => {
  const expected = [
    ["2024-03-08", "Maha Shivaratri"], ["2024-03-24", "Fagu Purnima (Holi)"],
    ["2024-05-23", "Buddha Jayanti"], ["2024-09-06", "Haritalika Teej"],
    ["2024-10-12", "Vijaya Dashami"], ["2024-11-03", "Bhai Tika"],
    ["2025-02-26", "Maha Shivaratri"], ["2025-03-13", "Fagu Purnima (Holi)"],
    ["2025-05-12", "Buddha Jayanti"], ["2025-08-09", "Janai Purnima / Raksha Bandhan"],
    ["2025-08-10", "Gai Jatra"], ["2025-08-16", "Krishna Janmashtami"],
    ["2025-08-26", "Haritalika Teej"], ["2025-09-22", "Ghatasthapana"],
    ["2025-09-29", "Fulpati"], ["2025-09-30", "Maha Ashtami"],
    ["2025-10-01", "Maha Navami"], ["2025-10-02", "Vijaya Dashami"],
    ["2025-10-21", "Laxmi Puja"], ["2025-10-23", "Bhai Tika"],
    ["2025-10-27", "Chhath"]
  ];
  for (const [iso, name] of expected) {
    const [y, m, d] = iso.split("-").map(Number);
    const names = L.festivalsOn(BS.dayNumber(y, m, d)).map((f) => f.en);
    assert.ok(names.includes(name), iso + " should include " + name + ", got " + JSON.stringify(names));
  }
});

test("each festival occurs once per year, never in an adhik month", () => {
  const seen = {};
  for (let n = BS.dayNumber(2023, 1, 1); n <= BS.dayNumber(2023, 12, 31); n++) {
    for (const f of L.festivalsOn(n)) {
      assert.ok(!seen[f.en], f.en + " on " + seen[f.en] + " and " + isoOf(n));
      seen[f.en] = isoOf(n);
    }
  }
  // 2023's Adhik Shrawan pushed Janai Purnima to the second Shrawan.
  assert.equal(seen["Janai Purnima / Raksha Bandhan"], "2023-08-31");
});

test("Krishna Paksha takes the next month's name, as in Nepali calendars", () => {
  assert.equal(L.monthName(BS.dayNumber(2025, 10, 21)).en, "Kartik"); // Laxmi Puja
  assert.equal(L.monthName(BS.dayNumber(2025, 8, 16)).en, "Bhadra"); // Janmashtami
  assert.equal(L.monthName(BS.dayNumber(2025, 10, 2)).en, "Asoj"); // Vijaya Dashami
});
