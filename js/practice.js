/* 7uner – Practice
   A catalogue of exercises in three groups: techniques, modes and scales
   (js/exercises.js). Each exercise is a Guitar Pro file in practice/,
   written by tools/make-practice-files.js; alphaTab draws it and plays it
   in a loop, at the tempo set here. */
(function () {
    "use strict";

    const CATS = window.practiceCatalogue;
    const PROGRAM = { clean: 27, drive: 30 }; // General MIDI clean and distortion guitar
    const AT = () => window.alphaTab;

    /* ---------- settings ---------- */
    const KEY = "7uner.practice.v1";
    let S = { bpm: {}, cat: "tech", sel: {}, notes: true, click: true, countIn: true, tone: "clean" };
    try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o) S = Object.assign(S, o); } catch (e) {}
    if (S.bpm.chrom === 62) delete S.bpm.chrom; // old default
    delete S.drone; delete S.droneSet; delete S.loops;
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

    /* ---------- elements ---------- */
    const $ = (id) => document.getElementById(id);
    const el = {
        tabs: document.querySelectorAll("#page-test .tabs button"), list: $("exlist"),
        title: $("exTitle"), desc: $("exDesc"), facts: $("exFacts"),
        bpm: $("bpm"), down: $("bpmDown"), up: $("bpmUp"), go: $("go"),
        notes: $("pNotes"), click: $("pClick"), countIn: $("pCount"), tones: document.querySelectorAll("#pTone button"),
        wrap: $("pWrap"), score: $("pScoreEl"), msg: $("msg"), player: $("pPlayer"), page: $("page-test")
    };
    const isOn = (b) => b.getAttribute("aria-pressed") === "true";
    const setOn = (b, on) => b.setAttribute("aria-pressed", on ? "true" : "false");
    const visible = () => !el.page.hidden;

    function setMsg(text, isError) {
        el.msg.textContent = text || "";
        el.msg.classList.toggle("err", !!isError);
    }

    let cat = CATS[S.cat] ? S.cat : "tech";
    let cur = null;

    function renderList() {
        el.list.innerHTML = "";
        CATS[cat].forEach((ex, i) => {
            const li = document.createElement("li"), b = document.createElement("button");
            b.innerHTML = '<span class="no"></span><span class="nm"></span><span class="st"></span>';
            b.querySelector(".no").textContent = i + 1;
            b.querySelector(".nm").textContent = ex.name;
            b.querySelector(".st").textContent = ex.formula ? ex.formula : (S.bpm[ex.id] ? "Last at " + S.bpm[ex.id] + " BPM" : "From " + ex.start + " BPM");
            if (ex === cur) b.setAttribute("aria-current", "true");
            b.addEventListener("click", () => { select(ex); if (window.matchMedia("(max-width: 820px)").matches) el.player.scrollIntoView({ behavior: "smooth", block: "start" }); });
            li.appendChild(b); el.list.appendChild(li);
        });
    }

    function select(ex) {
        stop();
        cur = ex;
        S.sel[cat] = ex.id; save();
        el.title.textContent = ex.title || (ex.formula ? "A " + ex.name : ex.name);
        el.desc.textContent = ex.desc;
        el.facts.innerHTML = "";
        if (ex.formula) {
            [["Formula", ex.formula], ["Notes", ex.spell]].forEach(([k, v]) => {
                const dt = document.createElement("dt"), dd = document.createElement("dd");
                dt.textContent = k; dd.textContent = v;
                el.facts.appendChild(dt); el.facts.appendChild(dd);
            });
        }
        el.facts.hidden = !ex.formula;
        el.bpm.value = S.bpm[ex.id] || ex.start;
        setMsg("");
        renderList();
        if (visible()) loadExercise();
    }

    function showCat(c) {
        cat = c; S.cat = c; save();
        el.tabs.forEach((b) => b.setAttribute("aria-selected", b.dataset.cat === c ? "true" : "false"));
        const ex = CATS[c].find((x) => x.id === S.sel[c]) || CATS[c][0];
        select(ex);
    }

    function clampBpm() {
        let v = Math.round(+el.bpm.value || 60);
        v = Math.max(30, Math.min(300, v));
        el.bpm.value = v;
        if (cur) { S.bpm[cur.id] = v; save(); }
        applySpeed();
        return v;
    }

    /* ---------- alphaTab ----------
       One player for the whole page, created the first time Practice is
       shown. The files are written at the exercise's starting tempo, so the
       BPM box sets the playback speed relative to that. */
    let api = null, ready = false, playing = false, shown = null;

    // on phones a bar of sixteenths is too cramped to wrap, so the tab
    // becomes one line that scrolls sideways with the cursor
    const narrow = () => window.matchMedia("(max-width: 640px)").matches;
    const layout = () => (narrow() ? "Horizontal" : "Page");

    function ensureApi() {
        if (api) return Promise.resolve();
        setMsg("Loading the player…");
        return window.at7.load().then(() => {
            if (api) return;
            const settings = window.at7.baseSettings(el.wrap);
            settings.display.layoutMode = layout();
            // the page already shows the name and tempo
            settings.notation = { elements: { scoreTitle: false, scoreArtist: false, guitarTuning: false, trackNames: false, effectTempo: false } };
            api = new (AT().AlphaTabApi)(el.score, settings);
            api.isLooping = true;
            api.soundFontLoad.on((e) => { if (e.total && !ready) setMsg("Loading sounds… " + Math.round((e.loaded / e.total) * 100) + "%"); });
            api.playerReady.on(() => {
                ready = true;
                el.go.disabled = false;
                if (!el.msg.classList.contains("err")) setMsg("");
                applyOptions(); applySpeed();
            });
            api.playerStateChanged.on((e) => {
                playing = e.state === 1;
                el.go.textContent = playing ? "Stop" : "Start";
                el.go.classList.toggle("stop", playing);
            });
            api.error.on(() => setMsg("Couldn’t play this exercise.", true));
        });
    }

    function loadExercise() {
        const ex = cur;
        if (!ex || shown === ex) return;
        ensureApi()
            .then(() => fetch("practice/" + ex.id + ".gp"))
            .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then((buf) => {
                if (cur !== ex) return;
                const score = AT().importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), api.settings);
                score.tracks.forEach((t) => { t.playbackInfo.program = PROGRAM[S.tone]; });
                shown = ex;
                api.renderScore(score);
                applyOptions(); applySpeed();
            })
            .catch(() => { if (cur === ex) setMsg("Couldn’t load this exercise. Check your connection and try again.", true); });
    }

    function applySpeed() {
        if (!api || !api.score || !cur) return;
        api.playbackSpeed = +el.bpm.value / api.score.tempo;
    }
    function applyOptions() {
        if (!api) return;
        api.metronomeVolume = S.click ? 1 : 0;
        api.countInVolume = S.countIn ? 1 : 0;
        if (api.score) api.changeTrackVolume(api.score.tracks, S.notes ? 1 : 0);
    }
    function applyTone() {
        if (!api || !api.score) return;
        api.score.tracks.forEach((t) => { t.playbackInfo.program = PROGRAM[S.tone]; });
        const was = playing;
        stop();
        api.loadMidiForScore();
        applyOptions();
        if (was) api.play();
    }

    function stop() { if (api && playing) api.stop(); }
    function toggle() {
        if (!api || !ready || !api.score) return;
        if (playing) api.stop();
        else { clampBpm(); api.play(); }
    }

    /* ---------- wiring ---------- */
    el.go.disabled = true;
    setOn(el.notes, S.notes); setOn(el.click, S.click); setOn(el.countIn, S.countIn);
    const showTone = () => el.tones.forEach((b) => setOn(b, b.dataset.tone === S.tone));
    showTone();
    el.tones.forEach((b) => b.addEventListener("click", () => { S.tone = b.dataset.tone; save(); showTone(); applyTone(); }));
    el.tabs.forEach((b) => b.addEventListener("click", () => showCat(b.dataset.cat)));
    el.down.addEventListener("click", () => { el.bpm.value = clampBpm() - 2; clampBpm(); renderList(); });
    el.up.addEventListener("click", () => { el.bpm.value = clampBpm() + 2; clampBpm(); renderList(); });
    el.bpm.addEventListener("change", () => { clampBpm(); renderList(); });
    el.go.addEventListener("click", toggle);
    el.notes.addEventListener("click", () => { setOn(el.notes, !isOn(el.notes)); S.notes = isOn(el.notes); save(); applyOptions(); });
    el.click.addEventListener("click", () => { setOn(el.click, !isOn(el.click)); S.click = isOn(el.click); save(); applyOptions(); });
    el.countIn.addEventListener("click", () => { setOn(el.countIn, !isOn(el.countIn)); S.countIn = isOn(el.countIn); save(); applyOptions(); });
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || !el.go.offsetParent) return;
        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        toggle();
    });
    window.at7.followTheme(() => api);

    let wasNarrow = narrow(), rz = 0;
    window.addEventListener("resize", () => {
        clearTimeout(rz);
        rz = setTimeout(() => {
            if (narrow() === wasNarrow || !api) return;
            wasNarrow = narrow();
            api.settings.display.layoutMode = AT().LayoutMode[layout()];
            api.updateSettings();
            api.render();
        }, 150);
    });

    showCat(cat);

    window.practice = { pause: stop, show: loadExercise };
})();
