/* 7uner – Tab studio
   Opens Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3) and MusicXML files, plays
   them with speed, loop and volume controls, and has an edit mode whose
   result can be downloaded as a Guitar Pro 7 (.gp) file. A vocal track is
   shown as notation, and Sing compares your voice with it as it plays.

   Rendering, playback and file import/export use alphaTab
   (https://alphatab.net, MPL-2.0), loaded by alphatab.js when the first
   file is opened. Files are kept in this browser (IndexedDB)
   and never uploaded anywhere. Only guitar and vocal tracks are shown, and
   only guitar tracks edited; drums, bass and other instruments play as backing. */
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
        edit: $("cEdit"), dirty: $("cDirty"), save: $("cSave"), download: $("cDownload"),
        go: $("cGo"), track: $("cTrack"),
        full: $("cFull"), fsCtl: $("cFsCtl"), singBar: $("cSingBar"), mic: $("sgMic"), micBtn: $("sgStart"), live: $("sgLive"),
        mix: $("cMix"), mixPop: $("cMixPop"), mixBox: $("cMixBox"),
        sgTarget: $("sgTarget"), sgYou: $("sgYou"), sgCents: $("sgCents"), sgDot: $("sgDot"), sgNow: $("sgNow"), sgPasses: $("sgPasses"), sgMsg: $("sgMsg"),
        eBar: $("eBar"), ePos: $("ePos"), eFret: $("eFret"),
        wrap: $("cWrap"), score: $("cScoreEl")
    };

    const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
    const baseName = (name) => name.replace(/\.[^.]+$/, "");
    const sizeOf = (b) => (b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB");
    const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const AT = () => window.alphaTab;
    const setOn = (b, on) => b.setAttribute("aria-pressed", on ? "true" : "false");

    /* ---------- preferences ---------- */
    const PKEY = "7uner.tabstudio.v1";
    // tracks: the track last picked in each file, by the file's id
    let prefs = { speed: 100, guitar: 100, vocals: 100, backing: 80, tracks: {} };
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

    // the first item, always: a card to add files, by a click or by dropping them on it
    const ADD_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 6h20l8 8v28H10z"/><path d="M30 6v8h8"/><path d="M24 20v14M17 27h14"/></svg>';
    function addCard() {
        const li = document.createElement("li"), b = document.createElement("button");
        li.className = "addtab";
        b.className = "addcard";
        b.innerHTML = ADD_ICON + '<span class="ac-main">Add a Guitar Pro file</span><span class="ac-sub">Guitar Pro 3–8 or MusicXML: click, or drop it here</span>';
        b.addEventListener("click", () => el.file.click());
        li.appendChild(b);
        return li;
    }
    const dropping = (on) => { const c = el.list.querySelector(".addcard"); if (c) c.classList.toggle("over", on); };

    function renderList() {
        el.list.innerHTML = "";
        el.list.appendChild(addCard());
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
    // onPage: Tab Studio is the page on screen
    let api = null, playing = false, ready = false, onPage = false;
    // shown: the track on screen; guitarIdx: the guitar track the Guitar volume is for
    let guitarTracks = [], vocalTracks = [], shown = null, guitarIdx = 0;

    function setStatus(text, isError) {
        el.status.textContent = text || "";
        el.status.classList.toggle("err", !!isError);
    }

    const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg><span>Play</span>';
    const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"/></svg><span>Pause</span>';

    function createApi() {
        el.score.innerHTML = "";
        const settings = window.at7.baseSettings(el.wrap);
        api = new (AT().AlphaTabApi)(el.score, settings);
        // the title, artist and credits are in the player's heading already
        const NE = AT().NotationElement, els = api.settings.notation.elements;
        // and, as in Practice, the tempo (it's on the metronome), the tuning, track names and dynamics
        ["ScoreTitle", "ScoreSubTitle", "ScoreArtist", "ScoreAlbum", "ScoreWords", "ScoreMusic", "ScoreWordsAndMusic", "ScoreCopyright",
            "EffectTempo", "GuitarTuning", "TrackNames", "EffectDynamics"].forEach((k) => { if (NE[k] !== undefined) els.set(NE[k], false); });
        api.updateSettings();
        window.at7.holdCursorDuringCountIn(api, el.score);
        ready = false; playing = false;

        api.scoreLoaded.on(onScoreLoaded);
        api.renderStarted.on(() => { if (!ready && !el.status.classList.contains("err")) setStatus("Drawing the tab…"); });
        api.renderFinished.on(onRenderFinished);
        api.soundFontLoad.on((e) => { if (e.total && !ready) setStatus("Loading sounds… " + Math.round((e.loaded / e.total) * 100) + "%"); });
        api.playerReady.on(() => {
            ready = true;
            el.go.disabled = false;
            if (!el.status.classList.contains("err")) setStatus("");
            applyPlayerOptions();
            applyVolumes();
        });
        api.playerStateChanged.on((e) => {
            playing = e.state === 1;
            el.go.innerHTML = playing ? PAUSE : PLAY;
            el.go.classList.toggle("stop", playing);
        });
        api.playerPositionChanged.on((e) => {
            el.time.textContent = mmss(e.currentTime) + " / " + mmss(e.endTime);
            window.metronome.sync(metro, e.currentTick);
            followPosition(e);
        });
        api.playerFinished.on(passOver);
        api.playbackRangeHighlightChanged.on(onRangeHighlight);
        api.playbackRangeChanged.on((e) => setLoopState(!!(e && e.playbackRange)));
        api.noteMouseDown.on(onNoteDown);
        api.beatMouseDown.on(onBeatDown);
        api.error.on(() => { setStatus("Couldn’t open this file. Supported formats: Guitar Pro 3–8 (.gp3, .gp4, .gp5, .gpx, .gp) and MusicXML.", true); });
    }

    /* ---------- tracks ---------- */
    // a vocal or melody line, by its name or its sound (choir aahs, voice oohs, synth voice, lead voice);
    // Guitar Pro 3–5 gives every track strings, so this comes before counting them
    const VOCAL = /\b(voc\w*|voice|vox|voz|sing\w*|melod\w*|choir)\b/i;
    const OTHER = /piano|keys|keyboard|synth|organ|fx|sfx|effect|noise|sample|string|pad|brass|horn|sax|flute|violin|cello|perc/i;
    function trackKind(t) {
        const st = t.staves[0], prog = t.playbackInfo ? t.playbackInfo.program : -1;
        if (st.isPercussion) return "drums";
        if (VOCAL.test(t.name || "") || VOCAL.test(t.shortName || "") || [52, 53, 54, 85].includes(prog)) return "vocal";
        const strings = st.tuning ? st.tuning.length : 0, name = (t.name || "") + " " + (t.shortName || "");
        if ((prog >= 32 && prog <= 39) || (strings > 0 && strings < 6)) return "bass";
        // Guitar Pro gives keys, effects and the like strings too: a guitar is named
        // one, or has strings and neither another name nor another sound
        if (/guit|gtr/i.test(name)) return strings >= 6 ? "guitar" : "other";
        // program 0 (piano) is also what a file without one says, so it doesn't count
        if (OTHER.test(name) || (prog >= 1 && prog < 24) || prog >= 40) return "other";
        if (strings >= 6) return "guitar";
        return "other";
    }

    /* alphaTab gives a syllable to every beat that isn't a rest, but Guitar Pro
       (and Songsterr) skip held notes too: a note tied over from the one before
       sings no new syllable. Each held note pushed the words a note later, so
       lay each line's syllables again from the bar it starts in, skipping them. */
    function placeLyrics(t) {
        const beats = [];
        t.staves[0].bars.forEach((b) => b.voices[0].beats.forEach((x) => beats.push(x)));
        const lines = beats.reduce((n, x) => Math.max(n, x.lyrics ? x.lyrics.length : 0), 0);
        const sung = (x) => !x.isEmpty && !x.isRest;
        const held = (x) => x.notes.every((n) => n.isTieDestination);
        const laid = beats.map(() => null);
        for (let li = 0; li < lines; li++) {
            let first = -1, last = -1;
            beats.forEach((x, i) => { if (x.lyrics && x.lyrics[li]) { if (first < 0) first = i; last = i; } });
            if (first < 0) continue;
            const start = beats.indexOf(beats[first].voice.bar.voices[0].beats[0]);
            const chunks = beats.slice(start, last + 1).filter(sung).map((x) => (x.lyrics && x.lyrics[li]) || "");
            let i = start;
            for (const c of chunks) {
                while (i < beats.length && (!sung(beats[i]) || held(beats[i]))) i++;
                if (i >= beats.length) break;
                if (!laid[i]) laid[i] = new Array(lines).fill("");
                laid[i][li] = c; i++;
            }
        }
        if (lines) beats.forEach((x, i) => { x.lyrics = laid[i]; });
    }

    function onScoreLoaded(score) {
        score.tracks.forEach(placeLyrics);
        el.title.textContent = score.title || (current ? baseName(current.name) : "Untitled");
        const bits = [score.artist, score.album].filter(Boolean);
        el.meta.textContent = (bits.length ? bits.join(", ") + ", " : "") + score.masterBars.length + " bars, " + Math.round(score.tempo) + " BPM";

        guitarTracks = score.tracks.filter((t) => trackKind(t) === "guitar");
        vocalTracks = score.tracks.filter((t) => trackKind(t) === "vocal");
        // other parts (drums, bass, keys) just play along as backing
        el.notice.hidden = !!(guitarTracks.length || vocalTracks.length);
        el.notice.textContent = "This file has no guitar or vocal tracks. 7uner shows guitar tabs and vocal lines only.";

        // one dropdown: vocals (sung, as notation) first, then the guitars as tab
        const opt = (v, label) => '<option value="' + v + '">' + escapeHtml(label) + "</option>";
        const vOpts = vocalTracks.map((t, i) => opt("v" + i, t.name || "Vocals " + (i + 1))).join("");
        const gOpts = guitarTracks.map((t, i) => opt("g" + i, t.name || "Guitar " + (i + 1))).join("");
        el.track.innerHTML = vOpts && gOpts ? '<optgroup label="Sing">' + vOpts + '</optgroup><optgroup label="Guitar tab">' + gOpts + "</optgroup>" : vOpts + gOpts;
        el.track.disabled = vocalTracks.length + guitarTracks.length < 2;
        guitarIdx = 0;

        setLoopState(false);

        // the track picked last time in this file; the first time, a guitar (the lead, if it's named), else the vocals
        const lead = (list) => list.find((t) => /lead|main/i.test(t.name || "")) || list[0];
        const kept = current && prefs.tracks[current.id], k = kept ? +kept.slice(1) : -1;
        const first = (kept && (kept[0] === "v" ? vocalTracks[k] : guitarTracks[k])) || lead(guitarTracks) || lead(vocalTracks) || null;
        if (first && guitarTracks.includes(first)) guitarIdx = guitarTracks.indexOf(first);
        if (first) showTrack(first, first === score.tracks[0]);
        setSpeed(speed);
        ed.beat = null; ed.undo = []; ed.redo = []; setDirty(false);
        trackChanged();

        if (current && (current.title !== (score.title || "") || current.artist !== (score.artist || ""))) {
            current.title = score.title || ""; current.artist = score.artist || "";
            putTab(current).then(refresh);
        }
    }
    const isVocal = (t) => vocalTracks.includes(t);
    const curTrack = () => (shown && !isVocal(shown) ? shown : null); // the guitar track on screen, for edit mode

    const trackKey = (t) => (isVocal(t) ? "v" + vocalTracks.indexOf(t) : "g" + guitarTracks.indexOf(t));

    // a guitar track as tab, a vocal track as notation; now: alphaTab has already drawn it
    function showTrack(t, now) {
        shown = t;
        el.track.value = trackKey(t);
        const prof = isVocal(t) ? AT().StaveProfile.Score : AT().StaveProfile.Tab;
        if (api.settings.display.staveProfile !== prof) { api.settings.display.staveProfile = prof; api.updateSettings(); now = false; }
        if (!now) api.renderTracks([t]);
    }
    function trackChanged() {
        if (ed.on && !curTrack()) setEdit(false);
        el.edit.disabled = !curTrack();
        const t = curTrack();
        ed.beat = t ? t.staves[0].bars[0].voices[0].beats[0] : null;
        ed.string = nStrings();
        resetSing();
        setSing(onPage && !!shown && isVocal(shown));
        applyVolumes(); showMix(); updateEditBar();
    }

    /* ---------- playback options ---------- */
    let speed = Math.max(25, Math.min(125, Math.round(+prefs.speed) || 100));
    function setSpeed(pct) {
        speed = pct;
        document.querySelectorAll("[data-cspeed]").forEach((b) => setOn(b, +b.dataset.cspeed === pct));
        if (api) api.playbackSpeed = pct / 100;
        prefs.speed = pct; savePrefs();
    }
    function applyPlayerOptions() {
        if (!api) return;
        api.isLooping = loopOn;
        // the metronome’s knob (0 silences the click) and count-in switch
        api.metronomeVolume = window.metronome.level();
        api.countInVolume = window.metronome.countIn() ? window.metronome.level() : 0;
    }

    /* the metronome (metronome.js) shows the playing tempo; sliding its
       weight, or one of its 50/75/100% keys, sets the speed relative to the
       song’s own tempo */
    const baseTempo = () => (api && api.score ? api.score.tempo : 0);
    const metro = {
        bpm: () => (baseTempo() ? (baseTempo() * speed) / 100 : null),
        setBpm(v) { setSpeed(Math.max(25, Math.min(125, Math.round((v / baseTempo()) * 100)))); },
        get range() { return [Math.ceil(baseTempo() * 0.25), Math.floor(baseTempo() * 1.25)]; },
        speed: () => (baseTempo() ? speed : null),
        setSpeed,
        playing: () => playing
    };
    /* the mix is a row of channel knobs on the amp (amp.js), whose own volume
       knob is the master: guitar (the one picked), vocals, and the rest */
    const level = (key) => prefs[key] / 100;
    function applyVolumes() {
        if (!api || !api.score) return;
        const g = guitarTracks[guitarIdx];
        if (g) api.changeTrackVolume([g], level("guitar"));
        if (vocalTracks.length) api.changeTrackVolume(vocalTracks, level("vocals"));
        const rest = api.score.tracks.filter((t) => t !== g && !isVocal(t));
        if (rest.length) api.changeTrackVolume(rest, level("backing"));
    }
    function showMix() {
        const sc = onPage && api && api.score;
        const g = sc && guitarTracks[guitarIdx];
        const list = !sc ? null : [
            g && { key: "guitar", label: "Guitar" },
            vocalTracks.length && { key: "vocals", label: "Vocals" },
            sc.tracks.some((t) => t !== g && !isVocal(t)) && { key: "backing", label: "Backing" }
        ].filter(Boolean).map((c) => Object.assign(c, { value: prefs[c.key] / 10 }));
        window.amp.channels(list, (k, v) => { prefs[k] = Math.round(v * 10); applyVolumes(); }, savePrefs);
        el.mixBox.hidden = !list || !list.length;
        if (el.mixBox.hidden) setMixOpen(false);
    }

    /* ---------- loop ----------
       Dragging across bars sets a playback range, which alphaTab highlights and
       loops, as in Practice; a click in the tab clears it. */
    let loopBars = null, loopOn = false;

    function setLoopState(on) {
        loopOn = on;
        if (api) api.isLooping = on;
        if (!on) loopBars = null;
    }
    function beatsForBars(a, b) {
        const t = shown;
        if (!t) return null;
        const bars = t.staves[0].bars, first = bars[a - 1], last = bars[b - 1];
        if (!first || !last) return null;
        const fb = first.voices[0].beats, lb = last.voices[0].beats;
        return { start: fb[0], end: lb[lb.length - 1] };
    }
    // remember the looped bars, to select them again after the tab is redrawn
    function onRangeHighlight(e) {
        if (e && e.startBeat && e.endBeat) loopBars = { a: e.startBeat.voice.bar.index + 1, b: e.endBeat.voice.bar.index + 1 };
    }

    function layer(cls) {
        let l = el.score.querySelector(":scope > ." + cls);
        if (!l) { l = document.createElement("div"); l.className = cls; el.score.appendChild(l); }
        return l;
    }

    /* ---------- edit mode ---------- */
    const ed = { on: false, beat: null, string: 1, undo: [], redo: [], dirty: false, typed: "", typedAt: 0, lastY: null };

    const nStrings = () => { const t = curTrack(); return t ? t.staves[0].tuning.length : 6; };
    const noteAt = (beat, s) => (beat ? beat.notes.find((n) => n.string === s) || null : null);

    function setDirty(on) {
        ed.dirty = on;
        el.dirty.hidden = !on;
        el.save.disabled = !on;
        el.save.title = on ? "Save a copy (unsaved changes)" : "Save a copy";
    }

    function setEdit(on) {
        if (on && !curTrack()) return;
        ed.on = on;
        el.edit.setAttribute("aria-pressed", on ? "true" : "false");
        el.eBar.hidden = !on;
        el.player.classList.toggle("editing", on);
        if (on) {
            if (api && playing) api.pause();
            if (!ed.beat) {
                const t = curTrack();
                ed.beat = t.staves[0].bars[0].voices[0].beats[0];
                ed.string = nStrings();
            }
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
        if (!ready && !el.status.classList.contains("err")) setStatus("Loading sounds…");
        if (loopBars && loopOn) {
            const bt = beatsForBars(loopBars.a, loopBars.b);
            if (bt && bt.start !== bt.end) api.highlightPlaybackRange(bt.start, bt.end);
        }
        drawCursor();
        drawMarks();
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

    /* ---------- sing ----------
       With Sing on, the microphone listens while the song plays, and the pitch
       heard is compared with the vocal note under the playback cursor: within
       40 cents counts, an octave either way too, as in Voice's exercises. Rests
       and the first moments of each note (finding it) aren't scored. A pass, the
       song or the loop once through, scores the share of note time on pitch,
       and each note is marked in the notation. Detection is pitch.js's, tuned
       as in Voice (voice.js). */
    const SING = { minF: 65, maxF: 1400, windowSec: 0.04, clarity: 0.8, median: 5 };
    // a held note still counts when it gets quieter or less clear, as long as it stays within a semitone
    const QUIET = Object.assign({}, SING, { minRms: 0.0008 }), SUSTAIN = { clarity: 0.2, near: 1 };
    const TICK_MS = 20, SILENCE_TICKS = 8, TOLERANCE = 40, GRACE_MS = 80, MIN_PASS = 50, PASSES = 5;
    const HINT = "Turn the amp’s Vocals knob down, or use headphones, so the microphone hears only you. Within 40 cents counts, an octave either way too.";
    const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
    const noteLabel = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
    const a4 = () => (window.tuner && window.tuner.a4 ? window.tuner.a4() : 440);
    // cents from the target, folded to the nearest octave (−600 to 600)
    const foldCents = (m, target) => ((((m - target) % 12) + 18) % 12 - 6) * 100;
    const pct = (x) => Math.round((100 * x.hit) / x.total);
    const { detect, windowLen, median, wake, micGranted } = window.pitch;

    // pass: this time through; notes: beat → { hit, total, pass, el }, the marks in the notation
    const sg = { on: false, want: false, starting: false, ctx: null, stream: null, analyser: null, buf: null, raf: 0, lastTick: 0,
        recent: [], silent: 0, live: false, m: 0, pos: { tick: 0, at: 0, rate: 0 },
        pass: { hit: 0, total: 0 }, passNo: 0, passes: [], notes: new Map() };
    const say = (text) => { el.sgMsg.textContent = text; };

    // where alphaTab's player is: it reports as the audio plays, and listen() reckons on from there
    function followPosition(e) {
        const p = sg.pos;
        if (e.currentTick < p.tick - 480) passOver(); // back to the loop's start, or a jump back
        p.tick = e.currentTick; p.at = performance.now();
        p.rate = (e.modifiedTempo * 960) / 60000; // ticks per millisecond at the playing speed
    }
    // the vocal note under the playback cursor: { beat, m, ms into it }, { beat, rest }, or null
    function target() {
        const p = sg.pos, age = performance.now() - p.at;
        // no report for a while: not moving (a count-in, or the player waiting)
        if (!playing || !shown || !isVocal(shown) || !api.tickCache || !p.rate || age > 300) return null;
        const tick = p.tick + age * p.rate, r = api.tickCache.findBeat(new Set([shown.index]), tick);
        if (!r || !r.beat) return null;
        const b = r.beat;
        if (b.isRest || !b.notes.length) return { beat: b, rest: true };
        const top = b.notes.reduce((x, y) => (y.realValue > x.realValue ? y : x));
        // a note tied over from the one before is already found
        return { beat: b, m: top.realValue, ms: top.isTieDestination ? Infinity : (tick - r.start) / p.rate };
    }

    function loop(ts) {
        sg.raf = requestAnimationFrame(loop);
        if (ts - sg.lastTick >= TICK_MS) { sg.lastTick = ts; listen(); }
    }
    function listen() {
        sg.analyser.getFloatTimeDomainData(sg.buf);
        const following = sg.live && sg.recent.length > 0, last = following ? median(sg.recent) : 0;
        const r = detect(sg.buf, sg.ctx.sampleRate, following ? QUIET : SING);
        const m0 = r.f > 0 ? 69 + 12 * Math.log2(r.f / a4()) : 0;
        if (r.f > 0 && (r.clarity >= SING.clarity || (following && r.clarity >= SING.clarity - SUSTAIN.clarity && Math.abs(m0 - last) <= SUSTAIN.near))) {
            sg.silent = 0; sg.live = true;
            sg.recent.push(m0);
            if (sg.recent.length > SING.median) sg.recent.shift();
            sg.m = median(sg.recent);
        } else if (++sg.silent > SILENCE_TICKS) { sg.live = false; sg.recent = []; }

        const tgt = target(), note = tgt && !tgt.rest ? tgt : null;
        const off = note && sg.live ? foldCents(sg.m, note.m) : null;
        if (note && note.ms >= GRACE_MS) {
            let n = sg.notes.get(note.beat);
            if (!n || n.pass !== sg.passNo) { n = Object.assign(n || {}, { hit: 0, total: 0, pass: sg.passNo }); sg.notes.set(note.beat, n); }
            n.total++; sg.pass.total++;
            if (off !== null && Math.abs(off) <= TOLERANCE) { n.hit++; sg.pass.hit++; }
            drawMark(layer("singlayer"), note.beat, n);
        }
        showSing(tgt, off);
    }

    function showSing(tgt, off) {
        el.sgTarget.textContent = !tgt ? "–" : tgt.rest ? "rest" : noteLabel(tgt.m);
        el.sgYou.textContent = sg.on && sg.live ? noteLabel(Math.round(sg.m)) : "–";
        el.sgCents.textContent = off === null ? "" : (off >= 0.5 ? "+" : off <= -0.5 ? "−" : "±") + Math.abs(off).toFixed(0) + " cents";
        const ok = off !== null && Math.abs(off) <= TOLERANCE;
        el.singBar.classList.toggle("ok", ok);
        el.singBar.classList.toggle("near", off !== null && !ok);
        el.sgDot.hidden = off === null;
        if (off !== null) el.sgDot.style.left = (50 + Math.max(-100, Math.min(100, off)) / 2) + "%";
        el.sgNow.textContent = sg.pass.total ? pct(sg.pass) + "%" : "–";
    }

    // a note's mark: green when most of it was on pitch, amber for some, red for little
    function drawMark(l, beat, n) {
        const bb = api && api.renderer.boundsLookup && api.renderer.boundsLookup.findBeat(beat);
        if (!bb || !n.total) return;
        const q = n.hit / n.total, vb = bb.visualBounds;
        if (!n.el || n.el.parentNode !== l) { n.el = document.createElement("div"); l.appendChild(n.el); }
        n.el.className = "sgmark " + (q >= 0.7 ? "ok" : q >= 0.3 ? "near" : "off");
        n.el.title = Math.round(q * 100) + "% on pitch";
        Object.assign(n.el.style, { left: vb.x - 4 + "px", top: vb.y - 4 + "px", width: vb.w + 8 + "px", height: vb.h + 8 + "px" });
    }
    function drawMarks() {
        const l = layer("singlayer");
        l.innerHTML = "";
        sg.notes.forEach((n, beat) => drawMark(l, beat, n));
    }

    // the song or the loop has gone round: keep its score
    function passOver() {
        if (sg.pass.total >= MIN_PASS) { // at least a second of notes
            sg.passes.unshift(pct(sg.pass));
            sg.passes.length = Math.min(sg.passes.length, PASSES);
            el.sgPasses.textContent = "last " + sg.passes.map((v) => v + "%").join(" · ");
        }
        sg.pass = { hit: 0, total: 0 }; sg.passNo++;
        el.sgNow.textContent = "–";
    }
    function resetSing() {
        sg.pass = { hit: 0, total: 0 }; sg.passes = []; sg.notes.clear();
        el.sgPasses.textContent = "";
        drawMarks();
        showSing(null, null);
    }

    async function openMic() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            say("This browser doesn’t support microphone access, or the page wasn’t opened over HTTPS.");
            return false;
        }
        try {
            sg.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        } catch (e) {
            say(e && e.name === "NotAllowedError"
                ? "Microphone permission was denied. Allow the microphone in your browser’s site settings and try again."
                : "Couldn’t access the microphone. Another app may be using it.");
            return false;
        }
        const ctx = sg.ctx = new (window.AudioContext || window.webkitAudioContext)();
        wake(ctx);
        const src = ctx.createMediaStreamSource(sg.stream);
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 55; hp.Q.value = 0.707;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4000; lp.Q.value = 0.707;
        sg.analyser = ctx.createAnalyser();
        sg.analyser.fftSize = windowLen(ctx.sampleRate, SING);
        src.connect(hp).connect(lp).connect(sg.analyser);
        sg.buf = new Float32Array(sg.analyser.fftSize);
        sg.on = true;
        showMicState();
        sg.raf = requestAnimationFrame(loop);
        return true;
    }
    function closeMic() {
        if (!sg.on) return;
        sg.on = false;
        cancelAnimationFrame(sg.raf);
        sg.stream.getTracks().forEach((t) => t.stop());
        sg.ctx.close();
        sg.ctx = sg.stream = sg.analyser = null;
        sg.live = false; sg.recent = [];
        showSing(null, null);
        showMicState();
    }
    // until the microphone is on, the Sing bar is its button; then the meter
    function showMicState() { el.mic.hidden = sg.on; el.live.hidden = !sg.on; }

    /* The Sing bar is there whenever a vocal track is on screen in Tab Studio.
       The microphone comes on at once if the browser already allows it;
       otherwise only from the bar's button, as on the tuner and in Voice. */
    async function setSing(on) {
        sg.want = on;
        el.singBar.hidden = !on;
        if (!on) { closeMic(); return; }
        showMicState();
        if (sg.on || sg.starting) return;
        if (await micGranted()) startMic();
    }
    async function startMic() {
        if (!sg.want || sg.on || sg.starting) return;
        say("Waiting for microphone permission…");
        sg.starting = true;
        const ok = await openMic();
        sg.starting = false;
        if (!ok) { el.mic.hidden = false; return; } // the button stays, with the reason
        if (!sg.want) { closeMic(); return; }
        say(HINT);
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
        setSing(false);
        el.title.textContent = rec.title || baseName(rec.name);
        el.meta.textContent = ""; el.time.textContent = ""; el.notice.hidden = true;
        el.go.disabled = true;
        el.go.innerHTML = PLAY; el.go.classList.remove("stop");
        setStatus(AT() ? "Opening…" : "Loading the tab player…");
        window.at7.load().then(() => {
            if (!api) createApi();
            else { api.stop(); ready = api.isReadyForPlayback; }
            setStatus("Opening…");
            if (api.load(new Uint8Array(rec.data), [0]) === false) setStatus("Couldn’t open this file.", true);
            if (ready) el.go.disabled = false;
        }).catch(() => setStatus("Couldn’t load the tab player. Check your internet connection and try again.", true));
    }

    function close() {
        leave();
        setDirty(false);
        current = null;
        el.player.hidden = true; el.empty.hidden = false;
        renderList();
    }

    function pause() { if (api && playing) api.pause(); }
    // leaving Tab Studio: pause, and the microphone goes off
    function leave() { onPage = false; pause(); setSing(false); setFull(false); setMixOpen(false); showMix(); }
    function show() {
        onPage = true;
        window.metronome.bind(metro);
        showMix();
        setSing(!!shown && isVocal(shown));
    }

    /* ---------- full screen: the player alone, the tab as tall as the screen ----------
       The player covers the window by itself, and asks the browser for the
       whole screen too where it may (not on iPhone, nor in some embedded views). */
    let full = false, mixOpen = false;
    const mixEl = () => document.getElementById("ampMix");
    /* the Mix button: the amp's channel knobs, lent to a bubble beside the player */
    function setMixOpen(on) {
        on = on && !full && !mixEl().hidden;
        if (on === mixOpen) return;
        mixOpen = on;
        if (on) el.mixPop.appendChild(mixEl()); else if (!full) mixHome.insertBefore(mixEl(), mixNext);
        el.mixPop.hidden = !on;
        el.mix.setAttribute("aria-expanded", on ? "true" : "false");
    }
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const mixHome = document.getElementById("ampMix").parentNode, mixNext = document.getElementById("ampMix").nextSibling;
    function setFull(on) {
        if (on === full) return;
        setMixOpen(false);
        full = on;
        // the amp stays on the page, so its mix row comes along beside Play
        const mix = mixEl();
        if (on) el.fsCtl.appendChild(mix); else mixHome.insertBefore(mix, mixNext);
        el.player.classList.toggle("full", on);
        document.documentElement.classList.toggle("tabfull", on); // the page under it doesn't scroll
        setOn(el.full, on);
        el.full.title = on ? "Exit full screen (Esc)" : "Full screen";
        el.full.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
        const req = el.player.requestFullscreen || el.player.webkitRequestFullscreen;
        if (on && !fsEl() && req) { const p = req.call(el.player); if (p && p.catch) p.catch(() => {}); }
        if (!on && fsEl() === el.player) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }

    function playPause() {
        if (!api || !ready) return;
        api.playPause();
    }

    /* ---------- wiring ---------- */
    setSpeed(speed);
    applyVolumes();

    el.file.addEventListener("change", () => { addFiles(el.file.files); el.file.value = ""; });
    [el.empty, document.querySelector(".tabside")].forEach((zone) => {
        ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); dropping(true); }));
        ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, () => dropping(false)));
        zone.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer && e.dataTransfer.files); });
    });
    // dropping a file anywhere on the open player also adds it
    ["dragover", "drop"].forEach((t) => el.player.addEventListener(t, (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
        e.preventDefault();
        if (t === "drop") addFiles(e.dataTransfer.files);
    }));

    el.go.addEventListener("click", playPause);
    el.track.addEventListener("change", () => {
        if (!api || !api.score) return;
        const i = +el.track.value.slice(1), vocal = el.track.value[0] === "v";
        if (!vocal) guitarIdx = i;
        if (current) { prefs.tracks[current.id] = el.track.value; savePrefs(); }
        showTrack(vocal ? vocalTracks[i] : guitarTracks[i]);
        trackChanged();
    });
    // a hidden tab lets go of the microphone; back on it, Sing picks up again
    document.addEventListener("visibilitychange", () => setSing(!document.hidden && onPage && !!shown && isVocal(shown)));

    el.full.addEventListener("click", () => setFull(!full));
    el.mix.addEventListener("click", () => setMixOpen(!mixOpen));
    document.addEventListener("pointerdown", (e) => { if (mixOpen && !e.target.closest("#cMixBox")) setMixOpen(false); });
    el.micBtn.addEventListener("click", startMic);
    // back to the start: a click on the time, or Home
    const toStart = () => { if (api && ready) api.tickPosition = 0; };
    el.time.addEventListener("click", toStart);
    el.fsCtl.querySelectorAll("[data-cspeed]").forEach((b) => b.addEventListener("click", () => setSpeed(+b.dataset.cspeed)));

    // ← and →: a bar back or on, in playing order (repeats included); a little into a bar, ← goes to its start
    function stepBar(d) {
        const bars = api.tickCache && api.tickCache.masterBars;
        if (!bars || !bars.length) return;
        const tick = api.tickPosition;
        let i = bars.findIndex((b) => tick < b.end);
        if (i < 0) i = bars.length - 1;
        if (d < 0 && tick - bars[i].start > 480) d = 0;
        api.tickPosition = bars[Math.max(0, Math.min(bars.length - 1, i + d))].start;
    }
    // leaving the browser's full screen (Esc) leaves the player's too
    ["fullscreenchange", "webkitfullscreenchange"].forEach((t) => document.addEventListener(t, () => { if (full && fsEl() !== el.player) setFull(false); }));

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

    // the space bar plays and pauses wherever the focus is, but in a text box or on a
    // button reached with the keyboard (at7.spaceFor); it's caught before a clicked
    // button, the dropdown or a knob can act on it
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || !onPage || el.player.hidden || !api || !ready) return;
        const t = e.target;
        if (!window.at7.spaceFor(t)) return;
        e.preventDefault(); e.stopPropagation();
        if (t !== document.body && t.blur) t.blur(); // so letting go of the key doesn't press it either
        if (!e.repeat) playPause();
    }, true);
    document.addEventListener("keydown", (e) => {
        if (!onPage || el.player.hidden || !api || e.defaultPrevented) return; // a knob or the metronome took it
        if (e.key === "Escape" && mixOpen) { setMixOpen(false); el.mix.focus(); return; }
        if (e.key === "Escape" && full) { setFull(false); return; }
        const tag = e.target.tagName;
        if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
        const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
        if (plain && e.key === "Home" && !ed.on && ready) { e.preventDefault(); toStart(); return; }
        if (plain && e.key.toLowerCase() === "f" && !ed.on) { e.preventDefault(); setFull(!full); return; }
        if (plain && !ed.on && ready && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); stepBar(e.key === "ArrowLeft" ? -1 : 1); return; }
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

    window.tabStudio = { pause: leave, show };
})();