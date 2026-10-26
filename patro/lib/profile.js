/*
 * A signed-in user's profile: photo, name, mobile number, email, date of
 * birth, gender and address. Kept on the phone only (Patro has no server).
 * check() returns the cleaned profile and any problems, by field.
 */
(function (root) {
  "use strict";

  var GENDERS = ["", "male", "female", "other"];
  var MAX_PHOTO_CHARS = 200 * 1024;
  var LIMITS = { name: 80, address: 120, email: 120 };

  function str(v) {
    return typeof v === "string" ? v.trim() : "";
  }

  /**
   * Nepali mobile numbers (98/97/96 + 8 digits, optionally +977) are stored
   * as "98XXXXXXXX"; other countries as "+<digits>".
   */
  function normalMobile(value) {
    var s = str(value).replace(/[\s\-().]/g, "");
    var nepal = /^(?:\+?977)?(9[678]\d{8})$/.exec(s);
    if (nepal) return nepal[1];
    if (/^\+\d{8,15}$/.test(s)) return s;
    return null;
  }

  function validDob(value, today) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && value >= "1900-01-01" && value <= today;
  }

  /**
   * Cleans a profile form.
   * @param {object} input field values
   * @param {string} today "YYYY-MM-DD", the latest allowed birth date
   * @returns {{profile: object, errors: Object<string,string>}} errors are
   *   keys: "mobile", "email", "dob", "photo", "name" -> problem code
   */
  function check(input, today) {
    var p = input || {};
    var out = {};
    var errors = {};
    var name = str(p.name);
    if (name.length > LIMITS.name) errors.name = "tooLong";
    else if (name) out.name = name;
    if (str(p.mobile)) {
      var mobile = normalMobile(p.mobile);
      if (mobile) out.mobile = mobile; else errors.mobile = "badMobile";
    }
    var email = str(p.email).toLowerCase();
    if (email) {
      if (email.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) out.email = email;
      else errors.email = "badEmail";
    }
    var dob = str(p.dob);
    if (dob) {
      if (validDob(dob, today)) out.dob = dob; else errors.dob = "badDob";
    }
    if (GENDERS.indexOf(p.gender || "") < 0) errors.gender = "badGender";
    else if (p.gender) out.gender = p.gender;
    var address = str(p.address);
    if (address.length > LIMITS.address) errors.address = "tooLong";
    else if (address) out.address = address;
    if (p.photo) {
      if (typeof p.photo === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo)
        && p.photo.length <= MAX_PHOTO_CHARS) out.photo = p.photo;
      else errors.photo = "badPhoto";
    }
    return { profile: out, errors: errors };
  }

  var api = { GENDERS: GENDERS, MAX_PHOTO_CHARS: MAX_PHOTO_CHARS, check: check, normalMobile: normalMobile };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PatroProfile = api;
})(this);
