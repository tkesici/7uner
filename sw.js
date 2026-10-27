/* 7uner – service worker: keeps the app usable offline.
   Own files: network first, so a new deploy shows up on the next visit,
   with the cached copy as the fallback.
   alphaTab (pinned version on jsDelivr) and Google Fonts: cache first.
   The ?v= hashes and the cache name are written by tools/stamp-assets.js. */
"use strict";

const CACHE = "7uner-cde091e3";
// the Practice exercise files, listed in js/exercises.js
importScripts("js/exercises.js?v=5d9b570f");
const PRACTICE = Object.keys(self.practiceCatalogue).flatMap((c) => self.practiceCatalogue[c].map((x) => x.id))
    .map((id) => "practice/" + id + ".gp?v=" + self.practiceFilesVersion);
const SHELL = [
  "./", "index.html", "css/style.css?v=7d8680c3", "favicon.svg", "manifest.webmanifest",
  "js/tuner.js?v=790cbe63", "js/pitch.js?v=36c33db7", "js/amp.js?v=eb9d514e", "js/metronome.js?v=a2ecc09e", "js/alphatab.js?v=ea58a266", "js/exercises.js?v=5d9b570f", "js/practice.js?v=f8b4a7bf", "js/tab-studio.js?v=68955429", "js/app.js?v=18d89ff3"
].concat(PRACTICE);
const CDN = ["https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

function put(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then((res) => put(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true })
            .then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined))));
    return;
  }
  if (CDN.includes(url.origin)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
  }
});
