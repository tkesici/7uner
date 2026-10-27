/* 7uner – draws the app icons and the social preview image as PNG, from the
   same shapes as favicon.svg (an amber 7 on a dark tile). Plain Node, no
   dependencies. Run after changing the logo:

     node tools/make-icons.js

   Writes to ../icons/:
   - icon-192.png, icon-512.png   manifest icons (rounded tile, transparent corners)
   - maskable-512.png             manifest icon for Android's masks: full bleed,
                                  the 7 inside the central safe circle
   - apple-touch-icon.png         180×180, full bleed (iOS rounds the corners)
   - social.png                   1200×630 Open Graph / Twitter card image */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "icons");
const BG = "#151A21", PANEL = "#1E252E", AMBER = "#F2B33D", INK = "#E8ECF1", LINE = "#4A5563", OK = "#5ED18F", OK_SOFT = "#173A27";

/* ---------- drawing ----------
   Shapes are painted in order with 4×4 supersampling for smooth edges:
   rrect (rounded rectangle), circle, and stroke (a list of segments with
   round caps and joins, like an SVG stroke). */
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function segDist(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l)) : 0;
  const ex = px - x1 - t * dx, ey = py - y1 - t * dy;
  return Math.sqrt(ex * ex + ey * ey);
}

function shapeTest(s) {
  if (s.type === "rrect") {
    return (x, y) => {
      if (x < s.x || y < s.y || x > s.x + s.w || y > s.y + s.h) return false;
      const cx = Math.max(s.x + s.r, Math.min(s.x + s.w - s.r, x)), cy = Math.max(s.y + s.r, Math.min(s.y + s.h - s.r, y));
      return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= s.r * s.r;
    };
  }
  if (s.type === "circle") return (x, y) => (x - s.cx) * (x - s.cx) + (y - s.cy) * (y - s.cy) <= s.r * s.r;
  const h = s.w / 2;
  return (x, y) => s.segs.some((g) => segDist(x, y, g) <= h);
}

function bbox(s) {
  if (s.type === "rrect") return [s.x, s.y, s.x + s.w, s.y + s.h];
  if (s.type === "circle") return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
  const xs = s.segs.flatMap((g) => [g[0], g[2]]), ys = s.segs.flatMap((g) => [g[1], g[3]]);
  return [Math.min(...xs) - s.w, Math.min(...ys) - s.w, Math.max(...xs) + s.w, Math.max(...ys) + s.w];
}

function render(W, H, shapes) {
  const px = new Float64Array(W * H * 4); // premultiplied RGBA, 0..1
  const SS = 4;
  shapes.forEach((s) => {
    const inside = shapeTest(s), [r, g, b] = hex(s.color).map((v) => v / 255), a = s.alpha == null ? 1 : s.alpha;
    const [x0, y0, x1, y1] = bbox(s);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
        let n = 0;
        for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) if (inside(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) n++;
        if (!n) continue;
        const cov = (n / (SS * SS)) * a, k = (y * W + x) * 4;
        px[k] = r * cov + px[k] * (1 - cov);
        px[k + 1] = g * cov + px[k + 1] * (1 - cov);
        px[k + 2] = b * cov + px[k + 2] * (1 - cov);
        px[k + 3] = cov + px[k + 3] * (1 - cov);
      }
    }
  });
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const al = px[i * 4 + 3];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = al ? Math.round((px[i * 4 + c] / al) * 255) : 0;
    out[i * 4 + 3] = Math.round(al * 255);
  }
  return out;
}

/* ---------- PNG ---------- */
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(W, H, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- the logo ---------- */
// favicon.svg's 7 in its 64×64 box: M18 16 h28 L30 50, stroke 8
function seven(x, y, size, color) {
  const k = size / 64, P = [[18, 16], [46, 16], [30, 50]].map(([a, b]) => [x + a * k, y + b * k]);
  return { type: "stroke", w: 8 * k, color, segs: [[...P[0], ...P[1]], [...P[1], ...P[2]]] };
}
// a tile with the 7; full = square, no rounded corners (maskable, apple-touch-icon)
function icon(S, full, scale) {
  const sh = [{ type: "rrect", x: 0, y: 0, w: S, h: S, r: full ? 0 : (14 / 64) * S, color: BG }];
  const L = S * scale;
  sh.push(seven((S - L) / 2, (S - L) / 2, L, AMBER));
  return sh;
}

// arcs as short segments; angles in radians, y down (as on a canvas)
function arc(cx, cy, r, a0, a1) {
  const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * r) / 4)), segs = [];
  for (let i = 0; i < n; i++) {
    const p = a0 + ((a1 - a0) * i) / n, q = a0 + ((a1 - a0) * (i + 1)) / n;
    segs.push([cx + r * Math.cos(p), cy + r * Math.sin(p), cx + r * Math.cos(q), cy + r * Math.sin(q)]);
  }
  return segs;
}

/* the wordmark "7uner", drawn with strokes: x is the left edge, base the
   baseline, h the x-height; letters are as wide as the x-height is tall */
function wordmark(x, base, h, w) {
  const r = h * 0.4, top = base - h, cap = base - h * 1.45, gap = h * 0.32, L = h * 0.8, out = [];
  // 7
  out.push({ type: "stroke", w, color: AMBER, segs: [[x, cap, x + L, cap], [x + L, cap, x + L * 0.38, base]] });
  x += L + gap;
  // u
  out.push({ type: "stroke", w, color: INK, segs: [[x, top, x, base - r], ...arc(x + r, base - r, r, Math.PI, 0), [x + 2 * r, top, x + 2 * r, base]] });
  x += 2 * r + gap;
  // n
  out.push({ type: "stroke", w, color: INK, segs: [[x, base, x, top], ...arc(x + r, top + r, r, Math.PI, 2 * Math.PI), [x + 2 * r, top + r, x + 2 * r, base]] });
  x += 2 * r + gap;
  // e
  const ey = top + h / 2, er = h / 2;
  out.push({ type: "stroke", w, color: INK, segs: [[x, ey, x + 2 * er, ey], ...arc(x + er, ey, er, 0, -2 * Math.PI + 0.75)] });
  x += 2 * er + gap;
  // r
  out.push({ type: "stroke", w, color: INK, segs: [[x, base, x, top], ...arc(x + r, top + r, r, Math.PI, 1.72 * Math.PI)] });
  return out;
}

// the tuner's gauge: a ±60° arc with ticks, the in-tune zone and the dot in it
function gauge(cx, cy, R) {
  const SPAN = Math.PI / 3, up = -Math.PI / 2, zone = SPAN * (2 / 25), out = [];
  out.push({ type: "stroke", w: 18, color: OK_SOFT, segs: arc(cx, cy, R, up - zone * 2, up + zone * 2) });
  out.push({ type: "stroke", w: 3, color: LINE, segs: arc(cx, cy, R, up - SPAN, up + SPAN) });
  const ticks = [];
  for (let k = -4; k <= 4; k++) {
    const a = up + (k / 4) * SPAN, len = k === 0 ? 20 : k % 2 ? 8 : 13;
    ticks.push([cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6), cx + Math.cos(a) * (R + 6 + len), cy + Math.sin(a) * (R + 6 + len)]);
  }
  out.push({ type: "stroke", w: 3, color: LINE, segs: ticks });
  out.push({ type: "circle", cx: cx + Math.cos(up) * R, cy: cy + Math.sin(up) * R, r: 26, color: OK, alpha: 0.25 });
  out.push({ type: "circle", cx: cx + Math.cos(up) * R, cy: cy + Math.sin(up) * R, r: 13, color: OK });
  return out;
}

function social() {
  const W = 1200, H = 630;
  return [{ type: "rrect", x: 0, y: 0, w: W, h: H, r: 0, color: BG },
    { type: "rrect", x: 96, y: 165, w: 300, h: 300, r: 66, color: PANEL },
    seven(96 + 30, 165 + 30, 240, AMBER),
    ...wordmark(480, 330, 112, 26),
    ...gauge(800, 720, 250)];
}

fs.mkdirSync(OUT, { recursive: true });
const write = (name, W, H, shapes) => {
  fs.writeFileSync(path.join(OUT, name), png(W, H, render(W, H, shapes)));
  console.log("wrote icons/" + name);
};
write("icon-192.png", 192, 192, icon(192, false, 1));
write("icon-512.png", 512, 512, icon(512, false, 1));
write("maskable-512.png", 512, 512, icon(512, true, 0.85));
write("apple-touch-icon.png", 180, 180, icon(180, true, 0.86));
write("social.png", 1200, 630, social());
