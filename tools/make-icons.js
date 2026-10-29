/* 7uner – writes favicon.svg and draws the app icons and the social preview
   image as PNG from the same geometry (a guitar pick holding a rosewood
   fretboard with an amber 7 inlaid between two frets). Plain Node, no
   dependencies. Run after changing the logo:

     node tools/make-icons.js

   Writes ../favicon.svg and, to ../icons/:
   - icon-192.png, icon-512.png   manifest icons (the pick on a transparent ground)
   - maskable-512.png             manifest icon for Android's masks: full bleed,
                                  the pick inside the central safe circle
   - apple-touch-icon.png         180×180, full bleed (iOS rounds the corners)
   - social.png                   1200×630 Open Graph / Twitter card image */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "icons");
const BG = "#151A21", PANEL = "#1E252E", MUTED = "#97A2B0", AMBER = "#F2B33D", INK = "#E8ECF1", LINE = "#4A5563", OK = "#5ED18F", OK_SOFT = "#173A27";

/* ---------- drawing ----------
   Shapes are painted in order with 4×4 supersampling for smooth edges:
   rrect (rounded rectangle), circle, ring (part of a ring), poly (a filled polygon) and stroke (a
   list of segments with round caps and joins, like an SVG stroke). A shape
   takes a color, or paint(x, y) returning [r, g, b] (0..1) for a gradient,
   and may have clip(x, y), a test that limits where it is painted. */
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
  if (s.type === "ring") {
    // part of a ring, from angle a0 to a1 (radians, y down), with square ends
    return (x, y) => {
      const dx = x - s.cx, dy = y - s.cy, d = Math.hypot(dx, dy);
      if (d < s.r0 || d > s.r1) return false;
      const a = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI), a0 = (s.a0 + 2 * Math.PI) % (2 * Math.PI);
      return (a - a0 + 2 * Math.PI) % (2 * Math.PI) <= s.a1 - s.a0;
    };
  }
  if (s.type === "poly") {
    return (x, y) => {
      let inside = false;
      for (let i = 0, j = s.pts.length - 1; i < s.pts.length; j = i++) {
        const [xi, yi] = s.pts[i], [xj, yj] = s.pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
  }
  const h = s.w / 2;
  return (x, y) => s.segs.some((g) => segDist(x, y, g) <= h);
}

function bbox(s) {
  if (s.type === "rrect") return [s.x, s.y, s.x + s.w, s.y + s.h];
  if (s.type === "circle") return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
  if (s.type === "ring") return [s.cx - s.r1, s.cy - s.r1, s.cx + s.r1, s.cy + s.r1];
  if (s.type === "poly") {
    const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  const xs = s.segs.flatMap((g) => [g[0], g[2]]), ys = s.segs.flatMap((g) => [g[1], g[3]]);
  return [Math.min(...xs) - s.w, Math.min(...ys) - s.w, Math.max(...xs) + s.w, Math.max(...ys) + s.w];
}

function render(W, H, shapes) {
  const px = new Float64Array(W * H * 4); // premultiplied RGBA, 0..1
  const SS = 4;
  shapes.forEach((s) => {
    const test = shapeTest(s), inside = s.clip ? (x, y) => test(x, y) && s.clip(x, y) : test, a = s.alpha == null ? 1 : s.alpha;
    const flat = s.paint ? null : hex(s.color).map((v) => v / 255);
    const [x0, y0, x1, y1] = bbox(s);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
        let n = 0;
        for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) if (inside(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) n++;
        if (!n) continue;
        const cov = (n / (SS * SS)) * a, k = (y * W + x) * 4, [r, g, b] = flat || s.paint(x + 0.5, y + 0.5);
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
/* ---------- the logo ----------
   A guitar pick holding a rosewood fretboard seen at a gentle angle, with an
   amber 7 inlaid flat into the board between two frets, under thin strings.
   The geometry is worked out once here, in a 64×64 box: favicon.svg is
   written from it and the PNGs are painted from it, so they can't drift. */
const PICK = [[[32, 61], [20, 50], [5, 34], [6, 19]], [[6, 19], [7, 8], [18, 3], [32, 3]], [[32, 3], [46, 3], [57, 8], [58, 19]], [[58, 19], [59, 34], [44, 50], [32, 61]]];
const lerp = (a, b, t) => a + (b - a) * t;
const cubic = ([a, b, c, d], t) => [0, 1].map((k) => (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t * t * c[k] + t ** 3 * d[k]);
const quad = ([a, b, c], t) => [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * b[k] + t * t * c[k]);
const PICK_PTS = PICK.flatMap((s) => Array.from({ length: 32 }, (_, i) => cubic(s, i / 32)));

// the board in perspective, 38 units wide at the top of the box and 54 at the bottom;
// u runs across it (0..1) and v along it (0 near, 1 far)
const WT = 38, WB = 54;
const wAt = (y) => WT + ((WB - WT) * y) / 64;
const yOfV = (v) => ((1 / (1 / WB + v * (1 / WT - 1 / WB)) - WT) * 64) / (WB - WT);
const at = (u, v) => { const y = yOfV(v); return [32 + (u - 0.5) * wAt(y), y]; };

const FRETS = [0.84, 0.1];
// the 7, cut like Barlow Condensed's, in its own box (x 18.5–46.6, y 10.5–56.3), laid onto the board between the frets
const SEVEN = [[18.5, 10.5], [46.6, 10.5], [46.6, 15.38], [33.3, 56.3], [25.1, 53.7], [36.38, 19], [18.5, 19]];
const vTop = FRETS[0] - (FRETS[0] - FRETS[1]) * 0.16, vBot = FRETS[1] + (FRETS[0] - FRETS[1]) * 0.14;
const SEVEN_PTS = SEVEN.map(([x, y]) => at(0.27 + (0.46 * (x - 18.5)) / 28.1, vTop - ((vTop - vBot) * (y - 10.5)) / 45.8));
const BOARD = [at(0, 3), at(1, 3), at(1, -0.2), at(0, -0.2)];
const GRAIN = [0.08, 0.2, 0.33, 0.46, 0.58, 0.71, 0.84, 0.94].map((u, j) => ({
  pts: [at(u, 3), at(u + (j % 2 ? 0.012 : -0.012), 0.5), at(u, -0.2)], color: j % 3 === 1 ? "#D9A070" : "#000000", alpha: j % 3 === 1 ? 0.09 : 0.3, w: j % 2 ? 0.5 : 0.8
}));
const FRET_LINES = FRETS.map((v) => { const a = at(-0.1, v), b = at(1.1, v), t = wAt(a[1]) / WB; return { a, b, w: 2.2 * t, off: 1.4 * t }; });
const STRINGS = [0, 1, 2, 3, 4, 5].map((i) => ({ a: at(0.1 + 0.16 * i, 3), b: at(0.1 + 0.16 * i, -0.2), w: i < 3 ? 0.7 : 0.5 }));

const box = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const PICK_BOX = box(PICK_PTS), BOARD_BOX = box(BOARD), SEVEN_BOX = box(SEVEN_PTS);
const STOPS = {
  wood: [[0, "#1E120A"], [0.5, "#3A2416"], [1, "#1E120A"]],
  rim: [[0, "#FFE7A3"], [0.5, "#F2B33D"], [1, "#C98A1E"]],
  inlay: [[0, "#F2B33D"], [0.5, "#F2B33D"], [1, "#E0A02E"]]
};

/* favicon.svg */
function logoSvg() {
  const n = (v) => +v.toFixed(2), pt = (p) => n(p[0]) + " " + n(p[1]);
  const poly = (pts) => "M" + pts.map(pt).join("L") + "Z";
  const grad = (id, stops, diag) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="' + (diag ? 1 : 0) + '">' + stops.map(([o, c]) => '<stop offset="' + o + '" stop-color="' + c + '"/>').join("") + "</linearGradient>";
  const pick = "M32 61C20 50 5 34 6 19C7 8 18 3 32 3C46 3 57 8 58 19C59 34 44 50 32 61Z";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>' + grad("w", STOPS.wood) + grad("r", STOPS.rim, true) + grad("i", STOPS.inlay, true) +
    '<clipPath id="p"><path d="' + pick + '"/></clipPath></defs><g clip-path="url(#p)"><rect width="64" height="64" fill="#0E0B09"/>' +
    '<path d="' + poly(BOARD) + '" fill="url(#w)"/>' +
    GRAIN.map((g) => '<path d="M' + pt(g.pts[0]) + "Q" + pt(g.pts[1]) + " " + pt(g.pts[2]) + '" fill="none" stroke="' + g.color + '" stroke-opacity="' + g.alpha + '" stroke-width="' + g.w + '"/>').join("") +
    FRET_LINES.map((f) => '<path d="M' + pt(f.a) + "L" + pt(f.b) + '" stroke="#C3C7CD" stroke-width="' + n(f.w) + '"/><path d="M' + n(f.a[0]) + " " + n(f.a[1] + f.off) + "L" + n(f.b[0]) + " " + n(f.b[1] + f.off) + '" stroke="#000" stroke-opacity=".45" stroke-width=".6"/>').join("") +
    '<path d="' + poly(SEVEN_PTS) + '" fill="#080504" stroke="#080504" stroke-width="1.2"/><path d="' + poly(SEVEN_PTS) + '" fill="url(#i)"/>' +
    STRINGS.map((s) => '<path d="M' + pt(s.a) + "L" + pt(s.b) + '" stroke="#D3D7DE" stroke-opacity=".85" stroke-width="' + s.w + '"/><path d="M' + n(s.a[0] + 0.6) + " " + n(s.a[1]) + "L" + n(s.b[0] + 0.8) + " " + n(s.b[1]) + '" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>').join("") +
    '</g><path d="' + pick + '" fill="none" stroke="url(#r)" stroke-width="3" stroke-linejoin="round"/></svg>\n';
}

/* the same drawing as shapes for the PNG painter, placed at x, y and scaled to size */
function gradient(stops, bx, diag, k, ox, oy) {
  const [x0, y0, x1, y1] = bx.map((v, i) => (i % 2 ? oy : ox) + v * k), cs = stops.map(([o, c]) => [o, hex(c).map((v) => v / 255)]);
  return (x, y) => {
    const nx = (x - x0) / (x1 - x0), t = Math.max(0, Math.min(1, diag ? (nx + (y - y0) / (y1 - y0)) / 2 : nx));
    let i = 0;
    while (i < cs.length - 2 && t > cs[i + 1][0]) i++;
    const [o0, c0] = cs[i], [o1, c1] = cs[i + 1], f = (t - o0) / (o1 - o0 || 1);
    return c0.map((c, j) => lerp(c, c1[j], Math.max(0, Math.min(1, f))));
  };
}
function logo(x, y, size) {
  const k = size / 64, P = ([a, b]) => [x + a * k, y + b * k], seg = (a, b) => [...P(a), ...P(b)];
  const pick = PICK_PTS.map(P), inPick = shapeTest({ type: "poly", pts: pick }), clip = inPick;
  const line = (pts) => pts.slice(1).map((p, i) => seg(pts[i], p));
  const out = [{ type: "poly", pts: pick, color: "#0E0B09" },
    { type: "poly", pts: BOARD.map(P), clip, paint: gradient(STOPS.wood, BOARD_BOX, false, k, x, y) }];
  GRAIN.forEach((g) => out.push({ type: "stroke", w: g.w * k, color: g.color, alpha: g.alpha, clip, segs: line(Array.from({ length: 25 }, (_, i) => quad(g.pts, i / 24))) }));
  FRET_LINES.forEach((f) => out.push({ type: "stroke", w: f.w * k, color: "#C3C7CD", clip, segs: [seg(f.a, f.b)] },
    { type: "stroke", w: 0.6 * k, color: "#000000", alpha: 0.45, clip, segs: [seg([f.a[0], f.a[1] + f.off], [f.b[0], f.b[1] + f.off])] }));
  out.push({ type: "poly", pts: SEVEN_PTS.map(P), color: "#080504" },
    { type: "stroke", w: 1.2 * k, color: "#080504", segs: line([...SEVEN_PTS, SEVEN_PTS[0]]) },
    { type: "poly", pts: SEVEN_PTS.map(P), paint: gradient(STOPS.inlay, SEVEN_BOX, true, k, x, y) });
  STRINGS.forEach((s) => out.push({ type: "stroke", w: s.w * k, color: "#D3D7DE", alpha: 0.85, clip, segs: [seg(s.a, s.b)] },
    { type: "stroke", w: 0.5 * k, color: "#000000", alpha: 0.35, clip, segs: [seg([s.a[0] + 0.6, s.a[1]], [s.b[0] + 0.8, s.b[1]])] }));
  out.push({ type: "stroke", w: 3 * k, paint: gradient(STOPS.rim, PICK_BOX, true, k, x, y), segs: line([...PICK_PTS, PICK_PTS[0]]) });
  return out;
}
// the app icons: the pick on a transparent ground, or full bleed on the dark tile (maskable, apple-touch-icon)
function icon(S, full, scale) {
  const L = S * scale;
  return [...(full ? [{ type: "rrect", x: 0, y: 0, w: S, h: S, r: 0, color: BG }] : []), ...logo((S - L) / 2, (S - L) / 2, L)];
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

/* the wordmark "7uner" in the logo's style, after Barlow Condensed Bold:
   the logo's 7 with square ends, and condensed letters built from flat
   stems and ring segments with square ends. x is the left edge, base the
   baseline, h the x-height and s the stem width. Stems reach a pixel into
   the rings so no seam shows where they meet. */
function wordmark(x, base, h, s) {
  const top = base - h, cap = base - h * 1.45, gap = h * 0.2, lw = h * 0.7, R = lw / 2, PI = Math.PI, out = [];
  const bar = (x0, y0, w, hh) => out.push({ type: "rrect", x: x0, y: y0, w, h: hh, r: 0, color: INK });
  const ring = (cx, cy, r, a0, a1) => out.push({ type: "ring", cx, cy, r0: r - s, r1: r, a0, a1, color: INK });
  // 7: the logo's outline, scaled up to the cap height
  const sh = base - cap, sw = (sh * 28.1) / 45.8;
  out.push({ type: "poly", color: AMBER, pts: SEVEN.map(([a, b]) => [x + ((a - 18.5) * sw) / 28.1, cap + ((b - 10.5) * sh) / 45.8]) });
  x += sw + gap * 1.3;
  // u: two stems and a bowl, the right stem down to the baseline
  bar(x, top, s, h - R + 1); ring(x + R, base - R, R, 0, PI); bar(x + lw - s, top, s, h);
  x += lw + gap;
  // n: the u upside down, the left stem full height
  bar(x, top, s, h); ring(x + R, top + R, R, PI, 2 * PI); bar(x + lw - s, top + R - 1, s, h - R + 1);
  x += lw + gap;
  // e: a stadium with a bar across, open at the lower right
  const ey = top + h * 0.46, eb = s * 0.8;
  ring(x + R, top + R, R, PI, 2 * PI); bar(x, top + R - 1, s, h - 2 * R + 2); ring(x + R, base - R, R, 0.42, PI);
  bar(x + lw - s, top + R - 1, s, ey + eb - top - R + 1); bar(x, ey, lw, eb);
  x += lw + gap;
  // r: a stem and an arm curling to the right, cut square
  const ar = lw * 0.44;
  bar(x, top, s, h); ring(x + ar, top + ar, ar, PI, 1.82 * PI);
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
    ...logo(96, 165, 300),
    ...wordmark(480, 330, 112, 27),
    ...gauge(800, 720, 250)];
}

fs.writeFileSync(path.join(__dirname, "..", "favicon.svg"), logoSvg());
console.log("wrote favicon.svg");
fs.mkdirSync(OUT, { recursive: true });
const write = (name, W, H, shapes) => {
  fs.writeFileSync(path.join(OUT, name), png(W, H, render(W, H, shapes)));
  console.log("wrote icons/" + name);
};
write("icon-192.png", 192, 192, icon(192, false, 1));
write("icon-512.png", 512, 512, icon(512, false, 1));
write("maskable-512.png", 512, 512, icon(512, true, 0.78));
write("apple-touch-icon.png", 180, 180, icon(180, true, 0.86));
write("social.png", 1200, 630, social());
