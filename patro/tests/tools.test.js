"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Tools = require("../lib/tools.js");

test("land area converts between hill, terai and square units", () => {
  const one = Tools.convertLand(1, "ropani");
  assert.deepEqual(one.hill, [1, 0, 0, 0]);
  assert.equal(one.sqft, 5476);
  assert.equal(Math.round(one.sqm * 100) / 100, 508.74);
  assert.deepEqual(Tools.convertLand(1, "bigha").terai, [1, 0, 0]);
  assert.deepEqual(Tools.convertLand(1, "kattha").hill, [0, 10, 2, 2.4]);
  assert.deepEqual(Tools.convertLand(342.25, "sqft").hill, [0, 1, 0, 0]);
  assert.equal(Math.round(Tools.convertLand(1, "bigha").ropani * 100) / 100, 13.31);
  assert.equal(Tools.convertLand(-1, "ropani"), null);
  assert.equal(Tools.convertLand(1, "acre"), null);
});

test("numbers read out in lakh and crore", () => {
  assert.equal(Tools.numberToWords(0, "en"), "zero");
  assert.equal(Tools.numberToWords(99, "ne"), "उनान्सय");
  assert.equal(Tools.numberToWords(45, "en"), "forty-five");
  assert.equal(Tools.numberToWords(105, "ne"), "एक सय पाँच");
  assert.equal(Tools.numberToWords(1234567, "en"), "twelve lakh thirty-four thousand five hundred sixty-seven");
  assert.equal(Tools.numberToWords(25000000, "ne"), "दुई करोड पचास लाख");
  assert.equal(Tools.numberToWords(250000000, "ne"), "पच्चीस करोड");
  assert.equal(Tools.numberToWords(Tools.MAX_WORDS, "en").split(" ")[1], "kharab");
  assert.equal(Tools.numberToWords(Tools.MAX_WORDS + 1, "en"), null);
  assert.equal(Tools.numberToWords(1.5, "en"), null);
});

test("amounts add rupees and paisa", () => {
  assert.equal(Tools.amountToWords("1,05,000.5", "ne"), "एक लाख पाँच हजार रुपैयाँ पचास पैसा");
  assert.equal(Tools.amountToWords("20.05", "en"), "twenty rupees five paisa");
  assert.equal(Tools.amountToWords("12.345", "en"), null);
  assert.equal(Tools.amountToWords("abc", "en"), null);
});
