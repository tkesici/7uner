/* 7uner – Tab studio
   Opens Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3) and MusicXML files, plays
   them with speed, loop and volume controls, and has an edit mode whose
   result can be downloaded as a Guitar Pro 7 (.gp) file.

   Rendering, playback and file import/export use alphaTab
   (https://alphatab.net, MPL-2.0), loaded by alphatab.js when the first
   file is opened. Files are kept in this browser (IndexedDB)
   and never uploaded anywhere. Only guitar tracks are shown and edited;
   drums, bass and other instruments play as backing. */
(function () {
    "use strict";

    const MAX_BYTES = 20 * 1024 * 1024;
    const MAX_FRET = 29;
    const FORMATS = {
        gp: "Guitar Pro 7–8", gpx: "Guitar Pro 6", gp5: "Guitar Pro 5", gp4: "Guitar Pro 4", gp3: "Guitar Pro 3",
        xml: "MusicXML", musicxml: "MusicXML", mxl: "MusicXML"
    };

    const $ = (id) => document.getElementById(id);
    const el = {
        list: $("tabList"), file: $("tabFile"), empty: $("tabEmpty"), player: $("tabPlayer"),
        title: $("cTitle"), meta: $("cMeta"), notice: $("cNotice"), status: $("cStatus"), time: $("cTime"),
        edit: $("cEdit"), editPill: $("cEditPill"), dirty: $("cDirty"), save: $("cSave"), download: $("cDownload"),
        go: $("cGo"), stop: $("cStop"), pct: $("cPct"), bpm: $("cBpm"), speed: $("cSpeed"),
        track: $("cTrack"), click: $("cClick"), notation: $("cScore"),
        loopInfo: $("cLoopInfo"), loopPill: $("cLoopPill"),
        eBar: $("eBar"), ePos: $("ePos"), eFret: $("eFret"),
        wrap: $("cWrap"), score: $("cScoreEl")
    };
    const vol = { master: $("v_master"), guitar: $("v_guitar"), backing: $("v_backing") };

    const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
    const baseName = (name) => name.replace(/\.[^.]+$/, "");
    const sizeOf = (b) => (b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB");
    const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const AT = () => window.alphaTab;
    const isOn = (b) => b.getAttribute("aria-pressed") === "true";
    const setOn = (b, on) => b.setAttribute("aria-pressed", on ? "true" : "false");

    /* ---------- preferences ---------- */
    const PKEY = "7uner.tabstudio.v1";
    let prefs = { speed: 100, master: 100, guitar: 100, backing: 80, muted: {}, click: false };
    try { const o = JSON.parse(localStorage.getItem(PKEY) || "null"); if (o) prefs = Object.assign(prefs, o); } catch (e) {}
    const savePrefs = () => { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {} };

    /* ---------- storage (IndexedDB, with an in-memory fallback) ---------- */
    const DB = "7uner", STORE = "tabs";
    let memory = null;
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
        })).catch(() => { memory = memory || []; return fn(null); });
    }
    const allTabs = () => run("readonly", (s) => (s ? s.getAll() : { result: memory.slice() })).then((r) => (r && r.result) || r || []);
    const putTab = (rec) => run("readwrite", (s) => { if (s) return s.put(rec); memory = memory.filter((x) => x.id !== rec.id).concat([rec]); return null; });
    const delTab = (id) => run("readwrite", (s) => { if (s) return s.delete(id); memory = memory.filter((x) => x.id !== id); return null; });
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    /* ---------- file list ---------- */
    let tabs = [], current = null;

    function renderList() {
        el.list.innerHTML = "";
        if (!tabs.length) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "No files yet.";
            el.list.appendChild(li);
            return;
        }
        tabs.slice().sort((a, b) => b.added - a.added).forEach((rec) => {
            const li = document.createElement("li");
            li.className = "mytab";
            const b = document.createElement("button");
            b.className = "pick";
            b.innerHTML = '<span class="no"></span><span class="nm"></span><span class="st"></span>';
            b.querySelector(".no").textContent = /xml/.test(extOf(rec.name)) ? "XML" : "GP";
            b.querySelector(".nm").textContent = (rec.title || baseName(rec.name)) + (rec.edited ? " (edited)" : "");
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
        const big = picked.filter((f) => FORMATS[extOf(f.name)] && f.size > MAX_BYTES);
        const ok = picked.filter((f) => FORMATS[extOf(f.name)] && f.size <= MAX_BYTES);
        const problems = [];
        if (bad.length) problems.push("Not a supported file: " + bad.map((f) => f.name).join(", ") + ". Use .gp, .gpx, .gp5, .gp4, .gp3 or MusicXML.");
        if (big.length) problems.push("Too large (over 20 MB): " + big.map((f) => f.name).join(", ") + ".");
        if (problems.length) alert(problems.join("\n"));
        let first = null;
        Promise.all(ok.map((f) => f.arrayBuffer().then((data) => {
            const rec = { id: newId(), name: f.name, size: f.size, added: Date.now(), data };
            if (!first) first = rec;
            return putTab(rec);
        }))).then(refresh).then(() => { if (first) open(first); });
    }

    function remove(rec) {
        if (!confirm("Remove “" + (rec.title || rec.name) + "” from this browser?")) return;
        if (current && current.id === rec.id) close();
        delTab(rec.id).then(refresh);
    }

    /* ---------- alphaTab ---------- */
    let api = null, playing = false, ready = false;
    let guitarTracks = [], trackIdx = 0;

    function setStatus(text, isError) {
        el.status.textContent = text || "";
        el.status.classList.toggle("err", !!isError);
    }

    function createApi() {
        el.score.innerHTML = "";
        const settings = window.at7.baseSettings(el.wrap);
        settings.display.staveProfile = isOn(el.notation) ? "ScoreTab" : "Tab";
        api = new (AT().AlphaTabApi)(el.score, settings);
        ready = false; playing = false;

        api.scoreLoaded.on(onScoreLoaded);
        api.renderStarted.on(() => { if (!ready && !el.status.classList.contains("err")) setStatus("Drawing the tab…"); });
        api.renderFinished.on(onRenderFinished);
        api.soundFontLoad.on((e) => { if (e.total && !ready) setStatus("Loading sounds… " + Math.round((e.loaded / e.total) * 100) + "%"); });
        api.playerReady.on(() => {
            ready = true;
            el.go.disabled = false; el.stop.disabled = false;
            if (!el.status.classList.contains("err")) setStatus("");
            applyPlayerOptions();
            applyVolumes();
        });
        api.playerStateChanged.on((e) => {
            playing = e.state === 1;
            el.go.textContent = playing ? "Pause" : "Play";
            el.go.classList.toggle("stop", playing);
        });
        api.playerPositionChanged.on((e) => {
            el.time.textContent = mmss(e.currentTime) + " / " + mmss(e.endTime);
            window.metronome.sync(metro, e.currentTick);
        });
        api.playbackRangeHighlightChanged.on(onRangeHighlight);
        api.playbackRangeChanged.on((e) => setLoopState(!!(e && e.playbackRange)));
        api.renderStarted.on(() => { rendering = true; });
        api.noteMouseDown.on(onNoteDown);
        api.beatMouseDown.on(onBeatDown);
        api.error.on(() => { setStatus("Couldn’t open this file. Supported formats: Guitar Pro 3–8 (.gp3, .gp4, .gp5, .gpx, .gp) and MusicXML.", true); });
    }

    /* ---------- tracks ---------- */
    function trackKind(t) {
        const st = t.staves[0], prog = t.playbackInfo ? t.playbackInfo.program : -1;
        if (st.isPercussion) return "drums";
        const strings = st.tuning ? st.tuning.length : 0;
        if ((prog >= 32 && prog <= 39) || (strings > 0 && strings < 6)) return "bass";
        if (strings >= 6) return "guitar";
        return "other";
    }

    function onScoreLoaded(score) {
        el.title.textContent = score.title || (current ? baseName(current.name) : "Untitled");
        const bits = [score.artist, score.album].filter(Boolean);
        el.meta.textContent = (bits.length ? bits.join(", ") + ", " : "") + score.masterBars.length + " bars, " + Math.round(score.tempo) + " BPM";

        guitarTracks = score.tracks.filter((t) => trackKind(t) === "guitar");
        const others = { drums: 0, bass: 0, other: 0 };
        score.tracks.forEach((t) => { const k = trackKind(t); if (k !== "guitar") others[k]++; });
        const parts = [];
        if (others.drums) parts.push("drums");
        if (others.bass) parts.push("bass");
        if (others.other) parts.push(others.other === 1 ? "another instrument" : "other instruments");
        if (!guitarTracks.length) {
            el.notice.hidden = false;
            el.notice.textContent = "This file has no guitar tracks. 7uner supports guitar tabs only.";
        } else if (parts.length) {
            el.notice.hidden = false;
            el.notice.textContent = "This file also contains " + listJoin(parts) + ". 7uner supports guitar tracks only: those parts play along as backing (use the Backing volume) but can’t be shown or edited.";
        } else el.notice.hidden = true;

        el.track.innerHTML = guitarTracks.map((t, i) => '<option value="' + i + '">' + escapeHtml(t.name || "Guitar " + (i + 1)) + " (" + t.staves[0].tuning.length + " strings)</option>").join("");
        el.track.disabled = guitarTracks.length < 2;
        trackIdx = 0;

        loopBars = null; setLoopState(false); drawLoopMarks(null);

        if (guitarTracks.length && score.tracks[0] !== guitarTracks[0]) api.renderTracks([guitarTracks[0]]);
        applySpeed();
        applyVolumes();
        ed.beat = null; ed.undo = []; ed.redo = []; setDirty(false);

        if (current && (current.title !== (score.title || "") || current.artist !== (score.artist || ""))) {
            current.title = score.title || ""; current.artist = score.artist || "";
            putTab(current).then(refresh);
        }
    }
    const listJoin = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
    const curTrack = () => guitarTracks[trackIdx] || null;

    /* ---------- playback options ---------- */
    function applySpeed() {
        const pct = +el.speed.value;
        el.pct.textContent = pct + "%";
        const base = api && api.score ? api.score.tempo : 0;
        el.bpm.textContent = base ? Math.round((base * pct) / 100) + " BPM" : "";
        if (api) api.playbackSpeed = pct / 100;
        prefs.speed = pct; savePrefs();
    }
    function applyPlayerOptions() {
        prefs.click = isOn(el.click); savePrefs();
        if (!api) return;
        api.isLooping = loopOn;
        api.metronomeVolume = prefs.click ? window.metronome.level() : 0;
        api.countInVolume = window.metronome.countIn() ? window.metronome.level() : 0; // the metronome’s switch
    }

    /* the metronome (metronome.js) shows the playing tempo; sliding its
       weight sets the speed relative to the song’s own tempo */
    const baseTempo = () => (api && api.score ? api.score.tempo : 0);
    const metro = {
        bpm: () => (baseTempo() ? (baseTempo() * +el.speed.value) / 100 : null),
        setBpm(v) { el.speed.value = Math.max(25, Math.min(125, Math.round((v / baseTempo()) * 100))); applySpeed(); },
        get range() { return [Math.ceil(baseTempo() * 0.25), Math.floor(baseTempo() * 1.25)]; },
        playing: () => playing
    };
    function level(key) { return prefs.muted[key] ? 0 : prefs[key] / 100; }
    function applyVolumes() {
        document.querySelectorAll(".mute").forEach((b) => b.setAttribute("aria-pressed", prefs.muted[b.dataset.mix] ? "true" : "false"));
        Object.keys(vol).forEach((k) => { vol[k].value = prefs[k]; vol[k].closest(".mix").classList.toggle("muted", !!prefs.muted[k]); });
        if (!api || !api.score) return;
        api.masterVolume = level("master");
        const g = curTrack();
        if (g) api.changeTrackVolume([g], level("guitar"));
        const rest = api.score.tracks.filter((t) => t !== g);
        if (rest.length) api.changeTrackVolume(rest, level("backing"));
    }

    /* ---------- loop ----------
       Dragging across bars sets a playback range, which alphaTab loops; a click
       in the tab clears it. The Loop chip only reports that state. */
    let loopBars = null, loopOn = false, rendering = false;

    function setLoopState(on) {
        loopOn = on;
        el.loopInfo.classList.toggle("on", on);
        el.loopPill.textContent = on ? "ON" : "OFF";
        if (api) api.isLooping = on;
        if (!on) { loopBars = null; drawLoopMarks(null); }
    }
    function beatsForBars(a, b) {
        const t = curTrack();
        if (!t) return null;
        const bars = t.staves[0].bars, first = bars[a - 1], last = bars[b - 1];
        if (!first || !last) return null;
        const fb = first.voices[0].beats, lb = last.voices[0].beats;
        return { start: fb[0], end: lb[lb.length - 1] };
    }
    function onRangeHighlight(e) {
        if (e && e.startBeat && e.endBeat) {
            loopBars = { a: e.startBeat.voice.bar.index + 1, b: e.endBeat.voice.bar.index + 1 };
            drawLoopMarks(e.highlightBlocks);
        } else if (!rendering) {
            drawLoopMarks(null);
        }
    }

    const LOOP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';
    function layer(cls) {
        let l = el.score.querySelector(":scope > ." + cls);
        if (!l) { l = document.createElement("div"); l.className = cls; el.score.appendChild(l); }
        return l;
    }
    function drawLoopMarks(blocks) {
        const l = layer("looplayer");
        l.innerHTML = "";
        if (!blocks || !blocks.length) return;
        const first = blocks[0], last = blocks[blocks.length - 1];
        const mark = (cls, x, y, h, title) => {
            const m = document.createElement("div");
            m.className = "loopmark " + cls;
            m.style.left = x + "px"; m.style.top = y + "px"; m.style.height = h + "px";
            m.innerHTML = '<span class="lm-bars"></span><span class="lm-dots"><i></i><i></i></span><span class="lm-badge" title="' + title + '">' + LOOP_ICON + "</span>";
            l.appendChild(m);
        };
        mark("start", first.x, first.y, first.h, "Loop start");
        mark("end", last.x + last.w, last.y, last.h, "Loop end");
    }

    /* ---------- edit mode ---------- */
    const ed = { on: false, beat: null, string: 1, undo: [], redo: [], dirty: false, typed: "", typedAt: 0, lastY: null };

    const nStrings = () => { const t = curTrack(); return t ? t.staves[0].tuning.length : 6; };
    const noteAt = (beat, s) => (beat ? beat.notes.find((n) => n.string === s) || null : null);

    function setDirty(on) {
        ed.dirty = on;
        el.dirty.hidden = !on;
        el.save.disabled = !on;
    }

    function setEdit(on) {
        if (on && !curTrack()) return;
        ed.on = on;
        el.edit.setAttribute("aria-pressed", on ? "true" : "false");
        el.editPill.textContent = on ? "ON" : "OFF";
        el.eBar.hidden = !on;
        el.player.classList.toggle("editing", on);
        if (on) {
            if (api && playing) api.pause();
            if (isOn(el.notation)) { setOn(el.notation, false); applyNotation(); }
            el.notation.disabled = true;
            if (!ed.beat) {
                const t = curTrack();
                ed.beat = t.staves[0].bars[0].voices[0].beats[0];
                ed.string = nStrings();
            }
        } else {
            el.notation.disabled = false;
        }
        drawCursor();
        updateEditBar();
    }

    function commit(doFn, undoFn) {
        doFn();
        ed.undo.push({ doFn, undoFn, beat: ed.beat, string: ed.string });
        if (ed.undo.length > 200) ed.undo.shift();
        ed.redo = [];
        modelChanged();
    }
    function undo() {
        const op = ed.undo.pop();
        if (!op) return;
        op.undoFn(); ed.redo.push(op);
        ed.beat = op.beat; ed.string = op.string;
        modelChanged();
    }
    function redo() {
        const op = ed.redo.pop();
        if (!op) return;
        op.doFn(); ed.undo.push(op);
        ed.beat = op.beat; ed.string = op.string;
        modelChanged();
    }

    let rerenderTimer = 0;
    function modelChanged() {
        setDirty(true);
        api.score.finish(api.settings);
        updateEditBar();
        clearTimeout(rerenderTimer);
        rerenderTimer = setTimeout(() => { api.render(); api.loadMidiForScore(); }, 60);
    }

    function onRenderFinished() {
        rendering = false;
        if (!ready && !el.status.classList.contains("err")) setStatus("Loading sounds…");
        if (loopBars && loopOn) {
            const bt = beatsForBars(loopBars.a, loopBars.b);
            if (bt && bt.start !== bt.end) api.highlightPlaybackRange(bt.start, bt.end);
        }
        drawCursor();
    }

    function stringFromY(beat, y) {
        const bb = api.renderer.boundsLookup && api.renderer.boundsLookup.findBeat(beat);
        if (!bb || y == null) return ed.string;
        const bar = bb.barBounds.realBounds, n = nStrings(), sp = bar.h / (n - 1);
        return Math.max(1, Math.min(n, n - Math.round((y - bar.y) / sp)));
    }

    function onBeatDown(beat) {
        if (!ed.on || !beat || beat.voice.bar.staff.track !== curTrack()) return;
        ed.beat = beat;
        ed.string = stringFromY(beat, ed.lastY);
        ed.typed = "";
        drawCursor(); updateEditBar();
    }
    function onNoteDown(note) {
        if (!ed.on || !note || note.beat.voice.bar.staff.track !== curTrack()) return;
        ed.beat = note.beat; ed.string = note.string; ed.typed = "";
        drawCursor(); updateEditBar();
    }

    function drawCursor() {
        const l = layer("edlayer");
        l.innerHTML = "";
        if (!ed.on || !ed.beat || !api || !api.renderer.boundsLookup) return;
        const bb = api.renderer.boundsLookup.findBeat(ed.beat);
        if (!bb) return;
        const bar = bb.barBounds.realBounds, n = nStrings(), sp = bar.h / (n - 1);
        const y = bar.y + (n - ed.string) * sp, vb = bb.visualBounds, rb = bb.realBounds;
        const cx = vb.x + vb.w / 2;
        const col = document.createElement("div");
        col.className = "edcol";
        col.style.left = rb.x + "px"; col.style.width = Math.max(rb.w, 14) + "px";
        col.style.top = (bar.y - sp / 2) + "px"; col.style.height = (bar.h + sp) + "px";
        const box = document.createElement("div");
        box.className = "edbox";
        const w = Math.max(22, sp * 1.7);
        box.style.left = (cx - w / 2) + "px"; box.style.width = w + "px";
        box.style.top = (y - sp / 2 - 1) + "px"; box.style.height = (sp + 2) + "px";
        l.appendChild(col); l.appendChild(box);
        // keep the cursor in view
        const wr = el.wrap, top = y - sp, bottom = y + sp;
        if (top < wr.scrollTop + 20 || bottom > wr.scrollTop + wr.clientHeight - 20) wr.scrollTop = Math.max(0, top - wr.clientHeight / 3);
    }

    const DUR_NAMES = { 1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "16th", 32: "32nd", 64: "64th" };
    function updateEditBar() {
        if (!ed.on) return;
        const b = ed.beat, n = noteAt(b, ed.string), strings = nStrings();
        if (!b) { el.ePos.textContent = "Click the tab to place the cursor."; return; }
        const stringNo = strings - ed.string + 1; // 1 = highest string, as guitarists count
        el.ePos.innerHTML = "<b>Bar " + (b.voice.bar.index + 1) + "</b>, beat " + (b.index + 1) + ", string " + stringNo +
            " &nbsp;<span>" + (n ? "fret " + n.fret : b.notes.length ? "no note on this string" : "rest") + ", " + (DUR_NAMES[b.duration] || b.duration) + (b.dots ? " dotted" : "") + "</span>";
        el.eFret.value = n ? n.fret : "";
        el.eBar.querySelectorAll("[data-dur]").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.dur === b.duration ? "true" : "false"));
        el.eBar.querySelector('[data-act="dot"]').setAttribute("aria-pressed", b.dots ? "true" : "false");
        const tech = { hp: n && n.isHammerPullOrigin, pm: n && n.isPalmMute, vib: n && n.vibrato !== 0, dead: n && n.isDead, ghost: n && n.isGhost, ring: n && n.isLetRing };
        el.eBar.querySelectorAll("[data-tech]").forEach((x) => { x.setAttribute("aria-pressed", tech[x.dataset.tech] ? "true" : "false"); x.disabled = !n; });
        el.eBar.querySelector('[data-act="delnote"]').disabled = !n;
        el.eBar.querySelector('[data-act="undo"]').disabled = !ed.undo.length;
        el.eBar.querySelector('[data-act="redo"]').disabled = !ed.redo.length;
    }

    /* edit operations */
    function setFret(v) {
        const b = ed.beat;
        if (!b) return;
        v = Math.max(0, Math.min(MAX_FRET, v | 0));
        const n = noteAt(b, ed.string);
        if (n) {
            const old = n.fret;
            if (old === v) return;
            commit(() => { n.fret = v; }, () => { n.fret = old; });
        } else {
            const nn = new (AT().model.Note)();
            nn.string = ed.string; nn.fret = v;
            commit(() => b.addNote(nn), () => b.removeNote(nn));
        }
    }
    function deleteNote() {
        const b = ed.beat, n = noteAt(b, ed.string);
        if (!n) return;
        commit(() => b.removeNote(n), () => b.addNote(n));
    }
    function setDuration(d) {
        const b = ed.beat;
        if (!b || b.duration === d) return;
        const old = b.duration;
        commit(() => { b.duration = d; }, () => { b.duration = old; });
    }
    function toggleDot() {
        const b = ed.beat;
        if (!b) return;
        const old = b.dots, v = old ? 0 : 1;
        commit(() => { b.dots = v; }, () => { b.dots = old; });
    }
    function toggleTech(key) {
        const n = noteAt(ed.beat, ed.string);
        if (!n) return;
        const map = { hp: "isHammerPullOrigin", pm: "isPalmMute", dead: "isDead", ghost: "isGhost", ring: "isLetRing" };
        if (key === "vib") {
            const old = n.vibrato, v = old ? 0 : AT().model.VibratoType.Slight;
            commit(() => { n.vibrato = v; }, () => { n.vibrato = old; });
            return;
        }
        const p = map[key], old = n[p];
        commit(() => { n[p] = !old; }, () => { n[p] = old; });
    }
    function insertBeat() {
        const b = ed.beat;
        if (!b) return;
        const v = b.voice, nb = new (AT().model.Beat)();
        nb.duration = b.duration;
        commit(() => { v.insertBeat(b, nb); ed.beat = nb; }, () => { const i = v.beats.indexOf(nb); if (i >= 0) v.beats.splice(i, 1); ed.beat = b; });
    }
    function deleteBeat() {
        const b = ed.beat;
        if (!b) return;
        const v = b.voice, i = v.beats.indexOf(b);
        if (v.beats.length < 2) {
            // the only beat in the bar: turn it into a rest instead
            const notes = b.notes.slice();
            if (!notes.length) return;
            commit(() => notes.forEach((n) => b.removeNote(n)), () => notes.forEach((n) => b.addNote(n)));
            return;
        }
        const next = v.beats[i + 1] || v.beats[i - 1];
        commit(() => { v.beats.splice(i, 1); ed.beat = next; }, () => { v.beats.splice(i, 0, b); ed.beat = b; });
    }
    function moveBeat(dir) {
        const b = ed.beat;
        if (!b) return;
        const t = b.voice.bar.staff.track;
        let nb = dir > 0 ? b.nextBeat : b.previousBeat;
        while (nb && nb.voice.index !== 0) nb = dir > 0 ? nb.nextBeat : nb.previousBeat;
        if (nb && nb.voice.bar.staff.track === t) { ed.beat = nb; ed.typed = ""; drawCursor(); updateEditBar(); }
    }
    function moveString(dir) {
        ed.string = Math.max(1, Math.min(nStrings(), ed.string + dir));
        ed.typed = "";
        drawCursor(); updateEditBar();
    }

    /* ---------- save / download ---------- */
    function exportBytes() { return new (AT().exporter.Gp7Exporter)().export(api.score, api.settings); }
    function download() {
        if (!api || !api.score) return;
        let bytes;
        try { bytes = exportBytes(); } catch (e) { setStatus("Couldn’t create the Guitar Pro file.", true); return; }
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = baseName(current ? current.name : "tab").replace(/-edited$/, "") + (ed.dirty || (current && current.edited) ? "-edited" : "") + ".gp";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    function saveCopy() {
        if (!api || !api.score || !current) return;
        let bytes;
        try { bytes = exportBytes(); } catch (e) { setStatus("Couldn’t save the changes.", true); return; }
        const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        // keep the original untouched; overwrite an existing edited copy
        const rec = current.edited ? current : { id: newId(), added: Date.now(), edited: true, title: current.title, artist: current.artist };
        rec.name = baseName(current.name).replace(/-edited$/, "") + "-edited.gp";
        rec.size = bytes.byteLength; rec.data = data;
        current = rec;
        putTab(rec).then(refresh).then(() => { setDirty(false); setStatus("Saved as an edited copy in this browser."); setTimeout(() => { if (/Saved/.test(el.status.textContent)) setStatus(""); }, 3000); });
    }

    /* ---------- open / close ---------- */
    function confirmDiscard() { return !ed.dirty || confirm("You have unsaved changes. Discard them?"); }

    function open(rec) {
        if (current && current.id === rec.id && api && api.score) return;
        if (!confirmDiscard()) return;
        current = rec;
        el.empty.hidden = true; el.player.hidden = false;
        renderList();
        setEdit(false);
        el.title.textContent = rec.title || baseName(rec.name);
        el.meta.textContent = ""; el.time.textContent = ""; el.notice.hidden = true;
        el.go.disabled = true; el.stop.disabled = true;
        el.go.textContent = "Play"; el.go.classList.remove("stop");
        setStatus(AT() ? "Opening…" : "Loading the tab player…");
        window.at7.load().then(() => {
            if (!api) createApi();
            else { api.stop(); ready = api.isReadyForPlayback; }
            setStatus("Opening…");
            drawLoopMarks(null);
            if (api.load(new Uint8Array(rec.data), [0]) === false) setStatus("Couldn’t open this file.", true);
            if (ready) { el.go.disabled = false; el.stop.disabled = false; }
        }).catch(() => setStatus("Couldn’t load the tab player. Check your internet connection and try again.", true));
    }

    function close() {
        pause();
        setDirty(false);
        current = null;
        el.player.hidden = true; el.empty.hidden = false;
        renderList();
    }

    function pause() { if (api && playing) api.pause(); }

    function applyNotation() {
        if (!api) return;
        api.settings.display.staveProfile = isOn(el.notation) ? AT().StaveProfile.ScoreTab : AT().StaveProfile.Tab;
        api.updateSettings();
        api.render();
    }

    /* ---------- wiring ---------- */
    el.speed.value = prefs.speed; setOn(el.click, prefs.click);
    el.pct.textContent = prefs.speed + "%";
    applyVolumes();

    el.file.addEventListener("change", () => { addFiles(el.file.files); el.file.value = ""; });
    el.empty.addEventListener("click", (e) => { e.preventDefault(); el.file.click(); });
    [el.empty, el.list, document.querySelector(".tabside")].forEach((zone) => {
        ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); el.empty.classList.add("over"); }));
        ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, () => el.empty.classList.remove("over")));
        zone.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer && e.dataTransfer.files); });
    });
    // dropping a file anywhere on the open player also adds it
    ["dragover", "drop"].forEach((t) => el.player.addEventListener(t, (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
        e.preventDefault();
        if (t === "drop") addFiles(e.dataTransfer.files);
    }));

    el.go.addEventListener("click", () => { if (api && ready) api.playPause(); });
    el.stop.addEventListener("click", () => { if (api && ready) api.stop(); });
    el.speed.addEventListener("input", applySpeed);
    document.querySelectorAll("[data-cspeed]").forEach((b) => b.addEventListener("click", () => { el.speed.value = b.dataset.cspeed; applySpeed(); }));
    el.track.addEventListener("change", () => {
        if (!api || !api.score) return;
        trackIdx = +el.track.value;
        const t = curTrack();
        if (t) api.renderTracks([t]);
        ed.beat = t ? t.staves[0].bars[0].voices[0].beats[0] : null;
        ed.string = nStrings();
        applyVolumes(); updateEditBar();
    });
    el.click.addEventListener("click", () => { setOn(el.click, !isOn(el.click)); applyPlayerOptions(); });
    el.notation.addEventListener("click", () => { if (el.notation.disabled) return; setOn(el.notation, !isOn(el.notation)); applyNotation(); });

    Object.keys(vol).forEach((k) => vol[k].addEventListener("input", () => {
        prefs[k] = +vol[k].value;
        if (prefs[k] > 0) prefs.muted[k] = false;
        savePrefs(); applyVolumes();
    }));
    document.querySelectorAll(".mute").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.mix;
        prefs.muted[k] = !prefs.muted[k];
        savePrefs(); applyVolumes();
    }));

    el.edit.addEventListener("click", () => setEdit(!ed.on));
    el.save.addEventListener("click", saveCopy);
    el.download.addEventListener("click", download);

    el.eBar.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || !ed.on) return;
        if (b.dataset.dur) setDuration(+b.dataset.dur);
        else if (b.dataset.tech) toggleTech(b.dataset.tech);
        else switch (b.dataset.act) {
                case "fret-": { const n = noteAt(ed.beat, ed.string); setFret(n ? n.fret - 1 : 0); break; }
                case "fret+": { const n = noteAt(ed.beat, ed.string); setFret(n ? n.fret + 1 : 0); break; }
                case "str+": moveString(1); break;
                case "str-": moveString(-1); break;
                case "dot": toggleDot(); break;
                case "addbeat": insertBeat(); break;
                case "delnote": deleteNote(); break;
                case "delbeat": deleteBeat(); break;
                case "undo": undo(); break;
                case "redo": redo(); break;
            }
    });
    el.eFret.addEventListener("change", () => { if (el.eFret.value !== "") setFret(+el.eFret.value); });

    // remember where in the score the pointer went down, to pick the string
    el.wrap.addEventListener("pointerdown", (e) => { ed.lastY = e.clientY - el.score.getBoundingClientRect().top; }, true);

    document.addEventListener("keydown", (e) => {
        if (!el.player.offsetParent || !api) return;
        const tag = e.target.tagName;
        if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
        if (e.code === "Space" && tag !== "BUTTON") {
            if (ready) { e.preventDefault(); api.playPause(); }
            return;
        }
        if (!ed.on) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
        if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
        if (mod || e.altKey) return;
        if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const now = Date.now();
            if (ed.typed.length === 1 && now - ed.typedAt < 800 && +(ed.typed + e.key) <= MAX_FRET) { ed.typed += e.key; }
            else ed.typed = e.key;
            ed.typedAt = now;
            setFret(+ed.typed);
            return;
        }
        switch (e.key) {
            case "ArrowUp": e.preventDefault(); moveString(1); break;
            case "ArrowDown": e.preventDefault(); moveString(-1); break;
            case "ArrowRight": e.preventDefault(); moveBeat(1); break;
            case "ArrowLeft": e.preventDefault(); moveBeat(-1); break;
            case "Delete": case "Backspace": e.preventDefault(); e.shiftKey ? deleteBeat() : deleteNote(); break;
            case "Insert": e.preventDefault(); insertBeat(); break;
        }
    });

    window.addEventListener("beforeunload", (e) => { if (ed.dirty) { e.preventDefault(); e.returnValue = ""; } });

    window.at7.followTheme(() => api);

    refresh();

    window.addEventListener("metronomechange", applyPlayerOptions);

    window.tabStudio = { pause, show() { window.metronome.bind(metro); } };
})();