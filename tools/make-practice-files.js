/* 7uner – writes the Practice exercises to ../practice/ (Guitar Pro 7):
   techniques and rhythm exercises to <id>.gp, scales and modes to
   <id>-p<position>.gp, one file per position. Names, tempos, notes-per-beat and the positions come from
   ../js/exercises.js; the notes are defined here. Run after changing either:

     cd tools && npm install && npm run practice

   Each file is read back after writing and compared note by note. */
"use strict";

const fs = require("fs");
const path = require("path");
const at = require("@coderline/alphatab");
const CATS = require("../js/exercises.js");

const OUT = path.join(__dirname, "..", "practice");
const OPEN = [64, 59, 55, 50, 45, 40];
const SI = { e: 0, B: 1, G: 2, D: 3, A: 4, E: 5 };
const PROGRAM = 27; // General MIDI "Electric Guitar (clean)"

/* ---------- notes ----------
   Tab tokens: <string><fret>[h|p|m][a], "-" for a rest, "~" to hold the
   note before. h and p mark a note reached by a hammer-on or pull-off from
   the one before; m is palm muted; a is accented. */
const note = (s, f, t, a) => (a ? { s, f, t, a: true } : { s, f, t });
function P(str) {
    return str.trim().split(/\s+/).map((t) => {
        if (t === "-") return { rest: true };
        if (t === "~") return { tie: true };
        const m = t.match(/^([eBGDAE])(\d+)([hpm]?)(a?)$/);
        if (!m) throw new Error("bad tab token " + t);
        return note(SI[m[1]], +m[2], m[3], !!m[4]);
    });
}

/* Rhythm exercises are written on their grid, one character per step:
   x a palm-muted chug on the low E, X an open, accented one, . a rest and
   ~ holds the note before; other letters are the exercise's own notes.
   Spaces and | only make the bars readable. */
function R(pattern, map) {
    const keys = Object.assign({ x: "E0m", X: "E0a" }, map);
    return P(pattern.replace(/[\s|]/g, "").split("").map((c) => {
        if (c === ".") return "-";
        if (c === "~") return "~";
        if (!keys[c]) throw new Error("no note for " + c);
        return keys[c];
    }).join(" "));
}
const times = (str, n) => Array(n).fill(str).join(" ");
const rep = (s, n) => Array(n).fill(s).join(" ");
function updown(s) { const a = P(s); return a.concat(a.slice().reverse()); }

/* One position of a scale: its notes inside a window of frets, from the
   low E string up, each pitch once and always climbing; then back down
   without repeating the ends, with rests to finish the last beat. A2 (45)
   is the root. */
function positionNotes(iv, w, sub) {
    const up = [];
    let last = -1;
    for (let s = 5; s >= 0; s--) {
        for (let f = Math.max(0, w.lo); f <= w.hi; f++) {
            const m = OPEN[s] + f;
            if (m > last && iv.includes((m - 45 + 120) % 12)) { up.push({ s, f, t: "" }); last = m; }
        }
    }
    const notes = up.concat(up.slice(1, -1).reverse());
    while (notes.length % sub) notes.push({ rest: true });
    return notes;
}

// box 1 of A minor pentatonic in overlapping groups of three, going up
const box1 = "E5 E8 A5 A7 D5 D7 G5 G7 B5 B8 e5 e8".split(" ");
const threes = [];
for (let i = 0; i + 2 < box1.length; i++) threes.push(box1[i], box1[i + 1], box1[i + 2]);

const chUp = [], chDn = [];
["E", "A", "D", "G", "B", "e"].forEach((s) => [1, 2, 3, 4].forEach((f) => chUp.push(s + f)));
["e", "B", "G", "D", "A", "E"].forEach((s) => [4, 3, 2, 1].forEach((f) => chDn.push(s + f)));
const fiUp = [], fiDn = [];
["E", "A", "D", "G", "B", "e"].forEach((s) => [5, 7, 6, 8].forEach((f) => fiUp.push(s + f)));
["e", "B", "G", "D", "A", "E"].forEach((s) => [8, 6, 7, 5].forEach((f) => fiDn.push(s + f)));

const TECH = {
    chrom: P(chUp.concat(chDn).join(" ")),
    trem: P("E0m E0m E0m E0m E0m E0m E0m E0m E1m E1m E1m E1m E0m E0m E0m E0m E0m E0m E0m E0m E3m E3m E3m E3m E2m E2m E2m E2m E1m E1m E1m E1m"),
    down: P("E0m E0m E0m E0m E0m E0m E3m E5m E0m E0m E0m E0m E0m E0m E5m E3m"),
    gallop: P(rep("E0m - E0m E0m", 3) + " E3m - E3m E3m " + rep("E0m - E0m E0m", 2) + " E5m - E5m E5m E2m - E2m E2m"),
    pent: updown("E5 E8 A5 A7 D5 D7 G5 G7 B5 B8 e5 e8"),
    nps: updown("E5 E7 E8 A5 A7 A8 D5 D7 D9 G5 G7 G9 B6 B8 B10 e7 e8 e10"),
    fing: P(fiUp.concat(fiDn).join(" ")),
    leg: P("e5 e7h e8h e7p e5 e7h e8h e7p B5 B6h B8h B6p B5 B6h B8h B6p G4 G5h G7h G5p G4 G5h G7h G5p D5 D7h D9h D7p D5 D7h D9h D7p"),
    trill: P(rep("G7 G9h G7p G9h", 4) + " " + rep("D7 D9h D7p D9h", 4)),
    skip: P("E5 D7 E7 D9 E8 D10 E7 D9 A5 G7 A7 G9 A8 G10 A7 G9"),
    arp: P("G14 B13 e12 e17 e12 B13 G10 B10 e8 e13 e8 B10 G12 B12 e10 e15 e10 B12 G9 B9 e7 e12 e7 B9"),
    sweep: P("A12 A15h D14 G14 B13 e12 e17h e12p B13 G14 D14 A15"),
    cross: P(rep("B5 e5 B8 e8", 2) + " " + rep("G5 B5 G7 B8", 2)),
    seq3: P(threes.join(" ")),
    pullpent: P("E5 E8h A5 A7h D5 D7h G5 G7h B5 B8h e5 e8h e8 e5p B8 B5p G7 G5p D7 D5p A7 A5p E8 E5p"),
    revgallop: P(rep("E0m E0m E0m -", 3) + " E3m E3m E3m - " + rep("E0m E0m E0m -", 2) + " E5m E5m E5m - E2m E2m E2m -"),
    spider: P("E1 A2 E3 A4 A1 D2 A3 D4 D1 G2 D3 G4 G1 B2 G3 B4"),
    sweep3: P("G14 B13 e12 e17h e12p B13 G9 B8 e8 e12h e8p B8 G7 B8 e7 e10h e7p B8 G9 B9 e7 e12h e7p B9")
};
/* the Rhythm course: from counting the pulse to odd and mixed meters */
const RHYTHM = {
    pulse: R("X...x...x...x... X.x.x.x.x.x.x.x. Xxxxxxxxxxxxxxxx X.x.x.x.x.x.x.x."),
    accents: R("XxxxXxxxXxxxXxxx xXxxxXxxxXxxxXxx xxXxxxXxxxXxxxXx xxxXxxxXxxxXxxxX"),
    triplets: R("X..x..x..x.. XxxXxxXxxXxx xXxxXxxXxxXx xxXxxXxxXxxX"),
    ghosts: R(times("xx.x.xx.xx.x.xx. xx.x.xx.x.xxx.X.", 2)),
    offbeats: R("..x...x...x...x. .x...x...x...x.. ...x...x...x...x .x.x.x.x.x.x.x.x"),
    displace: R("Xxx.Xxx.Xxx.Xxx. .Xxx.Xxx.Xxx.Xxx x.Xxx.Xxx.Xxx.Xx xx.Xxx.Xxx.Xxx.X"),
    stabs: R(times("xxx.xxf.xx.fxx.f xxx.xxf.x.f.g~~.", 2), { f: "E1a", g: "A3a" }),
    tresillo: R("XxxXxxXx X..X..X. XxxXxxXx X..X.XX."),
    threes: R(times("Xxx", 16)),
    fives: R(times("Xxx.x", 16)),
    qtriplets: R("X..x..x..x.. X.x.x.X.x.x. X..x..x..x.. X...x...x..."),
    sevens: R(times("Xx.xx.x", 16)),
    five4: R(times("XxxxxxXxxx X.x.x.X.x.", 2)),
    seven8: R("XxXxXxx XxXxXxx X.X.Xx. XxXxXxx"),
    seven8groups: R("XxXxXxx XxxXxXx XxXxxXx XxXxXxx"),
    five8: R("XxxXx X..X. XxxXx XxXxx"),
    nine8: R(times("XxXxXxXxx X.X.X.Xx.", 2)),
    fiveseven: R(times("Xxx.xXx.xx Xxx.xxXxx.Xx.x", 2)),
    countdown: R(times("XxxXxxXxx XxxXxxXx XxXxXxx", 2)),
    thirteen: R(times("Xxx.Xxx.Xx.xx Xxx.Xxx.X.Xxx", 2)),
    shifting: R("Xx.xXx.xXx.x Xx.xXx.xXx.xxx Xx.xX.x.xx Xx.xXx.xX.X."),
    finale: R("xx.xxf.xx.xxf. xx.xxf.xx.g~~. Xx.Xx.Xx.Xx.Xx.X Xxx.xXx.xx", { f: "E1a", g: "A3a" })
};
const titleOf = (ex) => ex.title || (ex.formula ? "A " + ex.name : ex.name);

/* ---------- score ----------
   One clean electric guitar track in standard tuning, tab only. sub is the
   number of notes per quarter note: 1 = quarters, 2 = eighths, 3 = eighth
   triplets, 4 = sixteenths, 6 = sixteenth-note sextuplets. Bars are 4/4
   (when the exercise doesn't fill the last bar, that bar is shortened, e.g.
   to 3/4, so the loop has no gap), or the exercise's own meters (bars, a
   list of [beats, note value] taken in turn). pick "alt" marks alternate
   picking on the grid, starting each bar down; "down" marks every note down. */
const DURATION = { 1: ["Quarter"], 2: ["Eighth"], 3: ["Eighth", 3, 2], 4: ["Sixteenth"], 6: ["Sixteenth", 6, 4] };
function barsOf(ex, total) {
    const out = [];
    if (ex.bars) {
        for (let i = 0, k = 0; i < total; k++) {
            const [n, d] = ex.bars[k % ex.bars.length], len = (n * 4 * ex.sub) / d;
            if (len % 1) throw new Error(ex.id + ": " + n + "/" + d + " doesn't fit a grid of " + ex.sub + " per beat");
            out.push({ n, d, len });
            i += len;
            if (i > total) throw new Error(ex.id + ": the notes don't fill the last " + n + "/" + d + " bar");
        }
        return out;
    }
    if (total % ex.sub) throw new Error(ex.id + ": " + total + " notes don't fill whole beats of " + ex.sub);
    for (let b0 = 0; b0 < total / ex.sub; b0 += 4) { const n = Math.min(4, total / ex.sub - b0); out.push({ n, d: 4, len: n * ex.sub }); }
    return out;
}
// the pick stroke of every step: 2 down, 1 up, 0 none (rests and held notes)
function picksOf(ex, notes) {
    const out = [];
    barsOf(ex, notes.length).forEach((b) => {
        for (let k = 0; k < b.len; k++) {
            const x = notes[out.length];
            out.push(!ex.pick || x.rest || x.tie ? 0 : ex.pick === "down" || k % 2 === 0 ? 2 : 1);
        }
    });
    return out;
}
function buildScore(ex, notes) {
    const M = at.model;
    const score = new M.Score();
    score.title = titleOf(ex);
    score.artist = "7uner Practice";

    const track = new M.Track();
    track.name = "Guitar";
    track.playbackInfo.program = PROGRAM;
    track.playbackInfo.primaryChannel = 0;
    track.playbackInfo.secondaryChannel = 1;
    score.addTrack(track);
    const staff = new M.Staff();
    track.addStaff(staff);
    staff.showTablature = true;
    staff.showStandardNotation = false;
    staff.stringTuning = new M.Tuning("Standard", OPEN.slice(), true);

    const [dur, tn, td] = DURATION[ex.sub], picks = picksOf(ex, notes);
    let pos = 0, prev = null;
    barsOf(ex, notes.length).forEach((b) => {
        const mb = new M.MasterBar();
        mb.timeSignatureNumerator = b.n;
        mb.timeSignatureDenominator = b.d;
        if (pos === 0) {
            const a = new M.Automation();
            a.type = M.AutomationType.Tempo; a.value = ex.start; a.ratioPosition = 0; a.isLinear = false;
            mb.tempoAutomations.push(a);
        }
        score.addMasterBar(mb);
        const bar = new M.Bar(), voice = new M.Voice();
        staff.addBar(bar);
        bar.addVoice(voice);
        for (let k = 0; k < b.len; k++, pos++) {
            const x = notes[pos], beat = new M.Beat();
            beat.duration = M.Duration[dur];
            if (tn) { beat.tupletNumerator = tn; beat.tupletDenominator = td; }
            beat.pickStroke = [M.PickStroke.None, M.PickStroke.Up, M.PickStroke.Down][picks[pos]];
            if (x.tie) {
                // the note before, held on
                const held = new M.Note();
                held.string = prev.string; held.fret = prev.fret; held.isPalmMute = prev.isPalmMute;
                held.isTieDestination = true;
                beat.addNote(held);
                prev = held;
            } else if (!x.rest) {
                const n = new M.Note();
                n.string = OPEN.length - x.s; // alphaTab counts strings from the lowest
                n.fret = x.f;
                n.isPalmMute = x.t === "m";
                if (x.a) n.accentuated = M.AccentuationType.Normal;
                const next = notes[pos + 1];
                n.isHammerPullOrigin = !!(next && (next.t === "h" || next.t === "p"));
                beat.addNote(n);
                prev = n;
            }
            voice.addBeat(beat);
        }
    });
    score.finish(new at.Settings());
    return score;
}

/* Reads the notes back out of a score, in the same shape as P() returns. */
function readBack(score) {
    const out = [];
    const beats = score.tracks[0].staves[0].bars.flatMap((b) => b.voices[0].beats);
    beats.forEach((beat, i) => {
        if (beat.isRest) { out.push({ rest: true }); return; }
        const n = beat.notes[0], prev = i ? beats[i - 1].notes[0] : null;
        if (n.isTieDestination) { out.push({ tie: true }); return; }
        const legato = prev && prev.isHammerPullOrigin ? (n.fret > prev.fret ? "h" : "p") : "";
        out.push(note(OPEN.length - n.string, n.fret, n.isPalmMute ? "m" : legato, n.accentuated === at.model.AccentuationType.Normal));
    });
    return out;
}
const picksBack = (score) => score.tracks[0].staves[0].bars.flatMap((b) => b.voices[0].beats).map((b) => [0, 1, 2][b.pickStroke]);
const same = (a, b) => a.length === b.length && a.every((x, i) => JSON.stringify(x) === JSON.stringify(b[i]));

// start clean, so a renamed or removed exercise leaves no file behind
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter((f) => f.endsWith(".gp")).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
const settings = new at.Settings();
let count = 0;
function write(ex, file, title, notes) {
    const bytes = new at.exporter.Gp7Exporter().export(buildScore(Object.assign({}, ex, { title }), notes), settings);
    const back = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
    if (!same(readBack(back), notes) || !same(picksBack(back), picksOf(ex, notes)) || back.tempo !== ex.start) throw new Error(file + ": the written file doesn't match the exercise");
    const meters = back.masterBars.map((m) => m.timeSignatureNumerator + "/" + m.timeSignatureDenominator), want = barsOf(ex, notes.length).map((b) => b.n + "/" + b.d);
    if (!same(meters, want)) throw new Error(file + ": the bars came back as " + meters.join(" "));
    fs.writeFileSync(path.join(OUT, file), bytes);
    count++;
}
Object.keys(CATS).forEach((cat) => CATS[cat].forEach((ex) => {
    if (!ex.iv) {
        const notes = TECH[ex.id] || RHYTHM[ex.id];
        if (!notes) throw new Error(ex.id + ": no notes defined");
        write(ex, ex.id + ".gp", titleOf(ex), notes);
        return;
    }
    CATS.positions(ex.iv).forEach((w, k) => write(ex, ex.id + "-p" + (k + 1) + ".gp", titleOf(ex) + " – position " + (k + 1), positionNotes(ex.iv, w, ex.sub)));
}));
console.log("Wrote and checked " + count + " files in " + path.relative(process.cwd(), OUT));
