/* 7uner – tests for js/pitch.js, run with Node (no browser needed):

     node --test tests/

   A sine and a sawtooth at known frequencies, across the range of every
   tuner mode, must come back within 1 cent. */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// pitch.js is a browser script that sets window.pitch
const sandbox = { window: {}, Math, Float64Array, Uint32Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "js", "pitch.js"), "utf8"), sandbox);
const { detect, windowLen, median } = sandbox.window.pitch;

// the usual sound card rates
const RATES = [44100, 48000];
// the tuner modes' detection settings (js/tuner.js)
const CHROMATIC = { minF: 27, maxF: 4200, windowSec: 0.085 };
const GUITAR = { minF: 38, maxF: 1400, windowSec: 0.17 };
const BASS = { minF: 25, maxF: 600, windowSec: 0.22 };

const sine = (f, n, sr) => Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin((2 * Math.PI * f * i) / sr));
// a band-limited sawtooth (harmonics up to 10 kHz), closer to a plucked string than a sine
function saw(f, n, sr) {
  const out = new Float32Array(n), H = Math.floor(10000 / f);
  for (let h = 1; h <= H; h++) {
    const a = 0.3 / h, w = (2 * Math.PI * f * h) / sr;
    for (let i = 0; i < n; i++) out[i] += a * Math.sin(w * i);
  }
  return out;
}
const cents = (f, ref) => 1200 * Math.log2(f / ref);

function check(wave, f, c) {
  RATES.forEach((sr) => checkAt(wave, f, c, sr));
}
function checkAt(wave, f, c, sr) {
  const x = wave(f, windowLen(sr, c) + 1000, sr);
  const r = detect(x, sr, c);
  assert.ok(r.f > 0, wave.name + " " + f + " Hz at " + sr + ": no pitch found");
  const off = cents(r.f, f);
  assert.ok(Math.abs(off) < 1, wave.name + " " + f + " Hz at " + sr + " read as " + r.f.toFixed(3) + " Hz (" + off.toFixed(2) + " cents)");
  assert.ok(r.clarity > 0.9, wave.name + " " + f + " Hz at " + sr + ": clarity " + r.clarity.toFixed(2));
}

test("guitar strings, sine and sawtooth, within 1 cent", () => {
  // E2 A2 D3 G3 B3 E4, low B1 (7-string) and F#1 (8-string), and high frets
  // up to E6 (24th fret), which used to read an octave low
  [82.41, 110, 146.83, 196, 246.94, 329.63, 61.74, 46.25, 1046.5, 1174.66, 1318.51].forEach((f) => {
    check(sine, f, GUITAR);
    check(saw, f, GUITAR);
  });
});

test("bass strings, including a 5-string's low B", () => {
  [30.87, 41.2, 55, 73.42, 98, 130.81].forEach((f) => {
    check(sine, f, BASS);
    check(saw, f, BASS);
  });
});

test("chromatic mode, across its range and off the semitone", () => {
  [32.7, 65.41, 440, 445.3, 880, 1760, 3520, 4186].forEach((f) => {
    check(sine, f, CHROMATIC);
    check(saw, f, CHROMATIC);
  });
});

test("silence and noise give no pitch", () => {
  const SR = 48000, n = windowLen(SR, GUITAR) + 1000;
  assert.strictEqual(detect(new Float32Array(n), SR, GUITAR).f, -1);
  let seed = 1;
  const noise = Float32Array.from({ length: n }, () => { seed = (seed * 16807) % 2147483647; return 0.001 * (seed / 2147483647 - 0.5); });
  assert.strictEqual(detect(noise, SR, GUITAR).f, -1);
});

test("windowLen is a power of two covering the window", () => {
  [GUITAR, BASS, CHROMATIC].forEach((c) => {
    RATES.forEach((sr) => {
      const n = windowLen(sr, c);
      assert.strictEqual(n & (n - 1), 0);
      assert.ok(n >= sr * c.windowSec && n < 2 * sr * c.windowSec);
    });
  });
});

test("median", () => {
  assert.strictEqual(median([3, 1, 2]), 2);
  assert.strictEqual(median([5, 1, 4, 2, 3]), 3);
});
