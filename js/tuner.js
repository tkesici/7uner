/* 7uner – chromatic and guitar tuner
   Pitch detection: McLeod Pitch Method. The normalised square difference
   function is computed with an FFT autocorrelation, so long analysis windows
   stay cheap, and the peak is refined with parabolic interpolation.
   All audio processing happens in the browser; nothing is sent to a server. */
(function () {
  "use strict";

  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const BASE = [40, 45, 50, 55, 59, 64]; // low E, A, D, G, B, high E (standard tuning, MIDI)
  const OFF_MIN = -12, OFF_MAX = 5;
  const PRESETS = [
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
  ];

  /* Per-mode settings. Guitar mode is stricter: a narrower in-tune zone,
     a zoomed-in scale, a longer analysis window and heavier smoothing. */
  const CFG = {
    chromatic: { inTune: 5, range: 50, minF: 27, maxF: 4200, windowSec: 0.085, clarity: 0.5, median: 5, onsetSkip: 2, decimals: 0 },
    guitar: { inTune: 2, range: 25, minF: 38, maxF: 1400, windowSec: 0.17, clarity: 0.7, median: 7, onsetSkip: 5, decimals: 1 }
  };
  const TICK_MS = 20;        // ~50 readings per second
  const SILENCE_TICKS = 12;  // ~240 ms without a pitch before going idle
  const HOLD_MS = 600;       // how long a string must stay in tune to get a tick
  const HIST_STEP = 2;       // pixels per reading in the trace

  const $ = (id) => document.getElementById(id);
  const el = {
    root: $("tRoot"), readout: $("tReadout"), sub: $("tSub"), note: $("tNote"), oct: $("tOct"),
    hz: $("tHz"), cents: $("tCents"), meter: $("tMeter"), zone: $("tZone"), needle: $("tNeedle"),
    labL: $("tLabL"), labR: $("tLabR"), advice: $("tAdvice"), guitar: $("tGuitar"),
    preset: $("tPreset"), auto: $("tAuto"), pegsL: $("pegsL"), pegsR: $("pegsR"), head: $("tHead"),
    canvas: $("tTrace"), cover: $("tCover"), start: $("tStart"), status: $("tStatus"), stop: $("tStop"),
    a4: $("a4"), a4d: $("a4Down"), a4u: $("a4Up"), a4r: $("a4Reset")
  };

  /* ---------- settings ---------- */
  const KEY = "7uner.tuner.v1";
  const clampOff = (v) => Math.max(OFF_MIN, Math.min(OFF_MAX, Math.round(v)));
  const st = { mode: "chromatic", offsets: [0, 0, 0, 0, 0, 0], a4: 440 };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (o) {
      if (o.mode === "guitar" || o.mode === "chromatic") st.mode = o.mode;
      if (Array.isArray(o.offsets) && o.offsets.length === 6) st.offsets = o.offsets.map((v) => clampOff(+v || 0));
      if (o.a4 >= 415 && o.a4 <= 466) st.a4 = +o.a4;
    } else {
      const v = +localStorage.getItem("7uner.a4");
      if (v >= 415 && v <= 466) st.a4 = v;
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const cfg = () => CFG[st.mode];
  const target = (i) => BASE[i] + st.offsets[i];
  const mtof = (m) => st.a4 * Math.pow(2, (m - 69) / 12);
  const noteName = (m) => NAMES[((m % 12) + 12) % 12];
  const octave = (m) => Math.floor(m / 12) - 1;

  /* ---------- FFT ---------- */
  const fftCache = {};
  function fftTables(n) {
    if (fftCache[n]) return fftCache[n];
    const bits = Math.round(Math.log2(n)), rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0, x = i;
      for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; }
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
    return (fftCache[n] = { rev, cos, sin });
  }
  function fft(re, im, inverse) {
    const n = re.length, T = fftTables(n);
    for (let i = 0; i < n; i++) {
      const j = T.rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = T.cos[k], wi = inverse ? T.sin[k] : -T.sin[k];
          const a = i + j, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  /* ---------- pitch detection ---------- */
  const work = {};
  function buffers(N) {
    if (!work[N]) work[N] = { s: new Float64Array(N), re: new Float64Array(2 * N), im: new Float64Array(2 * N), n: new Float64Array(N / 2 + 2) };
    return work[N];
  }
  const windowLen = (sr, c) => Math.pow(2, Math.ceil(Math.log2(sr * c.windowSec)));

  function detect(x, sr, c) {
    const N = windowLen(sr, c), B = buffers(N), s = B.s, off = x.length - N;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += x[off + i];
    mean /= N;
    let energy = 0;
    for (let i = 0; i < N; i++) { const v = x[off + i] - mean; s[i] = v; energy += v * v; }
    const rms = Math.sqrt(energy / N);
    if (rms < 0.0025) return { f: -1, rms, clarity: 0 };

    // autocorrelation r(tau) via FFT (zero-padded to 2N, so it is linear, not circular)
    const re = B.re, im = B.im, M = 2 * N;
    re.fill(0); im.fill(0);
    re.set(s);
    fft(re, im, false);
    for (let i = 0; i < M; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
    fft(re, im, true);

    const minLag = Math.max(2, Math.floor(sr / c.maxF));
    const maxLag = Math.min(Math.ceil(sr / c.minF), N / 2);
    const n = B.n;
    let m = 2 * energy;
    for (let t = 0; t <= maxLag + 1; t++) {
      if (t > 0) m -= s[t - 1] * s[t - 1] + s[N - t] * s[N - t];
      n[t] = m > 1e-12 ? (2 * re[t]) / M / m : 0;
    }

    // skip the first positive lobe, then collect the highest point of each positive lobe
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
    if (!peaks.length) return { f: -1, rms, clarity: 0 };

    let gmax = 0;
    for (const p of peaks) if (n[p] > gmax) gmax = n[p];
    const p = peaks.find((q) => n[q] >= 0.9 * gmax);
    const a = n[p - 1], b = n[p], cc = n[p + 1];
    const d = a - 2 * b + cc;
    const shift = d !== 0 ? (0.5 * (a - cc)) / d : 0;
    const clarity = d !== 0 ? b - 0.25 * (a - cc) * shift : b;
    return { f: sr / (p + shift), rms, clarity };
  }

  function median(arr) {
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  /* ---------- guitar headstock ---------- */
  const POSTS = [[70, 190], [70, 130], [70, 70], [130, 70], [130, 130], [130, 190]];
  const GAUGE = [2.8, 2.3, 1.9, 1.5, 1.2, 1];
  const strEls = [], pegEls = [];

  function buildHeadstock() {
    const nutX = (i) => 66 + i * 13.6;
    let knobs = "", strs = "", posts = "";
    POSTS.forEach(([x, y], i) => {
      const left = x < 100;
      const kx = left ? 18 : 156, sx = left ? 40 : 146;
      knobs += '<rect x="' + sx + '" y="' + (y - 2.5) + '" width="14" height="5" fill="#8E939B"/>' +
          '<rect x="' + kx + '" y="' + (y - 10) + '" width="26" height="20" rx="8" fill="#D3D6DB" stroke="#7D838C" stroke-width="1"/>';
      strs += '<path class="gstr" data-i="' + i + '" stroke-width="' + GAUGE[i] + '" d="M' + x + " " + y + " L" + nutX(i) + " 249 L" + nutX(i) + ' 320"/>';
      posts += '<circle cx="' + x + '" cy="' + y + '" r="6.5" fill="#D3D6DB" stroke="#5E646C" stroke-width="1"/><circle cx="' + x + '" cy="' + y + '" r="2.2" fill="#5E646C"/>';
    });
    el.head.innerHTML =
        '<svg class="headstock" viewBox="0 0 200 320" aria-hidden="true">' +
        '<defs>' +
        '<linearGradient id="hsGrad" x1="0" x2="1"><stop offset="0" stop-color="#17191D"/><stop offset=".5" stop-color="#2E3238"/><stop offset="1" stop-color="#17191D"/></linearGradient>' +
        '<linearGradient id="nkGrad" x1="0" x2="1"><stop offset="0" stop-color="#3A2315"/><stop offset=".5" stop-color="#5C3B24"/><stop offset="1" stop-color="#3A2315"/></linearGradient>' +
        '</defs>' + knobs +
        '<path d="M58 248 L48 46 Q46 16 74 12 L100 22 L126 12 Q154 16 152 46 L142 248 Z" fill="url(#hsGrad)" stroke="#0B0C0E" stroke-width="1.5"/>' +
        '<text x="100" y="46" text-anchor="middle" fill="#F2B33D" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="19">7uner</text>' +
        '<rect x="60" y="252" width="80" height="70" fill="url(#nkGrad)"/>' +
        '<rect x="60" y="294" width="80" height="3" fill="#C9CCD1"/>' +
        '<rect x="57" y="245" width="86" height="8" rx="2" fill="#ECE4D2"/>' +
        strs + posts + "</svg>";
    el.head.querySelectorAll(".gstr").forEach((p) => { strEls[+p.dataset.i] = p; });
  }

  function buildPegs() {
    const make = (i) => {
      const d = document.createElement("div");
      d.className = "peg";
      const n = 6 - i;
      d.innerHTML =
          '<button class="pm" data-d="-1" aria-label="Tune string ' + n + ' down a semitone">−</button>' +
          '<button class="pn" aria-pressed="false" aria-label="Lock to string ' + n + '"><span class="pnote"></span><span class="poff"></span></button>' +
          '<button class="pm" data-d="1" aria-label="Tune string ' + n + ' up a semitone">+</button>';
      d.querySelectorAll(".pm").forEach((b) => b.addEventListener("click", () => setOffset(i, st.offsets[i] + +b.dataset.d)));
      d.querySelector(".pn").addEventListener("click", () => setLock(lock === i ? null : i));
      pegEls[i] = d;
      return d;
    };
    [2, 1, 0].forEach((i) => el.pegsL.appendChild(make(i)));
    [3, 4, 5].forEach((i) => el.pegsR.appendChild(make(i)));
  }

  function buildPresets() {
    el.preset.innerHTML = PRESETS.map((p, k) => '<option value="' + k + '">' + p[0] + "</option>").join("") + '<option value="custom">Custom</option>';
  }

  let lock = null, tuned = [false, false, false, false, false, false];

  function renderPegs() {
    for (let i = 0; i < 6; i++) {
      const m = target(i), o = st.offsets[i], d = pegEls[i];
      d.querySelector(".pnote").innerHTML = noteName(m) + "<sub>" + octave(m) + "</sub>";
      d.querySelector(".poff").textContent = o === 0 ? "" : (o > 0 ? "+" : "−") + Math.abs(o);
      d.querySelector(".pn").setAttribute("aria-pressed", lock === i ? "true" : "false");
      const [down, up] = d.querySelectorAll(".pm");
      down.disabled = o <= OFF_MIN; up.disabled = o >= OFF_MAX;
      d.classList.toggle("tuned", tuned[i]);
      strEls[i].classList.toggle("tuned", tuned[i]);
    }
    const k = PRESETS.findIndex((p) => p[1].every((v, j) => v === st.offsets[j]));
    el.preset.value = k >= 0 ? String(k) : "custom";
    el.auto.setAttribute("aria-pressed", lock === null ? "true" : "false");
  }

  function setOffset(i, v) {
    st.offsets[i] = clampOff(v);
    tuned[i] = false;
    save(); renderPegs(); resetReading();
  }
  function setLock(i) { lock = i; resetReading(); renderPegs(); }

  function highlight(i, inTune) {
    for (let k = 0; k < 6; k++) {
      const on = k === i;
      pegEls[k].classList.toggle("active", on && !inTune);
      pegEls[k].classList.toggle("in", on && inTune);
      strEls[k].classList.toggle("active", on && !inTune);
      strEls[k].classList.toggle("in", on && inTune);
    }
  }

  /* ---------- mode and scale ---------- */
  function applyMode() {
    const c = cfg();
    document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-checked", b.dataset.mode === st.mode ? "true" : "false"));
    el.guitar.hidden = st.mode !== "guitar";
    el.root.classList.toggle("mode-guitar", st.mode === "guitar");
    el.labL.textContent = "−" + c.range;
    el.labR.textContent = "+" + c.range;
    const z = (c.inTune / c.range) * 50;
    el.zone.style.left = 50 - z + "%";
    el.zone.style.width = 2 * z + "%";
    el.sub.textContent = "";
    resetReading();
    hist.length = 0;
    resize();
  }
  function setMode(m) { if (m === st.mode) return; st.mode = m; save(); applyMode(); }

  /* ---------- display ---------- */
  function fmtCents(c, dec) {
    const v = Math.abs(c) < Math.pow(10, -dec) / 2 ? 0 : c;
    return (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(dec) + " cents";
  }

  function show(freq, targetMidi, cents, stringIdx) {
    const c = cfg(), inTune = Math.abs(cents) <= c.inTune;
    el.note.textContent = noteName(targetMidi);
    el.oct.textContent = octave(targetMidi);
    el.hz.innerHTML = '<span class="nw"><b>' + freq.toFixed(c.decimals ? 2 : 1) + "</b> Hz</span>" +
        (stringIdx != null ? ' &nbsp;<span class="nw">target ' + mtof(targetMidi).toFixed(2) + " Hz</span>" : "");
    el.cents.textContent = fmtCents(cents, c.decimals);
    el.sub.textContent = stringIdx != null ? "String " + (6 - stringIdx) + (lock !== null ? " (locked)" : "") : "";
    el.readout.classList.remove("idle");
    el.meter.classList.remove("idle");
    el.readout.classList.toggle("in", inTune);
    el.meter.classList.toggle("in", inTune);
    el.needle.style.left = 50 + (Math.max(-c.range, Math.min(c.range, cents)) / c.range) * 50 + "%";
    el.advice.classList.toggle("in", inTune);
    const far = Math.abs(cents) > c.range;
    el.advice.textContent = inTune ? "In tune"
        : cents < 0 ? (far ? "Well below – tighten the string" : "Flat – tighten the string a little")
            : (far ? "Well above – loosen the string" : "Sharp – loosen the string a little");
    if (st.mode === "guitar") highlight(stringIdx, inTune);
  }

  function idle() {
    el.readout.classList.add("idle");
    el.meter.classList.add("idle");
    el.advice.textContent = "";
    if (st.mode === "guitar") highlight(-1, false);
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
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function draw() {
    const cv = el.canvas, g = cv.getContext("2d"), c = cfg();
    const dpr = window.devicePixelRatio || 1, W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (!W) return;
    const mid = W / 2, half = W / 2, zw = half * (c.inTune / c.range);
    g.fillStyle = cssVar("--ok-soft");
    g.globalAlpha = 0.6;
    g.fillRect(mid - zw, 0, zw * 2, H);
    g.globalAlpha = 1;
    g.fillStyle = cssVar("--line");
    g.fillRect(mid - 0.5 * dpr, 0, dpr, H);

    const ok = cssVar("--ok"), amber = cssVar("--amber");
    g.lineWidth = 2.5 * dpr; g.lineJoin = "round"; g.lineCap = "round";
    const step = HIST_STEP * dpr;
    const xOf = (v) => mid + (Math.max(-c.range, Math.min(c.range, v)) / c.range) * half;
    for (let i = 1; i < hist.length; i++) {
      const a = hist[i - 1], b = hist[i];
      const y0 = (i - 1) * step;
      if (y0 > H) break;
      if (a == null || b == null) continue;
      g.strokeStyle = Math.abs(a) <= c.inTune && Math.abs(b) <= c.inTune ? ok : amber;
      g.beginPath(); g.moveTo(xOf(a), y0); g.lineTo(xOf(b), i * step); g.stroke();
    }
  }

  /* ---------- reading state ---------- */
  let ctx = null, stream = null, analyser = null, buf = null, raf = 0, lastTick = 0, running = false;
  let recent = [], smooth = null, lastKey = null, silent = 0, prevRms = 0, skip = 0, inTuneSince = null;
  const hist = [];

  function resetReading() { recent = []; smooth = null; lastKey = null; inTuneSince = null; idle(); }

  function chooseString(midi) {
    if (lock !== null) return lock;
    let best = 0, bd = Infinity;
    for (let i = 0; i < 6; i++) { const d = Math.abs(midi - target(i)); if (d < bd) { bd = d; best = i; } }
    // hysteresis: stay on the current string unless another one is clearly closer
    if (lastKey !== null && lastKey !== best && Math.abs(midi - target(lastKey)) <= bd + 0.35) return lastKey;
    return best;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastTick < TICK_MS) return;
    lastTick = now;
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
      if (st.mode === "guitar") { idx = chooseString(med); key = idx; tgt = target(idx); }
      else { tgt = Math.round(med); key = tgt; }
      const cents = (med - tgt) * 100;

      if (key !== lastKey || smooth === null) { smooth = cents; lastKey = key; inTuneSince = null; }
      else {
        const d = Math.abs(cents - smooth);
        const k = st.mode === "guitar" ? (d > 20 ? 0.8 : d > 6 ? 0.4 : 0.15) : (d > 20 ? 0.8 : 0.45);
        smooth += (cents - smooth) * k;
      }

      show(mtof(med), tgt, smooth, idx);
      hist.unshift(smooth);

      if (st.mode === "guitar") {
        if (Math.abs(smooth) <= c.inTune) {
          if (inTuneSince === null) inTuneSince = now;
          else if (now - inTuneSince >= HOLD_MS && !tuned[idx]) { tuned[idx] = true; renderPegs(); }
        } else inTuneSince = null;
      }
    } else {
      silent++;
      if (silent > SILENCE_TICKS) { if (lastKey !== null || smooth !== null) resetReading(); }
      hist.unshift(null);
    }
    const maxLen = Math.ceil(el.canvas.height / (HIST_STEP * (window.devicePixelRatio || 1))) + 2;
    if (hist.length > maxLen) hist.length = maxLen;
    draw();
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
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 24; hp.Q.value = 0.707;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5000; lp.Q.value = 0.707;
    analyser = ctx.createAnalyser();
    analyser.fftSize = Math.min(32768, Math.max(windowLen(ctx.sampleRate, CFG.chromatic), windowLen(ctx.sampleRate, CFG.guitar)));
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
    hist.length = 0;
    resetReading();
    draw();
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
  buildHeadstock();
  buildPegs();
  buildPresets();
  renderPegs();
  el.a4.value = st.a4;

  document.querySelectorAll(".modes button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  el.preset.addEventListener("change", () => {
    if (el.preset.value === "custom") return;
    st.offsets = PRESETS[+el.preset.value][1].slice();
    tuned = [false, false, false, false, false, false];
    lock = null;
    save(); renderPegs(); resetReading();
  });
  el.auto.addEventListener("click", () => setLock(null));
  el.start.addEventListener("click", start);
  el.stop.addEventListener("click", stop);
  el.a4.addEventListener("change", () => setA4(el.a4.value));
  el.a4d.addEventListener("click", () => setA4(st.a4 - 1));
  el.a4u.addEventListener("click", () => setA4(st.a4 + 1));
  el.a4r.addEventListener("click", () => setA4(440));
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });

  applyMode();

  window.tuner = { start, stop, resize, isRunning: () => running };
})();