/* 7uner – Practice
   A catalogue of exercises in three groups: techniques, modes and scales
   (js/exercises.js). Each exercise is a Guitar Pro file in practice/,
   written by tools/make-practice-files.js; alphaTab draws it and plays it
   in a loop. The sound goes through the amp (amp.js). The tempo is set on
   the metronome (metronome.js), which swings along, clicks unless its
   volume is turned to 0, and has the count-in switch. */
(function () {
    "use strict";

    const CATS = window.practiceCatalogue;
    const AT = () => window.alphaTab;

    /* ---------- settings ---------- */
    const KEY = "7uner.practice.v1";
    let S = { bpm: {}, cat: "tech", sel: {} };
    try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o) S = Object.assign(S, o); } catch (e) {}
    if (S.bpm.chrom === 62) delete S.bpm.chrom; // old default
    delete S.drone; delete S.droneSet; delete S.loops; delete S.tone; delete S.notes; delete S.click; delete S.countIn;
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

    /* ---------- elements ---------- */
    const $ = (id) => document.getElementById(id);
    const el = {
        tabs: document.querySelectorAll("#page-test .tabs button"), list: $("exlist"),
        title: $("exTitle"), desc: $("exDesc"), facts: $("exFacts"),
        go: $("go"),
        wrap: $("pWrap"), score: $("pScoreEl"), msg: $("msg"), player: $("pPlayer"), page: $("page-test")
    };
    const visible = () => !el.page.hidden;

    function setMsg(text, isError) {
        el.msg.textContent = text || "";
        el.msg.classList.toggle("err", !!isError);
    }

    let cat = CATS[S.cat] ? S.cat : "tech";
    let cur = null, tempo = 60;

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
        tempo = S.bpm[ex.id] || ex.start;
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

    function setTempo(v) {
        tempo = Math.max(30, Math.min(300, Math.round(+v || 60)));
        if (cur) { S.bpm[cur.id] = tempo; save(); }
        applySpeed();
        renderList();
    }

    /* ---------- alphaTab ----------
       One player for the whole page, created the first time Practice is
       shown. The files are written at the exercise's starting tempo, so the
       tempo becomes a playback speed relative to that. */
    let api = null, ready = false, playing = false, shown = null;

    const metro = { bpm: () => (cur ? tempo : null), setBpm: setTempo, range: [30, 300], playing: () => playing };

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
            window.at7.holdCursorDuringCountIn(api, el.score);
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
            api.playerPositionChanged.on((e) => window.metronome.sync(metro, e.currentTick));
            api.error.on(() => setMsg("Couldn’t play this exercise.", true));
        });
    }

    function loadExercise() {
        const ex = cur;
        if (!ex || shown === ex) return;
        ensureApi()
            .then(() => fetch("practice/" + ex.id + ".gp?v=" + window.practiceFilesVersion))
            .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then((buf) => {
                if (cur !== ex) return;
                const score = AT().importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), api.settings);
                shown = ex;
                api.renderScore(score);
                applyOptions(); applySpeed();
            })
            .catch(() => { if (cur === ex) setMsg("Couldn’t load this exercise. Check your connection and try again.", true); });
    }

    function applySpeed() {
        if (!api || !api.score || !cur) return;
        api.playbackSpeed = tempo / api.score.tempo;
    }
    function applyOptions() {
        if (!api) return;
        api.metronomeVolume = window.metronome.level();
        api.countInVolume = window.metronome.countIn() ? window.metronome.level() : 0;
    }

    function stop() { if (api && playing) api.stop(); }
    function toggle() {
        if (!api || !ready || !api.score) return;
        if (playing) api.stop();
        else { applySpeed(); api.play(); }
    }

    /* ---------- wiring ---------- */
    el.go.disabled = true;
    el.tabs.forEach((b) => b.addEventListener("click", () => showCat(b.dataset.cat)));
    el.go.addEventListener("click", toggle);
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || !el.go.offsetParent) return;
        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        toggle();
    });
    window.at7.followTheme(() => api);
    window.addEventListener("metronomechange", applyOptions);

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

    window.practice = { pause: stop, show() { window.metronome.bind(metro); loadExercise(); } };
})();
