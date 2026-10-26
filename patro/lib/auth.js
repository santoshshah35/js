/*
 * Sign-in with Google and Facebook, without a server of our own.
 *
 * - Android app, Google: the phone's own account picker (no setup needed).
 * - Facebook, and Google on the web: the provider's sign-in page in the
 *   browser, which returns to auth.html on the app's web address. auth.html
 *   hands the result back to the web app, or to the Android app through a
 *   patro://auth link.
 *
 * Sign-in only unlocks features on this device. Nothing is sent to a Patro
 * server (there is none), and the provider's token is not kept.
 */
(function (root) {
  "use strict";

  // The page's window, or Node's global object in the tests.
  var G = typeof window !== "undefined" ? window : globalThis;
  var PROVIDERS = ["google", "facebook"];
  var GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
  var GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
  var FACEBOOK_AUTH = "https://www.facebook.com/v19.0/dialog/oauth";
  var FACEBOOK_ME = "https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=";
  var ANDROID_PACKAGE = "np.patro.app";

  function randomNonce() {
    var bytes = new Uint8Array(16);
    G.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  /** "a=1&b=two" (with or without a leading # or ?) to {a:"1", b:"two"}. */
  function parseParams(s) {
    var out = {};
    String(s || "").replace(/^[#?]/, "").split("&").forEach(function (part) {
      if (!part) return;
      var i = part.indexOf("=");
      var k = i < 0 ? part : part.slice(0, i);
      var v = i < 0 ? "" : part.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { /* skipped */ }
    });
    return out;
  }

  function query(params) {
    return Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
  }

  /** The claims inside a JWT (unverified). */
  function decodeJwt(token) {
    var part = String(token).split(".")[1];
    if (!part) throw new Error("Not a JWT");
    var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var bin = G.atob(b64);
    var pct = "";
    for (var i = 0; i < bin.length; i++) pct += "%" + ("0" + bin.charCodeAt(i).toString(16)).slice(-2);
    return JSON.parse(decodeURIComponent(pct));
  }

  function str(v, max) {
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  }

  function https(v) {
    return typeof v === "string" && /^https:\/\/[^\s"'<>]+$/i.test(v) && v.length < 1000 ? v : null;
  }

  /** A signed-in user record, or null if it isn't one. */
  function cleanUser(u) {
    if (!u || typeof u !== "object" || PROVIDERS.indexOf(u.provider) < 0) return null;
    var id = str(u.id, 200);
    if (!id) return null;
    var email = str(u.email, 200);
    return {
      provider: u.provider,
      id: id,
      name: str(u.name, 80) || (email ? email.split("@")[0] : id),
      email: email,
      picture: https(u.picture)
    };
  }

  /**
   * The user in a Google ID token, after checking it was issued to this app,
   * for this sign-in attempt, and hasn't expired.
   */
  function googleUser(idToken, expect) {
    var c = decodeJwt(idToken);
    if (GOOGLE_ISSUERS.indexOf(c.iss) < 0) throw new Error("Wrong issuer");
    if (c.aud !== expect.clientId) throw new Error("Token is for another app");
    if (c.nonce !== expect.nonce) throw new Error("Sign-in attempt doesn't match");
    if (!(c.exp * 1000 > expect.now)) throw new Error("Token expired");
    return cleanUser({ provider: "google", id: c.sub, name: c.name, email: c.email, picture: c.picture });
  }

  /** Google's sign-in page, returning an ID token to auth.html. */
  function googleAuthUrl(o) {
    return GOOGLE_AUTH + "?" + query({
      client_id: o.clientId,
      redirect_uri: o.redirect,
      response_type: "id_token",
      scope: "openid email profile",
      nonce: o.nonce,
      state: o.state,
      prompt: "select_account"
    });
  }

  /** Facebook's sign-in page, returning an access token to auth.html. */
  function facebookAuthUrl(o) {
    return FACEBOOK_AUTH + "?" + query({
      client_id: o.appId,
      redirect_uri: o.redirect,
      response_type: "token",
      scope: "public_profile",
      state: o.state
    });
  }

  /** Link that opens the Android app with a signed-in user. */
  function appReturnUrl(user, nonce) {
    var params = { provider: user.provider, id: user.id, name: user.name, state: nonce };
    if (user.email) params.email = user.email;
    if (user.picture) params.picture = user.picture;
    return "intent://auth?" + query(params) + "#Intent;scheme=patro;package=" + ANDROID_PACKAGE + ";end";
  }

  var api = {
    PROVIDERS: PROVIDERS,
    FACEBOOK_ME: FACEBOOK_ME,
    randomNonce: randomNonce,
    parseParams: parseParams,
    decodeJwt: decodeJwt,
    cleanUser: cleanUser,
    googleUser: googleUser,
    googleAuthUrl: googleAuthUrl,
    facebookAuthUrl: facebookAuthUrl,
    appReturnUrl: appReturnUrl
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroAuth = api;
})(this);
