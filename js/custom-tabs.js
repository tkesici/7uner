/* 7uner – your tabs
   Opens Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3) and MusicXML files with
   alphaTab (https://alphatab.net, MPL-2.0), loaded from jsDelivr only when the
   first file is opened. Files are kept in this browser (IndexedDB) and are
   never uploaded anywhere. */
(function () {
    "use strict";

    const AT_VERSION = "1.8.4";
    const AT_BASE = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@" + AT_VERSION + "/dist/";
    const MAX_BYTES = 20 * 1024 * 1024;
    const FORMATS = {
        gp: "Guitar Pro 7–8", gpx: "Guitar Pro 6", gp5: "Guitar Pro 5", gp4: "Guitar Pro 4", gp3: "Guitar Pro 3",
        xml: "MusicXML", musicxml: "MusicXML", mxl: "MusicXML"
    };

    const $ = (id) => document.getElementById(id);
    const el = {
        builtin: $("builtinPlayer"), player: $("customPlayer"), songList: $("songList"),
        file: $("tabFile"), drop: $("tabDrop"), list: $("tabList"),
        title: $("cTitle"), meta: $("cMeta"), status: $("cStatus"), time: $("cTime"),
        go: $("cGo"), stop: $("cStop"), pct: $("cPct"), bpm: $("cBpm"), speed: $("cSpeed"),
        track: $("cTrack"), solo: $("cSolo"), loop: $("cLoop"), click: $("cClick"), count: $("cCount"), notation: $("cScore"),
        wrap: $("cWrap"), score: $("cScoreEl")
    };

    const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
    const sizeOf = (b) => (b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB");
    const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

    /* ---------- storage (IndexedDB, with an in-memory fallback) ---------- */
    const DB = "7uner", STORE = "tabs";
    let memory = null; // used when IndexedDB is unavailable (e.g. some private modes)
    function openDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
            const r = indexedDB.open(DB, 1);
            r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "id" }); };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }
    function run(mode, fn) {
        if (memory) return Promise.resolve(fn(null));
        return openDb().then((db) => new Promise((resolve, reject) => {
            const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
            t.oncomplete = () => resolve(req ? req.result : undefined);
            t.onerror = () => reject(t.error);
        })).catch((e) => { memory = memory || []; return fn(null); });
    }
    const allTabs = () => run("readonly", (s) => (s ? s.getAll() : { result: memory.slice() })).then((r) => (r && r.result) || r || []);
    const putTab = (rec) => run("readwrite", (s) => {
        if (s) return s.put(rec);
        memory = memory.filter((x) => x.id !== rec.id).concat([rec]);
        return null;
    });
    const delTab = (id) => run("readwrite", (s) => {
        if (s) return s.delete(id);
        memory = memory.filter((x) => x.id !== id);
        return null;
    });

    /* ---------- list ---------- */
    let tabs = [], current = null;

    function renderList() {
        el.list.innerHTML = "";
        if (!tabs.length) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "No tabs yet.";
            el.list.appendChild(li);
            return;
        }
        tabs.slice().sort((a, b) => b.added - a.added).forEach((rec) => {
            const li = document.createElement("li");
            li.className = "mytab";
            const b = document.createElement("button");
            b.className = "pick";
            b.innerHTML = '<span class="no">GP</span><span class="nm"></span><span class="st"></span>';
            b.querySelector(".no").textContent = /xml/.test(extOf(rec.name)) ? "XML" : "GP";
            b.querySelector(".nm").textContent = rec.title || rec.name;
            b.querySelector(".st").textContent = [rec.artist, FORMATS[extOf(rec.name)] || "Tab", sizeOf(rec.size)].filter(Boolean).join(", ");
            if (current && current.id === rec.id) b.setAttribute("aria-current", "true");
            b.addEventListener("click", () => open(rec));
            const del = document.createElement("button");
            del.className = "del";
            del.textContent = "×";
            del.setAttribute("aria-label", "Remove " + (rec.title || rec.name));
            del.addEventListener("click", () => remove(rec));
            li.appendChild(b); li.appendChild(del);
            el.list.appendChild(li);
        });
    }

    function refresh() { return allTabs().then((list) => { tabs = list; renderList(); }); }

    function addFiles(files) {
        const picked = Array.from(files || []);
        if (!picked.length) return;
        const bad = picked.filter((f) => !FORMATS[extOf(f.name)]);
        const big = picked.filter((f) => f.size > MAX_BYTES);
        const ok = picked.filter((f) => FORMATS[extOf(f.name)] && f.size <= MAX_BYTES);
        if (bad.length || big.length) {
            const why = bad.length ? "Unsupported file type: " + bad.map((f) => f.name).join(", ") + ". Use .gp, .gpx, .gp5, .gp4, .gp3 or MusicXML." : "";
            const why2 = big.length ? " Too large (over 20 MB): " + big.map((f) => f.name).join(", ") + "." : "";
            showPanel();
            setStatus((why + why2).trim(), true);
        }
        let first = null;
        Promise.all(ok.map((f) => f.arrayBuffer().then((data) => {
            const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: f.name, size: f.size, added: Date.now(), data };
            if (!first) first = rec;
            return putTab(rec);
        }))).then(refresh).then(() => { if (first) open(first); });
    }

    function remove(rec) {
        if (!confirm("Remove “" + (rec.title || rec.name) + "” from this browser?")) return;
        if (current && current.id === rec.id) deactivate();
        delTab(rec.id).then(refresh);
    }

    /* ---------- alphaTab ---------- */
    let api = null, loading = null, playing = false, ready = false;

    function loadScript() {
        if (window.alphaTab) return Promise.resolve();
        if (loading) return loading;
        loading = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = AT_BASE + "alphaTab.min.js";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => { loading = null; reject(new Error("script")); };
            document.head.appendChild(s);
        });
        return loading;
    }

    const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const colors = () => ({
        mainGlyphColor: cssVar("--ink"), secondaryGlyphColor: cssVar("--muted"), scoreInfoColor: cssVar("--ink"),
        staffLineColor: cssVar("--line"), barSeparatorColor: cssVar("--muted"), barNumberColor: cssVar("--muted")
    });

    function createApi() {
        el.score.innerHTML = "";
        api = new window.alphaTab.AlphaTabApi(el.score, {
            core: { scriptFile: AT_BASE + "alphaTab.min.js", fontDirectory: AT_BASE + "font/" },
            display: { staveProfile: el.notation.checked ? "ScoreTab" : "Tab", layoutMode: "Page", resources: colors() },
            player: {
                // the script-processor output needs no extra module download, so it also
                // works where loading an audio worklet from the CDN is blocked
                playerMode: "EnabledSynthesizer", outputMode: "WebAudioScriptProcessor",
                soundFont: AT_BASE + "soundfont/sonivox.sf2", scrollElement: el.wrap,
                enableCursor: true, enableAnimatedBeatCursor: true, enableUserInteraction: true
            }
        });
        ready = false; playing = false;

        api.scoreLoaded.on((score) => {
            el.title.textContent = score.title || (current ? current.name : "Untitled");
            const bits = [score.artist, score.album].filter(Boolean);
            el.meta.textContent = (bits.length ? bits.join(", ") + ", " : "") + score.tracks.length + (score.tracks.length === 1 ? " track" : " tracks") + ", " + Math.round(score.tempo) + " BPM";
            el.track.innerHTML = score.tracks.map((t, i) => '<option value="' + i + '">' + (i + 1) + ". " + escapeHtml(t.name || "Track " + (i + 1)) + "</option>").join("");
            el.track.value = "0";
            applySpeed();
            if (current && (current.title !== score.title || current.artist !== score.artist)) {
                current.title = score.title || ""; current.artist = score.artist || "";
                putTab(current).then(refresh);
            }
        });
        api.renderStarted.on(() => { if (!ready) setStatus("Drawing the tab…"); });
        api.renderFinished.on(() => { if (el.status.dataset.kind === "info" && /Drawing/.test(el.status.textContent)) setStatus(ready ? "" : "Loading sounds…"); });
        api.soundFontLoad.on((e) => { if (e.total) setStatus("Loading sounds… " + Math.round((e.loaded / e.total) * 100) + "%"); });
        api.playerReady.on(() => {
            ready = true; el.go.disabled = false; el.stop.disabled = false;
            setStatus("");
            applyPlayerOptions();
        });
        api.playerStateChanged.on((e) => {
            playing = e.state === 1;
            el.go.textContent = playing ? "Pause" : "Play";
            el.go.classList.toggle("stop", playing);
        });
        api.playerPositionChanged.on((e) => { el.time.textContent = mmss(e.currentTime) + " / " + mmss(e.endTime); });
        api.error.on(() => { setStatus("Couldn’t open this file. Supported formats: Guitar Pro 3–8 (.gp3, .gp4, .gp5, .gpx, .gp) and MusicXML.", true); });
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

    function setStatus(text, isError) {
        el.status.textContent = text;
        el.status.dataset.kind = isError ? "error" : "info";
        el.status.classList.toggle("err", !!isError);
    }

    function applySpeed() {
        const pct = +el.speed.value;
        el.pct.textContent = pct + "%";
        const base = api && api.score ? api.score.tempo : 0;
        el.bpm.textContent = base ? Math.round((base * pct) / 100) + " BPM" : "";
        if (api) api.playbackSpeed = pct / 100;
    }
    function applyPlayerOptions() {
        if (!api) return;
        api.isLooping = el.loop.checked;
        api.metronomeVolume = el.click.checked ? 1 : 0;
        api.countInVolume = el.count.checked ? 1 : 0;
        applySpeed();
        applySolo();
    }
    function applySolo() {
        if (!api || !api.score || !ready) return;
        const all = api.score.tracks, t = all[+el.track.value] || all[0];
        api.changeTrackSolo(all, false);
        if (el.solo.checked && t) api.changeTrackSolo([t], true);
    }

    /* ---------- open / close ---------- */
    function showPanel() {
        if (window.songStudies) window.songStudies.pause();
        el.builtin.hidden = true;
        el.player.hidden = false;
        el.songList.querySelectorAll("[aria-current]").forEach((b) => b.removeAttribute("aria-current"));
    }

    function open(rec) {
        current = rec;
        showPanel();
        renderList();
        el.title.textContent = rec.title || rec.name;
        el.meta.textContent = "";
        el.time.textContent = "";
        el.go.disabled = true; el.stop.disabled = true;
        el.go.textContent = "Play"; el.go.classList.remove("stop");
        setStatus(window.alphaTab ? "Opening…" : "Loading the tab player…");
        loadScript().then(() => {
            if (!api) createApi();
            else { api.stop(); ready = api.isReadyForPlayback; }
            setStatus("Opening…");
            const ok = api.load(new Uint8Array(rec.data), [0]);
            if (ok === false) setStatus("Couldn’t open this file.", true);
            if (ready) { el.go.disabled = false; el.stop.disabled = false; }
        }).catch(() => setStatus("Couldn’t load the tab player. Check your internet connection and try again.", true));
    }

    function pause() { if (api && playing) api.pause(); }

    function deactivate() {
        pause();
        current = null;
        el.player.hidden = true;
        el.builtin.hidden = false;
        renderList();
    }

    /* ---------- wiring ---------- */
    el.file.addEventListener("change", () => { addFiles(el.file.files); el.file.value = ""; });
    ["dragenter", "dragover"].forEach((t) => el.drop.addEventListener(t, (e) => { e.preventDefault(); el.drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => el.drop.addEventListener(t, () => el.drop.classList.remove("over")));
    el.drop.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer && e.dataTransfer.files); });

    el.go.addEventListener("click", () => { if (api && ready) api.playPause(); });
    el.stop.addEventListener("click", () => { if (api && ready) api.stop(); });
    el.speed.addEventListener("input", applySpeed);
    document.querySelectorAll("[data-cspeed]").forEach((b) => b.addEventListener("click", () => { el.speed.value = b.dataset.cspeed; applySpeed(); }));
    el.track.addEventListener("change", () => {
        if (!api || !api.score) return;
        const t = api.score.tracks[+el.track.value];
        if (t) api.renderTracks([t]);
        applySolo();
    });
    el.solo.addEventListener("change", applySolo);
    el.loop.addEventListener("change", applyPlayerOptions);
    el.click.addEventListener("change", applyPlayerOptions);
    el.count.addEventListener("change", applyPlayerOptions);
    el.notation.addEventListener("change", () => {
        if (!api) return;
        api.settings.display.staveProfile = el.notation.checked ? window.alphaTab.StaveProfile.ScoreTab : window.alphaTab.StaveProfile.Tab;
        api.updateSettings();
        api.render();
    });
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || !el.player.offsetParent || !api || !ready) return;
        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        api.playPause();
    });
    // follow the site's light/dark theme
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (!api || !window.alphaTab) return;
            const c = colors(), r = api.settings.display.resources, C = window.alphaTab.model.Color;
            Object.keys(c).forEach((k) => { const v = C.fromJson(c[k]); if (v) r[k] = v; });
            api.updateSettings();
            api.render();
        });
    }

    refresh();

    window.customTabs = { pause, deactivate, isActive: () => !!current };
})();