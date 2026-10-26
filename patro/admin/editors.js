/*
 * The admin panel's editors, one per content file. Each editor turns a file
 * into a form and back, and checks the result with the same code the app
 * uses to read it, so a saved file is always one the app accepts.
 *
 * An editor is { title, path, help, parse(text) -> model, render(box, model,
 * changed), validate(model) -> [problems], serialize(model) -> text }.
 */
(function (root) {
  "use strict";

  var Feed = root.PatroFeed;
  var BS = root.PatroBS;
  var Custom = root.PatroCustomEvents;
  var News = root.PatroNews;
  var Config = root.PatroConfig;
  var Alerts = root.PatroAlerts;

  // ---- Small DOM helpers ----

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, v);
    });
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function field(label, control, hint) {
    return h("label", { class: "field" }, [
      h("span", { class: "field-label", text: label }),
      control,
      hint ? h("span", { class: "field-hint", text: hint }) : null
    ]);
  }

  function input(value, onChange, attrs) {
    var a = attrs || {};
    a.value = value === null || value === undefined ? "" : String(value);
    a.oninput = function (e) { onChange(e.target.value); };
    return h("input", a);
  }

  function select(options, value, onChange) {
    var s = h("select", { onchange: function (e) { onChange(e.target.value); } },
      options.map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
    s.value = String(value);
    return s;
  }

  // Nepali and English text side by side; empty strings are left out.
  function pairFields(label, obj, key, max, changed, multiline) {
    var current = obj[key] || {};
    function set(lang, v) {
      var next = { ne: current.ne || "", en: current.en || "" };
      next[lang] = v;
      current = next;
      var clean = {};
      if (next.ne.trim()) clean.ne = next.ne.trim();
      if (next.en.trim()) clean.en = next.en.trim();
      if (clean.ne || clean.en) obj[key] = clean;
      else delete obj[key];
      changed();
    }
    function control(lang) {
      var attrs = { maxlength: max, lang: lang, placeholder: lang === "ne" ? "नेपाली" : "English" };
      if (!multiline) return input(current[lang], function (v) { set(lang, v); }, attrs);
      attrs.rows = 2;
      attrs.oninput = function (e) { set(lang, e.target.value); };
      var ta = h("textarea", attrs);
      ta.value = current[lang] || "";
      return ta;
    }
    return h("div", { class: "field" }, [
      h("span", { class: "field-label", text: label }),
      h("div", { class: "pair" }, [control("ne"), control("en")])
    ]);
  }

  function pretty(obj) {
    return JSON.stringify(obj, null, 2) + "\n";
  }

  function todayIso() {
    return new Date(Date.now() + (5 * 60 + 45) * 60000).toISOString().slice(0, 10);
  }

  function slug(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  }

  function uniqueId(base, taken) {
    var id = base || "item";
    var n = 2;
    while (taken.indexOf(id) >= 0) id = (base || "item") + "-" + n++;
    return id;
  }

  // ---- Ads and notices (feed.json) ----

  var SLOT_NAMES = { top: "Top of every screen", news: "News screen", rashifal: "Rashifal screen", forex: "Exchange screen", fuel: "Fuel screen" };

  function adStatus(item) {
    var today = todayIso();
    if (item.end && item.end < today) return ["expired", "Ended"];
    if (item.start && item.start > today) return ["scheduled", "Starts " + item.start];
    return ["live", "Showing now"];
  }

  function adProblems(item, i) {
    var p = [];
    var name = "Entry " + (i + 1) + (item.title ? " (" + (item.title.en || item.title.ne) + ")" : "");
    if (!item.title) p.push(name + ": needs a title.");
    ["link", "image"].forEach(function (k) {
      if (item[k] !== undefined && !/^https:\/\/[^\s"'<>]+$/i.test(item[k])) p.push(name + ": " + k + " must be an https:// address.");
    });
    ["start", "end"].forEach(function (k) {
      if (item[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(item[k])) p.push(name + ": " + k + " date is not valid.");
    });
    if (item.start && item.end && item.start > item.end) p.push(name + ": ends before it starts.");
    return p;
  }

  var ads = {
    title: "Ads & notices",
    path: "patro/content/feed.json",
    help: "Banners shown in the app. Changes reach phones the next time Patro opens (or within 30 minutes). At most 20 entries.",
    empty: { items: [] },
    parse: function (text) {
      var json = JSON.parse(text);
      if (!Array.isArray(json.items)) throw new Error("feed.json has no items list");
      return json;
    },
    validate: function (model) {
      var problems = [];
      model.items.forEach(function (item, i) { problems = problems.concat(adProblems(item, i)); });
      if (!problems.length) {
        var parsed = Feed.parseFeed(model);
        if (parsed.skipped) problems.push(parsed.skipped + " entr" + (parsed.skipped === 1 ? "y is" : "ies are") + " not valid and would be skipped.");
      }
      return problems;
    },
    serialize: pretty,
    render: function (box, model, changed, ctx) {
      var open = null;
      function redraw() {
        box.replaceChildren();
        var bar = h("div", { class: "toolbar" }, [
          h("button", { class: "btn primary", type: "button", text: "+ New ad", onclick: function () { add("ad"); } }),
          h("button", { class: "btn", type: "button", text: "+ New notice", onclick: function () { add("notice"); } })
        ]);
        box.appendChild(bar);
        if (!model.items.length) box.appendChild(h("p", { class: "muted", text: "No ads or notices yet." }));
        model.items.forEach(function (item, i) {
          var st = adStatus(item);
          var row = h("div", { class: "row" + (open === i ? " open" : "") }, [
            h("div", { class: "row-main", onclick: function () { open = open === i ? null : i; redraw(); } }, [
              h("span", { class: "badge " + item.kind, text: item.kind === "ad" ? "Ad" : "Notice" }),
              h("span", { class: "row-title", text: item.title ? (item.title.ne || item.title.en) : "(no title)" }),
              h("span", { class: "status " + st[0], text: st[1] }),
              h("span", { class: "muted", text: SLOT_NAMES[item.slot] || item.slot })
            ])
          ]);
          if (open === i) row.appendChild(adForm(item, i));
          box.appendChild(row);
        });
      }
      function add(kind) {
        var ids = model.items.map(function (x) { return x.id; });
        var today = todayIso();
        model.items.unshift({ id: uniqueId(kind + "-" + today, ids), slot: "top", kind: kind, title: {}, start: today });
        open = 0;
        changed();
        redraw();
      }
      function setOpt(item, key, v) {
        if (v === "" || v === null) delete item[key];
        else item[key] = v;
        changed();
      }
      function adForm(item, i) {
        var preview = h("img", { class: "preview", alt: "", hidden: !item.image, src: item.image || null });
        var upload = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", onchange: function (e) {
          var file = e.target.files[0];
          if (!file) return;
          ctx.uploadImage(file).then(function (url) {
            item.image = url;
            preview.src = url;
            preview.hidden = false;
            imageInput.value = url;
            changed();
          });
        } });
        var imageInput = input(item.image, function (v) { setOpt(item, "image", v.trim()); preview.src = v; preview.hidden = !v; },
          { type: "url", placeholder: "https://…" });
        return h("div", { class: "form" }, [
          h("div", { class: "grid2" }, [
            field("Type", select([["ad", "Ad (labelled Sponsored)"], ["notice", "Notice"]], item.kind, function (v) { item.kind = v; changed(); })),
            field("Where", select(Object.keys(SLOT_NAMES).map(function (k) { return [k, SLOT_NAMES[k]]; }), item.slot,
              function (v) { item.slot = v; changed(); }))
          ]),
          pairFields("Title (required)", item, "title", 120, changed),
          pairFields("Text", item, "body", 400, changed, true),
          h("div", { class: "grid2" }, [
            field("Link", input(item.link, function (v) { setOpt(item, "link", v.trim()); }, { type: "url", placeholder: "https://…" }),
              "Opened when the button is tapped. Leave empty for no button."),
            pairFields("Button text", item, "cta", 40, changed)
          ]),
          field("Picture", h("div", { class: "image-row" }, [imageInput, upload]),
            "Upload a picture or paste an https:// address. Wide banners (like 2160×300) show full width; square ones on the left. Keep it under 1 MB."),
          preview,
          h("div", { class: "grid2" }, [
            field("Show from", input(item.start, function (v) { setOpt(item, "start", v); }, { type: "date" })),
            field("Show until (included)", input(item.end, function (v) { setOpt(item, "end", v); }, { type: "date" }))
          ]),
          field("ID", input(item.id, function (v) { item.id = slug(v) || item.id; changed(); }),
            "A short unique name for this entry (letters, numbers and -)."),
          h("div", { class: "toolbar" }, [
            h("button", { class: "btn", type: "button", text: "Move up", disabled: i === 0, onclick: function () {
              model.items.splice(i - 1, 0, model.items.splice(i, 1)[0]); open = i - 1; changed(); redraw();
            } }),
            h("button", { class: "btn", type: "button", text: "Duplicate", onclick: function () {
              var copy = JSON.parse(JSON.stringify(item));
              copy.id = uniqueId(item.id + "-copy", model.items.map(function (x) { return x.id; }));
              model.items.splice(i + 1, 0, copy); open = i + 1; changed(); redraw();
            } }),
            h("button", { class: "btn danger", type: "button", text: "Delete", onclick: function () {
              if (!root.confirm("Delete this entry?")) return;
              model.items.splice(i, 1); open = null; changed(); redraw();
            } })
          ])
        ]);
      }
      redraw();
    }
  };

  // ---- Events, public holidays and sait (events.json) ----

  var KIND_NAMES = { event: "Event", holiday: "Public holiday", sait: "Sait (auspicious day)" };

  function bsParts(date) {
    var p = String(date || "").split("-").map(Number);
    return { year: p[0] || BS.dayNumberToBs(BS.nepalToday()).year, month: p[1] || 1, day: p[2] || 1 };
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var events = {
    title: "Events & holidays",
    path: "patro/content/events.json",
    help: "Your own events, public holidays (shown in red) and sait dates, by Bikram Sambat date. They appear on the calendar, in the upcoming list and on the home-screen widget.",
    empty: { events: [] },
    parse: function (text) {
      var json = JSON.parse(text);
      if (!Array.isArray(json.events)) throw new Error("events.json has no events list");
      return json;
    },
    validate: function (model) {
      var problems = [];
      model.events.forEach(function (e, i) {
        if (!e.title) problems.push("Entry " + (i + 1) + ": needs a title.");
      });
      if (!problems.length) {
        var parsed = Custom.parseEvents(model);
        if (parsed.skipped) problems.push(parsed.skipped + " entries have an impossible date or missing field.");
      }
      return problems;
    },
    serialize: function (model) {
      var sorted = model.events.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      return pretty({ events: sorted });
    },
    render: function (box, model, changed) {
      var open = null;
      function redraw() {
        box.replaceChildren();
        box.appendChild(h("div", { class: "toolbar" }, Object.keys(KIND_NAMES).map(function (k) {
          return h("button", { class: "btn" + (k === "holiday" ? " primary" : ""), type: "button", text: "+ " + KIND_NAMES[k], onclick: function () { add(k); } });
        })));
        if (!model.events.length) box.appendChild(h("p", { class: "muted", text: "No events yet." }));
        model.events.forEach(function (ev, i) {
          var d = bsParts(ev.date);
          var when = ev.yearly ? BS.MONTHS_EN[d.month - 1] + " " + d.day + " every year" : d.year + " " + BS.MONTHS_EN[d.month - 1] + " " + d.day;
          var row = h("div", { class: "row" + (open === i ? " open" : "") }, [
            h("div", { class: "row-main", onclick: function () { open = open === i ? null : i; redraw(); } }, [
              h("span", { class: "badge " + ev.kind, text: KIND_NAMES[ev.kind] || ev.kind }),
              h("span", { class: "row-title", text: ev.title ? (ev.title.ne || ev.title.en) : "(no title)" }),
              h("span", { class: "muted", text: when })
            ])
          ]);
          if (open === i) row.appendChild(eventForm(ev, i));
          box.appendChild(row);
        });
      }
      function add(kind) {
        var today = BS.dayNumberToBs(BS.nepalToday());
        var ids = model.events.map(function (x) { return x.id; });
        model.events.unshift({ id: uniqueId(kind + "-" + today.year + "-" + pad(today.month) + "-" + pad(today.day), ids),
          kind: kind, date: today.year + "-" + pad(today.month) + "-" + pad(today.day), title: {} });
        open = 0;
        changed();
        redraw();
      }
      function eventForm(ev, i) {
        var d = bsParts(ev.date);
        var adNote = h("span", { class: "field-hint" });
        var daySelect = h("select");
        function setDate() {
          ev.date = d.year + "-" + pad(d.month) + "-" + pad(d.day);
          var max = BS.daysInMonth(d.year, d.month);
          if (d.day > max) { d.day = max; ev.date = d.year + "-" + pad(d.month) + "-" + pad(d.day); }
          daySelect.replaceChildren.apply(daySelect, Array.from({ length: max }, function (_, k) {
            return h("option", { value: k + 1, text: String(k + 1) });
          }));
          daySelect.value = String(d.day);
          var ad = BS.fromDayNumber(BS.bsToDayNumber(d.year, d.month, d.day));
          adNote.textContent = "= " + ad.year + "-" + pad(ad.month) + "-" + pad(ad.day) + " AD" + (ev.yearly ? " this year; repeats every BS year" : "");
          changed();
        }
        daySelect.addEventListener("change", function () { d.day = +daySelect.value; setDate(); });
        var years = [];
        for (var y = BS.FIRST_YEAR; y <= BS.LAST_YEAR; y++) years.push([y, String(y)]);
        var form = h("div", { class: "form" }, [
          field("Type", select(Object.keys(KIND_NAMES).map(function (k) { return [k, KIND_NAMES[k]]; }), ev.kind,
            function (v) { ev.kind = v; changed(); })),
          pairFields("Title (required)", ev, "title", 80, changed),
          h("div", { class: "field" }, [
            h("span", { class: "field-label", text: "Date (BS)" }),
            h("div", { class: "grid3" }, [
              select(years, d.year, function (v) { d.year = +v; setDate(); }),
              select(BS.MONTHS_EN.map(function (m, k) { return [k + 1, BS.MONTHS_NE[k] + " · " + m]; }), d.month,
                function (v) { d.month = +v; setDate(); }),
              daySelect
            ]),
            adNote
          ]),
          h("label", { class: "check" }, [
            h("input", { type: "checkbox", checked: !!ev.yearly, onchange: function (e) {
              if (e.target.checked) ev.yearly = true; else delete ev.yearly;
              setDate();
            } }),
            " Repeats every year on this BS date"
          ]),
          h("div", { class: "toolbar" }, [
            h("button", { class: "btn danger", type: "button", text: "Delete", onclick: function () {
              if (!root.confirm("Delete this entry?")) return;
              model.events.splice(i, 1); open = null; changed(); redraw();
            } })
          ])
        ]);
        setDate();
        return form;
      }
      redraw();
    }
  };

  // ---- Fuel prices (fuel.json) ----

  var FUELS = [["petrol", "Petrol (Rs/litre)", 80, 400], ["diesel", "Diesel (Rs/litre)", 80, 400],
    ["kerosene", "Kerosene (Rs/litre)", 80, 400], ["lpg", "LPG (Rs/cylinder)", 800, 5000]];

  var fuel = {
    title: "Fuel prices",
    path: "patro/content/fuel.json",
    help: "Nepal Oil Corporation's site blocks automatic reading, so enter the Kathmandu valley prices when NOC announces a change. Saving updates the app within a few minutes.",
    empty: { effective: null, prices: { petrol: null, diesel: null, kerosene: null, lpg: null } },
    parse: function (text) {
      var json = JSON.parse(text);
      json.prices = json.prices || {};
      return json;
    },
    validate: function (model) {
      var p = [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(model.effective || "")) p.push("Enter the date the prices took effect.");
      FUELS.forEach(function (f) {
        var v = model.prices[f[0]];
        if (v !== null && v !== undefined && !(typeof v === "number" && v >= f[2] && v <= f[3])) {
          p.push(f[1] + " should be between " + f[2] + " and " + f[3] + ".");
        }
      });
      if (model.prices.petrol == null && model.prices.diesel == null) p.push("Enter at least petrol or diesel.");
      return p;
    },
    serialize: pretty,
    render: function (box, model, changed) {
      box.replaceChildren(h("div", { class: "form" }, [
        field("Prices effective from (AD date)", input(model.effective, function (v) { model.effective = v || null; changed(); }, { type: "date" })),
        h("div", { class: "grid2" }, FUELS.map(function (f) {
          return field(f[1], input(model.prices[f[0]], function (v) {
            model.prices[f[0]] = v === "" ? null : Number(v);
            changed();
          }, { type: "number", min: f[2], max: f[3], step: "0.01", inputmode: "decimal" }));
        }))
      ]));
    }
  };

  // ---- News sources (news-sources.json) ----

  var newsSources = {
    title: "News sources",
    path: "patro/content/news-sources.json",
    help: "RSS feeds the news job reads every 30 minutes. A site that blocks the job can be read through Google News: add https://news.google.com/rss/search?q=site:example.com&hl=ne&gl=NP&ceid=NP:ne as its last feed.",
    empty: { sources: [] },
    parse: function (text) {
      var json = JSON.parse(text);
      if (!Array.isArray(json.sources)) throw new Error("news-sources.json has no sources list");
      return json;
    },
    validate: function (model) {
      var p = [];
      var seen = {};
      model.sources.forEach(function (s, i) {
        var name = "Source " + (i + 1) + (s.name ? " (" + (s.name.en || s.name.ne) + ")" : "");
        if (!/^[a-z0-9-]{1,40}$/.test(s.id || "")) p.push(name + ": ID may use only a-z, 0-9 and -.");
        if (seen[s.id]) p.push(name + ": ID is used twice.");
        seen[s.id] = true;
        if (!s.name) p.push(name + ": needs a name.");
        if (!(s.feeds || []).some(function (f) { return /^https:\/\//.test(f); })) p.push(name + ": needs at least one https:// feed.");
      });
      if (!p.length && News.parseSources(model).skipped) p.push("Some sources are not valid.");
      return p;
    },
    serialize: function (model) {
      return "{\n  \"sources\": [\n" + model.sources.map(function (s) { return "    " + JSON.stringify(s); }).join(",\n") + "\n  ]\n}\n";
    },
    render: function (box, model, changed, ctx) {
      var open = null;
      var status = {};
      ctx.newsDoc().then(function (doc) {
        ((doc && doc.sources) || []).forEach(function (s) { status[s.id] = s; });
        redraw();
      });
      function redraw() {
        box.replaceChildren();
        box.appendChild(h("div", { class: "toolbar" }, [
          h("button", { class: "btn primary", type: "button", text: "+ New source", onclick: function () {
            model.sources.push({ id: uniqueId("source", model.sources.map(function (s) { return s.id; })), name: {}, lang: "ne", site: "", feeds: [] });
            open = model.sources.length - 1;
            changed();
            redraw();
          } })
        ]));
        model.sources.forEach(function (s, i) {
          var st = status[s.id];
          var label = s.enabled === false ? ["off", "Turned off"] : !st ? ["", "Not read yet"]
            : st.ok ? ["live", st.count + " stories"] : ["expired", "Failed last time"];
          var row = h("div", { class: "row" + (open === i ? " open" : "") }, [
            h("div", { class: "row-main", onclick: function () { open = open === i ? null : i; redraw(); } }, [
              h("span", { class: "badge", text: s.lang === "en" ? "English" : "नेपाली" }),
              s.priority ? h("span", { class: "badge ad", text: "Priority" }) : null,
              h("span", { class: "row-title", text: s.name ? (s.name.ne || s.name.en) : "(no name)" }),
              h("span", { class: "status " + label[0], text: label[1] })
            ])
          ]);
          if (open === i) row.appendChild(sourceForm(s, i));
          box.appendChild(row);
        });
      }
      function sourceForm(s, i) {
        var feeds = h("textarea", { rows: 3, oninput: function (e) {
          s.feeds = e.target.value.split(/\s+/).filter(Boolean);
          changed();
        } });
        feeds.value = (s.feeds || []).join("\n");
        return h("div", { class: "form" }, [
          h("label", { class: "check" }, [
            h("input", { type: "checkbox", checked: s.enabled !== false, onchange: function (e) {
              if (e.target.checked) delete s.enabled; else s.enabled = false;
              changed();
            } }),
            " Show news from this source"
          ]),
          h("label", { class: "check" }, [
            h("input", { type: "checkbox", checked: s.priority === true, onchange: function (e) {
              if (e.target.checked) s.priority = true; else delete s.priority;
              changed();
            } }),
            " Priority source: its stories from the last 12 hours are listed first"
          ]),
          pairFields("Name", s, "name", 40, changed),
          h("div", { class: "grid2" }, [
            field("Language", select([["ne", "नेपाली"], ["en", "English"]], s.lang, function (v) { s.lang = v; changed(); })),
            field("ID", input(s.id, function (v) { s.id = v.trim(); changed(); }), "a-z, 0-9 and - only")
          ]),
          field("Website", input(s.site, function (v) { s.site = v.trim(); changed(); }, { type: "url", placeholder: "https://…" })),
          field("Feed addresses", feeds, "One per line. The first one that works is used."),
          h("div", { class: "toolbar" }, [
            h("button", { class: "btn danger", type: "button", text: "Delete", onclick: function () {
              if (!root.confirm("Delete this source?")) return;
              model.sources.splice(i, 1); open = null; changed(); redraw();
            } })
          ])
        ]);
      }
      redraw();
    }
  };

  // ---- App settings (config.json) ----

  var settings = {
    title: "Login & members",
    path: "patro/content/config.json",
    help: "Sign-in keys and which features need a signed-in user. Google sign-in in the Android app works without any key; the keys below are for Facebook and for the web/iPhone app.",
    empty: { login: {}, membersOnly: Config.DEFAULTS.membersOnly.slice() },
    parse: function (text) {
      var json = JSON.parse(text);
      json.login = json.login || {};
      if (!Array.isArray(json.membersOnly)) json.membersOnly = Config.DEFAULTS.membersOnly.slice();
      return json;
    },
    validate: function (model) {
      var p = [];
      var parsed = Config.parseConfig(model);
      if (model.login.googleClientId && !parsed.login.googleClientId) p.push("The Google Client ID should look like 1234-abc.apps.googleusercontent.com.");
      if (model.login.facebookAppId && !parsed.login.facebookAppId) p.push("The Facebook App ID is a number.");
      if (model.login.webAddress && !parsed.login.webAddress) p.push("The web address must start with https://.");
      return p;
    },
    serialize: pretty,
    render: function (box, model, changed) {
      function set(k, v) { model.login[k] = v.trim(); changed(); }
      var web = model.login.webAddress || "https://santoshshah35.github.io/js/";
      box.replaceChildren(h("div", { class: "form" }, [
        h("h3", { text: "Features for signed-in users only" }),
        h("div", { class: "checks" }, Config.FEATURES.map(function (f) {
          return h("label", { class: "check" }, [
            h("input", { type: "checkbox", checked: model.membersOnly.indexOf(f) >= 0, onchange: function (e) {
              model.membersOnly = model.membersOnly.filter(function (x) { return x !== f; });
              if (e.target.checked) model.membersOnly.push(f);
              changed();
            } }),
            " " + Config.FEATURE_NAMES[f].en + " · " + Config.FEATURE_NAMES[f].ne
          ]);
        })),
        h("h3", { text: "Sign-in keys" }),
        field("App web address", input(model.login.webAddress, function (v) { set("webAddress", v); }, { type: "url", placeholder: web }),
          "Where the web app is published (GitHub Pages). Sign-in pages return to " + web + "auth.html — add that as the redirect address in Google and Facebook."),
        field("Google Client ID (web)", input(model.login.googleClientId, function (v) { set("googleClientId", v); }, { placeholder: "1234-abc.apps.googleusercontent.com" }),
          "Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application."),
        field("Facebook App ID", input(model.login.facebookAppId, function (v) { set("facebookAppId", v); }, { placeholder: "123456789012345", inputmode: "numeric" }),
          "developers.facebook.com → My Apps → your app → App ID. Add Facebook Login with the redirect address above.")
      ]));
    }
  };

  // ---- Push notifications (alerts.json) ----

  var LEVEL_NAMES = { breaking: "Breaking news", important: "Important", info: "Notice" };

  var push = {
    title: "Push notification",
    path: "patro/content/alerts.json",
    help: "Send breaking news or an important announcement. Android phones show it as a notification within about 15 minutes, even when Patro is closed; everyone sees it as a red strip in the app for 24 hours.",
    empty: { alerts: [] },
    parse: function (text) {
      var json = JSON.parse(text);
      if (!Array.isArray(json.alerts)) throw new Error("alerts.json has no alerts list");
      return json;
    },
    validate: function (model) {
      return Alerts.parseAlerts(model).skipped ? ["Some sent notifications are not valid; delete them."] : [];
    },
    serialize: pretty,
    // Sending saves at once; there's nothing to "Save" separately.
    autoSave: true,
    render: function (box, model, changed, ctx) {
      var draft = { level: "breaking" };
      var problems = h("ul", { class: "problems" });
      function redraw() {
        box.replaceChildren();
        var form = h("div", { class: "form compose" }, [
          h("h3", { text: "New notification" }),
          field("Type", select(Object.keys(LEVEL_NAMES).map(function (k) { return [k, LEVEL_NAMES[k]]; }), draft.level,
            function (v) { draft.level = v; })),
          pairFields("Headline (required)", draft, "title", 120, function () {}),
          pairFields("More text", draft, "body", 300, function () {}, true),
          field("Link", input(draft.link, function (v) { draft.link = v.trim() || undefined; }, { type: "url", placeholder: "https://…" }),
            "Opened when the notification is tapped. Optional."),
          problems,
          h("button", { class: "btn primary big", type: "button", text: "📣 Send notification now", onclick: send })
        ]);
        box.appendChild(form);

        var trendBox = h("div", { class: "trend-pick" }, [h("h3", { text: "Or send a trending story" }),
          h("p", { class: "muted", text: "Loading trending news…" })]);
        box.appendChild(trendBox);
        ctx.newsDoc().then(function (doc) {
          var items = {};
          ((doc && doc.items) || []).forEach(function (it) { items[it.id] = it; });
          var list = ((doc && doc.trending) || []).map(function (id) { return items[id]; }).filter(Boolean).slice(0, 8);
          trendBox.replaceChildren(h("h3", { text: "Or send a trending story" }));
          if (!list.length) trendBox.appendChild(h("p", { class: "muted", text: "Nothing is trending right now." }));
          list.forEach(function (it) {
            trendBox.appendChild(h("div", { class: "row" }, [h("div", { class: "row-main" }, [
              h("span", { class: "row-title", text: it.title }),
              h("button", { class: "btn small", type: "button", text: "Use this", onclick: function () {
                draft.title = it.lang === "en" ? { en: it.title } : { ne: it.title };
                draft.link = it.link;
                redraw();
                box.scrollIntoView({ block: "start" });
              } })
            ])]));
          });
        });

        box.appendChild(h("h3", { text: "Sent" }));
        if (!model.alerts.length) box.appendChild(h("p", { class: "muted", text: "Nothing sent yet." }));
        model.alerts.forEach(function (a, i) {
          var when = new Date(a.sentAt);
          var live = Date.now() - when.getTime() < Alerts.FRESH_HOURS * 3600000;
          box.appendChild(h("div", { class: "row" }, [h("div", { class: "row-main" }, [
            h("span", { class: "badge " + (a.level === "breaking" ? "holiday" : ""), text: LEVEL_NAMES[a.level] || a.level }),
            h("span", { class: "row-title", text: a.title ? (a.title.ne || a.title.en) : "" }),
            h("span", { class: "status " + (live ? "live" : "expired"), text: (live ? "Showing · " : "") + when.toLocaleString() }),
            h("button", { class: "btn small danger", type: "button", text: "Delete", onclick: function () {
              if (!root.confirm("Delete this notification? Phones that already showed it keep it.")) return;
              model.alerts.splice(i, 1);
              changed();
              ctx.save();
              redraw();
            } })
          ])]));
        });
      }
      function send() {
        var alert = { id: "alert-" + Date.now().toString(36), level: draft.level, title: draft.title, sentAt: new Date().toISOString() };
        if (draft.body) alert.body = draft.body;
        if (draft.link) alert.link = draft.link;
        var check = Alerts.parseAlerts({ alerts: [alert] });
        var msgs = [];
        if (!draft.title) msgs.push("Write a headline.");
        else if (check.skipped) msgs.push("The link must start with https://.");
        problems.replaceChildren.apply(problems, msgs.map(function (m) { return h("li", { text: m }); }));
        if (msgs.length) return;
        if (!root.confirm("Send this notification to every Patro user now?")) return;
        model.alerts.unshift(alert);
        model.alerts = model.alerts.slice(0, Alerts.MAX_ALERTS);
        draft = { level: "breaking" };
        changed();
        ctx.save();
        redraw();
      }
      redraw();
    }
  };

  root.PatroEditors = { ads: ads, events: events, fuel: fuel, newsSources: newsSources, settings: settings, push: push, h: h, field: field };
})(this);
