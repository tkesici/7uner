/* 7uner – chromatic tuner
   Pitch detection: McLeod Pitch Method (NSDF) with parabolic interpolation.
   All audio processing happens in the browser; nothing is sent to a server. */
(function () {
  "use strict";

  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
  const IN_TUNE = 5;          // ± cents
  const WINDOW = 2048;        // analysis window (samples)
  const MIN_F = 38, MAX_F = 1500;
  const TICK_MS = 33;         // ~30 readings per second
  const HIST_STEP = 3;        // pixels per reading in the trace

  const $ = (id) => document.getElementById(id);
  const el = {
    readout: $("tReadout"), note: $("tNote"), oct: $("tOct"), hz: $("tHz"), cents: $("tCents"),
    meter: $("tMeter"), needle: $("tNeedle"), advice: $("tAdvice"), strings: $("tStrings"),
    canvas: $("tTrace"), cover: $("tCover"), start: $("tStart"), status: $("tStatus"),
    stop: $("tStop"), a4: $("a4"), a4d: $("a4Down"), a4u: $("a4Up")
  };

  let a4 = 440;
  try { const v = +localStorage.getItem("7uner.a4"); if (v >= 415 && v <= 466) a4 = v; } catch (e) {}
  el.a4.value = a4;

  let ctx = null, stream = null, analyser = null, buf = null, raf = 0, lastTick = 0, running = false;
  let recent = [], smooth = null, lastMidi = null, silent = 0;
  const hist = [];

  /* ---------- pitch detection ---------- */
  function detect(x, sr) {
    let rms = 0;
    for (let i = 0; i < WINDOW; i++) rms += x[i] * x[i];
    rms = Math.sqrt(rms / WINDOW);
    if (rms < 0.006) return -1;

    const minLag = Math.max(2, Math.floor(sr / MAX_F));
    const maxLag = Math.min(Math.floor(sr / MIN_F), x.length - WINDOW - 2);
    const n = new Float32Array(maxLag + 2);
    for (let t = minLag; t <= maxLag + 1; t++) {
      let ac = 0, m = 0;
      for (let i = 0; i < WINDOW; i++) {
        const a = x[i], b = x[i + t];
        ac += a * b; m += a * a + b * b;
      }
      n[t] = m > 0 ? (2 * ac) / m : 0;
    }

    // skip to the first negative region, then collect the peak of each positive region
    let t = minLag;
    while (t <= maxLag && n[t] > 0) t++;
    const peaks = [];
    let inPos = false, best = 0, bestV = -1;
    for (; t <= maxLag; t++) {
      if (n[t] > 0) {
        if (!inPos) { inPos = true; best = t; bestV = n[t]; }
        else if (n[t] > bestV) { best = t; bestV = n[t]; }
      } else if (inPos) { peaks.push(best); inPos = false; }
    }
    if (inPos && best < maxLag) peaks.push(best);
    if (!peaks.length) return -1;

    let gmax = 0;
    for (const p of peaks) if (n[p] > gmax) gmax = n[p];
    if (gmax < 0.6) return -1; // no clear pitch

    const p = peaks.find((q) => n[q] >= 0.9 * gmax);
    const a = n[p - 1], b = n[p], c = n[p + 1];
    const d = a - 2 * b + c;
    const shift = d !== 0 ? (0.5 * (a - c)) / d : 0;
    return sr / (p + shift);
  }

  function median(arr) {
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  /* ---------- UI ---------- */
  function showNote(freq, midi, cents) {
    const name = NAMES[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    const inTune = Math.abs(cents) <= IN_TUNE;
    el.note.textContent = name;
    el.oct.textContent = octave;
    el.hz.innerHTML = "<b>" + freq.toFixed(1) + "</b> Hz";
    const c = Math.round(cents);
    el.cents.textContent = (c > 0 ? "+" : c < 0 ? "−" : "±") + Math.abs(c) + " cents";
    el.readout.classList.remove("idle");
    el.meter.classList.remove("idle");
    el.readout.classList.toggle("in", inTune);
    el.meter.classList.toggle("in", inTune);
    el.needle.style.left = 50 + Math.max(-50, Math.min(50, cents)) + "%";
    el.advice.classList.toggle("in", inTune);
    el.advice.textContent = inTune ? "In tune" : cents < 0 ? "Flat – tighten the string a little" : "Sharp – loosen the string a little";
    [...el.strings.children].forEach((li, i) => {
      const hit = STRINGS[i] === midi;
      li.classList.toggle("hit", hit);
      li.classList.toggle("in", hit && inTune);
    });
  }

  function idle() {
    el.readout.classList.add("idle");
    el.meter.classList.add("idle");
    el.advice.textContent = "";
    [...el.strings.children].forEach((li) => li.classList.remove("hit", "in"));
  }

  /* ---------- trace ---------- */
  function resize() {
    const r = el.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = Math.round(r.width * dpr);
    el.canvas.height = Math.round(r.height * dpr);
    draw();
  }

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function draw() {
    const cv = el.canvas, g = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (!W) return;
    const mid = W / 2, half = W / 2;
    // in-tune zone and center line
    g.fillStyle = cssVar("--ok-soft");
    g.globalAlpha = 0.6;
    g.fillRect(mid - half * (IN_TUNE / 50), 0, half * (IN_TUNE / 50) * 2, H);
    g.globalAlpha = 1;
    g.fillStyle = cssVar("--line");
    g.fillRect(mid - 0.5 * dpr, 0, dpr, H);

    const ok = cssVar("--ok"), amber = cssVar("--amber");
    g.lineWidth = 2.5 * dpr;
    g.lineJoin = "round";
    g.lineCap = "round";
    const step = HIST_STEP * dpr;
    const xOf = (c) => mid + (Math.max(-50, Math.min(50, c)) / 50) * half;
    for (let i = 1; i < hist.length; i++) {
      const a = hist[i - 1], b = hist[i];
      if (a == null || b == null) continue;
      const y0 = (i - 1) * step, y1 = i * step;
      if (y0 > H) break;
      g.strokeStyle = Math.abs(b) <= IN_TUNE && Math.abs(a) <= IN_TUNE ? ok : amber;
      g.beginPath();
      g.moveTo(xOf(a), y0);
      g.lineTo(xOf(b), y1);
      g.stroke();
    }
  }

  /* ---------- loop ---------- */
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastTick < TICK_MS) return;
    lastTick = now;
    analyser.getFloatTimeDomainData(buf);
    const f = detect(buf, ctx.sampleRate);

    if (f > 0) {
      silent = 0;
      recent.push(f);
      if (recent.length > 5) recent.shift();
      const fm = median(recent);
      const midiF = 69 + 12 * Math.log2(fm / a4);
      const midi = Math.round(midiF);
      const cents = (midiF - midi) * 100;
      if (midi !== lastMidi) { smooth = cents; lastMidi = midi; }
      else smooth = smooth * 0.55 + cents * 0.45;
      showNote(fm, midi, smooth);
      hist.unshift(smooth);
    } else {
      silent++;
      if (silent > 6) { recent = []; lastMidi = null; idle(); }
      hist.unshift(null);
    }
    const maxLen = Math.ceil(el.canvas.height / (HIST_STEP * (window.devicePixelRatio || 1))) + 2;
    if (hist.length > maxLen) hist.length = maxLen;
    draw();
  }

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
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    src.connect(analyser);
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
    recent = []; lastMidi = null; hist.length = 0;
    idle();
    draw();
    el.cover.hidden = false;
    el.stop.hidden = true;
    el.status.textContent = "Microphone is off.";
    el.start.textContent = "Turn on microphone";
  }

  function setA4(v) {
    v = Math.round(+v || 440);
    v = Math.max(415, Math.min(466, v));
    a4 = v;
    el.a4.value = v;
    try { localStorage.setItem("7uner.a4", String(v)); } catch (e) {}
  }

  el.start.addEventListener("click", start);
  el.stop.addEventListener("click", stop);
  el.a4.addEventListener("change", () => setA4(el.a4.value));
  el.a4d.addEventListener("click", () => setA4(a4 - 1));
  el.a4u.addEventListener("click", () => setA4(a4 + 1));
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });

  window.tuner = { start, stop, resize, isRunning: () => running };
})();