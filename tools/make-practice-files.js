/* 7uner – writes the Practice exercises to ../practice/ (Guitar Pro 7):
   techniques to <id>.gp, scales and modes to <id>-p<position>.gp, one file
   per position. Names, tempos, notes-per-beat and the positions come from
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
   Tab tokens: <string><fret>[h|p|m], "-" for a rest. h and p mark a note
   reached by a hammer-on or pull-off from the one before; m is palm muted. */
function P(str) {
    return str.trim().split(/\s+/).map((t) => {
        if (t === "-") return { rest: true };
        const m = t.match(/^([eBGDAE])(\d+)([hpm])?$/);
        return { s: SI[m[1]], f: +m[2], t: m[3] || "" };
    });
}
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
const titleOf = (ex) => ex.title || (ex.formula ? "A " + ex.name : ex.name);

/* ---------- score ----------
   One clean electric guitar track in standard tuning, tab only. Bars are
   4/4; when the exercise doesn't fill the last bar, that bar is shortened
   (e.g. 3/4) so the loop has no gap. sub 2 = eighths, 4 = sixteenths,
   6 = sixteenth-note sextuplets. */
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

    if (notes.length % ex.sub) throw new Error(ex.id + ": " + notes.length + " notes don't fill whole beats of " + ex.sub);
    const beats = notes.length / ex.sub;
    const duration = ex.sub === 2 ? M.Duration.Eighth : M.Duration.Sixteenth;

    for (let b0 = 0; b0 < beats; b0 += 4) {
        const n = Math.min(4, beats - b0);
        const mb = new M.MasterBar();
        mb.timeSignatureNumerator = n;
        mb.timeSignatureDenominator = 4;
        if (b0 === 0) {
            const a = new M.Automation();
            a.type = M.AutomationType.Tempo; a.value = ex.start; a.ratioPosition = 0; a.isLinear = false;
            mb.tempoAutomations.push(a);
        }
        score.addMasterBar(mb);
        const bar = new M.Bar(), voice = new M.Voice();
        staff.addBar(bar);
        bar.addVoice(voice);
        notes.slice(b0 * ex.sub, (b0 + n) * ex.sub).forEach((x, k) => {
            const beat = new M.Beat();
            beat.duration = duration;
            if (ex.sub === 6) { beat.tupletNumerator = 6; beat.tupletDenominator = 4; }
            if (!x.rest) {
                const note = new M.Note();
                note.string = OPEN.length - x.s; // alphaTab counts strings from the lowest
                note.fret = x.f;
                note.isPalmMute = x.t === "m";
                const next = notes[b0 * ex.sub + k + 1];
                note.isHammerPullOrigin = !!(next && (next.t === "h" || next.t === "p"));
                beat.addNote(note);
            }
            voice.addBeat(beat);
        });
    }
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
        const legato = prev && prev.isHammerPullOrigin ? (n.fret > prev.fret ? "h" : "p") : "";
        out.push({ s: OPEN.length - n.string, f: n.fret, t: n.isPalmMute ? "m" : legato });
    });
    return out;
}
const same = (a, b) => a.length === b.length && a.every((x, i) => JSON.stringify(x) === JSON.stringify(b[i]));

// start clean, so a renamed or removed exercise leaves no file behind
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter((f) => f.endsWith(".gp")).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
const settings = new at.Settings();
let count = 0;
function write(ex, file, title, notes) {
    const bytes = new at.exporter.Gp7Exporter().export(buildScore(Object.assign({}, ex, { title }), notes), settings);
    const back = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
    if (!same(readBack(back), notes) || back.tempo !== ex.start) throw new Error(file + ": the written file doesn't match the exercise");
    fs.writeFileSync(path.join(OUT, file), bytes);
    count++;
}
Object.keys(CATS).forEach((cat) => CATS[cat].forEach((ex) => {
    if (!ex.iv) {
        if (!TECH[ex.id]) throw new Error(ex.id + ": no notes defined");
        write(ex, ex.id + ".gp", titleOf(ex), TECH[ex.id]);
        return;
    }
    CATS.positions(ex.iv).forEach((w, k) => write(ex, ex.id + "-p" + (k + 1) + ".gp", titleOf(ex) + " – position " + (k + 1), positionNotes(ex.iv, w, ex.sub)));
}));
console.log("Wrote and checked " + count + " files in " + path.relative(process.cwd(), OUT));
