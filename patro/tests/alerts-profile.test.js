"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Alerts = require("../lib/alerts.js");
const Profile = require("../lib/profile.js");

test("the published alerts file is valid", () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "content", "alerts.json"), "utf8");
  assert.equal(Alerts.parseAlerts(text).skipped, 0);
});

test("alerts are checked, sorted newest first, and only fresh ones are shown", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const { alerts, skipped } = Alerts.parseAlerts({ alerts: [
    { id: "old", title: { en: "Old" }, sentAt: "2026-10-24T12:00:00Z" },
    { id: "new", title: { ne: "ब्रेकिङ" }, sentAt: "2026-10-26T11:00:00Z", link: "https://e.com/x", level: "important" },
    { id: "bad-link", title: { en: "x" }, sentAt: "2026-10-26T11:00:00Z", link: "javascript:alert(1)" },
    { id: "no-date", title: { en: "x" } },
    { id: "new", title: { en: "duplicate" }, sentAt: "2026-10-26T11:30:00Z" }
  ] });
  assert.deepEqual(alerts.map((a) => a.id), ["new", "old"]);
  assert.equal(skipped, 3);
  assert.equal(alerts[0].level, "important");
  assert.equal(alerts[1].level, "breaking");
  assert.deepEqual(Alerts.freshAlerts(alerts, now).map((a) => a.id), ["new"]);
});

test("profile fields are cleaned and checked", () => {
  const today = "2026-10-26";
  const ok = Profile.check({ name: " Sita ", mobile: "+977-984 1234567", email: "Sita@Example.com", dob: "1995-04-14",
    gender: "female", address: "Kathmandu", photo: "data:image/jpeg;base64,AAAA" }, today);
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.profile, { name: "Sita", mobile: "9841234567", email: "sita@example.com", dob: "1995-04-14",
    gender: "female", address: "Kathmandu", photo: "data:image/jpeg;base64,AAAA" });
  const bad = Profile.check({ mobile: "12345", email: "nope", dob: "2030-01-01", gender: "x", photo: "data:text/html;base64,AA" }, today);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["dob", "email", "gender", "mobile", "photo"]);
  assert.deepEqual(Profile.check({}, today), { profile: {}, errors: {} });
  assert.equal(Profile.normalMobile("+14155550123"), "+14155550123");
  assert.equal(Profile.check({ dob: "1995-02-30" }, today).errors.dob, "badDob");
});
