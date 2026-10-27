/* 7uner – service worker: keeps the app usable offline.
   Own files: network first, so a new deploy shows up on the next visit,
   with the cached copy as the fallback.
   alphaTab (pinned version on jsDelivr) and Google Fonts: cache first. */
"use strict";

const CACHE = "7uner-v1";
const SHELL = [
  "./", "index.html", "css/style.css", "favicon.svg", "manifest.webmanifest",
  "js/tuner.js", "js/pitch.js", "js/practice.js", "js/tab-studio.js", "js/app.js"
];
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
