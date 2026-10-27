/* 7uner – writes the Practice exercises to ../practice/<id>.gp (Guitar Pro 7).
   Names, tempos and notes-per-beat come from ../js/exercises.js; the notes
   are defined here. Run after changing either:

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
    sweep: P("A12 A15h D14 G14 B13 e12 e17h e12p B13 G14 D14 A15")
};
const notesOf = (ex) => TECH[ex.id] || scaleNotes(ex.iv, ex.per || 3);
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

fs.mkdirSync(OUT, { recursive: true });
const settings = new at.Settings();
let count = 0;
Object.keys(CATS).forEach((cat) => CATS[cat].forEach((ex) => {
    const notes = notesOf(ex);
    const bytes = new at.exporter.Gp7Exporter().export(buildScore(ex, notes), settings);
    const back = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
    if (!same(readBack(back), notes) || back.tempo !== ex.start) throw new Error(ex.id + ": the written file doesn't match the exercise");
    fs.writeFileSync(path.join(OUT, ex.id + ".gp"), bytes);
    count++;
}));
console.log("Wrote and checked " + count + " files in " + path.relative(process.cwd(), OUT));
