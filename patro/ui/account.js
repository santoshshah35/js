/*
 * Signing in with Google or Facebook (lib/auth.js), the account part of the
 * settings sheet, and the sign-in sheet shown when a members-only feature
 * is used. Which features need sign-in is set by the admin in config.json.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var Auth = root.PatroAuth;
  var Config = root.PatroConfig;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var USER_KEY = "patro.user";
  var PENDING_KEY = "patro.auth.pending";
  var pendingAction = null;

  UI.addText({
    ne: {
      account: "खाता",
      signIn: "लगइन",
      signInTitle: "Patro मा लगइन गर्नुहोस्",
      signInWhy: "{feature} प्रयोग गर्न लगइन गर्नुहोस्।",
      signInGeneral: "लगइन गरेपछि नोट राख्न र समाचार सेभ गर्न सकिन्छ।",
      withGoogle: "Google बाट लगइन",
      withFacebook: "Facebook बाट लगइन",
      signOut: "लगआउट",
      signedInAs: "{name} ({provider}) को रूपमा लगइन",
      notSetUp: "{provider} लगइन अझै मिलाइएको छैन। एडमिनले एडमिन प्यानलको सेटिङमा आवश्यक ID राख्नुपर्छ।",
      openAt: "लगइन गर्न Patro लाई {address} मा खोल्नुहोस्।",
      signInFailed: "लगइन हुन सकेन: {reason}",
      signingIn: "लगइन हुँदैछ…",
      privacy: "लगइनले यही फोनमा मात्र सुविधा खोल्छ। तपाईंको विवरण कुनै सर्भरमा पठाइँदैन।"
    },
    en: {
      account: "Account",
      signIn: "Sign in",
      signInTitle: "Sign in to Patro",
      signInWhy: "Sign in to use {feature}.",
      signInGeneral: "Signed-in users can keep notes and save news.",
      withGoogle: "Continue with Google",
      withFacebook: "Continue with Facebook",
      signOut: "Sign out",
      signedInAs: "Signed in as {name} ({provider})",
      notSetUp: "{provider} sign-in isn't set up yet. The admin needs to add its ID in the admin panel's settings.",
      openAt: "To sign in, open Patro at {address}.",
      signInFailed: "Couldn't sign in: {reason}",
      signingIn: "Signing in…",
      privacy: "Signing in only unlocks features on this phone. Your details are not sent to any server."
    }
  });

  var PROVIDER_NAMES = { google: "Google", facebook: "Facebook" };

  function readJson(key) {
    try {
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      if (value === null) root.localStorage.removeItem(key);
      else root.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* not saved */ }
  }

  UI.state.user = Auth.cleanUser(readJson(USER_KEY));

  function native() {
    return root.PatroNative;
  }

  // ---- Sign-in sheet ----

  function status(text) {
    $("login-status").textContent = text || "";
  }

  function renderLoginSheet(feature) {
    $("login-title").textContent = t("signInTitle");
    $("login-why").textContent = feature
      ? UI.fill(t("signInWhy"), { feature: UI.pick(Config.FEATURE_NAMES[feature]) })
      : t("signInGeneral");
    $("login-google").textContent = t("withGoogle");
    $("login-facebook").textContent = t("withFacebook");
    $("login-privacy").textContent = t("privacy");
    $("login-close").textContent = t("close");
  }

  function openLogin(feature) {
    renderLoginSheet(feature);
    status("");
    $("login-sheet").hidden = false;
    $("login-google").focus();
  }

  function closeLogin() {
    if ($("login-sheet").hidden) return false;
    $("login-sheet").hidden = true;
    pendingAction = null;
    return true;
  }

  function finishSignIn(user) {
    UI.state.user = user;
    writeJson(USER_KEY, user);
    var action = pendingAction;
    pendingAction = null;
    $("login-sheet").hidden = true;
    UI.emit("user");
    if (action) action();
  }

  // The web flow: Google or Facebook's page, then back to auth.html at the
  // app's web address, which saves the user for this page to pick up.
  function webSignIn(provider) {
    var login = UI.state.config.login;
    var web = login.webAddress;
    if (!web) return status(UI.fill(t("notSetUp"), { provider: PROVIDER_NAMES[provider] }));
    if (root.location.href.indexOf(web) !== 0) return status(UI.fill(t("openAt"), { address: web }));
    var nonce = Auth.randomNonce();
    var redirect = web + "auth.html";
    var url;
    if (provider === "google") {
      if (!login.googleClientId) return status(UI.fill(t("notSetUp"), { provider: "Google" }));
      writeJson(PENDING_KEY, { provider: "google", nonce: nonce, clientId: login.googleClientId, at: Date.now() });
      url = Auth.googleAuthUrl({ clientId: login.googleClientId, redirect: redirect, nonce: nonce, state: "web." + nonce });
    } else {
      if (!login.facebookAppId) return status(UI.fill(t("notSetUp"), { provider: "Facebook" }));
      writeJson(PENDING_KEY, { provider: "facebook", nonce: nonce, at: Date.now() });
      url = Auth.facebookAuthUrl({ appId: login.facebookAppId, redirect: redirect, state: "web." + nonce });
    }
    status(t("signingIn"));
    root.location.href = url;
  }

  function signIn(provider) {
    var bridge = native();
    var login = UI.state.config.login;
    if (bridge && provider === "google" && typeof bridge.signInGoogle === "function") {
      // The phone's own Google account picker.
      status(t("signingIn"));
      bridge.signInGoogle();
      return;
    }
    if (bridge && provider === "facebook" && typeof bridge.openAuth === "function") {
      // Facebook's page in the phone's browser, back to the app by link.
      if (!login.facebookAppId || !login.webAddress) {
        status(UI.fill(t("notSetUp"), { provider: "Facebook" }));
        return;
      }
      var nonce = Auth.randomNonce();
      status(t("signingIn"));
      bridge.openAuth(Auth.facebookAuthUrl({ appId: login.facebookAppId, redirect: login.webAddress + "auth.html", state: "app." + nonce }), nonce);
      return;
    }
    webSignIn(provider);
  }

  // Called by the Android app with the signed-in user, or an error.
  root.__patroAuthDone = function (json) {
    var user = null;
    try { user = Auth.cleanUser(typeof json === "string" ? JSON.parse(json) : json); } catch (e) { user = null; }
    if (user) finishSignIn(user);
    else status(UI.fill(t("signInFailed"), { reason: "?" }));
  };
  root.__patroAuthFailed = function (reason) {
    status(UI.fill(t("signInFailed"), { reason: String(reason || "?") }));
  };

  function signOut() {
    UI.state.user = null;
    writeJson(USER_KEY, null);
    UI.emit("user");
  }

  // ---- Settings sheet ----

  function renderAccount() {
    var box = $("account-box");
    UI.clear(box);
    box.appendChild(el("p", "setting-label", t("account")));
    var user = UI.state.user;
    if (!user) {
      var btn = el("button", "btn btn-primary account-signin", t("signIn"));
      btn.type = "button";
      btn.addEventListener("click", function () { openLogin(null); });
      box.appendChild(btn);
      return;
    }
    // The user's own profile (ui/profile.js) overrides the provider's name and picture.
    var mine = UI.profile ? UI.profile.get() : {};
    var row = el("div", "account-row");
    var picture = mine.photo || user.picture;
    if (picture) {
      var img = el("img", "account-picture");
      img.src = picture;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () { img.hidden = true; });
      row.appendChild(img);
    }
    var who = el("div", "account-who");
    who.appendChild(el("span", "account-name", mine.name || user.name));
    who.appendChild(el("span", "muted", mine.email || user.email || PROVIDER_NAMES[user.provider]));
    row.appendChild(who);
    var out = el("button", "btn", t("signOut"));
    out.type = "button";
    out.addEventListener("click", signOut);
    row.appendChild(out);
    box.appendChild(row);
    if (UI.profile) {
      var edit = el("button", "btn account-profile", t("profileEdit"));
      edit.type = "button";
      edit.addEventListener("click", UI.profile.open);
      box.appendChild(edit);
    }
  }

  /**
   * Runs an action, first asking the user to sign in if the admin made the
   * feature members-only.
   */
  function requireLogin(feature, action) {
    if (!Config.isLocked(feature, UI.state.config, UI.state.user)) {
      action();
      return;
    }
    openLogin(feature);
    pendingAction = action;
  }

  function isLocked(feature) {
    return Config.isLocked(feature, UI.state.config, UI.state.user);
  }

  function init() {
    $("login-google").addEventListener("click", function () { signIn("google"); });
    $("login-facebook").addEventListener("click", function () { signIn("facebook"); });
    $("login-close").addEventListener("click", closeLogin);
    $("login-sheet").addEventListener("click", function (e) {
      if (e.target === $("login-sheet")) closeLogin();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLogin();
    });
    UI.on("lang", function () { renderAccount(); renderLoginSheet(null); });
    UI.on("user", renderAccount);
    UI.on("profile", renderAccount);
    renderAccount();
    // A web sign-in that came back through auth.html in another tab.
    root.addEventListener("storage", function (e) {
      if (e.key !== USER_KEY) return;
      UI.state.user = Auth.cleanUser(readJson(USER_KEY));
      UI.emit("user");
    });
  }

  UI.account = {
    init: init,
    requireLogin: requireLogin,
    isLocked: isLocked,
    openLogin: openLogin,
    closeLogin: closeLogin,
    // Storage keys and owner for a signed-in user's own data.
    userKey: function () {
      var u = UI.state.user;
      return u ? u.provider + ":" + u.id : "guest";
    }
  };
})(this);
