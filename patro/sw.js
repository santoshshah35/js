/*
 * Offline support for the installed web app (iPhone "Add to Home Screen",
 * Android Chrome "Install app"). The app's own files are cached on install and
 * served cache-first; requests to other sites are left alone.
 * Bump VERSION whenever any cached file changes.
 */
"use strict";

var VERSION = "patro-v3";
var FILES = [
  "./",
  "index.html",
  "styles.css",
  "ui/core.js",
  "ui/calendar.js",
  "ui/upcoming.js",
  "ui/rashifal.js",
  "ui/converter.js",
  "ui/markets.js",
  "ui/feed.js",
  "ui/shell.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-512.png",
  "lib/bs-data.js",
  "lib/bs.js",
  "lib/tithi.js",
  "lib/events.js",
  "lib/lunar.js",
  "lib/upcoming.js",
  "lib/rashifal.js",
  "lib/rates.js",
  "lib/feed.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) { return cache.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(function (hit) {
    return hit || fetch(event.request);
  }));
});
