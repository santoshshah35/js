"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const Contacts = require("../lib/contacts.js");

test("Nepali mobile numbers are written one way", () => {
  for (const raw of ["9801234567", "+977 980-123-4567", "00977 9801234567", "977-9801234567", "09801234567"]) {
    assert.equal(Contacts.normalizePhone(raw), "+9779801234567", raw);
  }
  assert.equal(Contacts.normalizePhone("01-4412345"), null);
  assert.equal(Contacts.normalizePhone("+1 415 555 0100"), null);
  assert.equal(Contacts.normalizePhone(""), null);
});

test("sha256 matches Node's crypto", () => {
  for (const s of ["", "abc", "patro-contacts-v1:+9779801234567", "नेपाली", "x".repeat(200)]) {
    assert.equal(Contacts.sha256(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"), s.slice(0, 20));
  }
});

test("contact codes are unique and leave out the user's own number", () => {
  const own = Contacts.phoneCode("9801234567");
  const codes = Contacts.contactCodes(["+977 9801234567", "9811111111", "981-111-1111", "01-4412345", "9841000000"], own);
  assert.equal(codes.length, 2);
  assert.ok(codes.every((c) => /^[0-9a-f]{64}$/.test(c)));
  assert.ok(!codes.includes(own));
});
