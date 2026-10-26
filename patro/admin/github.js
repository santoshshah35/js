/*
 * The few GitHub API calls the admin panel needs: read and write a file in
 * the repository, and start a workflow. Every change is a normal commit, so
 * the repository's history shows who changed what and can undo it.
 */
(function (root) {
  "use strict";

  var API = "https://api.github.com";

  function GitHub(token, repo, branch) {
    this.token = token;
    this.repo = repo;
    this.branch = branch;
  }

  GitHub.prototype.call = function (path, options) {
    var opts = options || {};
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: {
        "Authorization": "Bearer " + this.token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return null; }).then(function (json) {
        if (res.ok) return json;
        var err = new Error((json && json.message) || ("HTTP " + res.status));
        err.status = res.status;
        throw err;
      });
    });
  };

  // UTF-8 text to and from base64, for file contents.
  function encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function decode(b64) {
    var bin = atob(b64.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function contentsPath(repo, path) {
    return "/repos/" + repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  }

  /** Who the token belongs to, and whether it can write to the repository. */
  GitHub.prototype.check = function () {
    var self = this;
    return this.call("/user").then(function (user) {
      return self.call("/repos/" + self.repo).then(function (repo) {
        return { login: user.login, canWrite: !!(repo.permissions && repo.permissions.push), defaultBranch: repo.default_branch };
      });
    });
  };

  /** True when the branch has the Patro app on it. */
  GitHub.prototype.hasApp = function (branch) {
    return this.call(contentsPath(this.repo, "patro/content/feed.json") + "?ref=" + encodeURIComponent(branch))
      .then(function () { return true; }, function () { return false; });
  };

  /** A file's text and version (sha), or null text when it doesn't exist yet. */
  GitHub.prototype.read = function (path) {
    return this.call(contentsPath(this.repo, path) + "?ref=" + encodeURIComponent(this.branch)).then(function (f) {
      return { text: decode(f.content), sha: f.sha };
    }, function (err) {
      if (err.status === 404) return { text: null, sha: null };
      throw err;
    });
  };

  /**
   * Commits a file. sha is the version that was read; GitHub refuses the
   * write if someone changed the file since, so nothing is overwritten.
   */
  GitHub.prototype.write = function (path, text, message, sha) {
    return this.writeBase64(path, encode(text), message, sha);
  };

  GitHub.prototype.writeBase64 = function (path, base64, message, sha) {
    var body = { message: message, content: base64, branch: this.branch };
    if (sha) body.sha = sha;
    return this.call(contentsPath(this.repo, path), { method: "PUT", body: body }).then(function (res) {
      return { sha: res.content.sha, commit: res.commit.sha };
    });
  };

  /** Starts a workflow (by file name) on the panel's branch. */
  GitHub.prototype.runWorkflow = function (file) {
    return this.call("/repos/" + this.repo + "/actions/workflows/" + file + "/dispatches",
      { method: "POST", body: { ref: this.branch } });
  };

  /** The latest runs of a workflow. */
  GitHub.prototype.runs = function (file) {
    return this.call("/repos/" + this.repo + "/actions/workflows/" + file + "/runs?per_page=3")
      .then(function (r) { return r.workflow_runs; });
  };

  /** Raw address of a file on the panel's branch, for images in ads. */
  GitHub.prototype.rawUrl = function (path) {
    return "https://raw.githubusercontent.com/" + this.repo + "/" + this.branch + "/" + path;
  };

  root.PatroGitHub = GitHub;
})(this);
