/* 7uner – service worker: keeps the app usable offline.
   Own files: network first, so a new deploy shows up on the next visit,
   with the cached copy as the fallback.
   alphaTab (pinned version on jsDelivr) and Google Fonts: cache first.
   The ?v= hashes and the cache name are written by tools/stamp-assets.js. */
"use strict";

const CACHE = "7uner-92966bc1";
// the Practice exercise files, listed in js/exercises.js: techniques, and
// the first position of each scale and mode (the others are cached when used)
importScripts("js/exercises.js?v=745860bb");
const PRACTICE = Object.keys(self.practiceCatalogue).flatMap((c) => self.practiceCatalogue[c].map((x) => (x.iv ? x.id + "-p1" : x.id)))
    .map((id) => "practice/" + id + ".gp?v=" + self.practiceFilesVersion);
const SHELL = [
  "./", "index.html", "css/style.css?v=da11e839", "favicon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png", "manifest.webmanifest",
  "js/tuner.js?v=c65b246a", "js/voice.js?v=722d6e1d", "js/pitch.js?v=618cee19", "js/amp.js?v=be2acf6a", "js/metronome.js?v=20109cc0", "js/alphatab.js?v=146457db", "js/exercises.js?v=745860bb", "js/practice.js?v=f5782755", "js/tab-studio.js?v=62bc4dd9", "js/app.js?v=2aa64581"
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
