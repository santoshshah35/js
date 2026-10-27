/*
 * Contact sync (More sheet): registers the user's own number and counts how
 * many phone contacts also use Patro. Only one-way codes of numbers reach
 * Firebase (lib/contacts.js); names never leave the phone.
 *
 * Firebase is used over its REST APIs with anonymous sign-in, so the app
 * needs no SDK. Rules: firebase/firestore.rules.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var Contacts = root.PatroContacts;
  var t = UI.t;
  var $ = UI.$;

  var SESSION_KEY = "patro.firebase.session";
  var ME_KEY = "patro.contacts.me";
  var RESULT_KEY = "patro.contacts.result";
  // Firestore reads at most this many documents per batchGet call here.
  var BATCH = 100;

  var busy = false;

  UI.addText({
    ne: {
      contactsLabel: "सम्पर्क मिलाउनुहोस्",
      contactsMe: "तपाईंको मोबाइल नम्बर",
      contactsSync: "सम्पर्क सिंक गर्नुहोस्",
      contactsSyncing: "सिंक हुँदैछ…",
      contactsFound: "तपाईंका {total} सम्पर्कमध्ये {n} जनाले Patro चलाउँछन्।",
      contactsNone: "तपाईंका {total} सम्पर्कमध्ये अहिलेसम्म कसैले Patro चलाउँदैनन्।",
      contactsWhen: "पछिल्लो पटक: {date}",
      contactsBadMe: "आफ्नो नेपाली मोबाइल नम्बर हाल्नुहोस् (९८XXXXXXXX)।",
      contactsDenied: "सम्पर्क हेर्ने अनुमति दिइएन। फोनको सेटिङबाट दिन सक्नुहुन्छ।",
      contactsNoPicker: "सम्पर्क सिंक एन्ड्रोइड एपमा मात्र चल्छ।",
      contactsFailed: "सिंक हुन सकेन। इन्टरनेट जाँचेर फेरि प्रयास गर्नुहोस्।",
      contactsPrivacy: "नम्बरहरूलाई फोनमै उल्टाउन नमिल्ने कोडमा बदलिन्छ र कोड मात्र पठाइन्छ; नाम कहिल्यै पठाइँदैन। तपाईंको नम्बरले अरूलाई तपाईं Patro मा हुनुहुन्छ भनेर देखाउँछ।"
    },
    en: {
      contactsLabel: "Friends on Patro",
      contactsMe: "Your mobile number",
      contactsSync: "Sync contacts",
      contactsSyncing: "Syncing…",
      contactsFound: "{n} of your {total} contacts use Patro.",
      contactsNone: "None of your {total} contacts use Patro yet.",
      contactsWhen: "Last synced: {date}",
      contactsBadMe: "Enter your Nepali mobile number (98XXXXXXXX).",
      contactsDenied: "Permission to read contacts wasn't given. You can allow it in the phone's settings.",
      contactsNoPicker: "Contact sync works in the Android app.",
      contactsFailed: "Couldn't sync. Check the internet connection and try again.",
      contactsPrivacy: "Numbers are turned into one-way codes on your phone and only the codes are sent; names never leave it. Your number lets friends who sync see that you use Patro."
    }
  });

  function readJson(key) {
    try { return JSON.parse(root.localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  function writeJson(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: not kept */ }
  }

  function firebase() {
    var fb = UI.state.config && UI.state.config.firebase;
    return fb && fb.apiKey && fb.projectId ? fb : null;
  }

  function request(url, options) {
    return root.fetch(url, options).then(function (res) {
      return res.text().then(function (body) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return body ? JSON.parse(body) : {};
      });
    });
  }

  // ---- Firebase anonymous session ----

  /** Resolves to { idToken, uid }, keeping one anonymous user per install. */
  function signIn(fb) {
    var saved = readJson(SESSION_KEY);
    if (saved && saved.projectId === fb.projectId && saved.refreshToken) {
      return request("https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(fb.apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(saved.refreshToken)
      }).then(function (r) {
        writeJson(SESSION_KEY, { projectId: fb.projectId, refreshToken: r.refresh_token, uid: r.user_id });
        return { idToken: r.id_token, uid: r.user_id };
      });
    }
    return request("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(fb.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    }).then(function (r) {
      writeJson(SESSION_KEY, { projectId: fb.projectId, refreshToken: r.refreshToken, uid: r.localId });
      return { idToken: r.idToken, uid: r.localId };
    });
  }

  // ---- Firestore ----

  function docsUrl(fb) {
    return "https://firestore.googleapis.com/v1/projects/" + fb.projectId + "/databases/(default)/documents";
  }

  function docName(fb, code) {
    return "projects/" + fb.projectId + "/databases/(default)/documents/members/" + code;
  }

  /** Marks this install's number as using Patro; forgets an old number. */
  function register(fb, session, code) {
    var auth = { "Authorization": "Bearer " + session.idToken, "Content-Type": "application/json" };
    var me = readJson(ME_KEY) || {};
    var drop = me.code && me.code !== code
      ? request(docsUrl(fb) + "/members/" + me.code, { method: "DELETE", headers: auth }).catch(function () { return null; })
      : Promise.resolve();
    return drop.then(function () {
      return request(docsUrl(fb) + "/members/" + code + "?updateMask.fieldPaths=uid&updateMask.fieldPaths=at", {
        method: "PATCH",
        headers: auth,
        body: JSON.stringify({ fields: { uid: { stringValue: session.uid }, at: { timestampValue: new Date().toISOString() } } })
      });
    });
  }

  /** How many of the codes belong to Patro users. */
  function countMembers(fb, session, codes) {
    var batches = [];
    for (var i = 0; i < codes.length; i += BATCH) batches.push(codes.slice(i, i + BATCH));
    return Promise.all(batches.map(function (batch) {
      return request(docsUrl(fb) + ":batchGet", {
        method: "POST",
        headers: { "Authorization": "Bearer " + session.idToken, "Content-Type": "application/json" },
        body: JSON.stringify({ documents: batch.map(function (c) { return docName(fb, c); }) })
      }).then(function (rows) {
        return (Array.isArray(rows) ? rows : []).filter(function (r) { return r.found; }).length;
      });
    })).then(function (counts) {
      return counts.reduce(function (a, b) { return a + b; }, 0);
    });
  }

  // ---- Reading the phone's contacts ----

  var pendingContacts = null;

  // Called by the Android app: a JSON list of numbers, "denied" or "error".
  root.__patroContacts = function (payload) {
    var done = pendingContacts;
    pendingContacts = null;
    if (!done) return;
    if (payload === "denied") done.reject(new Error("denied"));
    else if (payload === "error") done.reject(new Error("failed"));
    else {
      try { done.resolve(JSON.parse(payload)); } catch (e) { done.reject(new Error("failed")); }
    }
  };

  function readPhoneContacts() {
    var bridge = root.PatroNative;
    if (bridge && typeof bridge.readContacts === "function") {
      return new Promise(function (resolve, reject) {
        pendingContacts = { resolve: resolve, reject: reject };
        bridge.readContacts();
      });
    }
    // Chrome on Android: the user picks which contacts to share.
    if (root.navigator.contacts && typeof root.navigator.contacts.select === "function") {
      return root.navigator.contacts.select(["tel"], { multiple: true }).then(function (list) {
        return [].concat.apply([], list.map(function (c) { return c.tel || []; }));
      });
    }
    return Promise.reject(new Error("unsupported"));
  }

  // ---- Screen ----

  function showResult() {
    var r = readJson(RESULT_KEY);
    var out = $("contacts-result");
    out.classList.remove("error");
    if (!r) {
      out.textContent = "";
      return;
    }
    var line = UI.fill(t(r.found ? "contactsFound" : "contactsNone"), { n: UI.num(r.found), total: UI.num(r.total) });
    out.textContent = line + " " + UI.fill(t("contactsWhen"), { date: UI.dateOfMoment(r.at) });
  }

  function fail(key) {
    var out = $("contacts-result");
    out.textContent = t(key);
    out.classList.add("error");
  }

  function sync() {
    var fb = firebase();
    if (!fb || busy) return;
    var own = Contacts.phoneCode($("contacts-me").value);
    if (!own) {
      fail("contactsBadMe");
      return;
    }
    busy = true;
    $("contacts-sync").disabled = true;
    $("contacts-sync").textContent = t("contactsSyncing");
    var numbers;
    readPhoneContacts().then(function (list) {
      numbers = Contacts.contactCodes(list, own);
      return signIn(fb);
    }).then(function (session) {
      return register(fb, session, own).then(function () {
        writeJson(ME_KEY, { code: own, number: $("contacts-me").value.trim() });
        return countMembers(fb, session, numbers);
      });
    }).then(function (found) {
      writeJson(RESULT_KEY, { found: found, total: numbers.length, at: Date.now() });
      showResult();
    }).catch(function (err) {
      var reason = err && err.message;
      fail(reason === "denied" ? "contactsDenied" : reason === "unsupported" ? "contactsNoPicker" : "contactsFailed");
    }).then(function () {
      busy = false;
      $("contacts-sync").disabled = false;
      $("contacts-sync").textContent = t("contactsSync");
    });
  }

  function render() {
    $("contacts-box").hidden = !firebase();
    $("contacts-label").textContent = t("contactsLabel");
    var me = $("contacts-me");
    me.setAttribute("aria-label", t("contactsMe"));
    me.placeholder = t("contactsMe");
    if (!me.value) {
      var saved = readJson(ME_KEY);
      var profile = UI.profile.get() || {};
      me.value = (saved && saved.number) || profile.mobile || "";
    }
    if (!busy) $("contacts-sync").textContent = t("contactsSync");
    $("contacts-note").textContent = t("contactsPrivacy");
    showResult();
  }

  function init() {
    $("contacts-sync").addEventListener("click", sync);
    UI.on("config", render);
    UI.on("lang", render);
    UI.on("profile", render);
    render();
  }

  UI.contacts = { init: init };
})(this);
