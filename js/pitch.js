/* 7uner – pitch detection, shared by the tuner and anything else that
   listens to the microphone.
   McLeod Pitch Method: the normalised square difference function is
   computed with an FFT autocorrelation, so long analysis windows stay cheap,
   and the peak is refined with parabolic interpolation.
   detect(samples, sampleRate, cfg) reads the last windowLen() samples;
   cfg needs minF, maxF and windowSec; minRms, if given, lowers the level
   below which it doesn't look for a pitch (for following a note as it fades). */
(function () {
  "use strict";

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
    if (rms < (c.minRms || 0.0025)) return { f: -1, rms, clarity: 0 };

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

    // skip the positive lobe around lag 0, then collect the highest point of
    // each positive lobe. The skipping starts at lag 1, not minLag: for notes
    // near maxF, minLag already lies in the lobe of the true period, and
    // skipping that one read the note an octave low.
    let t = 1;
    while (t <= maxLag && n[t] > 0) t++;
    const peaks = [];
    let inPos = false, best = 0, bestV = -1;
    for (; t <= maxLag; t++) {
      if (n[t] > 0) {
        if (!inPos) { inPos = true; best = t; bestV = n[t]; }
        else if (n[t] > bestV) { best = t; bestV = n[t]; }
      } else if (inPos) { if (best >= minLag) peaks.push(best); inPos = false; }
    }
    if (inPos && best < maxLag && best >= minLag) peaks.push(best);
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

  window.pitch = { detect, windowLen, median };
})();
