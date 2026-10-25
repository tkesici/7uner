/* 7uner – song studies
   Original practice pieces built around the techniques of well-known solos.
   They are not transcriptions of the recorded solos.

   Notation, one token per event, bars separated by "|":
     <string><fret><techniques>[+<string><fret><techniques>]:<duration>
     strings: e B G D A E (high to low), "-" for a rest
     techniques: h hammer-on, p pull-off, t tap, s slide in, m palm mute,
                 x pinch harmonic, ~ vibrato, b1/b2 bend (half/whole step),
                 r1/r2 release (pre-bent, let down to the fret)
     durations: w h qd q ed e 3 (8th triplet) s (16th) x (sextuplet) */
(function () {
    "use strict";

    const OPEN = [64, 59, 55, 50, 45, 40];
    const SN = ["e", "B", "G", "D", "A", "E"];
    const SI = { e: 0, B: 1, G: 2, D: 3, A: 4, E: 5 };
    const TPB = 12, BAR = 48; // ticks per beat, ticks per 4/4 bar
    const DUR = { w: 48, h: 24, qd: 18, q: 12, ed: 9, e: 6, "3": 4, s: 3, x: 2 };

    const rep = (s, n) => Array(n).fill(s).join(" ");
    const tapBeat = (f) => rep("B" + f + "t:x B14p:x B17h:x", 2);

    const SONGS = [
        {
            name: "Crazy Train",
            artist: "Ozzy Osbourne, 1980",
            about: "Randy Rhoads recorded the original solo; Zakk Wylde has played it live with Ozzy since joining the band in 1987, keeping its outline while adding his own trademarks: squealing pinch harmonics, a very wide vibrato and fast pentatonic runs in groups of six. The song is in F♯ minor, and the solo moves between the minor scale and the minor pentatonic, with legato trills, a tapped passage and fast picked runs.",
            studies: [
                {
                    id: "ct-full", title: "Technique study", tag: "Full", bpm: 138, key: "F♯ minor",
                    bars: [
                        "B17b2:q B17r2:e B14:e G16~:q G14x:e D16~:e",
                        "G16b2+B17:q G16b2+B17:e G16b2+B17:e B17+e17:e B14+e14:e G14~:q",
                        "G14:s G16h:s G14p:s G16h:s G14p:s G16h:s G14p:s G16h:s G14p:e D16:e D14~:q",
                        [tapBeat(19), tapBeat(21), tapBeat(22), tapBeat(19)].join(" "),
                        "e17:x e14:x B17:x B14:x G16:x G14:x B17:x B14:x G16:x G14:x D16:x D14:x G16:x G14:x D16:x D14:x A16:x A14:x D16:x D14:x A16:x A14:x E17:x E14:x",
                        "e17:s e16:s e14:s B17:s B15:s B14:s G16:s G14:s G13:s D16:s D14:s D12:s A16:s A14:s A12:s A11:s",
                        "e14:s e17:s e14:s e16:s e14:s e17:s e14:s e19:s e14:s e17:s e14:s e16:s e14:s e12:s e14:s e9:s",
                        "G16b2+B14:q G16b2+B14:q E14x~:h"
                    ],
                    sections: [
                        [1, 1, "Bends, release and vibrato", "Bend with three fingers on the string and check that the bent note really reaches the target pitch. Make the vibrato wide and slow, driven from the wrist rather than the fingers."],
                        [2, 2, "Double-stop bend", "Bend the G string while the B string stays still under your little finger. Keep the bend in time: it lands on the beat, not after it."],
                        [3, 3, "Legato trill", "Pick only the first note; the rest come from hammer-ons and pull-offs. Pull off slightly downward so the lower note keeps its volume."],
                        [4, 4, "Tapped triplets", "Tap with the middle finger of your picking hand so you keep hold of the pick. Each group is tap, pull-off, hammer-on; the tapped note moves every beat."],
                        [5, 5, "Pentatonic sixes", "Groups of six notes over two strings, alternate picked. Accent the first note of each beat so the run stays locked to the click."],
                        [6, 6, "Descending minor run", "Straight sixteenths down the F♯ minor scale. Keep the picking motion small and even as you cross strings."],
                        [7, 7, "Pedal-tone run", "A favourite Rhoads device: keep returning to the same note between the moving ones. Pick the pedal note a little softer than the melody notes."],
                        [8, 8, "Unison bend and pinch harmonic", "Bend the G string up to match the B-string note. For the final pinch harmonic, let the edge of your thumb brush the string right after the pick; move your picking spot until it squeals."]
                    ]
                },
                {
                    id: "ct-simple", title: "Technique study", tag: "Simplified", bpm: 138, key: "F♯ minor",
                    bars: [
                        "B17b2:q B17r2:e B14:e G16~:h",
                        "G16b2:q B14:q G16~:h",
                        "G14:e G16h:e G14p:e G16h:e D16~:h",
                        "B17:e B14:e G16:e G14:e D16:e D14:e A16:e A14:e",
                        "e17:3 e14:3 B17:3 B14:3 G16:3 G14:3 D16:3 D14:3 A16:3 A14:3 E17:3 E14:3",
                        "e17:e e14:e B17:e B14:e G16:e G14:e D16:e D14:e",
                        "e14:e e17:e e14:e e16:e e14:e e12:e e14:e e9:e",
                        "G16b2:q G16b2:q E14~:h"
                    ],
                    sections: [
                        [1, 2, "Bends and vibrato", "The same bends as the full study, with more time on each note. Aim for a bend that lands exactly in pitch before you add vibrato."],
                        [3, 3, "Slow trill", "Eighth-note hammer-ons and pull-offs: a gentle way into the legato trill."],
                        [4, 4, "Pentatonic descent", "Replaces the tapping with picked pentatonic eighths in the same position."],
                        [5, 5, "Triplet run", "The pentatonic run in eighth-note triplets instead of sixes: same notes, half the speed."],
                        [6, 7, "Runs and pedal tone", "Eighth-note versions of the scale run and the pedal-tone idea."],
                        [8, 8, "Ending", "Whole-step bends and a held note with vibrato. Add the pinch harmonic once the rest feels easy."]
                    ]
                }
            ]
        },
        {
            name: "Paranoid",
            artist: "Megadeth, from the 1994 tribute album Nativity in Black",
            about: "Paranoid is Black Sabbath’s 1970 song; Megadeth’s cover was recorded during the Marty Friedman era. Like the original, it sits in E minor and its lead playing leans on the E minor pentatonic: bends and releases, repeating pull-off licks and quick runs.",
            studies: [
                {
                    id: "pa-full", title: "Technique study", tag: "Full", bpm: 160, key: "E minor",
                    bars: [
                        "G14r2:q G12:e D14:e G14b2~:q B12:q",
                        rep("e15:x e12p:x B15:x", 8),
                        rep("B15b2:s", 8) + " B15r2:e B12:e G14~:q",
                        "e15:s e12p:s B15:s B12p:s G14:s G12p:s D14:s D12p:s A14:s A12p:s E15:s E12p:s D14~:q",
                        "A12:s A13:s A14:s D12:s D13:s D14:s G12:s G13:s G14:s B12:s B13:s B14:s B15:s e12:s e13:s e14:s",
                        "G14b2+B12:q G14b2+B12:q B15+e15:e B12+e12:e G14~:q",
                        "B13b1:e B13r1:e B12:e G14:e G14b1:e G14r1:e G12:e D14:e",
                        "D14b2~:q D14r2:e D12:e E12~:h"
                    ],
                    sections: [
                        [1, 1, "Pre-bend and release", "Bend the string silently before you pick it, then let it down in time. Check the starting pitch: it should already be a full step up."],
                        [2, 2, "Repeater lick", "Pick, pull off, pick, in groups of three played as sextuplets. Once it’s even, it sounds faster than it is."],
                        [3, 3, "Tremolo-picked bend", "Hold the bend steady while the picking hand tremolo-picks sixteenths, then release."],
                        [4, 4, "Pentatonic descent with pull-offs", "One pick and one pull-off per string all the way down the box."],
                        [5, 5, "Chromatic climb", "Chromatic passing notes between the pentatonic notes: a thrash-lead staple. Alternate pick, one finger per fret."],
                        [6, 6, "Unison and double-stop bends", "Bend the G string to match the B string, then two-string double stops."],
                        [7, 7, "Half-step bends", "Small bends to notes outside the scale give the darker, more exotic colour. Keep them exact: a half step, not ‘somewhere up’."],
                        [8, 8, "Ending", "Bend, release, and a long low note with vibrato."]
                    ]
                }
            ]
        }
    ];

    /* ---------- parsing ---------- */
    function parseNote(tok) {
        const m = tok.match(/^([eBGDAE])(\d+)(.*)$/);
        if (!m) throw new Error("Bad note: " + tok);
        const n = { s: SI[m[1]], f: +m[2], bend: 0, rel: 0, vib: false, h: false, p: false, t: false, sl: false, m: false, ph: false };
        const mods = m[3];
        for (let i = 0; i < mods.length; i++) {
            const c = mods[i];
            if ((c === "b" || c === "r") && /\d/.test(mods[i + 1] || "")) { n[c === "b" ? "bend" : "rel"] = +mods[++i]; }
            else if (c === "~") n.vib = true;
            else if (c === "h") n.h = true;
            else if (c === "p") n.p = true;
            else if (c === "t") n.t = true;
            else if (c === "s") n.sl = true;
            else if (c === "m") n.m = true;
            else if (c === "x") n.ph = true;
        }
        return n;
    }

    function parseStudy(st) {
        const events = [];
        st.bars.forEach((bar, bi) => {
            let tick = 0;
            bar.trim().split(/\s+/).forEach((tok) => {
                const [body, d] = tok.split(":");
                const dur = DUR[d || "e"];
                if (!dur) throw new Error("Bad duration: " + tok);
                const notes = body === "-" ? [] : body.split("+").map(parseNote);
                events.push({ bar: bi + 1, tick: bi * BAR + tick, dur, notes, idx: events.length });
                tick += dur;
            });
            if (tick !== BAR && window.console) console.warn("7uner: bar " + (bi + 1) + " of " + st.id + " has " + tick + " ticks");
        });
        st.events = events;
        st.nBars = st.bars.length;
    }

    const STUDIES = [];
    SONGS.forEach((song) => song.studies.forEach((st) => { st.song = song; parseStudy(st); STUDIES.push(st); }));

    /* ---------- settings ---------- */
    const KEY = "7uner.songs.v1";
    let S = { speed: {}, last: STUDIES[0].id };
    try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o) S = Object.assign(S, o); } catch (e) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

    /* ---------- audio ---------- */
    let ctx, bus, clickOut;
    function ac() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            // simple lead tone: gain into a soft clipper, then a gentle low-pass
            bus = ctx.createGain(); bus.gain.value = 2.2;
            const shaper = ctx.createWaveShaper(), curve = new Float32Array(2048), k = 6;
            for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
            shaper.curve = curve; shaper.oversample = "2x";
            const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 4200;
            const out = ctx.createGain(); out.gain.value = 0.28;
            bus.connect(shaper).connect(tone).connect(out).connect(ctx.destination);
            clickOut = ctx.createGain(); clickOut.gain.value = 0.8; clickOut.connect(ctx.destination);
        }
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
    }
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function click(t, acc) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = acc ? 1700 : 1050;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(acc ? 0.3 : 0.17, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        o.connect(g).connect(clickOut); o.start(t); o.stop(t + 0.05);
    }

    function voice(n, t, dur, prevMidi) {
        const midi = OPEN[n.s] + n.f;
        const base = mtof(midi) * (n.ph ? 3 : 1);
        const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = "sawtooth";
        const fq = o.frequency;
        let held = base;
        if (n.rel) {
            const top = base * Math.pow(2, n.rel / 12);
            fq.setValueAtTime(top, t);
            fq.setValueAtTime(top, t + Math.min(0.12, dur * 0.3));
            fq.linearRampToValueAtTime(base, t + Math.min(0.45, dur * 0.85));
        } else if (n.bend) {
            held = base * Math.pow(2, n.bend / 12);
            fq.setValueAtTime(base, t);
            fq.linearRampToValueAtTime(held, t + Math.min(0.16, dur * 0.45));
        } else if (n.sl && prevMidi != null) {
            fq.setValueAtTime(mtof(prevMidi), t);
            fq.exponentialRampToValueAtTime(base, t + Math.min(0.08, dur * 0.5));
        } else {
            fq.setValueAtTime(base, t);
        }
        if (n.vib) {
            const lfo = ctx.createOscillator(), depth = ctx.createGain();
            lfo.frequency.value = 5.2;
            depth.gain.setValueAtTime(0, t);
            depth.gain.linearRampToValueAtTime(held * 0.022, t + Math.min(0.3, dur * 0.5));
            lfo.connect(depth).connect(fq);
            lfo.start(t); lfo.stop(t + dur + 0.06);
        }
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(n.m ? 700 : n.ph ? 6500 : 3000, t);
        lp.frequency.exponentialRampToValueAtTime(n.m ? 300 : 1100, t + Math.max(0.05, dur));
        const legato = n.h || n.p || n.t || n.sl;
        const peak = n.m ? 0.11 : legato ? 0.075 : 0.1;
        const end = n.m ? Math.min(dur, 0.12) : dur;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
        g.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.max(0.01, end * 0.7));
        g.gain.exponentialRampToValueAtTime(0.0001, t + end + 0.03);
        o.connect(lp).connect(g).connect(bus);
        o.start(t); o.stop(t + end + 0.05);
        return midi;
    }

    /* ---------- rendering ---------- */
    const $ = (id) => document.getElementById(id);
    const el = {
        list: $("songList"), title: $("sTitle"), meta: $("sMeta"), pct: $("sPct"), bpm: $("sBpm"), speed: $("sSpeed"),
        go: $("sGo"), from: $("sFrom"), to: $("sTo"), loop: $("sLoop"), notesOn: $("sNotesOn"), clickOn: $("sClick"),
        count: $("sCount"), tab: $("sTab"), study: $("sStudy"), sec: $("sec-songs")
    };

    let cur = STUDIES.find((s) => s.id === S.last) || STUDIES[0];
    let from = 1, to = cur.nBars, cols = [], barHeads = [], cellsByBar = [];

    const tagOf = (n) => (n.t ? "T" : "") + (n.h ? "h" : "") + (n.p ? "p" : "") + (n.sl ? "/" : "") +
        (n.bend === 2 ? "full" : n.bend === 1 ? "½" : "") + (n.rel ? "rel" : "") + (n.vib ? "~" : "") + (n.ph ? "PH" : "") + (n.m ? "PM" : "");
    const colRem = (ticks) => 1.35 + 0.42 * Math.log2(ticks);

    function renderList() {
        el.list.innerHTML = "";
        SONGS.forEach((song) => {
            const g = document.createElement("div");
            g.className = "songgroup";
            g.innerHTML = "<h3></h3><p></p>";
            g.querySelector("h3").textContent = song.name;
            g.querySelector("p").textContent = song.artist;
            const ol = document.createElement("ol");
            ol.className = "exlist";
            song.studies.forEach((st) => {
                const li = document.createElement("li"), b = document.createElement("button");
                b.innerHTML = '<span class="no"></span><span class="nm"></span><span class="st"></span>';
                b.querySelector(".no").textContent = st.tag === "Simplified" ? "S" : "F";
                b.querySelector(".nm").textContent = st.title + " – " + st.tag.toLowerCase();
                b.querySelector(".st").textContent = st.key + ", target " + st.bpm + " BPM" + (S.speed[st.id] ? ", last at " + S.speed[st.id] + "%" : "");
                if (st === cur) b.setAttribute("aria-current", "true");
                b.addEventListener("click", () => select(st));
                li.appendChild(b); ol.appendChild(li);
            });
            g.appendChild(ol);
            el.list.appendChild(g);
        });
    }

    function renderTab() {
        const evs = cur.events;
        const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const avail = (el.tab.clientWidth || 680) - 1.6 * rootPx - 8;
        // pack whole bars into lines that fit the available width
        const bars = [];
        for (let b = 1; b <= cur.nBars; b++) {
            const list = evs.filter((e) => e.bar === b);
            bars.push({ b, list, w: list.reduce((a, e) => a + colRem(e.dur) * rootPx, 0) });
        }
        const lines = [];
        let line = [], w = 0;
        bars.forEach((bar) => {
            if (line.length && w + bar.w > avail) { lines.push(line); line = []; w = 0; }
            line.push(bar); w += bar.w;
        });
        if (line.length) lines.push(line);

        el.tab.innerHTML = "";
        cols = []; barHeads = []; cellsByBar = [];
        lines.forEach((ln) => {
            const lineEvs = [].concat.apply([], ln.map((x) => x.list));
            const div = document.createElement("div");
            div.className = "tabline";
            div.style.gridTemplateColumns = "1.6em " + lineEvs.map((e) => colRem(e.dur) + "rem").join(" ");
            div.appendChild(document.createElement("div"));
            ln.forEach((bar) => {
                const hb = document.createElement("button");
                hb.className = "barhead";
                hb.style.gridColumn = "span " + bar.list.length;
                hb.textContent = bar.b;
                hb.setAttribute("aria-label", "Loop bar " + bar.b);
                hb.addEventListener("click", (ev) => setRange(ev.shiftKey ? Math.min(from, bar.b) : bar.b, ev.shiftKey ? Math.max(to, bar.b) : bar.b));
                barHeads[bar.b] = hb;
                div.appendChild(hb);
            });
            for (let r = 0; r < 6; r++) {
                const lab = document.createElement("div");
                lab.className = "sl"; lab.textContent = SN[r];
                div.appendChild(lab);
                lineEvs.forEach((e) => {
                    const cell = document.createElement("div");
                    const local = e.tick % BAR;
                    cell.className = "cell" + (local === 0 ? " barstart" : local % TPB === 0 ? " beat" : "");
                    const n = e.notes.find((x) => x.s === r);
                    if (n) {
                        const sp = document.createElement("span");
                        sp.className = "fn"; sp.textContent = n.f;
                        cell.appendChild(sp);
                        const tg = tagOf(n);
                        if (tg) { const i = document.createElement("i"); i.textContent = tg; cell.appendChild(i); }
                    }
                    (cols[e.idx] = cols[e.idx] || []).push(cell);
                    (cellsByBar[e.bar] = cellsByBar[e.bar] || []).push(cell);
                    div.appendChild(cell);
                });
            }
            el.tab.appendChild(div);
        });
        markRange();
    }

    function markRange() {
        for (let b = 1; b <= cur.nBars; b++) {
            const inR = b >= from && b <= to;
            (cellsByBar[b] || []).forEach((c) => c.classList.toggle("out", !inR));
            if (barHeads[b]) barHeads[b].classList.toggle("sel", inR && !(from === 1 && to === cur.nBars));
        }
        el.from.value = from; el.to.value = to;
    }

    function renderStudy() {
        const song = cur.song;
        el.title.textContent = song.name + ": " + cur.title.toLowerCase() + " (" + cur.tag.toLowerCase() + ")";
        el.meta.textContent = cur.key + ", target tempo " + cur.bpm + " BPM, " + cur.nBars + " bars";
        const opts = Array.from({ length: cur.nBars }, (_, i) => '<option value="' + (i + 1) + '">' + (i + 1) + "</option>").join("");
        el.from.innerHTML = opts; el.to.innerHTML = opts;

        el.study.innerHTML = "<h3>What you’ll practise</h3><ol class=\"secs\"></ol><h3>About the original</h3><p class=\"about\"></p>" +
            "<p class=\"hint\">This is an original study written around the solo’s techniques, not a transcription of it. For the solo itself, use a licensed tab.</p>";
        const ol = el.study.querySelector(".secs");
        cur.sections.forEach(([a, b, title, text]) => {
            const li = document.createElement("li");
            li.innerHTML = '<button class="linkbtn barlink"></button> <b></b><p></p>';
            li.querySelector(".barlink").textContent = a === b ? "Bar " + a : "Bars " + a + "–" + b;
            li.querySelector(".barlink").addEventListener("click", () => setRange(a, b));
            li.querySelector("b").textContent = title;
            li.querySelector("p").textContent = text;
            ol.appendChild(li);
        });
        el.study.querySelector(".about").textContent = song.about;
    }

    function setSpeed(pct) {
        pct = Math.max(25, Math.min(125, Math.round(pct / 5) * 5));
        el.speed.value = pct;
        el.pct.textContent = pct + "%";
        el.bpm.textContent = Math.round((cur.bpm * pct) / 100) + " BPM";
        S.speed[cur.id] = pct; save();
        if (playing) spt = tickSec();
    }
    const tickSec = () => 60 / ((cur.bpm * +el.speed.value) / 100) / TPB;

    function setRange(a, b) {
        from = Math.max(1, Math.min(a, cur.nBars));
        to = Math.max(from, Math.min(b, cur.nBars));
        const was = playing;
        if (playing) finish();
        markRange();
        if (was) start();
    }

    function select(st) {
        if (playing) finish();
        if (window.customTabs && window.customTabs.isActive()) window.customTabs.deactivate();
        cur = st; S.last = st.id; save();
        from = 1; to = st.nBars;
        renderStudy();
        renderTab();
        setSpeed(S.speed[st.id] || 60);
        renderList();
    }

    /* ---------- playback ---------- */
    let playing = false, timer = null, raf = null, nextTime = 0, tick = 0, spt = 0, vq = [], lastCol = -1, endAt = Infinity, prevMidi = null, evAt = null;

    function setCol(c) {
        if (lastCol >= 0 && cols[lastCol]) cols[lastCol].forEach((x) => x.classList.remove("on"));
        if (c >= 0 && cols[c]) {
            cols[c].forEach((x) => x.classList.add("on"));
            const w = el.tab, r = cols[c][0].getBoundingClientRect(), wr = w.getBoundingClientRect();
            if (r.right > wr.right - 20 || r.left < wr.left + 20) w.scrollLeft += r.left - wr.left - wr.width / 3;
        }
        lastCol = c;
    }

    function start() {
        ac();
        evAt = new Map();
        cur.events.forEach((e) => { if (e.bar >= from && e.bar <= to) evAt.set(e.tick, e); });
        spt = tickSec();
        tick = -4 * TPB;
        nextTime = ctx.currentTime + 0.12;
        endAt = Infinity; prevMidi = null; vq = [];
        playing = true;
        el.go.textContent = "Stop"; el.go.classList.add("stop");
        sched();
        timer = setInterval(sched, 25);
        raf = requestAnimationFrame(draw);
    }

    function sched() {
        const startTick = (from - 1) * BAR, len = (to - from + 1) * BAR;
        while (playing && endAt === Infinity && nextTime < ctx.currentTime + 0.12) {
            if (tick < 0) {
                const k = tick + 4 * TPB;
                if (k % TPB === 0) { click(nextTime, k === 0); vq.push({ t: nextTime, count: 4 - k / TPB }); }
            } else {
                if (!el.loop.checked && tick > 0 && tick % len === 0) { endAt = nextTime; break; }
                const rel = tick % len, abs = startTick + rel;
                if (rel % TPB === 0 && el.clickOn.checked) click(nextTime, rel % BAR === 0);
                const e = evAt.get(abs);
                if (e) {
                    if (el.notesOn.checked) {
                        const dur = e.dur * spt;
                        e.notes.forEach((n) => { prevMidi = voice(n, nextTime, dur, prevMidi); });
                    }
                    vq.push({ t: nextTime, col: e.idx });
                }
            }
            nextTime += spt;
            tick++;
        }
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
        el.go.textContent = "Play"; el.go.classList.remove("stop");
    }

    /* ---------- wiring ---------- */
    el.go.addEventListener("click", () => { playing ? finish() : start(); });
    el.speed.addEventListener("input", () => setSpeed(+el.speed.value));
    document.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => setSpeed(+b.dataset.speed)));
    el.from.addEventListener("change", () => setRange(+el.from.value, Math.max(+el.from.value, to)));
    el.to.addEventListener("change", () => setRange(Math.min(from, +el.to.value), +el.to.value));
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || !el.go.offsetParent) return;
        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        playing ? finish() : start();
    });
    let rz = 0;
    window.addEventListener("resize", () => {
        clearTimeout(rz);
        rz = setTimeout(() => { if (el.tab.offsetParent) { const c = lastCol; renderTab(); if (playing && c >= 0) setCol(c); } }, 150);
    });

    select(cur);

    window.songStudies = {
        pause() { if (playing) finish(); },
        refresh() { if (!playing) renderTab(); }
    };
})();