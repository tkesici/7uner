/* 7uner – chromatic and instrument tuner (guitar, bass, ukulele, violin, cello)
   Pitch detection (McLeod Pitch Method) lives in pitch.js; the display is a
   gauge with a scrolling history under it, plus turning strobe rings on the
   headstock post of the string being tuned (instrument modes).
   All audio processing happens in the browser; nothing is sent to a server. */
(function () {
  "use strict";

  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

  /* Chromatic mode: any instrument, nearest note. */
  const CHROMATIC = { inTune: 5, range: 100, minF: 27, maxF: 4200, windowSec: 0.085, clarity: 0.5, median: 5, onsetSkip: 2, decimals: 0 };

  /* Instrument modes are stricter: a ±2 cent in-tune zone, a ±50 cent scale,
     longer analysis windows and heavier smoothing.
     base: open-string MIDI notes, lowest-pitched string first.
     left/right: which strings sit on each side of the headstock, top to bottom.
     rows: y of the first peg and the gap between pegs, in headstock units (200×320);
     rowsR, when the right side's pegs sit differently from the left side's.
     Extended-range guitars and basses (guitar7, guitar12, bass5, ...) are
     variants of their mode, picked with the string-count dial (COUNTS). */
  const GUITAR_CFG = { inTune: 2, range: 50, minF: 38, maxF: 1400, windowSec: 0.17, clarity: 0.7, median: 7, onsetSkip: 5, decimals: 1 };
  const BASS_CFG = { inTune: 2, range: 50, minF: 25, maxF: 600, windowSec: 0.22, clarity: 0.7, median: 7, onsetSkip: 6, decimals: 1 };
  const INSTR = {
    guitar: {
      label: "Guitar", base: [40, 45, 50, 55, 59, 64], offMin: -12, offMax: 5,
      left: [2, 1, 0], right: [3, 4, 5], rows: [70, 60],
      cfg: GUITAR_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0, 0, 0]],
        ["Drop D", [-2, 0, 0, 0, 0, 0]],
        ["E♭ standard", [-1, -1, -1, -1, -1, -1]],
        ["Drop C♯", [-3, -1, -1, -1, -1, -1]],
        ["D standard", [-2, -2, -2, -2, -2, -2]],
        ["Drop C", [-4, -2, -2, -2, -2, -2]],
        ["C♯ standard", [-3, -3, -3, -3, -3, -3]],
        ["C standard", [-4, -4, -4, -4, -4, -4]],
        ["Drop B", [-5, -3, -3, -3, -3, -3]],
        ["B standard", [-5, -5, -5, -5, -5, -5]],
        ["Drop A", [-7, -5, -5, -5, -5, -5]]
      ]
    },
    guitar7: {
      label: "Guitar", base: [35, 40, 45, 50, 55, 59, 64], offMin: -12, offMax: 5,
      left: [2, 1, 0], right: [3, 4, 5, 6], rows: [112, 48], rowsR: [92, 39],
      cfg: GUITAR_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0, 0, 0, 0]],
        ["Drop A", [-2, 0, 0, 0, 0, 0, 0]]
      ]
    },
    guitar8: {
      label: "Guitar", base: [30, 35, 40, 45, 50, 55, 59, 64], offMin: -12, offMax: 5,
      left: [3, 2, 1, 0], right: [4, 5, 6, 7], rows: [92, 39],
      cfg: GUITAR_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0, 0, 0, 0, 0]],
        ["Drop E", [-2, 0, 0, 0, 0, 0, 0, 0]]
      ]
    },
    guitar12: {
      label: "Guitar", base: [40, 52, 45, 57, 50, 62, 55, 67, 59, 59, 64, 64], offMin: -12, offMax: 5,
      left: [5, 4, 3, 2, 1, 0], right: [6, 7, 8, 9, 10, 11], rows: [88, 24],
      cfg: GUITAR_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        ["Drop D", [-2, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        ["E♭ standard", [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]],
        ["D standard", [-2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2]]
      ]
    },
    bass: {
      label: "Bass", base: [28, 33, 38, 43], offMin: -12, offMax: 5,
      left: [1, 0], right: [2, 3], rows: [96, 64],
      cfg: BASS_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0]],
        ["Drop D", [-2, 0, 0, 0]],
        ["E♭ standard", [-1, -1, -1, -1]],
        ["D standard", [-2, -2, -2, -2]],
        ["Drop C", [-4, -2, -2, -2]],
        ["C standard", [-4, -4, -4, -4]],
        ["Drop B", [-5, -3, -3, -3]],
        ["B standard", [-5, -5, -5, -5]],
        ["Drop A", [-7, -5, -5, -5]]
      ]
    },
    bass5: {
      label: "Bass", base: [23, 28, 33, 38, 43], offMin: -12, offMax: 5,
      left: [1, 0], right: [2, 3, 4], rows: [118, 52], rowsR: [92, 39],
      cfg: BASS_CFG,
      presets: [["Standard", [0, 0, 0, 0, 0]]]
    },
    bass6: {
      label: "Bass", base: [23, 28, 33, 38, 43, 48], offMin: -12, offMax: 5,
      left: [2, 1, 0], right: [3, 4, 5], rows: [92, 39],
      cfg: BASS_CFG,
      presets: [["Standard", [0, 0, 0, 0, 0, 0]]]
    },
    ukulele: {
      label: "Ukulele", base: [67, 60, 64, 69], offMin: -12, offMax: 5,
      left: [1, 0], right: [2, 3], rows: [130, 60],
      cfg: { inTune: 2, range: 50, minF: 110, maxF: 1600, windowSec: 0.1, clarity: 0.7, median: 7, onsetSkip: 4, decimals: 1 },
      presets: [
        ["Standard", [0, 0, 0, 0]],
        ["Low G", [-12, 0, 0, 0]],
        ["D tuning", [2, 2, 2, 2]]
      ]
    },
    violin: {
      label: "Violin", base: [55, 62, 69, 76], offMin: -5, offMax: 3,
      left: [0, 1], right: [3, 2], rows: [156, 46.8], // the pegs of a head drawn at 0.78 (see scrollHead)
      cfg: { inTune: 2, range: 50, minF: 130, maxF: 3000, windowSec: 0.1, clarity: 0.7, median: 7, onsetSkip: 2, decimals: 1 },
      presets: [
        ["Standard", [0, 0, 0, 0]],
        ["Cross tuning", [2, 2, 0, 0]],
        ["Scordatura", [2, 0, 0, 0]],
        ["GDGD", [0, 0, -2, -2]]
      ]
    },
    cello: {
      label: "Cello", base: [36, 43, 50, 57], offMin: -5, offMax: 3,
      left: [0, 1], right: [3, 2], rows: [115.8, 67.2], // drawn at 1.12
      cfg: { inTune: 2, range: 50, minF: 55, maxF: 1500, windowSec: 0.17, clarity: 0.7, median: 7, onsetSkip: 3, decimals: 1 },
      presets: [["Standard", [0, 0, 0, 0]]]
    }
  };
  const MODES = ["chromatic", "guitar", "bass", "ukulele", "violin", "cello"];
  // string counts on offer; the first is the mode's own INSTR entry, the others are mode + count
  const COUNTS = { guitar: [6, 7, 8, 12], bass: [4, 5, 6] };

  const ICONS = {
    chromatic: '<path d="M11 3v10a5 5 0 0 0 10 0V3"/><path d="M16 18v11"/>',
    guitar: '<path d="M16 2v11M14.3 2h3.4"/><path d="M16 13c-3.2 0-5.2 1.6-5.2 4 0 1.4.9 2.2.9 3 0 .9-1.7 1.6-1.7 4 0 3.4 2.6 6 6 6s6-2.6 6-6c0-2.4-1.7-3.1-1.7-4 0-.8.9-1.6.9-3 0-2.4-2-4-5.2-4z"/><circle cx="16" cy="21.5" r="1.8"/>',
    bass: '<path d="M16 1v16M14 2.2h4M14 4.8h4"/><path d="M16 17c-2.4 0-3.4-1.6-5-1-1.3.5-.6 2.6-1 4.5-.6 2.6-1.5 3.6-1.5 5.5 0 2.6 2.7 4 7.5 4s7.5-1.4 7.5-4c0-1.9-.9-2.9-1.5-5.5-.4-1.9.3-4-1-4.5-1.6-.6-2.6 1-5 1z"/><path d="M13 22.5h6M13.5 26.5h5"/>',
    ukulele: '<path d="M16 5v9M14.5 5h3"/><path d="M16 14c-2.5 0-4.1 1.3-4.1 3.2 0 1.1.7 1.7.7 2.4 0 .7-1.4 1.3-1.4 3.2 0 2.7 2.1 4.8 4.8 4.8s4.8-2.1 4.8-4.8c0-1.9-1.4-2.5-1.4-3.2 0-.7.7-1.3.7-2.4 0-1.9-1.6-3.2-4.1-3.2z"/><circle cx="16" cy="21.6" r="1.4"/>',
    violin: '<circle cx="16" cy="3.2" r="1.4"/><path d="M16 4.6V11"/><path d="M16 11c-2.8 0-4.3 1.2-4.3 3 0 1.1.9 1.6.9 2.4 0 .8-1.6 1.3-1.6 3.4 0 3.4 2.3 6.2 5 6.2s5-2.8 5-6.2c0-2.1-1.6-2.6-1.6-3.4 0-.8.9-1.3.9-2.4 0-1.8-1.5-3-4.3-3z"/><path d="M13.7 18.4c.6.8-.6 2.4 0 3.2M18.3 18.4c-.6.8.6 2.4 0 3.2"/><path d="M4.5 29.5 27.5 8.5"/>',
    cello: '<circle cx="16" cy="2.6" r="1.3"/><path d="M16 3.9V9"/><path d="M16 9c-3.1 0-4.8 1.3-4.8 3.3 0 1.2 1 1.8 1 2.6 0 .9-1.8 1.5-1.8 3.8 0 3.8 2.6 6.9 5.6 6.9s5.6-3.1 5.6-6.9c0-2.3-1.8-2.9-1.8-3.8 0-.8 1-1.4 1-2.6 0-2-1.7-3.3-4.8-3.3z"/><path d="M13.4 17.2c.7.9-.7 2.7 0 3.6M18.6 17.2c-.7.9.7 2.7 0 3.6"/><path d="M16 25.6V30.5"/>'
  };

  const TICK_MS = 20;        // ~50 readings per second
  const SILENCE_TICKS = 25;  // ~500 ms without a pitch before going idle
  const HOLD_MS = 600;       // how long a string must stay in tune to get a tick
  const STROBE = 3;          // strobe speed: degrees per second for each cent off
  const HIST_SPEED = 40;     // the history trace scrolls down this many pixels a second

  const $ = (id) => document.getElementById(id);
  const el = {
    root: $("tRoot"), modes: $("tModes"), readout: $("tReadout"), sub: $("tSub"), note: $("tNote"), oct: $("tOct"),
    hz: $("tHz"), cents: $("tCents"), panel: $("tGuitar"), allIn: $("tAllIn"),
    preset: $("tPreset"), auto: $("tAuto"), autoRow: $("tAutoRow"), pegsL: $("pegsL"), pegsR: $("pegsR"), head: $("tHead"),
    pick: $("tPick"), pickLab: $("tPickLab"), pickPop: $("tPickPop"), stage: $("tStage"),
    canvas: $("tStrobe"), cover: $("tCover"), start: $("tStart"), status: $("tStatus"),
    a4: $("a4"), a4d: $("a4Down"), a4u: $("a4Up"),
    count: $("tCount")
  };

  /* ---------- settings ---------- */
  const KEY = "7uner.tuner.v1";
  const st = { mode: "chromatic", offsets: {}, a4: 440, strings: { guitar: 6, bass: 4 } };
  Object.keys(INSTR).forEach((k) => { st.offsets[k] = INSTR[k].base.map(() => 0); });
  const clampOff = (k, v) => Math.max(INSTR[k].offMin, Math.min(INSTR[k].offMax, Math.round(+v || 0)));
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o) {
      if (MODES.includes(o.mode)) st.mode = o.mode;
      // earlier versions stored only the guitar offsets as a plain array
      const offs = Array.isArray(o.offsets) ? { guitar: o.offsets } : (o.offsets || {});
      Object.keys(INSTR).forEach((k) => {
        if (Array.isArray(offs[k]) && offs[k].length === INSTR[k].base.length) st.offsets[k] = offs[k].map((v) => clampOff(k, v));
      });
      if (o.a4 >= 415 && o.a4 <= 466) st.a4 = +o.a4;
      Object.keys(COUNTS).forEach((m) => { if (o.strings && COUNTS[m].includes(o.strings[m])) st.strings[m] = o.strings[m]; });
    } else {
      const v = +localStorage.getItem("7uner.a4");
      if (v >= 415 && v <= 466) st.a4 = v;
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  // the INSTR entry in use: the mode's own, or its 7-string, 5-string, ... variant
  const ikey = () => (COUNTS[st.mode] && st.strings[st.mode] !== COUNTS[st.mode][0] ? st.mode + st.strings[st.mode] : st.mode);
  const instr = () => INSTR[ikey()] || null;
  const cfg = () => (instr() ? instr().cfg : CHROMATIC);
  const offs = () => st.offsets[ikey()];
  const target = (i) => instr().base[i] + offs()[i];
  const mtof = (m) => st.a4 * Math.pow(2, (m - 69) / 12);
  const noteName = (m) => NAMES[((m % 12) + 12) % 12];
  const octave = (m) => Math.floor(m / 12) - 1;

  const { detect, windowLen, median } = window.pitch;

  /* ---------- headstocks ---------- */
  const DEFS =
      '<defs>' +
      '<linearGradient id="hsBlack" x1="0" x2="1"><stop offset="0" stop-color="#17191D"/><stop offset=".5" stop-color="#2E3238"/><stop offset="1" stop-color="#17191D"/></linearGradient>' +
      '<linearGradient id="hsGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7E08A"/><stop offset=".55" stop-color="#D4AF37"/><stop offset="1" stop-color="#A97C1E"/></linearGradient>' +
      '<linearGradient id="hsWhite" x1="0" x2="1"><stop offset="0" stop-color="#E4E6EA"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4E6EA"/></linearGradient>' +
      '<linearGradient id="hsMahogany" x1="0" x2="1"><stop offset="0" stop-color="#5A2E16"/><stop offset=".5" stop-color="#8A4E28"/><stop offset="1" stop-color="#5A2E16"/></linearGradient>' +
      '<linearGradient id="hsVarnish" x1="0" x2="1"><stop offset="0" stop-color="#6E2A0C"/><stop offset=".5" stop-color="#B85A1F"/><stop offset="1" stop-color="#6E2A0C"/></linearGradient>' +
      '<linearGradient id="hsRosewood" x1="0" x2="1"><stop offset="0" stop-color="#3A2315"/><stop offset=".5" stop-color="#5C3B24"/><stop offset="1" stop-color="#3A2315"/></linearGradient>' +
      '<linearGradient id="hsEbony" x1="0" x2="1"><stop offset="0" stop-color="#0E0E10"/><stop offset=".5" stop-color="#26262A"/><stop offset="1" stop-color="#0E0E10"/></linearGradient>' +
      '<linearGradient id="hsChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F5F7"/><stop offset=".45" stop-color="#C3C7CD"/><stop offset=".55" stop-color="#9DA2AA"/><stop offset="1" stop-color="#E2E4E8"/></linearGradient>' +
      '<radialGradient id="hsBrassPost" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#FFF3B8"/><stop offset=".5" stop-color="#D9B44A"/><stop offset="1" stop-color="#8A6A1A"/></radialGradient>' +
      '<radialGradient id="hsChromePost" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C9CDD3"/><stop offset="1" stop-color="#6E747C"/></radialGradient>' +
      '<linearGradient id="hsGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".03"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="hsTurq" x1="0" x2="1"><stop offset="0" stop-color="#0B5E5C"/><stop offset=".5" stop-color="#1BA39C"/><stop offset="1" stop-color="#0B5E5C"/></linearGradient>' +
      '<linearGradient id="hsBlackKey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4D53"/><stop offset=".45" stop-color="#1A1B1E"/><stop offset="1" stop-color="#2C2E33"/></linearGradient>' +
      '<radialGradient id="hsBlackPost" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#6A6E76"/><stop offset=".55" stop-color="#1E1F23"/><stop offset="1" stop-color="#0A0A0C"/></radialGradient>' +
      '<radialGradient id="hsAbalone" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#9FE7DC"/><stop offset=".45" stop-color="#3FA79B"/><stop offset=".8" stop-color="#2B5E8A"/><stop offset="1" stop-color="#1B3F4E"/></radialGradient>' +
      '<linearGradient id="hsMaple" x1="0" x2="1"><stop offset="0" stop-color="#8A5A2B"/><stop offset=".5" stop-color="#C08A50"/><stop offset="1" stop-color="#8A5A2B"/></linearGradient>' +
      '<linearGradient id="hsPearl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7F4EC"/><stop offset=".5" stop-color="#DCE3E6"/><stop offset="1" stop-color="#EFE8DA"/></linearGradient>' +
      '</defs>';

  const strPath = (i, x, y, nx, w) => '<path class="gstr" data-i="' + i + '" stroke-width="' + w + '" d="M' + x + " " + y + " L" + nx + " 249 L" + nx + ' 320"/>';

  const HEADS = {
    guitar: () => luthierHead("esp", { posts: [[70, 190], [70, 130], [70, 70], [130, 70], [130, 130], [130, 190]], gauge: [2.8, 2.3, 1.9, 1.5, 1.2, 1] }),
    guitar7: () => luthierHead("esp", { posts: [[70, 208], [70, 160], [70, 112], [130, 92], [130, 131], [130, 170], [130, 209]], gauge: [3.1, 2.8, 2.3, 1.9, 1.5, 1.2, 1], small: true }),
    guitar8: () => luthierHead("esp", { posts: [[70, 209], [70, 170], [70, 131], [70, 92], [130, 92], [130, 131], [130, 170], [130, 209]], gauge: [3.4, 3.1, 2.8, 2.3, 1.9, 1.5, 1.2, 1], wide: 1.06, small: true }),
    // 6+6 posts; each course's two strings run side by side to the nut
    guitar12: () => luthierHead("esp", {
      posts: [[70, 208], [70, 184], [70, 160], [70, 136], [70, 112], [70, 88],
        [130, 88], [130, 112], [130, 136], [130, 160], [130, 184], [130, 208]],
      gauge: [2.8, 1.3, 2.3, 1.1, 1.9, 1, 1.5, 0.9, 1.2, 1.2, 1, 1], wide: 1.06, pairs: true, small: true, tiny: true
    }),
    bass: () => luthierHead("sr", { posts: [[80, 160], [80, 96], [120, 96], [120, 160]], gauge: [4.2, 3.5, 2.8, 2.2] }),
    // 2+3 and 3+3 posts
    bass5: () => luthierHead("sr", { posts: [[80, 170], [80, 118], [120, 92], [120, 131], [120, 170]], gauge: [4.6, 4.2, 3.5, 2.8, 2.2], small: true }),
    bass6: () => luthierHead("sr", { posts: [[80, 170], [80, 131], [80, 92], [120, 92], [120, 131], [120, 170]], gauge: [4.6, 4.2, 3.5, 2.8, 2.2, 1.8], wide: 1.05, small: true }),
    ukulele: () => luthierHead("uke", { posts: [[78, 190], [78, 130], [122, 130], [122, 190]], gauge: [1.5, 1.9, 1.7, 1.4] }),
    violin: () => scrollHead([1.7, 1.4, 1.2, 1], 0.78),
    cello: () => scrollHead([2.6, 2.2, 1.8, 1.5], 1.12)
  };

  /* Fretted headstocks share one way of drawing, so the instruments look
     like a family: a wooden face with cream binding (cream, a fine dark
     line, cream) and a gloss, gold tuners and posts, the 7uner logo in a
     space of its own above the posts, a bound ebony fretboard with a pearl
     block and a bone nut. The looks differ in outline, wood and hardware:
     esp    guitar, after the ESP Eclipse: black face, horns at the outer
            corners and a point in the middle, tulip tuners, bell truss cover
     sr     bass, after the Ibanez SR: a slim head with a slanted, rounded
            end in turquoise curly figured wood, no binding, black winged
            tuners on silver washers, black posts and a black logo
     uke    ukulele: a small crown in maple with small tulip tuners
     wide spreads a look sideways for more strings; edge(y) is where the
     face's left side is at height y (edgeR the right side's, when the head
     isn't symmetrical), so the tuners sit just outside it. */
  const LOOKS = {
    esp: {
      shape: (X) => "M" + X(60) + " 248 L" + X(37) + " 32 Q" + X(35) + " 18 " + X(42) + " 15 C" + X(58) + " 34 " + X(88) + " 46 100 30 C" + X(112) + " 46 " + X(142) + " 34 " + X(158) + " 15 Q" + X(165) + " 18 " + X(163) + " 32 L" + X(140) + " 248 Z",
      edge: (y) => 60 - ((248 - y) * 23) / 216,
      face: "hsBlack", tuner: "tulip", post: "gold", truss: true, neck: [64, 136],
      logo: [62, 20], logoSmall: [66, 17], font: "Georgia, 'Times New Roman', serif"
    },
    sr: {
      shape: (X) => "M" + X(64) + " 248 L" + X(54) + " 44 Q" + X(52) + " 22 " + X(72) + " 20 L" + X(136) + " 32 Q" + X(152) + " 36 " + X(150) + " 56 L" + X(136) + " 248 Z",
      edge: (y) => 64 - ((248 - y) * 10) / 204,
      edgeR: (y) => 136 + ((248 - y) * 14) / 192,
      face: "hsTurq", figure: "flame", binding: false, tuner: "fan", metal: "black", post: "black", neck: [62, 138],
      logo: [52, 18], logoSmall: [52, 16], logoFill: "#0B0B0C", logoUpright: true, font: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    },
    uke: {
      shape: (X) => "M" + X(70) + " 248 L" + X(66) + " 170 Q" + X(65) + " 156 " + X(58) + " 150 L" + X(54) + " 124 Q" + X(52) + " 104 " + X(66) + " 96 Q" + X(78) + " 90 " + X(84) + " 82 Q" + X(88) + " 66 100 62 Q" + X(112) + " 66 " + X(116) + " 82 Q" + X(122) + " 90 " + X(134) + " 96 Q" + X(148) + " 104 " + X(146) + " 124 L" + X(142) + " 150 Q" + X(135) + " 156 " + X(134) + " 170 L" + X(130) + " 248 Z",
      edge: (y) => (y <= 124 ? 54 : y <= 150 ? 54 + ((y - 124) * 4) / 26 : 58 + ((y - 150) * 12) / 98),
      face: "hsMaple", tuner: "tulip", post: "gold", crest: true, neck: [70, 130], tunerScale: 0.8, logoFill: "#3A1F0C", // gold would vanish on maple
      logo: [114, 13], logoSmall: [114, 13], font: "Georgia, 'Times New Roman', serif"
    }
  };

  function luthierHead(name, o) {
    const L = LOOKS[name], w = o.wide || 1, X = (x) => 100 + (x - 100) * w;
    const shape = L.shape(X);
    const edgeX = (y, left) => (left ? X(L.edge(y)) : L.edgeR ? X(L.edgeR(y)) : 200 - X(L.edge(y)));
    const n = o.posts.length, lo = X(L.neck[0] - 2), hi = X(L.neck[1] + 2);
    // nut slots: evenly spread, or in pairs for a 12-string
    const nut = o.pairs
      ? o.posts.map((p, i) => { const course = Math.floor(i / 2), step = (hi - lo) / 5; return lo + course * step + (i % 2 ? 4.4 : 0) - 2.2 + (course === 5 ? -2.2 : 0); })
      : o.posts.map((p, i) => lo + ((hi - lo) * i) / (n - 1));
    const ts = (L.tunerScale || 1) * (o.tiny ? 0.7 : o.small ? 0.85 : 1);
    const r = (L.post === "black" ? 7.5 : 6.5) * (o.tiny ? 0.85 : 1);
    const black = L.metal === "black";
    let tuners = "", strs = "", posts = "";
    o.posts.forEach(([x, y], i) => {
      const left = x < 100, e = edgeX(y, left), d = left ? -1 : 1, b0 = e + d * 6 * ts;
      const key = L.tuner === "fan"
        // a wide winged key, like a bass's
        ? "M" + b0 + " " + (y - 5 * ts) + " L" + (b0 + d * 6 * ts) + " " + (y - 6 * ts) + " Q" + (b0 + d * 16 * ts) + " " + (y - 16 * ts) + " " + (b0 + d * 30 * ts) + " " + (y - 15 * ts) +
          " Q" + (b0 + d * 25 * ts) + " " + y + " " + (b0 + d * 30 * ts) + " " + (y + 15 * ts) + " Q" + (b0 + d * 16 * ts) + " " + (y + 16 * ts) + " " + (b0 + d * 6 * ts) + " " + (y + 6 * ts) + " L" + b0 + " " + (y + 5 * ts) + " Z"
        // a tulip key, flaring away from the headstock
        : "M" + b0 + " " + (y - 4 * ts) + " L" + (b0 + d * 8.4 * ts) + " " + (y - 10 * ts) + " Q" + (b0 + d * 24 * ts) + " " + (y - 11 * ts) + " " + (b0 + d * 24 * ts) + " " + y +
          " Q" + (b0 + d * 24 * ts) + " " + (y + 11 * ts) + " " + (b0 + d * 8.4 * ts) + " " + (y + 10 * ts) + " L" + b0 + " " + (y + 4 * ts) + " Z";
      tuners += '<rect x="' + Math.min(e, b0) + '" y="' + (y - 2.5 * ts) + '" width="' + 6 * ts + '" height="' + 5 * ts + '" fill="url(#' + (black ? "hsChrome" : "hsGold") + ')"/>' +
          '<path d="' + key + '" fill="url(#' + (black ? "hsBlackKey" : "hsGold") + ')" stroke="' + (black ? "#000" : "#7A5A14") + '" stroke-width=".8"/>';
      strs += strPath(i, x, y, nut[i], o.gauge[i]);
      posts += '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 2) + '" fill="#000" opacity=".5"/>' +
          (L.post === "black"
            // a black bushing with a silver ring and the slotted post
            ? '<circle class="gpost" data-i="' + i + '" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#hsBlackPost)" stroke="#000" stroke-width=".8"/>' +
              '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.62 + '" fill="none" stroke="url(#hsChrome)" stroke-width="1.4"/>' +
              '<path d="M' + (x - r * 0.35) + " " + y + " L" + (x + r * 0.35) + " " + y + '" stroke="#000" stroke-width="1.2"/>'
            : '<circle class="gpost" data-i="' + i + '" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#hsBrassPost)" stroke="#6E5212" stroke-width=".8"/>' +
              '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.38 + '" fill="#C9A13C" stroke="#6E5212" stroke-width=".6"/>');
    });
    // curly figure: wavy bands across the face, clipped to it
    const clip = "hsClip" + name;
    const figure = L.figure === "flame" ? '<clipPath id="' + clip + '"><path d="' + shape + '"/></clipPath><g clip-path="url(#' + clip + ')" fill="none" stroke="#063F3D" stroke-width="2.2" opacity=".35">' +
        Array.from({ length: 22 }, (_, k) => { const y = 26 + k * 10; return '<path d="M30 ' + y + " Q" + 60 + " " + (y - 4) + " 85 " + y + " T140 " + y + " T175 " + (y + 1) + '"/>'; }).join("") + "</g>" : "";
    // a carved crest at the top of a crowned head
    const crest = L.crest ? '<path d="M' + 92 + " " + (name === "uke" ? 76 : 30) + " Q100 " + (name === "uke" ? 66 : 18) + " 108 " + (name === "uke" ? 76 : 30) + '" fill="none" stroke="url(#hsGold)" stroke-width="1.6"/>' +
        '<circle cx="100" cy="' + (name === "uke" ? 76 : 32) + '" r="' + (name === "uke" ? 2.4 : 4) + '" fill="url(#hsAbalone)" stroke="url(#hsGold)" stroke-width="1"/>' : "";
    const [ly, ls] = o.small || o.tiny ? L.logoSmall : L.logo;
    const neck = [X(L.neck[0]), X(L.neck[1])];
    return '<svg class="headstock" viewBox="0 0 200 320" aria-hidden="true">' + DEFS + tuners +
        (L.binding === false
          ? '<path d="' + shape + '" fill="url(#' + L.face + ')" stroke="#07302F" stroke-width="1.6" stroke-linejoin="round"/>' + figure
          : '<path d="' + shape + '" fill="url(#' + L.face + ')" stroke="#EDE3C8" stroke-width="5" stroke-linejoin="round"/>' + figure +
            '<path d="' + shape + '" fill="none" stroke="#0B0B0C" stroke-width="1.4" stroke-linejoin="round"/>') +
        '<path d="' + shape + '" fill="url(#hsGloss)"/>' + crest +
        '<text x="100" y="' + ly + '" text-anchor="middle" fill="' + (L.logoFill || "url(#hsGold)") + '" font-family="' + L.font.replace(/'/g, "&#39;") + '" font-style="' + (L.logoUpright ? "normal" : "italic") + '" font-weight="700" font-size="' + ls + '" letter-spacing="' + (L.logoUpright ? ".5" : "0") + '">7uner</text>' +
        (L.truss ? '<path d="M89 238 L92 210 Q100 199 108 210 L111 238 Z" fill="#0B0B0C" stroke="#EDE3C8" stroke-width="1.4"/><circle cx="100" cy="210" r="1.6" fill="url(#hsGold)"/>' : "") +
        '<rect x="' + neck[0] + '" y="252" width="' + (neck[1] - neck[0]) + '" height="70" fill="#141416"/>' +
        '<rect x="' + (neck[0] - 2) + '" y="252" width="2.5" height="70" fill="#EDE3C8"/><rect x="' + (neck[1] - 0.5) + '" y="252" width="2.5" height="70" fill="#EDE3C8"/>' +
        '<rect x="' + neck[0] + '" y="294" width="' + (neck[1] - neck[0]) + '" height="2.5" fill="url(#hsChrome)"/>' +
        '<path d="M' + (neck[0] + 10) + " 304 L" + (neck[1] - 10) + " 304 L" + (neck[1] - 14) + " 322 L" + (neck[0] + 14) + ' 322 Z" fill="url(#hsPearl)" opacity=".9"/>' +
        '<rect x="' + (neck[0] - 3) + '" y="245" width="' + (neck[1] - neck[0] + 6) + '" height="8" rx="2" fill="#F3EEDF"/>' +
        strs + posts + "</svg>";
  }

  // scroll, pegbox and side-mounted pegs (violin, cello); k sets the size,
  // growing from the nut, so the cello's head is clearly bigger than the violin's
  function scrollHead(gauge, k) {
    const M = (x, y) => [100 + (x - 100) * k, 248 - (248 - y) * k];
    const ends = [[90, 130], [95, 190], [105, 190], [110, 130]].map(([x, y]) => M(x, y)), nut = [88, 96, 104, 112].map((x) => M(x, 249)[0]);
    let strs = "", pegs = "";
    ends.forEach(([x, y], i) => {
      strs += '<path class="gstr" data-i="' + i + '" stroke-width="' + gauge[i] + '" d="M' + x + " " + y + " L" + nut[i] + " 249 L" + nut[i] + ' 320"/>' +
          '<circle class="gpost" data-i="' + i + '" cx="' + x + '" cy="' + y + '" r="' + 4 * k + '" fill="none"/>'; // where the string meets its peg
    });
    [130, 190].forEach((y) => {
      pegs += '<rect x="58" y="' + (y - 3) + '" width="84" height="6" rx="3" fill="#1B1411"/>' +
          '<ellipse cx="44" cy="' + y + '" rx="15" ry="11" fill="url(#hsEbony)" stroke="#000" stroke-width="1"/>' +
          '<circle cx="62" cy="' + y + '" r="5" fill="#2A221E" stroke="#000" stroke-width="1"/>' +
          '<ellipse cx="156" cy="' + y + '" rx="15" ry="11" fill="url(#hsEbony)" stroke="#000" stroke-width="1"/>' +
          '<circle cx="138" cy="' + y + '" r="5" fill="#2A221E" stroke="#000" stroke-width="1"/>';
    });
    const fb = [100 - 14 * k, 28 * k];
    return '<svg class="headstock" viewBox="0 0 200 320" aria-hidden="true">' + DEFS +
        '<g transform="matrix(' + k + " 0 0 " + k + " " + 100 * (1 - k) + " " + 248 * (1 - k) + ')">' +
        '<circle cx="100" cy="58" r="26" fill="url(#hsVarnish)" stroke="#3A1505" stroke-width="1.5"/>' +
        '<path d="M100 58 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0" fill="none" stroke="#3A1505" stroke-width="2"/>' +
        '<path d="M84 248 L80 98 Q80 82 92 80 L108 80 Q120 82 120 98 L116 248 Z" fill="url(#hsVarnish)" stroke="#3A1505" stroke-width="1.5"/>' +
        '<path d="M89 240 L86 104 L114 104 L111 240 Z" fill="#2A1208"/>' +
        '<path d="M84 248 L80 98 Q80 82 92 80 L108 80 Q120 82 120 98 L116 248 Z" fill="url(#hsGloss)"/>' +
        '<circle cx="100" cy="58" r="26" fill="url(#hsGloss)"/>' + pegs + "</g>" +
        '<rect x="' + fb[0] + '" y="252" width="' + fb[1] + '" height="70" fill="url(#hsEbony)" stroke="#55555C" stroke-width="1"/>' +
        '<rect x="' + (fb[0] - 2) + '" y="245" width="' + (fb[1] + 4) + '" height="7" rx="2" fill="#1B1B1E" stroke="#000" stroke-width="1"/>' +
        strs + "</svg>";
  }

  /* ---------- instrument panel ---------- */
  let strEls = [], pegEls = [], postEls = [], pstrobe = null, lock = null, tuned = [];
  const SVGNS = "http://www.w3.org/2000/svg";

  function buildInstrument() {
    const I = instr();
    if (!I) return;
    el.head.innerHTML = HEADS[ikey()]();
    strEls = []; postEls = [];
    el.head.querySelectorAll(".gstr").forEach((p) => { strEls[+p.dataset.i] = p; });
    el.head.querySelectorAll(".gpost").forEach((p) => { postEls[+p.dataset.i] = p; });

    // strobe rings that sit on the post of the string being tuned (see drawStage)
    const r = +postEls[0].getAttribute("r") || 6;
    const ring = (rad, n) => { const d = (Math.PI * rad) / n; return '<circle r="' + rad + '" stroke-dasharray="' + d.toFixed(2) + " " + d.toFixed(2) + '"/>'; };
    pstrobe = document.createElementNS(SVGNS, "g");
    pstrobe.setAttribute("class", "pstrobe");
    pstrobe.innerHTML = ring(r * 2, 10) + ring(r * 2.9, 16);
    el.head.querySelector("svg").appendChild(pstrobe);

    const n = I.base.length;
    [[el.pegsL, I.rows], [el.pegsR, I.rowsR || I.rows]].forEach(([side, [y0, gap]]) => {
      side.style.setProperty("--ptf", (y0 - gap / 2) / 200);
      side.style.setProperty("--phf", gap / 200);
    });

    pegEls = [];
    el.pegsL.innerHTML = ""; el.pegsR.innerHTML = "";
    const make = (i) => {
      const d = document.createElement("div"), num = n - i;
      d.className = "peg";
      // ▲ ▼ only show beside the string that's selected
      d.innerHTML =
          '<div class="parr" hidden>' +
          '<button data-d="1" aria-label="Tune string ' + num + ' up a semitone">▲</button>' +
          '<button data-d="-1" aria-label="Tune string ' + num + ' down a semitone">▼</button></div>' +
          '<button class="pn" aria-pressed="false" aria-label="Lock to string ' + num + '"><span class="pnote"></span><span class="poff"></span></button>';
      d.querySelectorAll(".parr button").forEach((b) => b.addEventListener("click", () => { setOffset(i, offs()[i] + +b.dataset.d); playRef(i); }));
      // tapping a note locks the tuner to that string and plays it;
      // tapping it again goes back to detecting the string
      d.querySelector(".pn").addEventListener("click", () => {
        if (lock === i) { setLock(null); return; }
        setLock(i);
        playRef(i);
      });
      pegEls[i] = d;
      return d;
    };
    I.left.forEach((i) => el.pegsL.appendChild(make(i)));
    I.right.forEach((i) => el.pegsR.appendChild(make(i)));

    lock = null;
    tuned = I.base.map(() => false);
    renderPegs();
  }

  function renderPegs() {
    const I = instr();
    if (!I) return;
    const o = offs();
    for (let i = 0; i < I.base.length; i++) {
      const m = target(i), d = pegEls[i];
      d.querySelector(".pnote").innerHTML = noteName(m) + "<sub>" + octave(m) + "</sub>";
      d.querySelector(".poff").textContent = o[i] === 0 ? "" : (o[i] > 0 ? "+" : "−") + Math.abs(o[i]);
      d.querySelector(".pn").setAttribute("aria-pressed", lock === i ? "true" : "false");
      d.querySelector(".parr").hidden = lock !== i;
      const [up, down] = d.querySelectorAll(".parr button");
      up.disabled = o[i] >= I.offMax; down.disabled = o[i] <= I.offMin;
      d.classList.toggle("tuned", tuned[i]);
      strEls[i].classList.toggle("tuned", tuned[i]);
      strEls[i].classList.toggle("locked", lock === i);
    }
    renderPick();
    el.auto.setAttribute("aria-checked", lock === null ? "true" : "false");
    const all = tuned.length > 0 && tuned.every(Boolean);
    el.allIn.hidden = !all;
    el.panel.classList.toggle("allin-on", all);
  }

  function setOffset(i, v) {
    offs()[i] = clampOff(ikey(), v);
    tuned[i] = false;
    save(); renderPegs(); resetReading();
  }
  function setLock(i) { lock = i; resetReading(); renderPegs(); }

  /* Reference tone: when a string is locked, play its target pitch once for
     about a second. The tuner ignores the microphone while it sounds, so it
     doesn't tune to its own reference. */
  const REF_SEC = 1;
  let outCtx = null, muteUntil = 0;
  function playRef(i) {
    try {
      if (!outCtx) outCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (outCtx.state === "suspended") outCtx.resume();
    } catch (e) { return; }
    const t = outCtx.currentTime + 0.02, f = mtof(target(i)), bowed = st.mode === "violin" || st.mode === "cello";
    const o = outCtx.createOscillator(), o2 = outCtx.createOscillator();
    const lp = outCtx.createBiquadFilter(), g = outCtx.createGain();
    o.type = "sawtooth"; o.frequency.value = f;
    o2.type = "triangle"; o2.frequency.value = f;
    lp.type = "lowpass"; lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t);
    if (bowed) {
      lp.frequency.setValueAtTime(Math.min(8000, f * 6), t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
      g.gain.setValueAtTime(0.14, t + REF_SEC - 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + REF_SEC);
    } else {
      lp.frequency.setValueAtTime(Math.min(9000, Math.max(1200, f * 10)), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), t + REF_SEC);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + REF_SEC);
    }
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(outCtx.destination);
    o.start(t); o2.start(t);
    o.stop(t + REF_SEC + 0.05); o2.stop(t + REF_SEC + 0.05);
    muteUntil = performance.now() + (REF_SEC + 0.2) * 1000;
  }

  // the string being played vibrates (CSS) and glows amber, or green when in tune
  function highlight(idx, inTune) {
    for (let k = 0; k < pegEls.length; k++) {
      const on = k === idx;
      pegEls[k].classList.toggle("active", on && !inTune);
      pegEls[k].classList.toggle("in", on && inTune);
      strEls[k].classList.toggle("active", on && !inTune);
      strEls[k].classList.toggle("in", on && inTune);
    }
  }

  /* ---------- mode picker ---------- */
  function buildModes() {
    el.modes.innerHTML = MODES.map((m) =>
        '<button role="radio" data-mode="' + m + '" aria-checked="false">' +
        '<svg viewBox="0 0 32 32" aria-hidden="true">' + ICONS[m] + "</svg>" +
        "<span>" + (INSTR[m] ? INSTR[m].label : "Chromatic") + "</span></button>").join("");
    el.modes.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    el.modes.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = MODES[(MODES.indexOf(st.mode) + d + MODES.length) % MODES.length];
      setMode(next);
      el.modes.querySelector('[data-mode="' + next + '"]').focus();
    });
  }

  /* ---------- strings and tuning ----------
     One quiet button under the headstock ("6 strings · Standard") opens a
     bubble with the number of strings (guitar and bass) and the tunings. */
  const presetIndex = () => { const o = offs(); return instr().presets.findIndex((p) => p[1].every((v, j) => v === o[j])); };
  function renderPick() {
    const I = instr();
    if (!I) return;
    const k = presetIndex(), counts = COUNTS[st.mode];
    el.pickLab.innerHTML = (counts ? "<b>" + st.strings[st.mode] + "</b> strings · " : "") + (k >= 0 ? I.presets[k][0] : "Custom");
    el.count.hidden = !counts;
    el.count.innerHTML = counts ? counts.map((n) => {
      const on = n === st.strings[st.mode];
      return '<button role="radio" data-n="' + n + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" aria-label="' + n + ' strings">' + n + "</button>";
    }).join("") : "";
    el.preset.innerHTML = I.presets.map((p, j) =>
        '<button role="radio" data-k="' + j + '" aria-checked="' + (j === k) + '" tabindex="' + (j === k || (k < 0 && j === 0) ? 0 : -1) + '">' + p[0] + "</button>").join("") +
        (k < 0 ? '<button role="radio" aria-checked="true" tabindex="-1" disabled>Custom</button>' : "");
  }
  function setCount(n) {
    if (!COUNTS[st.mode] || !COUNTS[st.mode].includes(n) || n === st.strings[st.mode]) return;
    st.strings[st.mode] = n;
    save(); applyMode();
    const b = el.count.querySelector('[data-n="' + n + '"]');
    if (b) b.focus();
  }
  function setPreset(k) {
    const I = instr();
    if (!I || !I.presets[k]) return;
    st.offsets[ikey()] = I.presets[k][1].slice();
    tuned = I.base.map(() => false);
    lock = null;
    save(); renderPegs(); resetReading();
    const b = el.preset.querySelector('[data-k="' + k + '"]');
    if (b) b.focus();
  }
  const togglePick = (open) => { el.pickPop.hidden = !open; el.pick.setAttribute("aria-expanded", open ? "true" : "false"); };
  el.pick.addEventListener("click", () => togglePick(el.pickPop.hidden));
  document.addEventListener("click", (e) => { if (!el.pickPop.hidden && !e.target.closest(".tset")) togglePick(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.pickPop.hidden) { togglePick(false); el.pick.focus(); } });
  el.count.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setCount(+b.dataset.n); });
  el.preset.addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (b) setPreset(+b.dataset.k); });
  // arrow keys move within each radio group
  [[el.count, () => COUNTS[st.mode] || [], () => st.strings[st.mode], setCount],
    [el.preset, () => instr().presets.map((p, j) => j), () => presetIndex(), setPreset]].forEach(([box, list, cur, set]) => {
    box.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      const l = list();
      if (!d || !l.length) return;
      e.preventDefault();
      set(l[(Math.max(0, l.indexOf(cur())) + d + l.length) % l.length]);
    });
  });

  function applyMode() {
    el.modes.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.mode === st.mode;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    el.panel.hidden = !instr();
    el.autoRow.hidden = !instr();
    togglePick(false);
    el.root.classList.toggle("mode-instrument", !!instr());
    buildInstrument();
    resetReading(); // also clears the last reading, so nothing from the previous mode stays on screen
    clearHistory();
    resize();
  }
  function setMode(m) { if (m === st.mode || !MODES.includes(m)) return; st.mode = m; save(); applyMode(); }

  /* ---------- readout ---------- */
  function fmtCents(c, dec) {
    const v = Math.abs(c) < Math.pow(10, -dec) / 2 ? 0 : c;
    return (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(dec) + " cents";
  }

  /* What the stage draws: the latest reading, shown as it is heard (the
     detector already steadies it a little with a median and a short
     average, so it doesn't shake). */
  const view = { active: false, cents: 0, ok: false, idx: null, tgt: null, phase: 0, t: 0, hist: [] };

  function show(freq, targetMidi, cents, stringIdx) {
    const c = cfg(), ok = Math.abs(cents) <= c.inTune;
    el.note.textContent = noteName(targetMidi);
    el.oct.textContent = octave(targetMidi);
    el.hz.innerHTML = '<span class="nw"><b>' + freq.toFixed(c.decimals ? 2 : 1) + "</b> Hz</span>" +
        (stringIdx != null ? ' &nbsp;<span class="nw tgt">target ' + mtof(targetMidi).toFixed(2) + " Hz</span>" : "");
    el.cents.textContent = fmtCents(cents, c.decimals);
    el.sub.textContent = stringIdx != null ? "String " + (instr().base.length - stringIdx) + (lock !== null ? " (locked)" : "") : "";
    el.readout.classList.remove("idle");
    el.readout.classList.toggle("in", ok);
    Object.assign(view, { active: true, cents, ok, idx: stringIdx, tgt: targetMidi });
    if (instr()) highlight(stringIdx, ok);
  }

  // nothing is being played: show a dash rather than a note that isn't there
  function idle() {
    el.readout.classList.add("idle");
    el.readout.classList.remove("in");
    el.note.textContent = "–";
    el.oct.textContent = "";
    el.hz.innerHTML = "";
    el.cents.textContent = "";
    el.sub.textContent = instr() && lock !== null ? "String " + (instr().base.length - lock) + " (locked)" : "";
    view.active = false; view.idx = null; view.tgt = null;
    if (instr()) highlight(-1, false);
  }

  /* ---------- stage ----------
     A gauge (a ±range arc with the in-tune zone and a dot for the reading)
     with the history scrolling down beneath it, like a chart recorder. In
     instrument modes a strobe also turns on the headstock post of the string
     being tuned. */
  const SPAN = (60 * Math.PI) / 180; // the gauge runs 60° either side of straight up
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let colors = null;
  const readColors = () => { colors = { ok: cssVar("--ok"), okSoft: cssVar("--ok-soft"), amber: cssVar("--amber"), line: cssVar("--line"), muted: cssVar("--muted"), ink: cssVar("--ink") }; };

  // in instrument modes the canvas reaches down behind the instrument, so
  // the history scrolls on behind it
  function resize() {
    const top = el.stage.getBoundingClientRect().top;
    el.canvas.style.height = instr() && !el.panel.hidden ? Math.max(el.stage.offsetHeight, el.panel.getBoundingClientRect().bottom - top) + "px" : "";
    const r = el.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = Math.round(r.width * dpr);
    el.canvas.height = Math.round(r.height * dpr);
    readColors();
    drawStage(performance.now());
  }

  function drawStage(now) {
    const cv = el.canvas, g = cv.getContext("2d"), W = cv.width, H = cv.height;
    if (!W || !H) return;
    if (!colors) readColors();
    const dpr = window.devicePixelRatio || 1, c = cfg(), K = colors;
    const dt = Math.min(0.1, Math.max(0, (now - (view.t || now)) / 1000));
    view.t = now;
    if (view.active) view.phase = (view.phase + dt * view.cents * STROBE) % 360;
    const col = !view.active ? K.muted : view.ok ? K.ok : K.amber;

    // geometry: the arc at the top, the history filling the space below it
    // the arc fills the stage box; in instrument modes the canvas goes on below it
    const arcH = el.stage.clientHeight * dpr;
    const R = instr() ? Math.min(W * 0.36, (arcH - 40 * dpr) * 1.7) : Math.min(W * 0.42, arcH * 0.42);
    const cx = W / 2, cy = R + 30 * dpr;
    const ang = (cents) => -Math.PI / 2 + Math.max(-1, Math.min(1, cents / c.range)) * SPAN;
    const A0 = -Math.PI / 2 - SPAN, A1 = -Math.PI / 2 + SPAN;
    g.clearRect(0, 0, W, H);
    g.lineCap = "round";
    drawHistory(g, now, cx, cy, R, dpr, c, H);

    // in-tune zone, scale, ticks and labels
    g.lineWidth = 10 * dpr; g.strokeStyle = K.okSoft;
    g.beginPath(); g.arc(cx, cy, R, ang(-c.inTune), ang(c.inTune)); g.stroke();
    g.lineWidth = 1.5 * dpr; g.strokeStyle = K.line;
    g.beginPath(); g.arc(cx, cy, R, A0, A1); g.stroke();
    for (let k = -4; k <= 4; k++) {
      const a = ang((k * c.range) / 4), len = (k === 0 ? 11 : k % 2 ? 4 : 7) * dpr;
      g.strokeStyle = k === 0 ? K.muted : K.line;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + 3 * dpr), cy + Math.sin(a) * (R + 3 * dpr));
      g.lineTo(cx + Math.cos(a) * (R + 3 * dpr + len), cy + Math.sin(a) * (R + 3 * dpr + len)); g.stroke();
    }
    g.fillStyle = K.muted; g.font = 11 * dpr + "px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    [[-c.range, "−" + c.range], [0, "0"], [c.range, "+" + c.range]].forEach(([v, t]) => {
      const a = ang(v), rr = R + 24 * dpr;
      g.fillText(t, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    });

    // the reading
    if (view.active) {
      const a = ang(view.cents), x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      g.save();
      if (view.ok) { g.shadowColor = K.ok; g.shadowBlur = 14 * dpr; }
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 7 * dpr, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    if (instr()) placePostStrobe();
  }

  /* history: like a chart recorder. The newest reading sits on the arc right
     where the dot is, and the trace scrolls down from there and slowly fades,
     over a faint in-tune band and centre line. */
  function drawHistory(g, now, cx, cy, R, dpr, c, H) {
    const clamp = (v) => Math.max(-1, Math.min(1, v / c.range));
    const xOf = (v) => cx + R * Math.sin(SPAN * clamp(v));
    const yArc = (v) => cy - R * Math.cos(SPAN * clamp(v));
    const speed = (HIST_SPEED * dpr) / 1000, maxAge = (H - (cy - R)) / speed;
    if (view.active) view.hist.push({ t: now, c: view.cents, ok: view.ok, k: view.idx != null ? view.idx : view.tgt });
    const h = view.hist;
    while (h.length && now - h[0].t > maxAge) h.shift();

    // in-tune band and centre line, under the arc
    const top = cy - R;
    g.globalAlpha = 0.4; g.fillStyle = colors.okSoft;
    g.fillRect(xOf(-c.inTune), top, xOf(c.inTune) - xOf(-c.inTune), H - top);
    g.globalAlpha = 0.7; g.fillStyle = colors.line;
    g.fillRect(cx - 0.5 * dpr, top, dpr, H - top);
    g.globalAlpha = 1;

    g.lineWidth = 3 * dpr; g.lineJoin = "round";
    for (let i = 1; i < h.length; i++) {
      const a = h[i - 1], b = h[i];
      if (b.t - a.t > 150 || a.k !== b.k) continue; // a pause, or another string or note: don't join them
      const age = (now - b.t) / maxAge;
      g.globalAlpha = (1 - 0.75 * age) * (instr() ? 0.45 : 1); // fainter behind an instrument
      g.strokeStyle = b.ok ? colors.ok : colors.amber;
      g.beginPath();
      g.moveTo(xOf(a.c), yArc(a.c) + (now - a.t) * speed);
      g.lineTo(xOf(b.c), yArc(b.c) + (now - b.t) * speed);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // instrument modes: the strobe rings turn on the post of the string being tuned
  function placePostStrobe() {
    if (!pstrobe) return;
    const i = view.active ? view.idx : null, p = i != null ? postEls[i] : null;
    pstrobe.classList.toggle("on", !!p);
    if (!p) return;
    pstrobe.classList.toggle("in", view.ok);
    pstrobe.setAttribute("transform", "translate(" + p.getAttribute("cx") + " " + p.getAttribute("cy") + ")");
    const [inner, outer] = pstrobe.children;
    inner.setAttribute("transform", "rotate(" + view.phase.toFixed(2) + ")");
    outer.setAttribute("transform", "rotate(" + (view.phase * 1.6).toFixed(2) + ")");
  }

  /* ---------- listening ---------- */
  let ctx = null, stream = null, analyser = null, buf = null, raf = 0, lastTick = 0, running = false;
  let recent = [], smooth = null, lastKey = null, silent = 0, prevRms = 0, skip = 0, inTuneSince = null;

  function resetReading() { recent = []; smooth = null; lastKey = null; inTuneSince = null; idle(); }
  const clearHistory = () => { view.hist = []; };

  function chooseString(midi) {
    if (lock !== null) return lock;
    const n = instr().base.length;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(midi - target(i));
      if (d < bd - 1e-6 || (Math.abs(d - bd) < 1e-6 && tuned[best] && !tuned[i])) { bd = d; best = i; }
    }
    // hysteresis: stay on the current string unless another one is clearly closer
    if (lastKey !== null && lastKey !== best && lastKey < n && Math.abs(midi - target(lastKey)) <= bd + 0.35) return lastKey;
    return best;
  }

  // the stage animates every frame; the pitch is read every TICK_MS
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastTick >= TICK_MS) { lastTick = now; listen(now); }
    drawStage(now);
  }

  function listen(now) {
    if (now < muteUntil) { prevRms = 0; skip = 0; return; }
    const c = cfg();
    analyser.getFloatTimeDomainData(buf);
    const r = detect(buf, ctx.sampleRate, c);

    // the first moments of a pluck ring sharp; ignore them
    if (r.rms > 0.01 && r.rms > prevRms * 1.8) { skip = c.onsetSkip; recent = []; }
    prevRms = r.rms;
    if (skip > 0) { skip--; return; }

    if (r.f > 0 && r.clarity >= c.clarity) {
      silent = 0;
      const midiF = 69 + 12 * Math.log2(r.f / st.a4);
      recent.push(midiF);
      if (recent.length > c.median) recent.shift();
      const med = median(recent);

      let key, tgt, idx = null;
      if (instr()) { idx = chooseString(med); key = idx; tgt = target(idx); }
      else { tgt = Math.round(med); key = tgt; }
      const cents = (med - tgt) * 100;

      if (key !== lastKey || smooth === null) { smooth = cents; lastKey = key; inTuneSince = null; }
      else {
        const d = Math.abs(cents - smooth);
        const k = instr() ? (d > 20 ? 0.8 : d > 6 ? 0.4 : 0.15) : (d > 20 ? 0.8 : 0.45);
        smooth += (cents - smooth) * k;
      }

      show(mtof(med), tgt, smooth, idx);

      if (instr()) {
        if (Math.abs(smooth) <= c.inTune) {
          if (inTuneSince === null) inTuneSince = now;
          else if (now - inTuneSince >= HOLD_MS && !tuned[idx]) { tuned[idx] = true; renderPegs(); }
        } else inTuneSince = null;
      }
    } else {
      silent++;
      if (silent > SILENCE_TICKS) { if (lastKey !== null || smooth !== null || view.active) resetReading(); }
    }
  }

  /* ---------- microphone ---------- */
  async function start() {
    if (running) return;
    el.status.textContent = "Waiting for microphone permission…";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      el.status.textContent = "This browser doesn’t support microphone access, or the page wasn’t opened over HTTPS.";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (e) {
      el.status.textContent = e && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow the microphone in your browser’s site settings and try again."
          : "Couldn’t access the microphone. Another app may be using it.";
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    // remove rumble and DC below the lowest note, and hiss above the highest
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 20; hp.Q.value = 0.707;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5000; lp.Q.value = 0.707;
    analyser = ctx.createAnalyser();
    const all = [CHROMATIC].concat(Object.keys(INSTR).map((k) => INSTR[k].cfg));
    analyser.fftSize = Math.min(32768, Math.max.apply(null, all.map((c) => windowLen(ctx.sampleRate, c))));
    src.connect(hp).connect(lp).connect(analyser);
    buf = new Float32Array(analyser.fftSize);
    running = true;
    el.cover.hidden = true;
    resize();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close();
    ctx = stream = analyser = null;
    resetReading();
    clearHistory();
    drawStage(performance.now());
    el.cover.hidden = false;
    el.status.textContent = "The microphone turns off when you leave the tuner.";
  }

  function setA4(v) {
    v = Math.max(415, Math.min(466, Math.round(+v || 440)));
    st.a4 = v;
    el.a4.value = v;
    save();
    resetReading();
  }

  /* ---------- wiring ---------- */
  buildModes();
  el.a4.value = st.a4;

  // auto-detect, in the settings bubble: off locks to the string last heard (or the lowest)
  el.auto.addEventListener("click", () => {
    if (!instr()) return;
    if (lock !== null) setLock(null);
    else setLock(lastKey !== null && instr().base[lastKey] !== undefined ? lastKey : 0);
  });
  el.start.addEventListener("click", start);
  el.a4.addEventListener("change", () => setA4(el.a4.value));
  el.a4d.addEventListener("click", () => setA4(st.a4 - 1));
  el.a4u.addEventListener("click", () => setA4(st.a4 + 1));
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  // follow the site's light/dark theme
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); drawStage(performance.now()); });

  applyMode();

  window.tuner = { start, stop, resize, isRunning: () => running, icons: ICONS };
})();
