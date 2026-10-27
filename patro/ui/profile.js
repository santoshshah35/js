/*
 * "My profile" for signed-in users: photo, name, mobile number, email, date
 * of birth, gender and address (lib/profile.js). Saved on this phone for
 * the signed-in account; the birthday shows on the calendar every year.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Profile = root.PatroProfile;
  var Upcoming = root.PatroUpcoming;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var PHOTO_PX = 256;
  var PHOTO_QUALITY = 0.85;
  var profile = {};
  var draft = {};

  UI.addText({
    ne: {
      profileTitle: "मेरो प्रोफाइल",
      profileEdit: "प्रोफाइल हेर्नुहोस् / मिलाउनुहोस्",
      profilePhoto: "फोटो",
      profilePhotoPick: "फोटो छान्नुहोस्",
      profilePhotoRemove: "फोटो हटाउनुहोस्",
      profileName: "नाम",
      profileMobile: "मोबाइल नम्बर",
      profileEmail: "इमेल",
      profileDob: "जन्म मिति (ई.सं.)",
      profileDobBs: "बि.सं. {date}",
      profileGender: "लिङ्ग",
      genderNone: "भन्न चाहन्न",
      genderMale: "पुरुष",
      genderFemale: "महिला",
      genderOther: "अन्य",
      profileAddress: "ठेगाना",
      profileSave: "सेभ गर्नुहोस्",
      profileCancel: "रद्द गर्नुहोस्",
      profileSaved: "प्रोफाइल सेभ भयो।",
      profilePrivate: "तपाईंको विवरण यही फोनमा मात्र राखिन्छ, कसैलाई पठाइँदैन।",
      badMobile: "मोबाइल नम्बर मिलेन (जस्तै 98XXXXXXXX)।",
      badEmail: "इमेल ठेगाना मिलेन।",
      badDob: "जन्म मिति मिलेन।",
      badPhoto: "यो फोटो प्रयोग गर्न सकिएन। अर्को छान्नुहोस्।",
      tooLong: "धेरै लामो भयो।",
      badGender: "छान्नुहोस्।"
    },
    en: {
      profileTitle: "My profile",
      profileEdit: "View / edit profile",
      profilePhoto: "Photo",
      profilePhotoPick: "Choose photo",
      profilePhotoRemove: "Remove photo",
      profileName: "Name",
      profileMobile: "Mobile number",
      profileEmail: "Email",
      profileDob: "Date of birth (AD)",
      profileDobBs: "{date} BS",
      profileGender: "Gender",
      genderNone: "Prefer not to say",
      genderMale: "Male",
      genderFemale: "Female",
      genderOther: "Other",
      profileAddress: "Address",
      profileSave: "Save",
      profileCancel: "Cancel",
      profileSaved: "Profile saved.",
      profilePrivate: "Your details are kept on this phone only and are not sent anywhere.",
      badMobile: "That mobile number doesn't look right (e.g. 98XXXXXXXX).",
      badEmail: "That email address doesn't look right.",
      badDob: "That date of birth doesn't look right.",
      badPhoto: "This photo couldn't be used. Please choose another.",
      tooLong: "Too long.",
      badGender: "Please choose."
    }
  });

  function storageKey() {
    return "patro.profile." + UI.account.userKey();
  }

  function todayIso() {
    var d = BS.fromDayNumber(BS.nepalToday());
    return d.year + "-" + (d.month < 10 ? "0" : "") + d.month + "-" + (d.day < 10 ? "0" : "") + d.day;
  }

  // The birthday's BS date, or null if it's outside the calendar's years.
  function birthdayBs(dob) {
    if (!dob) return null;
    var p = dob.split("-").map(Number);
    try {
      return BS.dayNumberToBs(Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000));
    } catch (e) {
      return null;
    }
  }

  function load() {
    var saved = null;
    try { saved = JSON.parse(root.localStorage.getItem(storageKey()) || "null"); } catch (e) { saved = null; }
    profile = UI.state.user && saved ? Profile.check(saved, todayIso()).profile : {};
    var bday = birthdayBs(profile.dob);
    Upcoming.setSource("birthday", bday ? function (bs) {
      return bs.month === bday.month && bs.day === bday.day && bs.year > bday.year
        ? [{ ne: "🎂 मेरो जन्मदिन", en: "🎂 My birthday", kind: "note" }] : [];
    } : null);
  }

  // ---- Photo: any picture, cropped to a small square JPEG ----

  function readPhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var side = Math.min(img.naturalWidth, img.naturalHeight);
          var canvas = document.createElement("canvas");
          canvas.width = PHOTO_PX;
          canvas.height = PHOTO_PX;
          canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2,
            side, side, 0, 0, PHOTO_PX, PHOTO_PX);
          resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // ---- The form ----

  function fieldRow(key, label, control, error, hint) {
    var row = el("label", "pf-field");
    row.appendChild(el("span", "pf-label", label));
    row.appendChild(control);
    if (hint) row.appendChild(hint);
    if (error) row.appendChild(el("span", "pf-error", t(error)));
    control.name = key;
    return row;
  }

  function input(key, type, attrs) {
    var i = el("input");
    i.type = type;
    i.value = draft[key] || "";
    Object.keys(attrs || {}).forEach(function (k) { i.setAttribute(k, attrs[k]); });
    i.addEventListener("input", function () { draft[key] = i.value; });
    return i;
  }

  function renderForm(errors) {
    var form = $("profile-form");
    UI.clear(form);
    $("profile-title").textContent = t("profileTitle");
    var errs = errors || {};

    var photoRow = el("div", "pf-photo");
    var avatar = el("div", "pf-avatar");
    if (draft.photo) {
      var img = el("img");
      img.src = draft.photo;
      img.alt = "";
      avatar.appendChild(img);
    } else {
      avatar.textContent = (draft.name || (UI.state.user && UI.state.user.name) || "?").trim().charAt(0).toUpperCase();
    }
    photoRow.appendChild(avatar);
    var pick = el("label", "btn pf-pick", t("profilePhotoPick"));
    var file = el("input");
    file.type = "file";
    file.accept = "image/*";
    file.className = "sr-only";
    file.addEventListener("change", function () {
      if (!file.files || !file.files[0]) return;
      readPhoto(file.files[0]).then(function (url) {
        draft.photo = url;
        renderForm();
      }, function () { renderForm({ photo: "badPhoto" }); });
    });
    pick.appendChild(file);
    var photoButtons = el("div", "pf-photo-buttons");
    photoButtons.appendChild(pick);
    if (draft.photo) {
      var remove = el("button", "link-btn", t("profilePhotoRemove"));
      remove.type = "button";
      remove.addEventListener("click", function () { delete draft.photo; renderForm(); });
      photoButtons.appendChild(remove);
    }
    photoRow.appendChild(photoButtons);
    form.appendChild(photoRow);
    if (errs.photo) form.appendChild(el("p", "pf-error", t(errs.photo)));

    form.appendChild(fieldRow("name", t("profileName"), input("name", "text", { maxlength: "80", autocomplete: "name" }), errs.name));
    form.appendChild(fieldRow("mobile", t("profileMobile"),
      input("mobile", "tel", { inputmode: "tel", autocomplete: "tel", placeholder: "98XXXXXXXX" }), errs.mobile));
    form.appendChild(fieldRow("email", t("profileEmail"),
      input("email", "email", { autocomplete: "email", placeholder: "name@example.com" }), errs.email));
    var dobInput = input("dob", "date", { max: todayIso(), min: "1900-01-01", autocomplete: "bday" });
    var bsHint = el("span", "pf-hint");
    function showBs() {
      var b = birthdayBs(dobInput.value);
      bsHint.textContent = b ? UI.fill(t("profileDobBs"), { date: UI.formatBs(b) }) : "";
    }
    dobInput.addEventListener("input", showBs);
    showBs();
    form.appendChild(fieldRow("dob", t("profileDob"), dobInput, errs.dob, bsHint));

    var gender = el("select");
    [["", "genderNone"], ["male", "genderMale"], ["female", "genderFemale"], ["other", "genderOther"]].forEach(function (g) {
      var o = el("option", null, t(g[1]));
      o.value = g[0];
      gender.appendChild(o);
    });
    gender.value = draft.gender || "";
    gender.addEventListener("change", function () { draft.gender = gender.value; });
    form.appendChild(fieldRow("gender", t("profileGender"), gender, errs.gender));
    form.appendChild(fieldRow("address", t("profileAddress"),
      input("address", "text", { maxlength: "120", autocomplete: "street-address" }), errs.address));

    form.appendChild(el("p", "fineprint", t("profilePrivate")));
    var buttons = el("div", "pf-buttons");
    var cancel = el("button", "btn", t("profileCancel"));
    cancel.type = "button";
    cancel.addEventListener("click", close);
    var save = el("button", "btn btn-primary", t("profileSave"));
    save.type = "submit";
    buttons.appendChild(cancel);
    buttons.appendChild(save);
    form.appendChild(buttons);
  }

  function submit(e) {
    e.preventDefault();
    var result = Profile.check(draft, todayIso());
    if (Object.keys(result.errors).length) {
      renderForm(result.errors);
      var first = $("profile-form").querySelector(".pf-error");
      if (first) first.scrollIntoView({ block: "center" });
      return;
    }
    try {
      root.localStorage.setItem(storageKey(), JSON.stringify(result.profile));
    } catch (err) {
      renderForm({ photo: "badPhoto" });
      return;
    }
    load();
    close();
    UI.emit("profile");
    UI.emit("events");
  }

  function open() {
    if (!UI.state.user) {
      UI.account.openLogin(null);
      return;
    }
    draft = JSON.parse(JSON.stringify(profile));
    if (!draft.name && UI.state.user.name) draft.name = UI.state.user.name;
    if (!draft.email && UI.state.user.email) draft.email = UI.state.user.email;
    renderForm();
    $("profile-sheet").hidden = false;
  }

  // The round button in the header: the photo, else the name's first
  // letter, else a person outline when nobody is signed in.
  function renderAvatar() {
    var btn = $("avatar-btn");
    var user = UI.state.user;
    UI.clear(btn);
    btn.setAttribute("aria-label", user ? t("profileTitle") : t("signIn"));
    if (user && profile.photo) {
      var img = el("img");
      img.src = profile.photo;
      img.alt = "";
      btn.appendChild(img);
      return;
    }
    var name = (user && (profile.name || user.name)) || "";
    if (name) {
      btn.textContent = name.trim().charAt(0).toUpperCase();
      return;
    }
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"/></svg>';
  }

  function close() {
    if ($("profile-sheet").hidden) return false;
    $("profile-sheet").hidden = true;
    return true;
  }

  function init() {
    load();
    renderAvatar();
    $("avatar-btn").addEventListener("click", open);
    UI.on("profile", renderAvatar);
    UI.on("lang", renderAvatar);
    $("profile-form").addEventListener("submit", submit);
    $("profile-sheet").addEventListener("click", function (e) {
      if (e.target === $("profile-sheet")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    UI.on("user", function () {
      load();
      UI.emit("profile");
      UI.emit("events");
    });
  }

  UI.profile = {
    init: init,
    open: open,
    close: close,
    get: function () { return profile; }
  };
})(this);
