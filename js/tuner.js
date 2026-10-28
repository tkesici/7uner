/* 7uner – chromatic and instrument tuner (guitar, bass, ukulele, violin, cello)
   Pitch detection (McLeod Pitch Method) lives in pitch.js; the display is a
   gauge with a scrolling history under it, plus turning strobe rings on the
   headstock post of the string being tuned (instrument modes).
   All audio processing happens in the browser; nothing is sent to a server. */
(function () {
  "use strict";

  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

  /* Chromatic mode: any instrument, nearest note. */
  const CHROMATIC = { inTune: 5, range: 50, minF: 27, maxF: 4200, windowSec: 0.085, clarity: 0.5, median: 5, onsetSkip: 2, decimals: 0 };

  /* Instrument modes are stricter: a ±2 cent in-tune zone, a ±25 cent scale,
     longer analysis windows and heavier smoothing.
     base: open-string MIDI notes, lowest-pitched string first.
     left/right: which strings sit on each side of the headstock, top to bottom.
     rows: y of the first peg and the gap between pegs, in headstock units (200×320);
     rowsR, when the right side's pegs sit differently from the left side's.
     Extended-range guitars and basses (guitar7, guitar12, bass5, ...) are
     variants of their mode, picked with the string-count dial (COUNTS). */
  const GUITAR_CFG = { inTune: 2, range: 25, minF: 38, maxF: 1400, windowSec: 0.17, clarity: 0.7, median: 7, onsetSkip: 5, decimals: 1 };
  const BASS_CFG = { inTune: 2, range: 25, minF: 25, maxF: 600, windowSec: 0.22, clarity: 0.7, median: 7, onsetSkip: 6, decimals: 1 };
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
      left: [2, 1, 0], right: [3, 4, 5, 6], rows: [100, 50], rowsR: [50, 50],
      cfg: GUITAR_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0, 0, 0, 0]],
        ["Drop A", [-2, 0, 0, 0, 0, 0, 0]]
      ]
    },
    guitar8: {
      label: "Guitar", base: [30, 35, 40, 45, 50, 55, 59, 64], offMin: -12, offMax: 5,
      left: [3, 2, 1, 0], right: [4, 5, 6, 7], rows: [50, 50],
      cfg: GUITAR_CFG,
      presets: [
        ["Standard", [0, 0, 0, 0, 0, 0, 0, 0]],
        ["Drop E", [-2, 0, 0, 0, 0, 0, 0, 0]]
      ]
    },
    guitar12: {
      label: "Guitar", base: [40, 52, 45, 57, 50, 62, 55, 67, 59, 59, 64, 64], offMin: -12, offMax: 5,
      left: [5, 4, 3, 2, 1, 0], right: [6, 7, 8, 9, 10, 11], rows: [46, 36],
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
      left: [1, 0], right: [2, 3], rows: [100, 75],
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
      left: [1, 0], right: [2, 3, 4], rows: [118, 58], rowsR: [60, 58],
      cfg: BASS_CFG,
      presets: [["Standard", [0, 0, 0, 0, 0]]]
    },
    bass6: {
      label: "Bass", base: [23, 28, 33, 38, 43, 48], offMin: -12, offMax: 5,
      left: [2, 1, 0], right: [3, 4, 5], rows: [60, 58],
      cfg: BASS_CFG,
      presets: [["Standard", [0, 0, 0, 0, 0, 0]]]
    },
    ukulele: {
      label: "Ukulele", base: [67, 60, 64, 69], offMin: -12, offMax: 5,
      left: [1, 0], right: [2, 3], rows: [130, 60],
      cfg: { inTune: 2, range: 25, minF: 110, maxF: 1600, windowSec: 0.1, clarity: 0.7, median: 7, onsetSkip: 4, decimals: 1 },
      presets: [
        ["Standard", [0, 0, 0, 0]],
        ["Low G", [-12, 0, 0, 0]],
        ["D tuning", [2, 2, 2, 2]]
      ]
    },
    violin: {
      label: "Violin", base: [55, 62, 69, 76], offMin: -5, offMax: 3,
      left: [0, 1], right: [3, 2], rows: [130, 60],
      cfg: { inTune: 2, range: 25, minF: 130, maxF: 3000, windowSec: 0.1, clarity: 0.7, median: 7, onsetSkip: 2, decimals: 1 },
      presets: [
        ["Standard", [0, 0, 0, 0]],
        ["Cross tuning", [2, 2, 0, 0]],
        ["Scordatura", [2, 0, 0, 0]],
        ["GDGD", [0, 0, -2, -2]]
      ]
    },
    cello: {
      label: "Cello", base: [36, 43, 50, 57], offMin: -5, offMax: 3,
      left: [0, 1], right: [3, 2], rows: [130, 60],
      cfg: { inTune: 2, range: 25, minF: 55, maxF: 1500, windowSec: 0.17, clarity: 0.7, median: 7, onsetSkip: 3, decimals: 1 },
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
    preset: $("tPreset"), auto: $("tAuto"), autoPill: $("tAutoPill"), pegsL: $("pegsL"), pegsR: $("pegsR"), head: $("tHead"),
    canvas: $("tStrobe"), cover: $("tCover"), start: $("tStart"), status: $("tStatus"), stop: $("tStop"),
    a4: $("a4"), a4d: $("a4Down"), a4u: $("a4Up"), presetWrap: $("tPresetWrap"),
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
      '</defs>';

  const logo = (y, size, color) => '<text x="100" y="' + y + '" text-anchor="middle" fill="' + (color || "#F2B33D") + '" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="' + size + '">7uner</text>';
  const strPath = (i, x, y, nx, w) => '<path class="gstr" data-i="' + i + '" stroke-width="' + w + '" d="M' + x + " " + y + " L" + nx + " 249 L" + nx + ' 320"/>';

  // machine-head style headstock (guitar, bass, ukulele)
  function machineHead(o) {
    let knobs = "", strs = "", posts = "";
    o.posts.forEach(([x, y], i) => {
      const left = x < 100, k = o.knob;
      const kx = left ? k.inner - k.w : 200 - k.inner, sx = left ? k.inner - 4 : 200 - k.inner - k.shaft + 4;
      knobs += '<rect x="' + sx + '" y="' + (y - k.sh / 2) + '" width="' + k.shaft + '" height="' + k.sh + '" fill="#8E939B"/>' +
          '<rect x="' + kx + '" y="' + (y - k.h / 2) + '" width="' + k.w + '" height="' + k.h + '" rx="' + k.r + '" fill="' + k.fill + '" stroke="' + k.stroke + '" stroke-width="1"/>';
      strs += strPath(i, x, y, o.nut[i], o.gauge[i]);
      posts += '<circle class="gpost" data-i="' + i + '" cx="' + x + '" cy="' + y + '" r="' + o.post + '" fill="#D3D6DB" stroke="#5E646C" stroke-width="1"/><circle cx="' + x + '" cy="' + y + '" r="' + o.post / 3 + '" fill="#5E646C"/>';
    });
    return '<svg class="headstock' + (o.light ? " light" : "") + '" viewBox="0 0 200 320" aria-hidden="true">' + DEFS + knobs +
        '<path d="' + o.shape + '" fill="url(#' + o.wood + ')" stroke="#0B0C0E" stroke-width="1.5"/>' + o.logo +
        '<rect x="' + o.neck[0] + '" y="252" width="' + (o.neck[1] - o.neck[0]) + '" height="70" fill="url(#hsRosewood)"/>' +
        '<rect x="' + o.neck[0] + '" y="294" width="' + (o.neck[1] - o.neck[0]) + '" height="3" fill="#C9CCD1"/>' +
        '<rect x="' + (o.neck[0] - 3) + '" y="245" width="' + (o.neck[1] - o.neck[0] + 6) + '" height="8" rx="2" fill="#ECE4D2"/>' +
        strs + posts + "</svg>";
  }

  const HEADS = {
    guitar: () => machineHead({
      posts: [[70, 190], [70, 130], [70, 70], [130, 70], [130, 130], [130, 190]],
      nut: [66, 79.6, 93.2, 106.8, 120.4, 134], gauge: [2.8, 2.3, 1.9, 1.5, 1.2, 1], post: 6.5,
      knob: { inner: 44, w: 26, h: 20, r: 8, shaft: 18, sh: 5, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M58 248 L46 52 Q42 14 70 10 Q104 6 124 26 Q134 34 150 22 L160 13 Q159 34 152 52 L142 248 Z", wood: "hsBlack",
      logo: logo(46, 19, "url(#hsGold)"), neck: [60, 140]
    }),
    // extended range: 3+4 and 4+4 posts, closer together; a smaller logo fits between the top posts
    guitar7: () => machineHead({
      posts: [[70, 200], [70, 150], [70, 100], [130, 50], [130, 100], [130, 150], [130, 200]],
      nut: [64, 76, 88, 100, 112, 124, 136], gauge: [3.1, 2.8, 2.3, 1.9, 1.5, 1.2, 1], post: 6.5,
      knob: { inner: 44, w: 26, h: 20, r: 8, shaft: 18, sh: 5, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M58 248 L46 52 Q42 14 70 10 Q104 6 124 26 Q134 34 150 22 L160 13 Q159 34 152 52 L142 248 Z", wood: "hsBlack",
      logo: logo(44, 15, "url(#hsGold)"), neck: [60, 140]
    }),
    guitar8: () => machineHead({
      posts: [[70, 200], [70, 150], [70, 100], [70, 50], [130, 50], [130, 100], [130, 150], [130, 200]],
      nut: [62, 72.9, 83.7, 94.6, 105.4, 116.3, 127.1, 138], gauge: [3.4, 3.1, 2.8, 2.3, 1.9, 1.5, 1.2, 1], post: 6.5,
      knob: { inner: 44, w: 26, h: 20, r: 8, shaft: 18, sh: 5, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M56 248 L44 52 Q40 14 70 10 Q104 6 124 26 Q134 34 150 22 L161 13 Q161 34 154 52 L144 248 Z", wood: "hsBlack",
      logo: logo(44, 15, "url(#hsGold)"), neck: [58, 142]
    }),
    // 6+6 posts; each course's two strings run side by side to the nut
    guitar12: () => machineHead({
      posts: [[70, 226], [70, 190], [70, 154], [70, 118], [70, 82], [70, 46],
        [130, 46], [130, 82], [130, 118], [130, 154], [130, 190], [130, 226]],
      nut: [62, 66.4, 76, 80.4, 90, 94.4, 105.6, 110, 119.6, 124, 133.6, 138],
      gauge: [2.8, 1.3, 2.3, 1.1, 1.9, 1, 1.5, 0.9, 1.2, 1.2, 1, 1], post: 6,
      knob: { inner: 44, w: 24, h: 18, r: 7, shaft: 18, sh: 5, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M56 248 L44 52 Q40 14 70 10 Q104 6 124 26 Q134 34 150 22 L161 13 Q161 34 154 52 L144 248 Z", wood: "hsBlack",
      logo: logo(30, 13, "url(#hsGold)"), neck: [56, 144]
    }),
    bass: () => machineHead({
      posts: [[66, 175], [66, 100], [134, 100], [134, 175]],
      nut: [70, 90, 110, 130], gauge: [4.2, 3.5, 2.8, 2.2], post: 8,
      knob: { inner: 42, w: 32, h: 26, r: 7, shaft: 22, sh: 7, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M56 248 L42 64 Q38 22 78 16 Q100 12 122 16 Q162 22 158 64 L146 248 Z", wood: "hsBlack",
      logo: logo(52, 21), neck: [62, 138]
    }),
    // 2+3 and 3+3 posts
    bass5: () => machineHead({
      posts: [[66, 176], [66, 118], [134, 60], [134, 118], [134, 176]],
      nut: [68, 84, 100, 116, 132], gauge: [4.6, 4.2, 3.5, 2.8, 2.2], post: 8,
      knob: { inner: 42, w: 32, h: 26, r: 7, shaft: 22, sh: 7, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M56 248 L42 64 Q38 22 78 16 Q100 12 122 16 Q162 22 158 64 L146 248 Z", wood: "hsBlack",
      logo: logo(46, 17), neck: [62, 138]
    }),
    bass6: () => machineHead({
      posts: [[66, 176], [66, 118], [66, 60], [134, 60], [134, 118], [134, 176]],
      nut: [64, 78.4, 92.8, 107.2, 121.6, 136], gauge: [4.6, 4.2, 3.5, 2.8, 2.2, 1.8], post: 8,
      knob: { inner: 42, w: 32, h: 26, r: 7, shaft: 22, sh: 7, fill: "#D3D6DB", stroke: "#7D838C" },
      shape: "M54 248 L42 64 Q38 22 78 16 Q100 12 122 16 Q162 22 158 64 L148 248 Z", wood: "hsBlack",
      logo: logo(40, 17), neck: [58, 142]
    }),
    ukulele: () => machineHead({
      posts: [[78, 190], [78, 130], [122, 130], [122, 190]],
      nut: [79, 93, 107, 121], gauge: [1.5, 1.9, 1.7, 1.4], post: 5.5,
      knob: { inner: 62, w: 22, h: 17, r: 8, shaft: 14, sh: 4, fill: "#F3EBD8", stroke: "#A89A7E" },
      shape: "M66 248 L60 104 Q58 74 82 66 Q100 76 118 66 Q142 74 140 104 L134 248 Z", wood: "hsMahogany",
      logo: logo(100, 15), neck: [68, 132]
    }),
    violin: () => scrollHead([1.7, 1.4, 1.2, 1]),
    cello: () => scrollHead([2.6, 2.2, 1.8, 1.5])
  };

  // scroll, pegbox and side-mounted pegs (violin, cello)
  function scrollHead(gauge) {
    const ends = [[90, 130], [95, 190], [105, 190], [110, 130]], nut = [88, 96, 104, 112];
    let strs = "", pegs = "";
    ends.forEach(([x, y], i) => {
      strs += '<path class="gstr" data-i="' + i + '" stroke-width="' + gauge[i] + '" d="M' + x + " " + y + " L" + nut[i] + " 249 L" + nut[i] + ' 320"/>' +
          '<circle class="gpost" data-i="' + i + '" cx="' + x + '" cy="' + y + '" r="4" fill="none"/>'; // where the string meets its peg
    });
    [130, 190].forEach((y) => {
      pegs += '<rect x="58" y="' + (y - 3) + '" width="84" height="6" rx="3" fill="#1B1411"/>' +
          '<ellipse cx="44" cy="' + y + '" rx="15" ry="11" fill="url(#hsEbony)" stroke="#000" stroke-width="1"/>' +
          '<circle cx="62" cy="' + y + '" r="5" fill="#2A221E" stroke="#000" stroke-width="1"/>' +
          '<ellipse cx="156" cy="' + y + '" rx="15" ry="11" fill="url(#hsEbony)" stroke="#000" stroke-width="1"/>' +
          '<circle cx="138" cy="' + y + '" r="5" fill="#2A221E" stroke="#000" stroke-width="1"/>';
    });
    return '<svg class="headstock" viewBox="0 0 200 320" aria-hidden="true">' + DEFS +
        '<circle cx="100" cy="58" r="26" fill="url(#hsVarnish)" stroke="#3A1505" stroke-width="1.5"/>' +
        '<path d="M100 58 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0" fill="none" stroke="#3A1505" stroke-width="2"/>' +
        '<path d="M84 248 L80 98 Q80 82 92 80 L108 80 Q120 82 120 98 L116 248 Z" fill="url(#hsVarnish)" stroke="#3A1505" stroke-width="1.5"/>' +
        '<path d="M89 240 L86 104 L114 104 L111 240 Z" fill="#2A1208"/>' +
        '<rect x="86" y="252" width="28" height="70" fill="url(#hsEbony)" stroke="#55555C" stroke-width="1"/>' +
        '<rect x="84" y="245" width="32" height="7" rx="2" fill="#1B1B1E" stroke="#000" stroke-width="1"/>' +
        strs + pegs + "</svg>";
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
      // tapping a note always selects that string and plays it; only the
      // Auto-detect button returns to automatic string detection
      d.querySelector(".pn").addEventListener("click", () => {
        if (lock !== i) setLock(i);
        playRef(i);
      });
      pegEls[i] = d;
      return d;
    };
    I.left.forEach((i) => el.pegsL.appendChild(make(i)));
    I.right.forEach((i) => el.pegsR.appendChild(make(i)));

    el.preset.innerHTML = I.presets.map((p, k) => '<option value="' + k + '">' + p[0] + "</option>").join("") + '<option value="custom">Custom</option>';
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
    const k = I.presets.findIndex((p) => p[1].every((v, j) => v === o[j]));
    el.preset.value = k >= 0 ? String(k) : "custom";
    el.auto.setAttribute("aria-pressed", lock === null ? "true" : "false");
    el.autoPill.textContent = lock === null ? "ON" : "OFF";
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

  /* ---------- string-count dial (guitar 6/7/8/12, bass 4/5/6) ----------
     The counts sit on an arc over a small knob whose pointer turns to the
     one in use; click a count, or the knob to step to the next one. */
  const DIAL_R = 2.3, DIAL_Y = 2.55; // rem: label radius, and the knob centre from the top
  function buildCount() {
    const counts = COUNTS[st.mode];
    el.count.hidden = !counts;
    if (!counts) return;
    const deg = (k) => (counts.length === 1 ? 0 : -55 + (110 * k) / (counts.length - 1));
    el.count.innerHTML = counts.map((n, k) => {
      const on = n === st.strings[st.mode], a = (deg(k) * Math.PI) / 180;
      return '<button role="radio" data-n="' + n + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" aria-label="' + n + ' strings"' +
          ' style="left:calc(50% + ' + (Math.sin(a) * DIAL_R).toFixed(2) + "rem);top:" + (DIAL_Y - Math.cos(a) * DIAL_R).toFixed(2) + 'rem">' + n + "</button>";
    }).join("") + '<span class="tdial-knob" aria-hidden="true" style="--a:' + deg(counts.indexOf(st.strings[st.mode])) + 'deg"></span>';
  }
  function setCount(n) {
    if (!COUNTS[st.mode] || !COUNTS[st.mode].includes(n) || n === st.strings[st.mode]) return;
    st.strings[st.mode] = n;
    save(); applyMode();
    el.count.querySelector('[data-n="' + n + '"]').focus();
  }
  el.count.addEventListener("click", (e) => {
    const b = e.target.closest("button"), counts = COUNTS[st.mode];
    if (b) setCount(+b.dataset.n);
    else if (counts && e.target.closest(".tdial-knob")) setCount(counts[(counts.indexOf(st.strings[st.mode]) + 1) % counts.length]);
  });
  el.count.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const counts = COUNTS[st.mode];
    if (!d || !counts) return;
    e.preventDefault();
    setCount(counts[(counts.indexOf(st.strings[st.mode]) + d + counts.length) % counts.length]);
  });

  function applyMode() {
    el.modes.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.mode === st.mode;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    el.panel.hidden = !instr();
    el.presetWrap.hidden = !instr();
    buildCount();
    el.auto.hidden = !instr();
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
        (stringIdx != null ? ' &nbsp;<span class="nw">target ' + mtof(targetMidi).toFixed(2) + " Hz</span>" : "");
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

  function resize() {
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
    const R = Math.min(W * 0.42, H * 0.42);
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
      g.globalAlpha = 1 - 0.75 * age;
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
    el.stop.hidden = false;
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
    el.stop.hidden = true;
    el.status.textContent = "Microphone is off.";
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

  el.preset.addEventListener("change", () => {
    const I = instr();
    if (!I || el.preset.value === "custom") return;
    st.offsets[st.mode] = I.presets[+el.preset.value][1].slice();
    tuned = I.base.map(() => false);
    lock = null;
    save(); renderPegs(); resetReading();
  });
  el.auto.addEventListener("click", () => setLock(null));
  el.start.addEventListener("click", start);
  el.stop.addEventListener("click", stop);
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
