/* 7uner – Practice
   A catalogue of exercises in three groups: techniques, modes and scales.
   Pick one, set the tempo and play along with the moving tab. */
(function () {
    "use strict";

    const OPEN = [64, 59, 55, 50, 45, 40];
    const SN = ["e", "B", "G", "D", "A", "E"];
    const SI = { e: 0, B: 1, G: 2, D: 3, A: 4, E: 5 };
    const TECH = { h: "h", p: "p", m: "PM" };

    /* Tab tokens: <string><fret>[h|p|m], "-" for a rest. */
    function P(str) {
        return str.trim().split(/\s+/).map((t) => {
            if (t === "-") return { rest: true };
            const m = t.match(/^([eBGDAE])(\d+)([hpm])?$/);
            return { s: SI[m[1]], f: +m[2], t: m[3] || "" };
        });
    }
    const rep = (s, n) => Array(n).fill(s).join(" ");
    function updown(s) { const a = P(s); return a.concat(a.slice().reverse()); }

    /* Two-octave fingering in A (A2 to A4) starting at the 5th fret:
       each string takes notes until it has maxPer of them or the stretch
       passes four frets. Played up, then down without repeating the ends. */
    function scaleNotes(intervals, maxPer) {
        const notes = [];
        for (let m = 45; m <= 69; m++) if (intervals.includes((m - 45) % 12)) notes.push(m);
        let s = 5, count = 0, first = null;
        const up = notes.map((m) => {
            let f = m - OPEN[s];
            if (first !== null && (count >= maxPer || f - first > 4)) { s--; count = 0; first = null; f = m - OPEN[s]; }
            if (first === null) first = f;
            count++;
            return { s, f, t: "" };
        });
        return up.concat(up.slice(1, -1).reverse());
    }

    const chUp = [], chDn = [];
    ["E", "A", "D", "G", "B", "e"].forEach((s) => [1, 2, 3, 4].forEach((f) => chUp.push(s + f)));
    ["e", "B", "G", "D", "A", "E"].forEach((s) => [4, 3, 2, 1].forEach((f) => chDn.push(s + f)));
    const fiUp = [], fiDn = [];
    ["E", "A", "D", "G", "B", "e"].forEach((s) => [5, 7, 6, 8].forEach((f) => fiUp.push(s + f)));
    ["e", "B", "G", "D", "A", "E"].forEach((s) => [8, 6, 7, 5].forEach((f) => fiDn.push(s + f)));

    /* ---------- catalogue ---------- */
    const CATS = {
        tech: [
            { id: "chrom", name: "Alternate picking – chromatic", sub: 4, start: 60, step: 8,
                desc: "Sixteenth notes, changing pick direction on every note (down-up). One finger per fret, 1-2-3-4. The rhythm shouldn’t slip when you cross strings.",
                notes: P(chUp.concat(chDn).join(" ")) },
            { id: "trem", name: "Tremolo and palm muting", sub: 4, start: 80, step: 10,
                desc: "Continuous down-up sixteenths on the low E string with palm muting (PM). Builds picking-hand consistency and stamina; play from the wrist with small motions.",
                notes: P("E0m E0m E0m E0m E0m E0m E0m E0m E1m E1m E1m E1m E0m E0m E0m E0m E0m E0m E0m E0m E3m E3m E3m E3m E2m E2m E2m E2m E1m E1m E1m E1m") },
            { id: "down", name: "Downpicking endurance", sub: 2, start: 120, step: 10,
                desc: "Eighth notes with downstrokes only, palm muted. Keep the motion relaxed and the volume even; this is the stamina behind fast thrash rhythm playing.",
                notes: P("E0m E0m E0m E0m E0m E0m E3m E5m E0m E0m E0m E0m E0m E0m E5m E3m") },
            { id: "gallop", name: "Gallop rhythm", sub: 4, start: 90, step: 8,
                desc: "An eighth followed by two sixteenths, palm muted: down, down-up. Lock the two short notes tightly to the click.",
                notes: P(rep("E0m - E0m E0m", 3) + " E3m - E3m E3m " + rep("E0m - E0m E0m", 2) + " E5m - E5m E5m E2m - E2m E2m") },
            { id: "pent", name: "A minor pentatonic – box 1", sub: 4, start: 72, step: 8,
                desc: "The classic box at the 5th fret, up and down in sixteenths. Alternate picking.",
                notes: updown("E5 E8 A5 A7 D5 D7 G5 G7 B5 B8 e5 e8") },
            { id: "nps", name: "A natural minor – three notes per string", sub: 6, start: 54, step: 6,
                desc: "Sextuplets: six notes per beat, so one string per beat. This is the foundation of fast solo runs.",
                notes: updown("E5 E7 E8 A5 A7 A8 D5 D7 D9 G5 G7 G9 B6 B8 B10 e7 e8 e10") },
            { id: "fing", name: "Finger independence 1-3-2-4", sub: 4, start: 64, step: 6,
                desc: "Frets 5-7-6-8 on every string, then back down as 8-6-7-5. Keep each finger close to the fretboard and let the others rest lightly.",
                notes: P(fiUp.concat(fiDn).join(" ")) },
            { id: "leg", name: "Legato – hammer-ons and pull-offs", sub: 4, start: 72, step: 8,
                desc: "Pick only the unmarked notes. h = hammer-on, p = pull-off. Your fretting hand should sound every note clearly on its own.",
                notes: P("e5 e7h e8h e7p e5 e7h e8h e7p B5 B6h B8h B6p B5 B6h B8h B6p G4 G5h G7h G5p G4 G5h G7h G5p D5 D7h D9h D7p D5 D7h D9h D7p") },
            { id: "trill", name: "Trill endurance", sub: 4, start: 80, step: 8,
                desc: "Pick once, then keep the trill going with hammer-ons and pull-offs only. Stay even and keep both notes the same volume.",
                notes: P(rep("G7 G9h G7p G9h", 4) + " " + rep("D7 D9h D7p D9h", 4)) },
            { id: "skip", name: "Octave string skipping", sub: 4, start: 70, step: 8,
                desc: "Octave pairs that skip a string, a melodic line in the low and middle register. Mute the skipped string with the underside of your fretting finger.",
                notes: P("E5 D7 E7 D9 E8 D10 E7 D9 A5 G7 A7 G9 A8 G10 A7 G9") },
            { id: "arp", name: "Arpeggios – Am F G E", sub: 6, start: 44, step: 6,
                desc: "Three-string arpeggios in sextuplets. Sweep the pick across the strings in one motion or alternate pick; keep the notes from ringing into each other.",
                notes: P("G14 B13 e12 e17 e12 B13 G10 B10 e8 e13 e8 B10 G12 B12 e10 e15 e10 B12 G9 B9 e7 e12 e7 B9") },
            { id: "sweep", name: "Sweep picking – five-string A minor", sub: 6, start: 40, step: 4,
                desc: "One down-sweep across five strings, a hammer-on at the top, then an up-sweep back. Roll the fretting fingers so only one note sounds at a time.",
                notes: P("A12 A15h D14 G14 B13 e12 e17h e12p B13 G14 D14 A15") }
        ],
        modes: [
            { id: "ionian", name: "Ionian (major)", iv: [0, 2, 4, 5, 7, 9, 11], formula: "1 2 3 4 5 6 7", spell: "A B C♯ D E F♯ G♯",
                desc: "The major scale: bright and settled. Use it over A major chords and in major keys." },
            { id: "dorian", name: "Dorian", iv: [0, 2, 3, 5, 7, 9, 10], formula: "1 2 ♭3 4 5 6 ♭7", spell: "A B C D E F♯ G",
                desc: "Minor with a major 6th, which makes it brighter than natural minor. A favourite for rock, funk and jazz solos over Am7 or an Am–D vamp." },
            { id: "phrygian", name: "Phrygian", iv: [0, 1, 3, 5, 7, 8, 10], formula: "1 ♭2 ♭3 4 5 ♭6 ♭7", spell: "A B♭ C D E F G",
                desc: "Minor with a flat 2nd: dark and tense, with a Spanish or metal flavour. Try it over A5 power-chord riffs that move to B♭." },
            { id: "lydian", name: "Lydian", iv: [0, 2, 4, 6, 7, 9, 11], formula: "1 2 3 ♯4 5 6 7", spell: "A B C♯ D♯ E F♯ G♯",
                desc: "Major with a raised 4th: dreamy and floating. Works over Amaj7 or an A–B vamp." },
            { id: "mixolydian", name: "Mixolydian", iv: [0, 2, 4, 5, 7, 9, 10], formula: "1 2 3 4 5 6 ♭7", spell: "A B C♯ D E F♯ G",
                desc: "Major with a flat 7th: bluesy, classic-rock major. Use it over A7 or an A–G–D progression." },
            { id: "aeolian", name: "Aeolian (natural minor)", iv: [0, 2, 3, 5, 7, 8, 10], formula: "1 2 ♭3 4 5 ♭6 ♭7", spell: "A B C D E F G",
                desc: "The natural minor scale: sad and dramatic. The default for minor keys, over progressions like Am–F–G." },
            { id: "locrian", name: "Locrian", iv: [0, 1, 3, 5, 6, 8, 10], formula: "1 ♭2 ♭3 4 ♭5 ♭6 ♭7", spell: "A B♭ C D E♭ F G",
                desc: "Flat 2nd and flat 5th: the most unstable mode. Rare as a key, but at home over Am7♭5 and in some dark metal riffs." }
        ],
        scales: [
            { id: "minpent", name: "Minor pentatonic", title: "A minor pentatonic", iv: [0, 3, 5, 7, 10], per: 2, formula: "1 ♭3 4 5 ♭7", spell: "A C D E G",
                desc: "Five notes, no weak spots: the backbone of rock and blues soloing." },
            { id: "majpent", name: "Major pentatonic", title: "A major pentatonic", iv: [0, 2, 4, 7, 9], per: 2, formula: "1 2 3 5 6", spell: "A B C♯ E F♯",
                desc: "The sweet, open sound of country and southern rock leads." },
            { id: "blues", name: "Blues scale", title: "A blues scale", iv: [0, 3, 5, 6, 7, 10], formula: "1 ♭3 4 ♭5 5 ♭7", spell: "A C D E♭ E G",
                desc: "Minor pentatonic plus the flat 5th, the ‘blue note’. Use the ♭5 as a passing note rather than a place to rest." },
            { id: "harmonic", name: "Harmonic minor", title: "A harmonic minor", iv: [0, 2, 3, 5, 7, 8, 11], formula: "1 2 ♭3 4 5 ♭6 7", spell: "A B C D E F G♯",
                desc: "Natural minor with a raised 7th. The wide step from F to G♯ gives the neoclassical sound heard in much shred and metal." },
            { id: "melodic", name: "Melodic minor", title: "A melodic minor", iv: [0, 2, 3, 5, 7, 9, 11], formula: "1 2 ♭3 4 5 6 7", spell: "A B C D E F♯ G♯",
                desc: "Minor with a major 6th and 7th; smooth and jazzy. Shown here in its ascending form, used both ways in jazz." },
            { id: "phrydom", name: "Phrygian dominant", iv: [0, 1, 4, 5, 7, 8, 10], formula: "1 ♭2 3 4 5 ♭6 ♭7", spell: "A B♭ C♯ D E F G",
                desc: "The fifth mode of harmonic minor: exotic and heavy, common in metal and flamenco. Try it over an A major or A5 riff." },
            { id: "hungarian", name: "Hungarian minor", iv: [0, 2, 3, 6, 7, 8, 11], formula: "1 2 ♭3 ♯4 5 ♭6 7", spell: "A B C D♯ E F G♯",
                desc: "Harmonic minor with a raised 4th: two wide steps make it sound dramatic and exotic." },
            { id: "dimwh", name: "Diminished (whole-half)", title: "A diminished (whole-half)", iv: [0, 2, 3, 5, 6, 8, 9, 11], formula: "1 2 ♭3 4 ♭5 ♭6 6 7", spell: "A B C D E♭ F F♯ G♯",
                desc: "Eight notes alternating whole and half steps; symmetrical and tense. Fits diminished seventh chords." },
            { id: "hirajoshi", name: "Hirajoshi (Japanese pentatonic)", title: "A Hirajoshi", iv: [0, 2, 3, 7, 8], per: 3, formula: "1 2 ♭3 5 ♭6", spell: "A B C E F",
                desc: "A Japanese five-note scale with two half steps that give it a haunting, exotic sound. This Japanese-style pentatonic colour is closely associated with Marty Friedman’s lead playing; try bending into the ♭6 and resolving to the 5." },
            { id: "whole", name: "Whole tone", title: "A whole tone", iv: [0, 2, 4, 6, 8, 10], formula: "1 2 3 ♯4 ♯5 ♭7", spell: "A B C♯ D♯ F G",
                desc: "Only whole steps, so there is no home note: dreamy and unresolved. Fits augmented chords." }
        ]
    };
    CATS.modes.forEach((x) => { x.sub = 4; x.start = 70; x.step = 6; x.notes = scaleNotes(x.iv, 3); });
    CATS.scales.forEach((x) => { x.sub = 4; x.start = 70; x.step = 6; x.notes = scaleNotes(x.iv, x.per || 3); });

    /* ---------- settings ---------- */
    const KEY = "7uner.practice.v1";
    let S = { bpm: {}, cat: "tech", sel: {}, notes: true, click: true, countIn: true, tone: "clean" };
    try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o) S = Object.assign(S, o); } catch (e) {}
    if (S.bpm.chrom === 62) delete S.bpm.chrom; // old default
    delete S.drone; delete S.droneSet; delete S.loops;
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

    /* ---------- audio ----------
       Notes are plucked-string samples made with the Karplus-Strong algorithm
       (a burst of noise fed through a short, slightly lossy delay line), so they
       sound like a string rather than a synth. "Distortion" sends them through a
       clipper and a speaker-cabinet style filter. */
    let ctx, master, cleanBus, driveBus;
    function ac() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);

            cleanBus = ctx.createGain(); cleanBus.gain.value = 0.9;
            const cleanTone = ctx.createBiquadFilter(); cleanTone.type = "lowpass"; cleanTone.frequency.value = 5500;
            cleanBus.connect(cleanTone).connect(master);

            driveBus = ctx.createGain(); driveBus.gain.value = 9;
            const tight = ctx.createBiquadFilter(); tight.type = "highpass"; tight.frequency.value = 110;
            const shaper = ctx.createWaveShaper(), curve = new Float32Array(4096);
            for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(3 * x); }
            shaper.curve = curve; shaper.oversample = "4x";
            const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 900; mid.Q.value = 0.8; mid.gain.value = 4;
            const cab = ctx.createBiquadFilter(); cab.type = "lowpass"; cab.frequency.value = 3800; cab.Q.value = 0.9;
            const cab2 = ctx.createBiquadFilter(); cab2.type = "lowpass"; cab2.frequency.value = 6000;
            const out = ctx.createGain(); out.gain.value = 0.16;
            driveBus.connect(tight).connect(shaper).connect(mid).connect(cab).connect(cab2).connect(out).connect(master);
        }
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
    }
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    const ksCache = new Map();
    function ksBuffer(midi, muted) {
        const key = midi + (muted ? "m" : "");
        if (ksCache.has(key)) return ksCache.get(key);
        const sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.floor(sr / f - 0.5));
        const len = Math.floor(sr * (muted ? 0.35 : 2.2));
        const buf = ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
        // low strings ring longer than high ones; palm-muted notes die quickly
        const loss = muted ? 0.93 : Math.min(0.9985, 0.9965 + (60 - midi) * 0.00006);
        const bright = muted ? 0.25 : 0.5; // how much of the noise burst's top end survives
        let prev = 0;
        for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * bright + r * (1 - bright); y[i] = prev; }
        for (let i = N; i < len; i++) y[i] = loss * 0.5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
        let peak = 0;
        for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
        if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
        const rec = { buf, rate: f / (sr / (N + 0.5)) }; // fine-tune the integer delay to the exact pitch
        ksCache.set(key, rec);
        return rec;
    }

    function pluck(midi, t, dur, muted, soft) {
        const k = ksBuffer(midi, muted), src = ctx.createBufferSource(), g = ctx.createGain();
        const drive = S.tone === "drive";
        src.buffer = k.buf; src.playbackRate.value = k.rate;
        const level = (drive ? 0.5 : 0.42) * (soft ? 0.7 : 1);
        // clean notes ring past their length; distorted ones are cut tighter to avoid mud
        const ring = drive ? Math.min(dur * 1.05, 1.6) : Math.min(Math.max(dur * 2.2, 0.25), 1.8);
        g.gain.setValueAtTime(level, t);
        g.gain.setValueAtTime(level, t + Math.max(0.01, ring - 0.04));
        g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
        src.connect(g).connect(drive ? driveBus : cleanBus);
        src.start(t); src.stop(t + ring + 0.02);
    }

    function click(t, acc) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = acc ? 1700 : 1050;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(acc ? 0.3 : 0.17, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        o.connect(g).connect(master); o.start(t); o.stop(t + 0.05);
    }
    const midiOf = (n) => OPEN[n.s] + n.f;

    /* ---------- tab rendering ---------- */
    function renderTab(el, notes, sub, perLine) {
        el.innerHTML = "";
        const cols = [];
        for (let st = 0; st < notes.length; st += perLine) {
            const seg = notes.slice(st, st + perLine), line = document.createElement("div");
            line.className = "tabline";
            line.style.gridTemplateColumns = "1.8em repeat(" + seg.length + ", var(--cw))";
            for (let r = 0; r < 6; r++) {
                const lab = document.createElement("div");
                lab.className = "sl"; lab.textContent = SN[r]; line.appendChild(lab);
                seg.forEach((n, k) => {
                    const c = st + k, cell = document.createElement("div");
                    cell.className = "cell" + (c % sub === 0 ? " beat" : "");
                    if (!n.rest && n.s === r) {
                        const sp = document.createElement("span");
                        sp.className = "fn"; sp.textContent = n.f; cell.appendChild(sp);
                        if (n.t) { const i = document.createElement("i"); i.textContent = TECH[n.t]; cell.appendChild(i); }
                    }
                    (cols[c] = cols[c] || []).push(cell);
                    line.appendChild(cell);
                });
            }
            el.appendChild(line);
        }
        return cols;
    }

    /* ---------- elements ---------- */
    const $ = (id) => document.getElementById(id);
    const el = {
        tabs: document.querySelectorAll("#page-test .tabs button"), list: $("exlist"),
        title: $("exTitle"), desc: $("exDesc"), facts: $("exFacts"),
        bpm: $("bpm"), down: $("bpmDown"), up: $("bpmUp"), go: $("go"),
        notes: $("pNotes"), click: $("pClick"), countIn: $("pCount"), tones: document.querySelectorAll("#pTone button"),
        count: $("countin"), tab: $("tabwrap"), msg: $("msg"), player: $("pPlayer")
    };
    const isOn = (b) => b.getAttribute("aria-pressed") === "true";
    const setOn = (b, on) => b.setAttribute("aria-pressed", on ? "true" : "false");

    let cat = CATS[S.cat] ? S.cat : "tech";
    let cur = null, cols = [];

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

    // two beats per tab line on phones, four on wider screens
    const narrow = () => window.matchMedia("(max-width: 640px)").matches;
    const perLine = (ex) => ex.sub * (narrow() ? 2 : 4);

    function select(ex) {
        if (playing) finish();
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
        cols = renderTab(el.tab, ex.notes, ex.sub, perLine(ex));
        el.msg.textContent = "";
        renderList();
    }

    function showCat(c) {
        if (playing) finish();
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
        return v;
    }

    /* ---------- playback ---------- */
    let playing = false, timer = null, raf = null, nextTime = 0, step = 0, total = 0, countSteps = 0, spd = 0, vq = [], lastCol = -1, endAt = Infinity;

    function setCol(c) {
        if (lastCol >= 0 && cols[lastCol]) cols[lastCol].forEach((x) => x.classList.remove("on"));
        if (c >= 0 && cols[c]) {
            cols[c].forEach((x) => x.classList.add("on"));
            const w = el.tab, cl = cols[c][0].getBoundingClientRect(), wr = w.getBoundingClientRect();
            if (cl.right > wr.right - 20 || cl.left < wr.left + 20) w.scrollLeft += cl.left - wr.left - wr.width / 3;
        }
        lastCol = c;
    }

    function start() {
        ac();
        const ex = cur, bpm = clampBpm();
        countSteps = isOn(el.countIn) ? 4 * ex.sub : 0;
        total = Infinity; // loops until Stop
        spd = 60 / bpm / ex.sub;
        step = 0; vq = [];
        nextTime = ctx.currentTime + 0.12;
        endAt = Infinity;
        playing = true;
        el.go.textContent = "Stop"; el.go.classList.add("stop");
        el.msg.textContent = "";
        sched();
        timer = setInterval(sched, 25);
        raf = requestAnimationFrame(draw);
    }

    function sched() {
        const ex = cur;
        while (nextTime < ctx.currentTime + 0.12 && step < total) {
            schedStep(step, nextTime, ex);
            nextTime += spd; step++;
        }
        if (step >= total && timer) { clearInterval(timer); timer = null; endAt = nextTime; }
    }

    function schedStep(i, t, ex) {
        if (i < countSteps) {
            if (i % ex.sub === 0) { click(t, i === 0); vq.push({ t, count: 4 - i / ex.sub }); }
            return;
        }
        const j = (i - countSteps) % ex.notes.length, n = ex.notes[j];
        if (j % ex.sub === 0 && isOn(el.click)) click(t, j === 0);
        if (!n.rest && isOn(el.notes)) pluck(midiOf(n), t, spd, n.t === "m", n.t === "h" || n.t === "p");
        vq.push({ t, col: j });
    }

    function draw() {
        const now = ctx.currentTime;
        while (vq.length && vq[0].t <= now) {
            const e = vq.shift();
            if (e.count != null) { el.count.textContent = e.count; el.count.classList.add("show"); }
            else { el.count.classList.remove("show"); setCol(e.col); }
        }
        if (playing && now >= endAt) { finish(); return; }
        raf = requestAnimationFrame(draw);
    }

    function finish() {
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        if (raf) cancelAnimationFrame(raf);
        vq = []; setCol(-1);
        el.count.classList.remove("show");
        el.go.textContent = "Start"; el.go.classList.remove("stop");
    }

    /* ---------- wiring ---------- */
    setOn(el.notes, S.notes); setOn(el.click, S.click); setOn(el.countIn, S.countIn);
    const showTone = () => el.tones.forEach((b) => setOn(b, b.dataset.tone === S.tone));
    showTone();
    el.tones.forEach((b) => b.addEventListener("click", () => { S.tone = b.dataset.tone; save(); showTone(); }));
    el.tabs.forEach((b) => b.addEventListener("click", () => showCat(b.dataset.cat)));
    el.down.addEventListener("click", () => { el.bpm.value = clampBpm() - 2; clampBpm(); renderList(); });
    el.up.addEventListener("click", () => { el.bpm.value = clampBpm() + 2; clampBpm(); renderList(); });
    el.bpm.addEventListener("change", () => { clampBpm(); renderList(); });
    el.go.addEventListener("click", () => { playing ? finish() : start(); });
    el.notes.addEventListener("click", () => { setOn(el.notes, !isOn(el.notes)); S.notes = isOn(el.notes); save(); });
    el.click.addEventListener("click", () => { setOn(el.click, !isOn(el.click)); S.click = isOn(el.click); save(); });
    el.countIn.addEventListener("click", () => { setOn(el.countIn, !isOn(el.countIn)); S.countIn = isOn(el.countIn); save(); });
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || !el.go.offsetParent) return;
        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        playing ? finish() : start();
    });

    let wasNarrow = narrow(), rz = 0;
    window.addEventListener("resize", () => {
        clearTimeout(rz);
        rz = setTimeout(() => { if (narrow() !== wasNarrow && cur && !playing) { wasNarrow = narrow(); cols = renderTab(el.tab, cur.notes, cur.sub, perLine(cur)); } }, 150);
    });

    showCat(cat);

    window.practice = { pause() { if (playing) finish(); } };
})();