/*
 * "My notes": the user's own notes on a calendar day, once or every year.
 * They show on the calendar and in the upcoming list. Kept on this phone,
 * separately for each signed-in account; members-only when the admin says so.
 */
(function (root) {
  "use strict";

  var UI = root.PatroUI;
  var BS = root.PatroBS;
  var Upcoming = root.PatroUpcoming;
  var t = UI.t;
  var el = UI.el;
  var $ = UI.$;

  var MAX_NOTES = 300;
  var MAX_TEXT = 80;
  var notes = [];

  UI.addText({
    ne: {
      notesTitle: "मेरो नोट",
      notesNone: "यस दिनको कुनै नोट छैन।",
      notePlaceholder: "जस्तै: आमाको जन्मदिन",
      noteYearly: "हरेक वर्ष",
      noteAdd: "थप्नुहोस्",
      noteDelete: "हटाउनुहोस्",
      notesLocked: "नोट राख्न लगइन गर्नुहोस्",
      noteLabel: "नोट"
    },
    en: {
      notesTitle: "My notes",
      notesNone: "No notes on this day.",
      notePlaceholder: "e.g. Mum's birthday",
      noteYearly: "Every year",
      noteAdd: "Add",
      noteDelete: "Delete",
      notesLocked: "Sign in to keep notes",
      noteLabel: "Note"
    }
  });

  function storageKey() {
    return "patro.notes." + UI.account.userKey();
  }

  function isNote(n) {
    return n && typeof n.id === "string" && typeof n.text === "string" && n.text.length <= MAX_TEXT
      && n.month >= 1 && n.month <= 12 && n.day >= 1 && n.day <= 32 && (n.year === null || typeof n.year === "number");
  }

  function load() {
    var list = [];
    try { list = JSON.parse(root.localStorage.getItem(storageKey()) || "[]"); } catch (e) { list = []; }
    notes = Array.isArray(list) ? list.filter(isNote) : [];
    Upcoming.setSource("notes", notes.length ? notesOn : null);
  }

  function save(list) {
    notes = list.slice(0, MAX_NOTES);
    try { root.localStorage.setItem(storageKey(), JSON.stringify(notes)); } catch (e) { /* not saved */ }
    Upcoming.setSource("notes", notes.length ? notesOn : null);
    UI.emit("events");
  }

  function matches(n, bs) {
    return n.month === bs.month && n.day === bs.day && (n.year === null || n.year === bs.year);
  }

  function notesOn(bs) {
    return notes.filter(function (n) { return matches(n, bs); }).map(function (n) {
      return { ne: n.text, en: n.text, kind: "note" };
    });
  }

  function addNote(text, yearly) {
    var bs = BS.dayNumberToBs(UI.state.selected);
    var note = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      year: yearly ? null : bs.year, month: bs.month, day: bs.day, text: text };
    save(notes.concat([note]));
  }

  function removeNote(id) {
    save(notes.filter(function (n) { return n.id !== id; }));
  }

  function render() {
    var box = $("notes-card");
    UI.clear(box);
    box.appendChild(el("h2", null, t("notesTitle")));
    if (UI.account.isLocked("notes")) {
      var unlock = el("button", "btn", "🔒 " + t("notesLocked"));
      unlock.type = "button";
      unlock.addEventListener("click", function () { UI.account.requireLogin("notes", render); });
      box.appendChild(unlock);
      return;
    }
    var bs = BS.dayNumberToBs(UI.state.selected);
    var today = notes.filter(function (n) { return matches(n, bs); });
    var ul = el("ul", "note-list");
    if (!today.length) ul.appendChild(el("li", "empty", t("notesNone")));
    today.forEach(function (n) {
      var li = el("li");
      li.appendChild(el("span", "note-text", n.text));
      if (n.year === null) li.appendChild(el("span", "tag", t("noteYearly")));
      var del = el("button", "note-delete", "×");
      del.type = "button";
      del.setAttribute("aria-label", t("noteDelete") + ": " + n.text);
      del.addEventListener("click", function () { removeNote(n.id); });
      li.appendChild(del);
      ul.appendChild(li);
    });
    box.appendChild(ul);

    var form = el("form", "note-form");
    var input = el("input");
    input.type = "text";
    input.maxLength = MAX_TEXT;
    input.placeholder = t("notePlaceholder");
    input.setAttribute("aria-label", t("noteLabel"));
    var yearly = el("label", "note-yearly");
    var check = el("input");
    check.type = "checkbox";
    yearly.appendChild(check);
    yearly.appendChild(document.createTextNode(" " + t("noteYearly")));
    var add = el("button", "btn btn-primary", t("noteAdd"));
    add.type = "submit";
    form.appendChild(input);
    form.appendChild(yearly);
    form.appendChild(add);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (text) addNote(text, check.checked);
    });
    box.appendChild(form);
  }

  function init() {
    load();
    UI.on("day", render);
    UI.on("lang", render);
    UI.on("config", render);
    UI.on("events", render);
    UI.on("user", function () {
      load();
      UI.emit("events");
    });
    render();
  }

  UI.notes = { init: init, load: load };
})(this);
