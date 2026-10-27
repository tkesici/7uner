/* 7uner – stamps a content hash on every local CSS and JS URL, e.g.
   css/style.css?v=3f9a1c2e, so a deploy can never mix new HTML with an old
   stylesheet or script still sitting in a cache (Cloudflare keeps them for
   hours). Run before committing; the pre-commit hook in tools/hooks does it:

     node tools/stamp-assets.js

   It updates, in this order:
   - js/exercises.js: practiceFilesVersion, a hash of practice/*.gp, which
     Practice and the service worker add to the exercise file URLs
   - index.html: the ?v= of each <script src> and <link href> under js/ or css/
   - sw.js: the same ?v= on its precache list and importScripts, and the
     cache name, so the service worker updates and drops the old cache */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const hash = (data) => crypto.createHash("sha1").update(data).digest("hex").slice(0, 8);
const fileHash = (f) => hash(fs.readFileSync(path.join(ROOT, f)));
let changed = 0;
function write(f, text) {
    if (read(f) === text) return;
    fs.writeFileSync(path.join(ROOT, f), text);
    changed++;
    console.log("stamped " + f);
}

// 1. the exercise files
const gp = fs.readdirSync(path.join(ROOT, "practice")).filter((f) => f.endsWith(".gp")).sort();
const gpVersion = hash(gp.map((f) => f + ":" + fileHash("practice/" + f)).join("\n"));
const ex = read("js/exercises.js");
if (!/practiceFilesVersion = "[0-9a-f]*"/.test(ex)) throw new Error("js/exercises.js has no practiceFilesVersion");
write("js/exercises.js", ex.replace(/practiceFilesVersion = "[0-9a-f]*"/, 'practiceFilesVersion = "' + gpVersion + '"'));

// 2. pages and 3. the service worker
const ASSET = /((?:js|css)\/[\w.-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(?=")/g;
const stamp = (text) => text.replace(ASSET, (m, f) => f + "?v=" + fileHash(f));
write("index.html", stamp(read("index.html")));
const sw = stamp(read("sw.js"));
const stamps = (sw.match(/\?v=[0-9a-f]+/g) || []).join("") + gpVersion;
write("sw.js", sw.replace(/const CACHE = "7uner-[\w-]+";/, 'const CACHE = "7uner-' + hash(stamps) + '";'));

console.log(changed ? "Done." : "Everything was already stamped.");
