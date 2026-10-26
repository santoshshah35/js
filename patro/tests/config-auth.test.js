"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Config = require("../lib/config.js");
const Custom = require("../lib/custom-events.js");
const Auth = require("../lib/auth.js");
const Upcoming = require("../lib/upcoming.js");
const BS = require("../lib/bs.js");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "content", f), "utf8");

test("the published config and events files are valid", () => {
  const config = Config.parseConfig(read("config.json"));
  assert.ok(Array.isArray(config.membersOnly));
  assert.equal(Custom.parseEvents(read("events.json")).skipped, 0);
});

test("config keeps only well-formed login keys and known features", () => {
  const c = Config.parseConfig({
    login: { googleClientId: "123456789-abc123.apps.googleusercontent.com", facebookAppId: "12x", webAddress: "https://me.github.io/js" },
    membersOnly: ["notes", "teleport"]
  });
  assert.equal(c.login.googleClientId, "123456789-abc123.apps.googleusercontent.com");
  assert.equal(c.login.facebookAppId, null);
  assert.equal(c.login.webAddress, "https://me.github.io/js/");
  assert.deepEqual(c.membersOnly, ["notes"]);
  assert.deepEqual(Config.parseConfig({}).membersOnly, Config.DEFAULTS.membersOnly);
  assert.equal(Config.isLocked("notes", c, null), true);
  assert.equal(Config.isLocked("notes", c, { id: "x" }), false);
  assert.equal(Config.isLocked("newsSave", c, null), false);
});

test("admin events are checked, and yearly ones repeat", () => {
  const { events, skipped } = Custom.parseEvents({ events: [
    { id: "a", kind: "holiday", date: "2083-07-15", title: { ne: "बिदा" } },
    { id: "b", kind: "sait", date: "2000-01-05", yearly: true, title: { en: "Wedding sait" } },
    { id: "c", kind: "party", date: "2083-07-15", title: { en: "x" } },
    { id: "d", kind: "event", date: "2083-13-01", title: { en: "x" } },
    { id: "e", kind: "event", date: "2083-07-40", title: { en: "x" } }
  ] });
  assert.equal(skipped, 3);
  assert.deepEqual(Custom.eventsOn(events, { year: 2083, month: 7, day: 15 }), [{ ne: "बिदा", en: "बिदा", kind: "holiday" }]);
  assert.equal(Custom.eventsOn(events, { year: 2084, month: 7, day: 15 }).length, 0);
  assert.equal(Custom.eventsOn(events, { year: 2090, month: 1, day: 5 })[0].kind, "sait");
});

test("extra event sources join the festival list and can be removed", () => {
  const day = BS.bsToDayNumber(2083, 7, 15);
  Upcoming.setSource("test", (bs) => (bs.day === 15 ? [{ ne: "नोट", en: "Note", kind: "note" }] : []));
  assert.ok(Upcoming.eventsOn(day).some((e) => e.kind === "note"));
  Upcoming.setSource("test", null);
  assert.ok(!Upcoming.eventsOn(day).some((e) => e.kind === "note"));
});

function jwt(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return b64({ alg: "none" }) + "." + b64(claims) + ".sig";
}

test("a Google ID token is accepted only for this app, this attempt and before expiry", () => {
  const now = Date.parse("2026-10-26T00:00:00Z");
  const claims = { iss: "https://accounts.google.com", aud: "cid", nonce: "n1", exp: now / 1000 + 600,
    sub: "42", name: "राम", email: "ram@example.com", picture: "https://x.com/p.jpg" };
  const user = Auth.googleUser(jwt(claims), { clientId: "cid", nonce: "n1", now });
  assert.deepEqual(user, { provider: "google", id: "42", name: "राम", email: "ram@example.com", picture: "https://x.com/p.jpg" });
  assert.throws(() => Auth.googleUser(jwt({ ...claims, aud: "other" }), { clientId: "cid", nonce: "n1", now }));
  assert.throws(() => Auth.googleUser(jwt(claims), { clientId: "cid", nonce: "n2", now }));
  assert.throws(() => Auth.googleUser(jwt(claims), { clientId: "cid", nonce: "n1", now: now + 3600000 }));
});

test("user records are cleaned and sign-in links are built", () => {
  assert.equal(Auth.cleanUser({ provider: "twitter", id: "1" }), null);
  assert.equal(Auth.cleanUser({ provider: "google", id: "a@b.com", email: "a@b.com", picture: "javascript:x" }).picture, null);
  assert.equal(Auth.cleanUser({ provider: "google", id: "a@b.com", email: "a@b.com" }).name, "a");
  assert.deepEqual(Auth.parseParams("#id_token=x.y.z&state=web.abc&x=a%20b"), { id_token: "x.y.z", state: "web.abc", x: "a b" });
  const g = new URL(Auth.googleAuthUrl({ clientId: "cid", redirect: "https://me/auth.html", nonce: "n", state: "web.n" }));
  assert.equal(g.searchParams.get("response_type"), "id_token");
  assert.equal(g.searchParams.get("redirect_uri"), "https://me/auth.html");
  const back = Auth.appReturnUrl({ provider: "facebook", id: "9", name: "A B" }, "n");
  assert.match(back, /^intent:\/\/auth\?provider=facebook&id=9&name=A%20B&state=n#Intent;scheme=patro;package=np\.patro\.app;end$/);
  assert.equal(Auth.randomNonce().length, 32);
});
