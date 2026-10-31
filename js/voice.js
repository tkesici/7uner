/* 7uner – Voice: the tuner's microphone mode, for singers.
   A pitch trail (the note you sing, drawn over a staff of semitones as it
   scrolls left), a range finder, listen-and-sing exercises built in your own
   range, and a helper that says how far to move a song to fit your voice.
   Pitch detection is pitch.js's; the guide tones are synthesised here.
   As with the tuner, audio is processed only in the browser. */
(function () {
  "use strict";

  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const noteName = (m) => NAMES[((m % 12) + 12) % 12];
  const octave = (m) => Math.floor(m / 12) - 1;
  const label = (m) => noteName(m) + octave(m);

  // a short window and light smoothing: a voice glides and wavers, and the trail should show it
  const CFG = { minF: 65, maxF: 1400, windowSec: 0.04, clarity: 0.8, median: 5 };
  // while a note is being followed, a quieter and less clear signal still counts if it stays
  // within a semitone of it, so a held note doesn't drop out as you run short of breath
  const QUIET = Object.assign({}, CFG, { minRms: 0.0008 }), SUSTAIN = { clarity: 0.2, near: 1 };
  const TICK_MS = 20;
  const SILENCE_TICKS = 8;  // ~160 ms without a pitch ends a line of the trail; the last note stays on screen, faded
  const PX_PER_S = 110;     // the trail scrolls left this many CSS pixels a second
  const NOW_AT = 0.38;      // where "now" sits across the stage; the exercise's notes come from the right
  const TOLERANCE = 40;     // cents from the target that count as on pitch
  const HOLD_S = 0.35;      // the range finder takes a note held this steadily for this long
  const DEFAULT_RANGE = { lo: 45, hi: 64 }; // A2–E4, until you measure your own

  /* Exercises: a phrase of [semitones above the root, beats], played to you
     and then sung back, once for each root (semitones above the exercise's
     lowest root; roots that would leave your range are left out). at places
     the lowest root within your range: 0 at the bottom, 1 as high as fits. */
  const EXERCISES = [
    { id: "match", name: "Match a note", bpm: 72, at: 0.15, phrase: [[0, 2]], roots: [0, 2, 4, 5, 7, 5, 4, 2, 0],
      desc: "Listen to a note, then sing it back and hold it. The start of everything: hearing a pitch and finding it with your voice." },
    { id: "long", name: "Long tones", bpm: 60, at: 0.3, phrase: [[0, 6]], roots: [0, 2, 4, 2, 0],
      desc: "Hold one note steady for six slow beats. Breathe low, let the air out evenly, and keep the line on the trail flat." },
    { id: "five", name: "Five-note scale", bpm: 96, at: 0.1, phrase: [[0, 1], [2, 1], [4, 1], [5, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 2]], roots: [0, 1, 2, 3, 4],
      desc: "Up five notes of a major scale and back, a half step higher each time. Sing it on “ah” or “oh”." },
    { id: "arp", name: "Major arpeggio", bpm: 84, at: 0.05, phrase: [[0, 1], [4, 1], [7, 1], [12, 1], [7, 1], [4, 1], [0, 2]], roots: [0, 1, 2, 3],
      desc: "Root, third, fifth and the octave: bigger steps that you have to hear before you sing them." },
    { id: "penta", name: "Minor pentatonic", bpm: 92, at: 0.05, phrase: [[0, 1], [3, 1], [5, 1], [7, 1], [10, 1], [12, 1], [10, 1], [7, 1], [5, 1], [3, 1], [0, 2]], roots: [0, 2, 4],
      desc: "The scale most rock and metal melodies are made of, the same one you solo in. Sing it the way you’d play it." },
    { id: "fifths", name: "Fourths and fifths", bpm: 76, at: 0.15, phrase: [[0, 1], [7, 1], [0, 1], [5, 1], [0, 2]], roots: [0, 2, 4, 5],
      desc: "Jump a fifth and back, then a fourth and back: the power chord’s intervals, as a melody." },
    { id: "chroma", name: "Half steps", bpm: 72, at: 0.15, phrase: [[0, 1], [1, 1], [2, 1], [1, 1], [0, 2]], roots: [0, 3, 5, 7],
      desc: "Up a half step, up another and back. Small moves need fine control; aim for the middle of each bar." },
    { id: "octave", name: "Octave leaps", bpm: 66, at: 0, phrase: [[0, 2], [12, 2], [0, 2]], roots: [0, 1, 2],
      desc: "Leap up an octave and come back. Don’t push the top note; let it be lighter than the bottom one." }
  ];

  const $ = (id) => document.getElementById(id);
  const el = {
    root: $("vRoot"), readout: $("vReadout"), sub: $("vSub"), note: $("vNote"), oct: $("vOct"), hz: $("vHz"), cents: $("vCents"),
    canvas: $("vTrail"), cover: $("vCover"), start: $("vStart"), status: $("vStatus"),
    list: $("vList"), exTitle: $("vExTitle"), exDesc: $("vExDesc"), go: $("vGo"), msg: $("vMsg"),
    range: $("vRange"), type: $("vType"), find: $("vFind"), cancel: $("vCancel"),
    songLo: $("vSongLo"), songHi: $("vSongHi"), advice: $("vAdvice")
  };

  /* ---------- settings ---------- */
  const KEY = "7uner.voice.v1";
  const st = { range: null, ex: "match", best: {}, song: [45, 64] };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o) {
      if (o.range && o.range.lo >= 28 && o.range.hi <= 96 && o.range.hi > o.range.lo) st.range = { lo: +o.range.lo, hi: +o.range.hi };
      if (EXERCISES.some((x) => x.id === o.ex)) st.ex = o.ex;
      if (o.best && typeof o.best === "object") st.best = o.best;
      if (Array.isArray(o.song) && o.song.length === 2) st.song = o.song.map((v) => Math.max(36, Math.min(84, Math.round(+v) || 48)));
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const range = () => st.range || DEFAULT_RANGE;
  const a4 = () => (window.tuner && window.tuner.a4 ? window.tuner.a4() : 440);
  const mtof = (m) => a4() * Math.pow(2, (m - 69) / 12);

  const { detect, windowLen, median } = window.pitch;

  /* ---------- the exercise as timed notes ---------- */
  // the roots that fit, and the notes in order: { t0, t1, m, sing } in seconds from the start
  function plan(ex) {
    const { lo, hi } = range(), top = Math.max(...ex.phrase.map((p) => p[0]));
    const room = hi - lo - top - 2; // a semitone of margin at each end
    const fits = (r) => r <= room;
    let roots = ex.roots.filter(fits);
    let base = lo + 1 + Math.round(Math.max(0, room - Math.max(...roots, 0)) * ex.at);
    if (!roots.length) { roots = [0]; base = Math.max(lo, hi - top - 1); } // a narrow range: one round, as low as it goes
    const beat = 60 / ex.bpm, notes = [];
    let t = 1.2;
    roots.forEach((r, round) => {
      [false, true].forEach((sing) => {
        ex.phrase.forEach(([s, b]) => {
          notes.push({ t0: t, t1: t + b * beat * (sing ? 1 : 0.9), m: base + r + s, sing, round });
          t += b * beat;
        });
        t += beat * (sing ? 1.5 : 1);
      });
    });
    return { notes, rounds: roots.length, end: t };
  }

  /* ---------- guide tones ---------- */
  let tones = [];
  function tone(m, t0, dur) {
    const f = mtof(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), mix = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = f;
    o2.type = "sine"; o2.frequency.value = f * 2; mix.gain.value = 0.25;
    lp.type = "lowpass"; lp.frequency.value = Math.min(5000, f * 6);
    o.connect(lp); o2.connect(mix).connect(lp); lp.connect(g).connect(ctx.destination);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.32, t0 + 0.02);
    g.gain.setTargetAtTime(0.2, t0 + 0.02, 0.2);
    g.gain.setTargetAtTime(0, t0 + dur - 0.05, 0.03);
    [o, o2].forEach((x) => { x.start(t0); x.stop(t0 + dur + 0.25); });
    tones.push(o, o2);
  }
  function silence() { tones.forEach((x) => { try { x.stop(); } catch (e) {} }); tones = []; }

  /* ---------- state ---------- */
  let ctx = null, stream = null, analyser = null, buf = null, raf = 0, lastTick = 0, running = false;
  let recent = [], silent = 0, current = null; // current: the latest reading { m (fractional MIDI), f }
  let live = false;                             // false once the note has stopped and current is only held
  let trail = [];                               // { t, m, ok } in AudioContext seconds
  let run = null;                               // the exercise being sung: { ex, plan, start, hit, total, rounds[] }
  let finder = null;                            // the range finder: { lo, hi, hold[] }
  let shown = false;

  /* ---------- readout ---------- */
  function show() {
    const tgt = activeNote(), sing = tgt && tgt.sing;
    if (!current) {
      el.readout.classList.add("idle"); el.readout.classList.remove("in", "held");
      el.note.textContent = sing ? noteName(tgt.m) : "–";
      el.oct.textContent = sing ? octave(tgt.m) : "";
      el.hz.innerHTML = ""; el.cents.textContent = "";
      return;
    }
    const near = Math.round(current.m), c = (current.m - near) * 100;
    el.readout.classList.remove("idle");
    el.readout.classList.toggle("held", !live);
    el.note.textContent = noteName(near);
    el.oct.textContent = octave(near);
    el.hz.innerHTML = '<span class="nw"><b>' + current.f.toFixed(1) + "</b> Hz</span>";
    el.cents.textContent = (c >= 0.5 ? "+" : c <= -0.5 ? "−" : "±") + Math.abs(c).toFixed(0) + " cents";
    el.readout.classList.toggle("in", live && (sing ? offBy(current.m, tgt.m) <= TOLERANCE : Math.abs(c) <= 10));
  }
  // cents from the target, an octave either way counting as the same note (a man and a woman singing the same melody)
  function offBy(m, target) {
    const d = (((m - target) % 12) + 12) % 12;
    return Math.min(d, 12 - d) * 100;
  }

  /* ---------- the trail ----------
     A staff of semitones (the natural notes labelled, each C stronger),
     the line you sing scrolling to the left of "now", and the exercise's
     notes coming in from the right: outlined while you listen, filled
     when it's your turn. */
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let colors = null;
  const readColors = () => { colors = { ok: cssVar("--ok"), okSoft: cssVar("--ok-soft"), amber: cssVar("--amber"), amberSoft: cssVar("--amber-soft"), line: cssVar("--line"), beat: cssVar("--beat"), muted: cssVar("--muted"), ink: cssVar("--ink") }; };

  function resize() {
    const r = el.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = Math.round(r.width * dpr);
    el.canvas.height = Math.round(r.height * dpr);
    readColors();
    draw();
  }

  // the notes the staff shows: the exercise's, or your range, with room around them
  function window12() {
    let lo, hi;
    if (run) { lo = Math.min(...run.plan.notes.map((n) => n.m)); hi = Math.max(...run.plan.notes.map((n) => n.m)); }
    else if (finder) { lo = Math.min(finder.lo ?? 60, 48); hi = Math.max(finder.hi ?? 60, 67); }
    else ({ lo, hi } = range());
    lo -= 3; hi += 3;
    while (hi - lo < 14) { lo--; hi++; }
    return [lo, hi];
  }

  const now = () => (ctx ? ctx.currentTime : 0);
  function draw() {
    const cv = el.canvas, g = cv.getContext("2d"), W = cv.width, H = cv.height;
    if (!W || !H) return;
    if (!colors) readColors();
    const K = colors, dpr = window.devicePixelRatio || 1, t = now();
    const [lo, hi] = window12(), pad = 10 * dpr, lab = 34 * dpr;
    const y = (m) => H - pad - ((m - lo + 0.5) / (hi - lo + 1)) * (H - 2 * pad);
    const row = (H - 2 * pad) / (hi - lo + 1);
    const nowX = lab + (W - lab) * NOW_AT, px = PX_PER_S * dpr;
    const x = (s) => nowX + (s - t) * px;
    g.clearRect(0, 0, W, H);

    // the staff
    g.font = Math.min(11 * dpr, row * 0.8) + "px 'JetBrains Mono', monospace";
    g.textAlign = "right"; g.textBaseline = "middle";
    for (let m = lo; m <= hi; m++) {
      const natural = !NAMES[((m % 12) + 12) % 12].includes("♯"), c = ((m % 12) + 12) % 12 === 0;
      g.strokeStyle = c ? K.line : K.beat; g.lineWidth = (c ? 1.2 : 1) * dpr;
      g.globalAlpha = natural ? 1 : 0.45;
      g.beginPath(); g.moveTo(lab, y(m)); g.lineTo(W, y(m)); g.stroke();
      g.globalAlpha = 1;
      // every natural note when there's room, otherwise C, E, G and A, which never sit next to each other
      const named = row >= 13 * dpr ? natural : [0, 4, 7, 9].includes(((m % 12) + 12) % 12);
      if (named && row >= 6 * dpr) { g.fillStyle = c ? K.ink : K.muted; g.fillText(label(m), lab - 6 * dpr, y(m)); }
    }
    // your range, shaded at the left edge
    if (!run) {
      const r = finder && finder.lo != null ? { lo: finder.lo, hi: finder.hi } : st.range;
      if (r) { g.fillStyle = K.okSoft; g.fillRect(lab - 3 * dpr, y(r.hi) - row / 2, 3 * dpr, y(r.lo) - y(r.hi) + row); }
    }

    // the exercise's notes
    if (run) {
      const h = Math.max(4 * dpr, row * 0.72);
      run.plan.notes.forEach((n) => {
        const a = x(run.start + n.t0), b = x(run.start + n.t1);
        if (b < lab || a > W) return;
        const yy = y(n.m) - h / 2, r = Math.min(h / 2, 6 * dpr);
        g.beginPath(); g.roundRect(Math.max(lab, a), yy, Math.max(2, b - Math.max(lab, a)), h, r);
        if (n.sing) { g.fillStyle = K.amberSoft; g.fill(); g.strokeStyle = K.amber; g.lineWidth = 1.5 * dpr; g.stroke(); }
        else { g.setLineDash([4 * dpr, 3 * dpr]); g.strokeStyle = K.muted; g.lineWidth = 1.2 * dpr; g.stroke(); g.setLineDash([]); }
      });
    }

    // now
    g.strokeStyle = K.muted; g.globalAlpha = 0.5; g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(nowX, 0); g.lineTo(nowX, H); g.stroke();
    g.globalAlpha = 1;

    // the line you sang
    g.lineWidth = 3.2 * dpr; g.lineCap = "round"; g.lineJoin = "round";
    const oldest = t - (nowX - lab) / px;
    while (trail.length && trail[0].t < oldest - 1) trail.shift();
    for (let i = 1; i < trail.length; i++) {
      const p = trail[i - 1], q = trail[i];
      if (q.t - p.t > 0.25 || x(q.t) < lab) continue; // a breath: don't join across it
      g.strokeStyle = q.ok === true ? K.ok : q.ok === false ? K.amber : K.ink;
      g.globalAlpha = q.ok == null && run ? 0.35 : 1; // fainter while you're listening
      g.beginPath();
      g.moveTo(Math.max(lab, x(p.t)), y(Math.max(lo - 0.5, Math.min(hi + 0.5, p.m))));
      g.lineTo(Math.max(lab, x(q.t)), y(Math.max(lo - 0.5, Math.min(hi + 0.5, q.m))));
      g.stroke();
    }
    g.globalAlpha = 1;
    if (current) {
      g.globalAlpha = live ? 1 : 0.5;
      g.fillStyle = live && trail.length && trail[trail.length - 1].ok === true ? K.ok : K.amber;
      g.beginPath(); g.arc(nowX, y(Math.max(lo - 0.5, Math.min(hi + 0.5, current.m))), 5.5 * dpr, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }

  /* ---------- listening ---------- */
  const activeNote = () => {
    if (!run) return null;
    const s = now() - run.start;
    return run.plan.notes.find((n) => s >= n.t0 && s < n.t1) || null;
  };

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (ts - lastTick >= TICK_MS) { lastTick = ts; listen(); }
    draw();
  }

  function listen() {
    analyser.getFloatTimeDomainData(buf);
    const following = live && recent.length > 0, last = following ? median(recent) : 0;
    const r = detect(buf, ctx.sampleRate, following ? QUIET : CFG), t = now();
    const tgt = activeNote(), m0 = r.f > 0 ? 69 + 12 * Math.log2(r.f / a4()) : 0;
    if (r.f > 0 && (r.clarity >= CFG.clarity || (following && r.clarity >= CFG.clarity - SUSTAIN.clarity && Math.abs(m0 - last) <= SUSTAIN.near))) {
      silent = 0; live = true;
      recent.push(m0);
      if (recent.length > CFG.median) recent.shift();
      const m = median(recent);
      current = { m, f: mtof(m) };
    } else if (++silent > SILENCE_TICKS) { live = false; recent = []; }

    let ok = null;
    if (tgt && tgt.sing) {
      ok = live && current ? offBy(current.m, tgt.m) <= TOLERANCE : false;
      // score from a moment into each note, so the time it takes to find it isn't held against you
      if (t - run.start - tgt.t0 > 0.15) {
        run.total++; run.rounds[tgt.round].total++;
        if (ok) { run.hit++; run.rounds[tgt.round].hit++; }
      }
    }
    if (live) trail.push({ t, m: current.m, ok });
    if (finder && live) findRange(t);
    if (run) progress(t);
    show();
  }

  /* ---------- exercises ---------- */
  const pct = (h, n) => (n ? Math.round((100 * h) / n) : 0);
  function renderList() {
    el.list.innerHTML = EXERCISES.map((x, i) => {
      const b = st.best[x.id];
      return '<li><button data-ex="' + x.id + '" aria-current="' + (x.id === st.ex) + '"><span class="no">' + (i + 1) + '</span><span class="nm">' + x.name + "</span>" +
        '<span class="st' + (b >= 80 ? " done" : "") + '">' + (b != null ? "Best " + b + "% on pitch" : x.bpm + " bpm") + "</span></button></li>";
    }).join("");
    const ex = EXERCISES.find((x) => x.id === st.ex);
    el.exTitle.textContent = ex.name;
    el.exDesc.textContent = ex.desc;
  }
  el.list.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-ex]");
    if (!b || b.dataset.ex === st.ex) return;
    stopExercise();
    st.ex = b.dataset.ex; save(); renderList();
    el.msg.textContent = "";
  });

  async function startExercise() {
    if (finder) cancelFinder();
    if (!running) { await start(); if (!running) return; }
    const ex = EXERCISES.find((x) => x.id === st.ex), p = plan(ex);
    run = { ex, plan: p, start: now() + 0.1, hit: 0, total: 0, rounds: Array.from({ length: p.rounds }, () => ({ hit: 0, total: 0 })), said: "" };
    p.notes.forEach((n) => { if (!n.sing) tone(n.m, run.start + n.t0, n.t1 - n.t0); });
    trail = [];
    setGo(true);
    el.msg.textContent = "";
  }
  function stopExercise() {
    if (!run) return;
    run = null;
    silence();
    setGo(false);
  }
  function setGo(on) {
    el.go.classList.toggle("stop", on);
    el.go.textContent = on ? "Stop" : "Start";
  }
  // what to do now, and the score when it's over
  function progress(t) {
    const s = t - run.start, n = run.plan.notes.find((x) => s < x.t1) || null;
    if (!n) {
      const score = pct(run.hit, run.total), id = run.ex.id, best = st.best[id];
      if (best == null || score > best) { st.best[id] = score; save(); }
      el.msg.textContent = score + "% on pitch" + (best != null && score > best ? " – a new best" : best != null ? " (best " + Math.max(best, score) + "%)" : "") + ". " +
          (score >= 80 ? "Clean. Try the next one, or this one again with less effort." : score >= 50 ? "Getting there. Go again, and listen closely before you sing." : "Hum it quietly first, then sing. Slide until the line turns green.");
      stopExercise();
      renderList();
      return;
    }
    const prev = n.round > 0 ? run.rounds[n.round - 1] : null;
    const say = "Round " + (n.round + 1) + " of " + run.plan.rounds + " · " + (n.sing && s >= n.t0 - 0.6 ? "Your turn: sing" : s < 1.2 ? "Get ready" : "Listen") +
        (prev && prev.total ? " · last round " + pct(prev.hit, prev.total) + "%" : "");
    if (say !== run.said) { run.said = say; el.msg.textContent = say; }
  }
  el.go.addEventListener("click", () => (run ? stopExercise() : startExercise()));

  /* ---------- your range ----------
     Slide down to your lowest comfortable note and hold it, then up to the
     highest; a note counts once you've held it steadily for a moment. */
  function voiceType(lo, hi) {
    const mid = (lo + hi) / 2;
    return mid < 54.5 ? "bass" : mid < 58.5 ? "baritone" : mid < 62.5 ? "tenor" : mid < 67 ? "alto" : mid < 70.5 ? "mezzo-soprano" : "soprano";
  }
  function renderRange() {
    const r = finder && finder.lo != null ? finder : st.range;
    if (finder) {
      el.range.textContent = r ? label(r.lo) + " – " + label(r.hi) : "Sing…";
      el.type.textContent = "Slide down to your lowest comfortable note and hold it, then up to your highest. Don’t strain: comfortable is the range you’ll use.";
    } else if (r) {
      el.range.textContent = label(r.lo) + " – " + label(r.hi);
      el.type.textContent = (r.hi - r.lo) + " semitones, closest to a " + voiceType(r.lo, r.hi) + " voice. The exercises are set in this range.";
    } else {
      el.range.textContent = "Not measured";
      el.type.textContent = "Until you measure it, the exercises use " + label(DEFAULT_RANGE.lo) + " – " + label(DEFAULT_RANGE.hi) + ", a typical untrained man’s range.";
    }
    el.find.textContent = finder ? (finder.lo != null && finder.hi - finder.lo >= 5 ? "Save range" : "Listening…") : st.range ? "Measure again" : "Find my range";
    el.find.disabled = !!finder && !(finder.lo != null && finder.hi - finder.lo >= 5);
    el.cancel.hidden = !finder;
    renderAdvice();
  }
  function findRange(t) {
    const h = finder.hold;
    h.push({ t, m: current.m });
    while (h.length && t - h[0].t > HOLD_S) h.shift();
    if (t - h[0].t < HOLD_S * 0.9) return;
    const ms = h.map((p) => p.m);
    if (Math.max(...ms) - Math.min(...ms) > 0.6) return; // not steady yet
    const m = Math.round(median(ms));
    if (finder.lo == null) { finder.lo = finder.hi = m; }
    else if (m < finder.lo) finder.lo = m;
    else if (m > finder.hi) finder.hi = m;
    else return;
    renderRange();
  }
  async function toggleFinder() {
    if (finder) {
      if (finder.lo != null && finder.hi - finder.lo >= 5) { st.range = { lo: finder.lo, hi: finder.hi }; save(); }
      finder = null; renderRange(); renderList();
      return;
    }
    stopExercise();
    if (!running) { await start(); if (!running) return; }
    finder = { lo: null, hi: null, hold: [] };
    trail = [];
    renderRange();
  }
  function cancelFinder() { finder = null; renderRange(); }
  el.find.addEventListener("click", toggleFinder);
  el.cancel.addEventListener("click", cancelFinder);

  /* ---------- a song in your key ----------
     The song's lowest and highest notes against your range: how far to move
     it (an octave counts as free: sing it an octave down or up), and what
     that means on the guitar. */
  const SONG_NOTES = Array.from({ length: 49 }, (_, i) => 36 + i); // C2–C6
  el.songLo.innerHTML = el.songHi.innerHTML = SONG_NOTES.map((m) => '<option value="' + m + '">' + label(m) + "</option>").join("");
  el.songLo.value = st.song[0]; el.songHi.value = st.song[1];
  function renderAdvice() {
    let [sLo, sHi] = st.song;
    if (sHi < sLo) [sLo, sHi] = [sHi, sLo];
    const { lo, hi } = range(), span = sHi - sLo, room = hi - lo;
    let s, wide = span > room;
    if (wide) s = Math.round((lo + hi - sLo - sHi) / 2);
    else {
      // every shift that fits; the one closest to an octave (or none) moves the key least
      const a = lo - sLo, b = hi - sHi;
      s = a;
      for (let k = a; k <= b; k++) {
        const cost = (v) => Math.abs(v - 12 * Math.round(v / 12)) * 100 + Math.abs(v);
        if (cost(k) < cost(s)) s = k;
      }
    }
    const oct = Math.round(s / 12), key = s - 12 * oct;
    const parts = [];
    if (!wide && s === 0) parts.push("It fits your range as it is.");
    else {
      if (oct) parts.push("Sing it " + (Math.abs(oct) === 1 ? "an octave" : Math.abs(oct) + " octaves") + (oct < 0 ? " lower" : " higher") + " than written.");
      if (key < 0) parts.push("Move it down " + -key + " semitone" + (key === -1 ? "" : "s") + ": " +
          (key >= -2 ? "tune the guitar down " + (key === -1 ? "a half step (E♭ standard)" : "a whole step (D standard)") + " and play it as usual."
            : key >= -4 ? "tune down a whole step (D standard) and play it " + (-key - 2) + (key === -3 ? " fret" : " frets") + " lower."
            : "play it " + -key + " frets lower."));
      if (key > 0) parts.push("Move it up " + key + " semitone" + (key === 1 ? "" : "s") + ": a capo on fret " + key + ", or play it " + key + " frets higher.");
      if (!key && oct) parts.push("No change on the guitar.");
    }
    if (wide) parts.push("The song spans " + span + " semitones and your range " + room + ", so its edges stay out of reach for now: sing those notes an octave the other way, or let them come with practice.");
    el.advice.textContent = parts.join(" ");
  }
  [el.songLo, el.songHi].forEach((s, i) => s.addEventListener("change", () => { st.song[i] = +s.value; save(); renderAdvice(); }));

  /* ---------- microphone ---------- */
  async function start() {
    if (running) return;
    el.status.textContent = "Waiting for microphone permission…";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      el.status.textContent = "This browser doesn’t support microphone access, or the page wasn’t opened over HTTPS.";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      el.status.textContent = e && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow the microphone in your browser’s site settings and try again."
          : "Couldn’t access the microphone. Another app may be using it.";
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 55; hp.Q.value = 0.707;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4000; lp.Q.value = 0.707;
    analyser = ctx.createAnalyser();
    analyser.fftSize = windowLen(ctx.sampleRate, CFG);
    src.connect(hp).connect(lp).connect(analyser);
    buf = new Float32Array(analyser.fftSize);
    running = true;
    el.cover.hidden = true;
    resize();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (!running) return;
    stopExercise();
    if (finder) cancelFinder();
    running = false;
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close();
    ctx = stream = analyser = null;
    current = null; live = false; recent = []; trail = [];
    show(); draw();
    el.cover.hidden = false;
    el.status.textContent = "The microphone turns off when you leave Voice.";
  }

  /* ---------- wiring ---------- */
  el.start.addEventListener("click", start);
  window.addEventListener("resize", () => { if (shown) resize(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });
  renderList();
  renderRange();

  // the tuner shows and hides Voice when its mode changes; listen: carry on with the microphone on
  window.voice = {
    show(listen) { shown = true; el.root.hidden = false; resize(); if (listen) start(); },
    hide() { shown = false; el.root.hidden = true; stop(); },
    stop, resize: () => { if (shown) resize(); }, isRunning: () => running
  };
})();
