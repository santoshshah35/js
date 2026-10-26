/*
 * Patro admin panel: sign in with a GitHub token, edit the app's content
 * files with forms, and save them as commits. The app picks changes up
 * without an update. Nothing here runs on a server; the token stays in this
 * browser and is sent only to api.github.com.
 */
(function (root) {
  "use strict";

  var GitHub = root.PatroGitHub;
  var Editors = root.PatroEditors;
  var News = root.PatroNews;
  var h = Editors.h;

  var REPO = "santoshshah35/js";
  var BRANCHES = ["main", "claude/new-session-94tzzd"];
  var TOKEN_KEY = "patro.admin.token";
  var BRANCH_KEY = "patro.admin.branch";
  var MAX_IMAGE_BYTES = 1024 * 1024;
  var TABS = [
    ["push", Editors.push],
    ["ads", Editors.ads],
    ["events", Editors.events],
    ["fuel", Editors.fuel],
    ["newsSources", Editors.newsSources],
    ["settings", Editors.settings]
  ];
  var JOBS = [
    ["patro-news.yml", "Update news now", "Reads every news source again (takes about a minute)."],
    ["patro-rates.yml", "Update rates now", "Fetches exchange and gold rates and republishes fuel prices."]
  ];

  var gh = null;
  var who = null;
  var current = null;
  // Per tab: { model, sha, dirty } once loaded.
  var loaded = {};

  function $(id) { return document.getElementById(id); }

  function toast(text, kind) {
    var t = $("toast");
    t.textContent = text;
    t.className = "toast " + (kind || "");
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, kind === "error" ? 9000 : 4000);
  }

  function storage(remember) {
    return remember ? root.localStorage : root.sessionStorage;
  }

  function savedToken() {
    try { return root.sessionStorage.getItem(TOKEN_KEY) || root.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function friendly(err) {
    if (err.status === 401) return "GitHub didn't accept the token. Check it was copied fully and hasn't expired.";
    if (err.status === 403) return "The token isn't allowed to do this. It needs Contents: Read and write (and Actions: Read and write for the update buttons) on " + REPO + ".";
    if (err.status === 409 || err.status === 422) return "The file was changed by someone else since you opened it. Reload the panel to get the latest copy, then make your change again.";
    if (err instanceof TypeError) return "Couldn't reach GitHub. Check the internet connection.";
    return err.message || String(err);
  }

  // ---- Sign in ----

  function showLogin(message) {
    $("login").hidden = false;
    $("panel").hidden = true;
    $("login-error").textContent = message || "";
  }

  function signIn(token, remember) {
    $("login-error").textContent = "";
    $("login-submit").disabled = true;
    var probe = new GitHub(token, REPO, "main");
    probe.check().then(function (info) {
      if (!info.canWrite) throw Object.assign(new Error("This GitHub account can't change " + REPO + "."), { status: 0 });
      who = info;
      return Promise.all(BRANCHES.map(function (b) { return probe.hasApp(b); }));
    }).then(function (has) {
      var available = BRANCHES.filter(function (b, i) { return has[i]; });
      if (!available.length) throw new Error("The Patro app wasn't found on " + BRANCHES.join(" or ") + ".");
      var preferred = null;
      try { preferred = root.localStorage.getItem(BRANCH_KEY); } catch (e) { preferred = null; }
      var branch = available.indexOf(preferred) >= 0 ? preferred : available[0];
      try {
        root.sessionStorage.removeItem(TOKEN_KEY);
        root.localStorage.removeItem(TOKEN_KEY);
        storage(remember).setItem(TOKEN_KEY, token);
      } catch (e) { /* signed in for this page only */ }
      gh = new GitHub(token, REPO, branch);
      openPanel(available);
    }).catch(function (err) {
      showLogin(friendly(err));
    }).then(function () {
      $("login-submit").disabled = false;
    });
  }

  function signOut() {
    if (anyDirty() && !root.confirm("You have unsaved changes. Sign out anyway?")) return;
    try {
      root.sessionStorage.removeItem(TOKEN_KEY);
      root.localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* nothing saved */ }
    gh = null;
    loaded = {};
    showLogin("Signed out.");
  }

  // ---- Panel ----

  function openPanel(branches) {
    $("login").hidden = true;
    $("panel").hidden = false;
    $("who").textContent = "@" + who.login;
    var sel = $("branch");
    sel.replaceChildren.apply(sel, branches.map(function (b) { return h("option", { value: b, text: b }); }));
    sel.value = gh.branch;
    sel.disabled = branches.length < 2;
    var tabs = $("tabs");
    tabs.replaceChildren();
    TABS.forEach(function (pair) {
      tabs.appendChild(h("button", { type: "button", class: "tab", "data-tab": pair[0], text: pair[1].title,
        onclick: function () { showTab(pair[0]); } }));
    });
    tabs.appendChild(h("button", { type: "button", class: "tab", "data-tab": "jobs", text: "Update now", onclick: function () { showTab("jobs"); } }));
    tabs.appendChild(h("button", { type: "button", class: "tab", "data-tab": "help", text: "Help", onclick: function () { showTab("help"); } }));
    showTab(current || "push");
  }

  function anyDirty() {
    return Object.keys(loaded).some(function (k) { return loaded[k] && loaded[k].dirty; });
  }

  function markTabs() {
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      var id = b.getAttribute("data-tab");
      b.setAttribute("aria-selected", String(id === current));
      b.classList.toggle("dirty", !!(loaded[id] && loaded[id].dirty));
    });
  }

  function editorOf(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i][0] === id) return TABS[i][1];
    return null;
  }

  function showTab(id) {
    current = id;
    markTabs();
    var editor = editorOf(id);
    var body = $("body");
    body.replaceChildren();
    $("save-bar").hidden = !editor || !!editor.autoSave;
    if (id === "jobs") return renderJobs(body);
    if (id === "help") return renderHelp(body);
    $("tab-title").textContent = editor.title;
    $("tab-help").textContent = editor.help;
    if (loaded[id]) return renderEditor(id);
    body.appendChild(h("p", { class: "muted", text: "Loading…" }));
    gh.read(editor.path).then(function (file) {
      var model = file.text === null ? JSON.parse(JSON.stringify(editor.empty)) : editor.parse(file.text);
      loaded[id] = { model: model, sha: file.sha, dirty: false };
      if (current === id) renderEditor(id);
    }).catch(function (err) {
      body.replaceChildren(h("p", { class: "error", text: "Couldn't open " + editor.path + ": " + friendly(err) }));
    });
  }

  function renderEditor(id) {
    var editor = editorOf(id);
    var state = loaded[id];
    var box = h("div", { class: "editor" });
    $("body").replaceChildren(box);
    editor.render(box, state.model, function () {
      state.dirty = true;
      markTabs();
      updateSave();
    }, context);
    updateSave();
  }

  function updateSave() {
    var state = loaded[current];
    var editor = editorOf(current);
    if (!state || !editor) return;
    var problems = editor.validate(state.model);
    var list = $("problems");
    list.replaceChildren.apply(list, problems.map(function (p) { return h("li", { text: p }); }));
    list.hidden = !problems.length;
    $("save").disabled = !state.dirty || problems.length > 0;
    $("save-state").textContent = state.dirty ? "Unsaved changes" : "All changes saved";
  }

  function save() {
    var id = current;
    var editor = editorOf(id);
    var state = loaded[id];
    if (!editor || !state || editor.validate(state.model).length) return;
    $("save").disabled = true;
    $("save-state").textContent = "Saving…";
    if (editor.autoSave) toast("Sending…");
    var text = editor.serialize(state.model);
    gh.write(editor.path, text, "Admin panel: update " + editor.title.toLowerCase() + " (@" + who.login + ")", state.sha)
      .then(function (res) {
        state.sha = res.sha;
        state.dirty = false;
        toast(editor.autoSave ? "Sent. Android phones get it within about 15 minutes." : "Saved. Phones get it the next time Patro opens.", "ok");
      }).catch(function (err) {
        toast(friendly(err), "error");
      }).then(function () {
        markTabs();
        updateSave();
      });
  }

  // Shared with the editors.
  var context = {
    uploadImage: function (file) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast("That picture is " + Math.round(file.size / 1024) + " KB; please use one under 1 MB.", "error");
        return Promise.reject(new Error("too big"));
      }
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result).split(",")[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).then(function (base64) {
        var name = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+/, "").slice(-60) || "image";
        var path = "patro/content/ads/" + Date.now() + "-" + name;
        toast("Uploading picture…");
        return gh.writeBase64(path, base64, "Admin panel: upload ad picture (@" + who.login + ")").then(function () {
          toast("Picture uploaded. Save to publish the ad.", "ok");
          return gh.rawUrl(path);
        });
      }).catch(function (err) {
        if (err.message !== "too big") toast(friendly(err), "error");
        throw err;
      });
    },
    // The news job's latest file: per-source results and trending stories.
    newsDoc: function () {
      return fetch(News.NEWS_URLS[0], { cache: "no-store" }).then(function (r) { return r.json(); })
        .catch(function () { return null; });
    },
    // For editors that publish straight away (push notifications).
    save: function () { save(); }
  };

  // ---- Update-now buttons ----

  function renderJobs(body) {
    $("tab-title").textContent = "Update now";
    $("tab-help").textContent = "These jobs also run by themselves (news every 30 minutes, rates every 3 hours) once the app is on the main branch.";
    JOBS.forEach(function (job) {
      var runs = h("ul", { class: "runs" }, [h("li", { class: "muted", text: "Loading recent runs…" })]);
      function loadRuns() {
        gh.runs(job[0]).then(function (list) {
          runs.replaceChildren.apply(runs, (list || []).map(function (r) {
            var result = r.status === "completed" ? r.conclusion : r.status;
            return h("li", {}, [
              h("span", { class: "status " + (result === "success" ? "live" : result === "failure" ? "expired" : "scheduled"), text: result }),
              " " + new Date(r.created_at).toLocaleString() + " · " + r.event + " · ",
              h("a", { href: r.html_url, target: "_blank", rel: "noopener", text: "details" })
            ]);
          }));
          if (!list || !list.length) runs.replaceChildren(h("li", { class: "muted", text: "No runs yet." }));
        }).catch(function (err) {
          runs.replaceChildren(h("li", { class: "error", text: friendly(err) }));
        });
      }
      body.appendChild(h("section", { class: "job" }, [
        h("h3", { text: job[1] }),
        h("p", { class: "muted", text: job[2] }),
        h("button", { type: "button", class: "btn primary", text: job[1], onclick: function (e) {
          e.target.disabled = true;
          gh.runWorkflow(job[0]).then(function () {
            toast("Started. It takes about a minute.", "ok");
            setTimeout(loadRuns, 4000);
          }).catch(function (err) {
            toast(friendly(err), "error");
          }).then(function () { e.target.disabled = false; });
        } }),
        runs
      ]));
      loadRuns();
    });
  }

  function renderHelp(body) {
    $("tab-title").textContent = "Help";
    $("tab-help").textContent = "";
    var tpl = $("help-template");
    body.appendChild(tpl.content.cloneNode(true));
  }

  // ---- Start ----

  function init() {
    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var token = $("token").value.trim();
      if (token) signIn(token, $("remember").checked);
    });
    $("signout").addEventListener("click", signOut);
    $("save").addEventListener("click", save);
    $("branch").addEventListener("change", function (e) {
      if (anyDirty() && !root.confirm("Switching branch drops unsaved changes. Continue?")) {
        e.target.value = gh.branch;
        return;
      }
      gh.branch = e.target.value;
      try { root.localStorage.setItem(BRANCH_KEY, gh.branch); } catch (err) { /* not remembered */ }
      loaded = {};
      showTab(current);
    });
    root.addEventListener("beforeunload", function (e) {
      if (anyDirty()) { e.preventDefault(); e.returnValue = ""; }
    });
    var token = savedToken();
    var remembered = false;
    try { remembered = !!root.localStorage.getItem(TOKEN_KEY); } catch (e) { remembered = false; }
    if (token) signIn(token, remembered);
    else showLogin("");
  }

  init();
})(this);
