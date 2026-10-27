/*
 * App settings the admin changes without an app update (content/config.json):
 * login keys and which features need a signed-in user.
 */
(function (root) {
  "use strict";

  var REPO_RAW = "https://raw.githubusercontent.com/santoshshah35/js/";
  // Tried in order, like the ads feed.
  var BRANCHES = ["main", "claude/new-session-94tzzd"];

  // Features the admin can reserve for signed-in users.
  var FEATURES = ["notes", "newsSave", "rashifalPeriods"];
  var FEATURE_NAMES = {
    notes: { ne: "मेरो नोट", en: "My notes" },
    newsSave: { ne: "समाचार सेभ", en: "Saved news" },
    rashifalPeriods: { ne: "साप्ताहिक र मासिक राशिफल", en: "Weekly and monthly rashifal" }
  };

  var DEFAULTS = {
    login: { googleClientId: null, facebookAppId: null, webAddress: null },
    membersOnly: ["notes", "newsSave"]
  };

  /** Addresses of a file in patro/content/, in the order to try them. */
  function contentUrls(file) {
    return BRANCHES.map(function (b) { return REPO_RAW + b + "/patro/content/" + file; });
  }

  function match(value, re) {
    return typeof value === "string" && re.test(value.trim()) ? value.trim() : null;
  }

  /**
   * Checks config.json; anything missing or malformed takes its default.
   * @param {string|object} body
   */
  function parseConfig(body) {
    var json = typeof body === "string" ? JSON.parse(body) : body;
    if (!json || typeof json !== "object") throw new Error("Config is not an object");
    var login = json.login && typeof json.login === "object" ? json.login : {};
    var web = match(login.webAddress, /^https:\/\/[^\s"'<>?#]+$/i);
    return {
      login: {
        googleClientId: match(login.googleClientId, /^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/),
        facebookAppId: match(login.facebookAppId, /^[0-9]{5,20}$/),
        webAddress: web ? web.replace(/\/?$/, "/") : null
      },
      membersOnly: Array.isArray(json.membersOnly)
        ? FEATURES.filter(function (f) { return json.membersOnly.indexOf(f) >= 0; })
        : DEFAULTS.membersOnly.slice()
    };
  }

  /** True when a feature needs sign-in and nobody is signed in. */
  function isLocked(feature, config, user) {
    var c = config || DEFAULTS;
    // With no sign-in set up nobody could unlock it, so nothing is locked.
    if (!c.login.googleClientId && !c.login.facebookAppId) return false;
    return !user && c.membersOnly.indexOf(feature) >= 0;
  }

  var api = {
    FEATURES: FEATURES,
    FEATURE_NAMES: FEATURE_NAMES,
    DEFAULTS: DEFAULTS,
    contentUrls: contentUrls,
    parseConfig: parseConfig,
    isLocked: isLocked
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroConfig = api;
})(this);
