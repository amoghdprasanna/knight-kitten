'use strict';

// ---------------------------------------------------------------------------
// Bengaluru mode: pixel art for buildings, trees and homes. Everything is
// drawn once into small canvases when the city is first built.
// ---------------------------------------------------------------------------
function bcv(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  const r = (col, x, y, ww = 1, hh = 1) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); };
  fn(r, c, w, h);
  return cv;
}

// A shape given as rows [y, x0, x1]: outline first, then fill per pixel.
function bShape(r, rows, o, fill) {
  for (const [y, x0, x1] of rows) r(o, x0 - 1, y - 1, x1 - x0 + 3, 3);
  for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) r(fill(x, y, x0, x1), x, y);
}

function domeRows(cx, by, rx, ry) {
  const rows = [];
  for (let dy = 0; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    rows.push([by - dy, cx - half, cx + half]);
  }
  return rows;
}

function bDome(r, cx, by, rx, ry, cols, ribs = 0, finial = '#e2b54a') {
  const [o, lit, mid, dark] = cols;
  bShape(r, domeRows(cx, by, rx, ry), o, (x, y, x0, x1) => {
    const k = (x - x0) / Math.max(1, x1 - x0);
    let col = k < 0.28 ? lit : k > 0.68 ? dark : mid;
    if (ribs && (x - cx) % ribs === 0 && col !== lit) col = dark;
    return col;
  });
  r(o, cx - 1, by - ry - 5, 3, 4);
  r(finial, cx, by - ry - 6, 1, 5);
}

function archWindow(r, x, y, w, h, frame, glass) {
  r(frame, x - 1, y, w + 2, h + 1);
  r(frame, x, y - 1, w, 1);
  r(glass, x, y + 1, w, h - 1);
  r(glass, x + 1, y, w - 2, 1);
}

// ---------------------------------------------------------------------------
// 3D buildings. An oblique projection in the spirit of isometric map
// illustration: every building shows its roof, its front and its right-hand
// side, shaded roof-lightest, front-middle, side-darkest, with dark outlines.
// x runs along the facade, y goes back into the picture, z goes up.
// ---------------------------------------------------------------------------
const OB = { SX: 0.42, SY: 0.58 };
const LIGHT = (() => { const l = [-0.55, 0.62, 0.56], n = Math.hypot(...l); return l.map(v => v / n); })();

// Fills a polygon by scanlines so its edges stay crisp pixels.
function polyFill(c, pts, col) {
  c.fillStyle = col;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + (yc - y0) / (y1 - y0) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const a = Math.round(xs[i]), b = Math.round(xs[i + 1]); if (b > a) c.fillRect(a, y, b - a, 1); }
  }
}

function pixLine(c, [x0, y0], [x1, y1], col) {
  c.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Picks a colour from a dark-to-light ramp for a brightness, with ordered dithering.
function rampAt(ramp, v, x, y) {
  const t = clamp(v, 0, 1) * (ramp.length - 1) + (BAYER[y & 3][x & 3] / 16 - 0.47) * 0.7;
  return ramp[clamp(Math.round(t), 0, ramp.length - 1)];
}

function b3dCanvas(w, h, ox, oy, fn) {
  return bcv(w, h, (r, c) => {
    const P = (x, y, z) => [ox + x + y * OB.SX, oy - z - y * OB.SY];
    const g = {
      r, c, P,
      // A box: right side, roof, then front; returns the front face rectangle.
      box(x, y, z, w, d, h, col) {
        const O = col.line || '#3a2a1a';
        const side = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
        const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
        if (col.side) polyFill(c, side, col.side);
        if (col.top) polyFill(c, top, col.top);
        const [fx, fy] = P(x, y, z + h);
        const fw = Math.round(w), fh = Math.round(h);
        if (col.front) r(col.front, Math.round(fx), Math.round(fy), fw, fh);
        if (O) {
          if (col.top) { pixLine(c, top[0], top[3], O); pixLine(c, top[3], top[2], O); pixLine(c, top[1], top[2], O); }
          if (col.side) { pixLine(c, side[0], side[1], O); pixLine(c, side[1], side[2], O); }
          r(O, Math.round(fx), Math.round(fy), fw + 1, 1);
          r(O, Math.round(fx), Math.round(fy), 1, fh);
          r(O, Math.round(fx) + fw, Math.round(fy), 1, fh);
          r(O, Math.round(fx), Math.round(fy) + fh - 1, fw + 1, 1);
        }
        return { x: Math.round(fx), y: Math.round(fy), w: fw, h: fh };
      },
      // A vertical cylinder (columns, drums), shaded across its width.
      cyl(x, y, z, rad, h, ramp, line = '#3a2a1a') {
        const [cx, cy] = P(x, y, z);
        for (let i = -rad; i <= rad; i++) {
          const nx = i / (rad + 0.5), nz = Math.sqrt(Math.max(0, 1 - nx * nx));
          const v = nx * LIGHT[0] + nz * LIGHT[2] + 0.25;
          for (let j = 0; j < h; j++) r(rampAt(ramp, v, i + 64, j), Math.round(cx + i), Math.round(cy - j), 1, 1);
        }
        if (line) { r(line, Math.round(cx - rad - 1), Math.round(cy - h), 1, h); r(line, Math.round(cx + rad + 1), Math.round(cy - h), 1, h); }
      },
      // A dome on a circular base; onion > 0 bulges it and draws a point on top.
      dome(x, y, z, rad, h, ramp, onion = 0, line = '#3a2a1a', ribs = 0) {
        const [cx, cy] = P(x, y, z);
        const widthAt = t => rad * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + onion * 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
        const rows = [];
        for (let j = 0; j <= h; j++) {
          const t = j / h, half = widthAt(t);
          rows.push([Math.round(cy - j), Math.round(cx - half), Math.round(cx + half), t]);
        }
        for (const [yy, a, b] of rows) r(line, a - 1, yy - 1, b - a + 3, 2);
        for (const [yy, a, b, t] of rows) {
          for (let xx = a; xx <= b; xx++) {
            const nx = (xx - cx) / Math.max(1, (b - a) / 2), el = Math.asin(Math.min(1, t));
            const n = [nx * Math.cos(el), Math.sin(el), Math.sqrt(Math.max(0, 1 - nx * nx)) * Math.cos(el)];
            let v = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2] + 0.12;
            if (ribs && t < 0.92 && Math.round(Math.asin(clamp(nx, -1, 1)) * ribs) % 2 === 0 && Math.abs(Math.asin(clamp(nx, -1, 1)) * ribs % 1) < 0.18) v -= 0.16;
            r(rampAt(ramp, v, xx, yy), xx, yy, 1, 1);
          }
        }
        if (onion) { r(line, Math.round(cx) - 1, Math.round(cy - h) - 4, 3, 4); r(ramp[ramp.length - 2], Math.round(cx), Math.round(cy - h) - 4, 1, 3); }
        return [cx, cy - h];
      },
    };
    fn(g);
  });
}

// Vidhana Soudha, from the front steps: arcaded wings with a parapet of tiny
// spires, square towers with tiered chhatri roofs, a portico of twelve
// columns under a deep sloping cornice, the Karnataka emblem and the flag on
// the gable, and the great dome with the Ashoka lion capital.
function bVidhana3D() {
  const W0 = 396, H0 = 246, OX = 4, OY = H0 - 23;
  const SAND = ['#3a2a1a', '#634a2c', '#86663f', '#a88552', '#c6a067', '#dbb97e', '#ebd09c', '#f6e3b8'];
  const GOLD = ['#4a3410', '#7a5a1a', '#a87e24', '#d4a83a', '#f0cc5c', '#fff0a8'];
  const F = { front: '#d2ae74', top: '#e9cf98', side: '#a07e50', line: '#3a2a1a' };
  const REC = '#664c2e', DEEP = '#3f2e1c', LIT = '#efd8a4', MID = '#b8955f', TEAL = '#7fbfa8';
  let inscription = null;
  const img = b3dCanvas(W0, H0, OX, OY, g => {
    const { r, P } = g;
    const finials = (x0, x1, y, z, step = 5) => {
      for (let x = x0 + 2; x < x1 - 1; x += step) {
        const [sx, sy] = P(x, y, z);
        const X = Math.round(sx), Y = Math.round(sy);
        r('#3a2a1a', X - 1, Y - 6, 3, 6); r(LIT, X, Y - 6, 1, 5); r(MID, X + 1, Y - 4, 1, 3); r('#3a2a1a', X, Y - 8, 1, 2);
      }
    };
    const lotus = (x, y, z) => {
      const [sx, sy] = P(x, y, z);
      const X = Math.round(sx), Y = Math.round(sy);
      r('#3a2a1a', X - 3, Y - 7, 7, 7); r(LIT, X - 2, Y - 6, 5, 4); r(MID, X - 2, Y - 3, 5, 2); r(LIT, X - 1, Y - 8, 3, 2); r('#3a2a1a', X, Y - 10, 1, 2);
    };
    const rosette = (cx, cy, rad) => {
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) {
        const d = Math.hypot(xx, yy);
        if (d > rad + 0.3) continue;
        r(d > rad - 1 ? '#3a2a1a' : d > rad - 2.2 ? LIT : (Math.round(Math.atan2(yy, xx) * 4 / Math.PI) & 1) ? MID : REC, cx + xx, cy + yy, 1, 1);
      }
      r(LIT, cx, cy, 1, 1);
    };
    const rustic = (f, step = 4) => { for (let y = f.y + 2; y < f.y + f.h - 1; y += step) { r(MID, f.x + 1, y, f.w - 1, 1); for (let x = f.x + 2 + ((y / step) % 2) * 4; x < f.x + f.w - 1; x += 8) r(MID, x, y - step + 1, 1, step - 1); } };

    // The plinth everything stands on.
    g.box(0, 6, 0, 360, 64, 16, { front: '#bf9d6c', top: '#e3c690', side: '#8f7048' });

    // Back: the block behind the portico, the drum, kiosks and the great dome.
    g.box(124, 34, 16, 112, 34, 86, F);
    for (const [kx, ky] of [[136, 40], [224, 40]]) {
      g.box(kx - 7, ky - 7, 102, 14, 14, 10, F);
      g.dome(kx, ky, 112, 8, 9, SAND, 1);
    }
    // Two-tier drum: arched windows, a cornice ring, then a balustrade.
    g.cyl(180, 52, 102, 27, 19, SAND);
    for (let a = 0; a < 12; a++) {
      const k = (a + 0.5) / 12 * 2 - 1;
      const [sx, sy] = P(180, 52, 104);
      const x = Math.round(sx + k * 24);
      r(REC, x - 1, Math.round(sy) - 13, 3, 11); r(DEEP, x, Math.round(sy) - 12, 1, 9); r(LIT, x - 2, Math.round(sy) - 14, 1, 12);
    }
    g.cyl(180, 52, 121, 31, 3, SAND);
    g.cyl(180, 52, 124, 26, 7, SAND);
    { const [sx, sy] = P(180, 52, 124); for (let x = -25; x < 26; x += 3) r(REC, Math.round(sx) + x, Math.round(sy) - 5, 1, 4); }
    const [dx, dy] = g.dome(180, 52, 131, 28, 40, SAND, 0.7, '#3a2a1a', 3.2);
    // Carved crests round the foot of the dome and a band of scallops.
    for (const k of [-0.75, -0.25, 0.25, 0.75]) {
      const [sx, sy] = P(180, 52, 134);
      const X = Math.round(sx + k * 27), Y = Math.round(sy);
      r('#3a2a1a', X - 2, Y - 9, 5, 9); r(LIT, X - 1, Y - 8, 3, 7); r(MID, X, Y - 6, 1, 4); r('#3a2a1a', X, Y - 11, 1, 2);
    }
    for (let k = -2; k <= 2; k++) { const [sx, sy] = P(180, 52, 150); r(MID, Math.round(sx + k * 9) - 2, Math.round(sy), 5, 1); r(MID, Math.round(sx + k * 9) - 3, Math.round(sy) + 1, 1, 1); r(MID, Math.round(sx + k * 9) + 3, Math.round(sy) + 1, 1, 1); }
    // Lantern and the Ashoka lion capital.
    r('#3a2a1a', Math.round(dx) - 6, Math.round(dy) - 4, 13, 6); r('#9cc4dc', Math.round(dx) - 5, Math.round(dy) - 3, 11, 3); r(LIT, Math.round(dx) - 6, Math.round(dy) - 5, 13, 2);
    { // Ashoka lion capital: a round abacus, then lions standing back to back.
      const X = Math.round(dx), Y = Math.round(dy) - 6;
      r(GOLD[0], X - 7, Y - 4, 15, 5); r(GOLD[3], X - 6, Y - 3, 13, 2); r(GOLD[1], X - 6, Y - 1, 13, 1); r(GOLD[4], X - 1, Y - 3, 2, 2);
      r(GOLD[0], X - 7, Y - 17, 15, 14);
      for (const [lx, f] of [[-6, -1], [1, 1]]) {
        r(GOLD[3], X + lx, Y - 13, 5, 9);
        r(GOLD[4], X + lx + (f < 0 ? 0 : 4), Y - 16, 1, 6);
        r(GOLD[3], X + lx + (f < 0 ? 0 : 1), Y - 16, 4, 4);
        r(GOLD[2], X + lx + 1, Y - 8, 3, 4);
        r(GOLD[0], X + lx + (f < 0 ? 1 : 3), Y - 14, 1, 1);
      }
      r(GOLD[1], X - 1, Y - 15, 2, 11); r(GOLD[4], X - 6, Y - 17, 2, 1); r(GOLD[4], X + 4, Y - 17, 2, 1);
    }

    // Wings: three floors of arches with a parapet of small spires.
    for (const wx of [34, 262]) {
      const f = g.box(wx, 18, 16, 64, 50, 66, F);
      for (const [z0, hgt] of [[18, 18], [38, 18], [58, 16]]) {
        const [, by] = P(wx, 18, z0 + hgt);
        r('#c4a878', f.x + 1, Math.round(by) - 2, f.w - 1, 2); r(LIT, f.x + 1, Math.round(by) - 3, f.w - 1, 1);
        for (let x = f.x + 3; x < f.x + f.w - 5; x += 8) {
          const y0 = Math.round(by) + 1;
          r(REC, x, y0 + 2, 6, hgt - 4); r(REC, x + 1, y0 + 1, 4, 1);
          r(DEEP, x + 1, y0 + 3, 4, hgt - 6);
          r(LIT, x - 1, y0, 1, hgt - 2); r(MID, x + 6, y0, 1, hgt - 2);
          r(MID, x, y0 + hgt - 5, 6, 1); for (let b = 0; b < 6; b += 2) r(LIT, x + b, y0 + hgt - 7, 1, 2);
        }
      }
      // The side wall shows its arches too.
      if (wx > 200) for (let d = 6; d < 48; d += 8) for (const z of [24, 44, 62]) { const [sx, sy] = P(wx + 64, 18 + d, z); r('#5a4630', Math.round(sx), Math.round(sy) - 8, 2, 8); }
      const [tx0, ty0] = P(wx, 18, 82);
      r('#3a2a1a', f.x, Math.round(ty0), f.w + 1, 1);
      finials(wx, wx + 64, 18, 82, 5);
      finials(wx, wx + 64, 68, 82, 7);
    }

    // Corner towers with tiered chhatri roofs.
    for (const tx of [4, 326]) {
      const f = g.box(tx, 14, 16, 30, 30, 92, F);
      rustic(f);
      const cx = f.x + 15;
      r(REC, cx - 3, f.y + 30, 7, 40); r(DEEP, cx - 2, f.y + 32, 5, 37); r(REC, cx - 2, f.y + 29, 5, 1);
      r(LIT, cx - 5, f.y + 70, 11, 2); for (let b = 0; b < 10; b += 2) r(MID, cx - 4 + b, f.y + 66, 1, 4);
      rosette(cx, f.y + 18, 5);
      g.box(tx - 3, 11, 108, 36, 36, 3, { front: MID, top: LIT, side: '#94784e' });
      g.box(tx + 3, 17, 111, 24, 24, 9, F);
      for (let x = 0; x < 24; x += 4) { const [sx, sy] = P(tx + 4 + x, 17, 118); r(REC, Math.round(sx), Math.round(sy) - 5, 2, 5); }
      g.box(tx, 14, 120, 30, 30, 2, { front: MID, top: LIT, side: '#94784e' });
      g.dome(tx + 15, 29, 122, 12, 14, SAND, 1);
    }

    // Square towers either side of the portico, with rosettes and balconies.
    for (const tx of [96, 238]) {
      const f = g.box(tx, 8, 16, 26, 40, 98, F);
      rustic(f);
      const cx = f.x + 13;
      rosette(cx, f.y + 20, 6);
      r('#3a2a1a', cx - 7, f.y + 34, 15, 3); r(LIT, cx - 6, f.y + 34, 13, 1);
      r(REC, cx - 4, f.y + 37, 9, 12); r('#6f93b0', cx - 3, f.y + 38, 7, 9); r(LIT, cx, f.y + 38, 1, 9);
      r(MID, cx - 6, f.y + 49, 13, 3); for (let b = 0; b < 12; b += 2) r(LIT, cx - 6 + b, f.y + 49, 1, 3);
      r(REC, cx - 4, f.y + 62, 9, 18); r(DEEP, cx - 3, f.y + 64, 7, 16);
      g.box(tx - 3, 5, 114, 32, 46, 3, { front: MID, top: LIT, side: '#94784e' });
      g.box(tx + 4, 18, 117, 18, 18, 6, F);
      g.dome(tx + 13, 27, 123, 10, 11, SAND, 1);
    }

    // The portico: recessed wall with teal-trimmed doors, then twelve columns.
    const back = g.box(122, 12, 16, 116, 22, 70, { front: REC, top: null, side: null });
    for (let x = back.x + 6; x < back.x + back.w - 8; x += 19) {
      r(DEEP, x, back.y + 30, 10, 40); r(TEAL, x - 1, back.y + 28, 12, 2); r(TEAL, x - 1, back.y + 30, 2, 40); r(TEAL, x + 9, back.y + 30, 2, 40);
      r('#9a8058', x + 2, back.y + 34, 6, 10); r('#6f93b0', x + 2, back.y + 10, 6, 9);
    }
    for (let i = 0; i < 12; i++) {
      const x = 127 + i * 9.6;
      g.cyl(x, 3, 20, 3, 62, SAND);
      const [sx, sy] = P(x, 3, 20);
      r('#3a2a1a', Math.round(sx) - 4, Math.round(sy) - 1, 9, 5); r(MID, Math.round(sx) - 3, Math.round(sy), 7, 3);
      r('#3a2a1a', Math.round(sx) - 5, Math.round(sy) - 70, 11, 7); r(LIT, Math.round(sx) - 4, Math.round(sy) - 69, 9, 2); r(MID, Math.round(sx) - 4, Math.round(sy) - 67, 9, 2);
      r('#3a2a1a', Math.round(sx) - 3, Math.round(sy) - 64, 7, 3); r(MID, Math.round(sx) - 2, Math.round(sy) - 64, 5, 2);
      for (const zz of [8, 16, 50]) r(MID, Math.round(sx) - 3, Math.round(sy) - zz, 7, 1);
      r(MID, Math.round(sx) - 3, Math.round(sy) - 30, 7, 1);
    }
    // The deep sloping cornice, its shadow, the parapet of lotus finials.
    const cor = g.box(112, -12, 85, 136, 28, 8, { front: '#9a7a50', top: '#ead2a0', side: '#8f7048' });
    r('#3f2e1c', cor.x + 1, cor.y + cor.h, cor.w - 1, 3);
    for (let x = cor.x + 3; x < cor.x + cor.w - 2; x += 6) r('#7a5e3c', x, cor.y + 2, 2, cor.h - 3);
    inscription = { x: cor.x + cor.w / 2, y: cor.y + cor.h / 2 };
    g.box(122, 2, 92, 116, 6, 6, F);
    for (let x = 126; x < 236; x += 11) if (Math.abs(x - 180) > 18) lotus(x, 2, 98);
    // Central gable with the Karnataka emblem, a small dome and the flag.
    const gb = g.box(162, 1, 98, 36, 8, 18, F);
    r('#3a2a1a', gb.x + 9, gb.y + 3, 19, 14); r('#e6b33a', gb.x + 10, gb.y + 4, 17, 12);
    r('#d8433b', gb.x + 12, gb.y + 6, 13, 8); r('#2f8a3a', gb.x + 12, gb.y + 11, 13, 3); r('#ffffff', gb.x + 17, gb.y + 7, 3, 5); r('#e6b33a', gb.x + 16, gb.y + 5, 5, 1);
    g.dome(180, 5, 116, 9, 10, SAND, 1);
    { const [px, py] = P(188, 6, 116); const X = Math.round(px), Y = Math.round(py);
      r('#3a2a1a', X, Y - 40, 1, 40);
      r('#ef8b2c', X + 1, Y - 40, 11, 3); r('#ffffff', X + 1, Y - 37, 11, 3); r('#2f8a3a', X + 1, Y - 34, 11, 3); r('#2f4f8a', X + 6, Y - 37, 1, 3); r('#2f4f8a', X + 5, Y - 36, 3, 1);
    }

    // The grand staircase with its balustrades.
    for (let k = 0; k < 8; k++) {
      const y0 = -32 + k * 4;
      g.box(132, y0, 0, 96, 4, 2 + k * 2, { front: k % 2 ? '#d4b98a' : '#e2c999', top: LIT, side: null, line: k === 0 ? '#3a2a1a' : null });
    }
    for (const bx of [128, 228]) g.box(bx, -32, 0, 4, 32, 18, { front: MID, top: LIT, side: '#94784e' });
  });
  img.anchors = { inscription };
  img.fw = W0 - 30;
  img.oy = 0;
  return img;
}

// Gives a flat front-elevation sprite depth: a roof plane receding up and to
// the right and a shaded side wall, so it reads as a solid building. Rows
// above `cut` (domes, spires) are not extruded; they sit at mid-depth instead.
function bExtrude(src, depth, cut = 0) {
  const dx = Math.ceil(depth * OB.SX), dy = Math.ceil(depth * OB.SY);
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const side = new ImageData(w, h), top = new ImageData(w, h);
  const at = (x, y) => (y * w + x) * 4;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && sd[at(x, y) + 3] >= 128;
  const lum = i => sd[i] * 0.3 + sd[i + 1] * 0.59 + sd[i + 2] * 0.11;
  // Walks from (x, y) in a direction until it finds a pixel that isn't outline.
  const sample = (x, y, ddx, ddy) => {
    for (let k = 1; k < 8; k++) {
      const xx = x + ddx * k, yy = y + ddy * k;
      if (!solid(xx, yy)) break;
      if (lum(at(xx, yy)) > 62) return at(xx, yy);
    }
    return at(x, y);
  };
  for (let y = cut; y < h; y++) {
    let xr = -1;
    for (let x = w - 1; x >= 0; x--) if (solid(x, y)) { xr = x; break; }
    if (xr < 0) continue;
    const wall = sample(xr, y, -1, 0);
    for (let x = 0; x <= xr; x++) {
      if (!solid(x, y)) continue;
      const i = at(x, y);
      // Side walls: the wall colour of this row, darker and a touch cooler.
      side.data[i] = sd[wall] * 0.62; side.data[i + 1] = sd[wall + 1] * 0.6; side.data[i + 2] = Math.min(255, sd[wall + 2] * 0.66 + 10); side.data[i + 3] = 255;
      // Roof: along the top edge, coloured from the wall just below the outline.
      if (y === cut || !solid(x, y - 1)) {
        const j = sample(x, y, 0, 1);
        top.data[i] = Math.min(255, sd[j] * 1.06 + 16); top.data[i + 1] = Math.min(255, sd[j + 1] * 1.06 + 16); top.data[i + 2] = Math.min(255, sd[j + 2] * 1.06 + 12); top.data[i + 3] = 255;
      }
    }
  }
  const mk = data => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(data, 0, 0); return cv; };
  const sideC = mk(side), topC = mk(top);
  const out = document.createElement('canvas');
  out.width = w + dx + 1;
  out.height = h + dy;
  const c = out.getContext('2d');
  for (let k = depth; k >= 1; k--) {
    const ox = Math.round(k * OB.SX), oy = dy - Math.round(k * OB.SY);
    c.drawImage(sideC, ox, oy);
    c.drawImage(topC, ox, oy);
  }
  // The back edge of the roof gets an outline so the block reads cleanly.
  if (cut) c.drawImage(src, 0, 0, w, cut, Math.round(depth / 2 * OB.SX), dy - Math.round(depth / 2 * OB.SY), w, cut);
  c.drawImage(src, 0, cut, w, h - cut, 0, dy + cut, w, h - cut);
  out.fw = w;
  out.oy = dy;
  out.anchors = src.anchors;
  return out;
}

// How deep each kind of building is drawn, and where its domes start.
const B_DEPTH = {
  highcourt: [44], library: [30, 20], holidayinn: [40], ksr: [44], busstand: [40], freedom: [34, 6], townhall: [40],
  museum: [32], stmarks: [36, 32], ubcity: [56], krmarket: [26], fort: [18], tipu: [38], bulltemple: [32],
  malleshwara: [32], vidyarthi: [20], cinema: [28], mtr: [22], darshini: [14], complex: [32], bakery: [18],
  school: [30], temple: [24], mstation: [26], hut: [16], glasshouse: [44], grandstand: [24], palace: [56],
  gurudwara: [30, 32], shop: [20], office0: [44], office1: [40], office2: [44], apartment0: [32], apartment1: [32],
  apartment2: [32], jhouse: [18], mhouse: [16],
};

const B_ART = {
  vidhana: () => bVidhana3D(),

  // Attara Kacheri: two floors of red verandahs behind paired white columns,
  // a pedimented central portico and a sloping tiled roof.
  highcourt: () => bcv(240, 96, (r) => {
    const O = '#3d2724', RED = '#b8483d', RED2 = '#8f3530', REC = '#6e2a25', WH = '#f1e9dc', WH2 = '#cfc4b2', ROOF = '#5d3a33';
    r(O, 4, 86, 232, 9); r(WH2, 5, 87, 230, 7); r(WH, 5, 87, 230, 2);
    for (let y = 14; y < 27; y++) { const inset = Math.round((27 - y) * 0.8); r(O, 6 + inset, y, 228 - inset * 2, 1); r(y % 3 ? ROOF : '#4a2c26', 7 + inset, y, 226 - inset * 2, 1); }
    r(O, 6, 27, 228, 60); r(RED, 7, 28, 226, 58);
    r(WH, 5, 26, 230, 3); r(WH, 5, 55, 230, 3); r(O, 5, 25, 230, 1);
    for (const [y0, h] of [[30, 24], [59, 26]]) {
      r(REC, 9, y0, 222, h);
      for (let x = 14; x < 226; x += 16) { r('#3a1f1c', x + 2, y0 + 4, 8, h - 6); r('#5a2a24', x + 3, y0 + 5, 6, h - 8); }
      for (let x = 10; x < 230; x += 12) { r(WH, x, y0, 2, h); r(WH, x + 4, y0, 2, h); r(WH2, x + 1, y0, 1, h); r(WH2, x + 5, y0, 1, h); r(WH, x - 1, y0, 8, 2); }
    }
    for (let x = 9; x < 231; x += 3) r(WH, x, 51, 1, 3);
    r(WH, 9, 50, 222, 1);
    // Central portico.
    r(O, 86, 20, 68, 67); r(RED2, 87, 21, 66, 65);
    for (let dy = 0; dy <= 18; dy++) {
      const half = Math.round((18 - dy) / 18 * 38);
      r(O, 120 - half - 1, 22 - dy, half * 2 + 3, 1);
      if (half > 1) r(dy < 2 ? WH2 : WH, 120 - half + 1, 22 - dy, half * 2 - 1, 1);
    }
    for (let dy = 3; dy <= 13; dy++) { const half = Math.round((16 - dy) / 18 * 30); r(RED, 120 - half, 22 - dy, half * 2, 1); }
    r(WH, 116, 9, 9, 7); r(O, 117, 10, 7, 5); r(WH, 118, 11, 5, 3); r(O, 120, 11, 1, 2); r(O, 120, 12, 2, 1);
    for (let i = 0; i < 4; i++) {
      const x = 91 + i * 17;
      for (const dx of [0, 5]) { r(O, x + dx - 1, 22, 5, 64); r(WH, x + dx, 23, 3, 63); r('#ffffff', x + dx, 23, 1, 63); r(WH2, x + dx + 2, 23, 1, 63); }
      r(WH2, x - 2, 22, 11, 2);
    }
    for (let k = 0; k < 4; k++) { r(O, 96 - k * 2, 86 + k * 2, 48 + k * 4, 1); r(WH, 96 - k * 2, 87 + k * 2, 48 + k * 4, 1); }
  }),
  library: () => bcv(110, 70, (r) => {
    const O = '#3d2724', RED = '#b8483d', RED2 = '#963a32', WH = '#efe7da', WIN = '#3a2f2f';
    r(O, 4, 62, 102, 7); r('#cfc4b2', 5, 63, 100, 5);
    r(O, 6, 30, 98, 33); r(RED, 7, 31, 96, 31); r(RED2, 92, 31, 11, 31);
    r(WH, 5, 28, 100, 3); r(O, 5, 27, 100, 1);
    for (let x = 0; x < 100; x += 4) r(WH, 6 + x, 25, 2, 2);
    for (const x of [12, 22, 32, 72, 82, 92]) { archWindow(r, x, 36, 5, 10, WH, WIN); archWindow(r, x, 50, 5, 9, WH, WIN); }
    r(O, 40, 14, 30, 49); r(RED, 41, 15, 28, 47); r(WH, 39, 12, 32, 3);
    archWindow(r, 50, 22, 10, 16, WH, WIN);
    r(O, 49, 44, 12, 18); r('#5a3a2a', 50, 45, 10, 17);
    bDome(r, 55, 11, 10, 8, ['#3d2724', '#e9e1d2', '#c9bfae', '#9a9082']);
    for (const x of [6, 98]) { r(O, x, 18, 6, 12); r(WH, x + 1, 19, 4, 11); bDome(r, x + 3, 17, 3, 3, ['#3d2724', '#e9e1d2', '#c9bfae', '#9a9082']); }
  }),

  bandstand: () => bcv(40, 38, (r) => {
    const O = '#3a3a34', WH = '#f2efe6', WH2 = '#cfcabd';
    r(O, 3, 30, 34, 7); r(WH2, 4, 31, 32, 5); r(WH, 4, 31, 32, 1);
    for (const x of [6, 13, 20, 27, 33]) { r(O, x - 1, 16, 3, 15); r(WH, x, 16, 1, 14); }
    r(O, 2, 13, 36, 4); r(WH, 3, 14, 34, 2);
    bDome(r, 20, 13, 16, 9, ['#2f3f2a', '#7fb86a', '#4f8a3c', '#35662b'], 4, '#e6c15e');
  }),

  ubcity: () => bcv(190, 232, (r) => {
    const O = '#22303f', GL = '#7fa6c4', GL2 = '#6890b4', GL3 = '#b4d2e4', GLD = '#45688a', ST = '#d9dee2';
    const tower = (x0, y0, w, y1, seed) => {
      r(O, x0 - 1, y0 - 1, w + 2, y1 - y0 + 2);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const d = (x - x0) + (y1 - y) * 0.6;
          let col = (y - y0) % 4 === 0 ? GLD : (x - x0) % 6 === 0 ? GL2 : GL;
          if (((d + seed) % 46) < 6) col = GL3;
          if (x > x0 + w - 5) col = col === GL3 ? GL : GLD;
          r(col, x, y);
        }
      }
    };
    tower(26, 98, 40, 200, 7);
    tower(126, 66, 38, 200, 21);
    tower(70, 34, 50, 200, 0);
    // The crown of the UB Tower.
    for (let y = 2; y < 34; y++) {
      const k = (34 - y) / 32;
      const half = Math.max(1, Math.round(25 * (1 - k * k * 0.92)));
      r(O, 95 - half - 1, y, half * 2 + 3, 1);
      r(y % 3 === 0 ? ST : GL3, 95 - half, y, half * 2 + 1, 1);
      r(GLD, 95 + Math.round(half * 0.5), y, Math.round(half * 0.5) + 1, 1);
    }
    r(O, 94, 0, 2, 4);
    r(O, 125, 60, 40, 6); r(ST, 126, 61, 38, 4);
    for (let y = 92; y < 98; y++) { const half = (y - 90) * 3; r(O, 46 - half, y, half * 2, 1); r(ST, 47 - half, y, half * 2 - 2, 1); }
    // Podium mall.
    r(O, 3, 180, 184, 51); r('#dacdb6', 4, 181, 182, 49); r('#efe5d3', 4, 181, 182, 2);
    r('#2b2a33', 60, 184, 70, 10);
    r(O, 8, 202, 174, 22); r('#36404c', 9, 203, 172, 20);
    for (let x = 12; x < 180; x += 10) r('#ffd98a', x, 205, 6, 15);
    r('#c9b28a', 4, 197, 182, 4); r('#a89270', 4, 200, 182, 1);
    for (let x = 6; x < 186; x += 12) { r('#3f7a35', x, 226, 6, 3); r('#5a9a45', x + 1, 225, 4, 2); }
  }),

  holidayinn: () => bcv(110, 130, (r) => {
    const O = '#3a3530', CR = '#ece2cf', CR2 = '#cfc2aa', GLS = '#6f93b0', GLS2 = '#9cbdd4', GRN = '#2f8f4e';
    r(O, 3, 70, 104, 52); r(CR2, 4, 71, 102, 50);
    r(O, 14, 20, 82, 102); r(CR, 15, 21, 80, 100); r(CR2, 86, 21, 9, 100);
    r(GRN, 15, 21, 80, 11); r('#56b574', 15, 21, 80, 2); r(O, 14, 32, 82, 1);
    for (let y = 36; y < 104; y += 7) for (let x = 19; x < 90; x += 8) { r(GLS, x, y, 6, 4); r(GLS2, x, y, 2, 4); }
    for (let y = 76; y < 112; y += 8) for (const x of [6, 98]) r(GLS, x, y, 6, 4);
    r(O, 34, 104, 42, 4); r('#d9d2c4', 35, 104, 40, 2);
    r(O, 42, 108, 26, 14); r('#2b3a48', 43, 109, 24, 13); r('#ffd98a', 45, 111, 8, 10); r('#ffd98a', 57, 111, 8, 10);
    r('#bdb5a5', 30, 122, 50, 7); r('#a39b8a', 30, 128, 50, 1);
  }),

  grandstand: () => bcv(220, 50, (r) => {
    const O = '#3a3530', RF = '#ece6da', RF2 = '#c7bfb0', crowd = ['#d8433b', '#f2c94c', '#5b8ee0', '#f1ead8', '#7cc35a', '#c3a0ec', '#2b2220'];
    const rnd = seeded(77);
    r(O, 4, 12, 212, 30); r('#9a948a', 5, 13, 210, 28);
    for (let k = 0; k < 7; k++) {
      const y = 14 + k * 4;
      r('#b5ada0', 5, y, 210, 1);
      for (let x = 6; x < 214; x += 2) if (rnd() < 0.75) r(crowd[Math.floor(rnd() * crowd.length)], x, y + 1, 1, 2);
    }
    for (const x of [8, 60, 110, 160, 210]) { r(O, x - 1, 6, 3, 34); r(RF2, x, 6, 1, 33); }
    r(O, 2, 2, 216, 8); r(RF, 3, 3, 214, 4); r(RF2, 3, 7, 214, 2);
    r(O, 4, 40, 212, 9); r('#2f6b3a', 5, 41, 210, 7); r('#3f8a4c', 5, 41, 210, 1);
  }),

  glasshouse: () => bcv(210, 80, (r) => {
    const O = '#3c4d52', FR = '#f3f6f4', GL = '#bfe3e8', GL2 = '#9fcfd9', PL = '#5a9a45';
    const glass = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        let col = (x - x0) % 5 === 0 || (y - y0) % 5 === 0 ? FR : ((x + y) % 11 < 3 ? GL : GL2);
        if (y > y0 + h - 6 && col !== FR) col = (x * 7 + y) % 5 < 3 ? PL : '#3f7a35';
        r(col, x, y);
      }
    };
    r(O, 4, 70, 202, 9); r('#d8d0c0', 5, 71, 200, 7); r('#efe9dc', 5, 71, 200, 1);
    // Side wings with barrel roofs.
    for (const [x0, x1] of [[8, 74], [136, 202]]) {
      r(O, x0 - 1, 38, x1 - x0 + 2, 33);
      glass(x0, 46, x1 - x0, 24);
      for (let y = 36; y < 46; y++) {
        const inset = Math.round((46 - y) * (46 - y) / 16);
        r(O, x0 + inset - 1, y, x1 - x0 - inset * 2 + 2, 1);
        r((y % 3 === 0) ? FR : GL, x0 + inset, y, x1 - x0 - inset * 2, 1);
      }
    }
    // Central transept with its big arched front.
    r(O, 73, 30, 64, 41);
    glass(74, 30, 62, 40);
    for (let dy = 0; dy <= 26; dy++) {
      const half = Math.round(32 * Math.sqrt(Math.max(0, 1 - (dy / 26) ** 2)));
      r(O, 105 - half - 1, 30 - dy, half * 2 + 3, 1);
      r(FR, 105 - half, 30 - dy, half * 2 + 1, 1);
      if (half > 2) r(dy % 4 ? GL : GL2, 105 - half + 1, 30 - dy, half * 2 - 1, 1);
    }
    for (let a = 0; a <= 8; a++) {
      const ang = Math.PI * a / 8;
      for (let k = 0; k < 26; k++) r(FR, Math.round(105 - Math.cos(ang) * k * 1.2), Math.round(30 - Math.sin(ang) * k));
    }
    r(O, 98, 52, 14, 18); r('#2f4f54', 99, 53, 12, 17); r(FR, 105, 53, 1, 17);
    r('#e2b54a', 104, 0, 3, 4);
  }),

  rock: () => bcv(120, 74, (r) => {
    const O = '#3a3a38', R1 = '#c2bfb6', R2 = '#9c9a94', R3 = '#77756f';
    const rnd = seeded(5);
    const rows = [];
    for (let y = 30; y < 72; y++) {
      const k = (y - 30) / 42;
      const half = Math.round(56 * Math.sqrt(Math.min(1, k * 1.6)) * (0.92 + Math.sin(y * 0.7) * 0.04));
      rows.push([y, 60 - half, 60 + half]);
    }
    bShape(r, rows, O, (x, y, x0, x1) => {
      const k = (x - x0) / Math.max(1, x1 - x0);
      let col = k < 0.3 ? R1 : k > 0.66 ? R3 : R2;
      if (rnd() < 0.08) col = R3;
      return col;
    });
    for (const [x, y, l] of [[40, 50, 12], [72, 46, 10], [58, 60, 14]]) for (let i = 0; i < l; i++) r(R3, x + i, y + Math.round(Math.sin(i * 0.8)));
    // Kempegowda tower: a small stone mantapa.
    const S1 = '#d9cfb8', S2 = '#b3a68a';
    r(O, 48, 26, 24, 6); r(S1, 49, 27, 22, 4);
    for (const x of [50, 57, 63, 69]) { r(O, x - 1, 13, 3, 14); r(S1, x, 13, 1, 13); }
    r(O, 46, 9, 28, 5); r(S1, 47, 10, 26, 3);
    for (let k = 0; k < 4; k++) { r(O, 50 + k * 3, 6 - k * 2, 20 - k * 6, 3); r(k % 2 ? S2 : S1, 51 + k * 3, 6 - k * 2, 18 - k * 6, 2); }
    r('#e2b54a', 59, 0, 2, 2);
  }),

  mtr: () => bcv(64, 46, (r) => {
    const O = '#3a3530', WH = '#f4efe4', WH2 = '#d9d2c4', GR = '#2f6b3a';
    r(O, 2, 4, 60, 8); r('#b5553a', 3, 5, 58, 6); r('#8a3a28', 3, 10, 58, 1);
    r(O, 4, 12, 56, 32); r(WH, 5, 13, 54, 30); r(WH2, 52, 13, 7, 30);
    r(GR, 5, 13, 54, 1); r('#f2e3b0', 8, 5, 48, 7); r(GR, 8, 5, 48, 1); r(GR, 8, 11, 48, 1);
    for (const x of [9, 19, 39, 49]) { r(GR, x - 1, 18, 7, 9); r('#6b8f9c', x, 19, 5, 7); }
    r(O, 27, 26, 10, 18); r('#7a4a2a', 28, 27, 8, 17);
    r(GR, 5, 42, 54, 2);
  }),

  darshini: () => bcv(44, 36, (r) => {
    const O = '#3a3530', CR = '#f2e0b0', GR = '#2f8a3a';
    r(O, 1, 2, 42, 9); r(CR, 2, 3, 40, 7); r(GR, 2, 9, 40, 1);
    r(O, 3, 11, 38, 24); r('#e6d9c0', 4, 12, 36, 22);
    r('#3a2a20', 6, 14, 32, 10);
    r('#b8bec4', 8, 20, 3, 4); r('#e9eef0', 8, 20, 1, 4); r('#b8bec4', 14, 20, 3, 4); r('#b8bec4', 30, 19, 4, 5);
    r('#8a5a3a', 4, 24, 36, 3); r('#6b4a32', 4, 27, 36, 7);
    r(GR, 4, 30, 36, 1);
  }),

  shop: (wall, sign, awning) => bcv(64, 62, (r) => {
    const O = '#3a3530';
    r(O, 3, 4, 58, 56); r(wall, 4, 5, 56, 54); r(shade(wall, -0.12), 52, 5, 8, 54);
    for (let y = 9; y < 14; y += 4) for (let x = 8; x < 56; x += 10) { r(O, x, y, 6, 3); r('#9cbdd4', x, y, 6, 2); }
    r(O, 4, 15, 56, 10); r(sign, 5, 16, 54, 8);
    r(awning, 3, 27, 58, 4); for (let x = 3; x < 61; x += 6) r('#ffffff', x, 27, 3, 4);
    r(O, 8, 32, 48, 26); r('#2b3a48', 9, 33, 46, 25);
    for (let x = 11; x < 54; x += 8) r('#ffd98a', x, 36, 5, 18);
  }),

  complex: () => bcv(150, 58, (r) => {
    const O = '#3a3530', W1 = '#d9cbb0', W2 = '#bfb197';
    const signs = ['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#c3a0ec', '#ee8b3a', '#5b8ee0'];
    r(O, 2, 12, 146, 45); r(W1, 3, 13, 144, 43); r(W2, 3, 34, 144, 2);
    r(O, 2, 2, 146, 11); r('#7a4a2a', 3, 3, 144, 9);
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 20;
      r(signs[i], x, 15, 18, 6);
      r(O, x, 23, 18, 10); r('#9cbdd4', x + 1, 24, 16, 8);
      r(O, x, 38, 18, 18); r(i % 3 ? '#8a8f96' : '#2b3a48', x + 1, 39, 16, 17);
      if (i % 3) for (let y = 40; y < 56; y += 2) r('#a3a9ae', x + 1, y, 16, 1);
      else r('#ffd98a', x + 3, 42, 12, 12);
    }
  }),

  bakery: () => bcv(52, 44, (r) => {
    const O = '#3a3530';
    r(O, 2, 4, 48, 39); r('#f6f0e2', 3, 5, 46, 37);
    r(O, 2, 2, 48, 12); r('#f0d78a', 3, 3, 46, 10); r('#b8281e', 3, 12, 46, 1);
    r('#2f6db0', 2, 15, 48, 4); for (let x = 2; x < 50; x += 6) r('#ffffff', x, 15, 3, 4);
    r(O, 6, 21, 40, 14); r('#3a4a58', 7, 22, 38, 12);
    for (let x = 9; x < 44; x += 6) { r('#e9c07a', x, 30, 4, 3); r('#c9824a', x, 29, 4, 1); r('#f4a3b8', x + 1, 25, 3, 3); }
    r('#8a5a3a', 6, 35, 40, 7); r('#b5824a', 6, 35, 40, 1);
  }),

  school: () => bcv(130, 72, (r) => {
    const O = '#3d2a1e', ST = '#dcc9a3', ST2 = '#bfa982', TL = '#b5553a', TL2 = '#8a3a28';
    r(O, 2, 16, 126, 12); r(TL, 3, 17, 124, 10);
    for (let y = 19; y < 27; y += 3) r(TL2, 3, y, 124, 1);
    r(O, 4, 27, 122, 44); r(ST, 5, 28, 120, 42); r(ST2, 5, 28, 120, 2);
    r('#f1e6c8', 30, 29, 70, 7); r(O, 30, 36, 70, 1);
    for (let x = 9; x < 122; x += 12) {
      r(O, x - 1, 46, 10, 23); r('#4a3a2e', x, 48, 8, 21); r('#4a3a2e', x + 1, 47, 6, 1);
      r(ST2, x + 9, 46, 2, 23);
    }
    for (let x = 9; x < 122; x += 12) { r(O, x + 1, 38, 5, 6); r('#5f6f7a', x + 2, 39, 3, 4); }
    r(O, 56, 0, 18, 28); r(ST, 57, 4, 16, 24); r(TL, 55, 0, 20, 5); r(TL2, 55, 4, 20, 1);
    r(O, 61, 9, 8, 8); r('#2b2220', 62, 10, 6, 7); r('#e6c15e', 63, 12, 4, 4);
  }),

  temple: () => bcv(56, 64, (r) => {
    const O = '#3d2a1e', ST = '#ecdfc0', ST2 = '#cdbb94', fig = ['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#ee8b3a'];
    r(O, 2, 46, 52, 17); r(ST, 3, 47, 50, 15); r('#d8433b', 3, 47, 50, 1); r('#ffffff', 3, 48, 50, 1);
    for (let x = 4; x < 52; x += 4) r(x % 8 ? '#d8433b' : '#ffffff', x, 58, 3, 3);
    r(O, 21, 50, 14, 13); r('#3a2a20', 22, 51, 12, 12); r('#e6c15e', 27, 53, 2, 3);
    for (let k = 0; k < 6; k++) {
      const w = 40 - k * 6, x = 28 - w / 2, y = 40 - k * 7;
      r(O, x - 1, y, w + 2, 7); r(k % 2 ? ST2 : ST, x, y + 1, w, 5);
      for (let fx = x + 2; fx < x + w - 2; fx += 4) r(fig[(fx + k) % fig.length], fx, y + 2, 2, 3);
    }
    r(O, 18, -1, 20, 0);
    r(O, 23, 1, 10, 4); r('#e6c15e', 24, 2, 8, 2);
    for (const x of [24, 28, 32]) { r('#e6c15e', x - 1, -1 + 1, 2, 1); }
  }),

  banyan: () => bcv(140, 104, (r, c) => {
    const rnd = seeded(1935);
    // Stone katte (platform) round the trunk.
    r('#3a3530', 44, 92, 52, 11); r('#b8b0a0', 45, 93, 50, 9); r('#d3cbbb', 45, 93, 50, 2);
    // Trunks and hanging roots.
    for (const [x, w] of [[60, 8], [70, 7], [54, 4], [78, 4]]) { r('#3a2618', x - 1, 50, w + 2, 44); r('#6b4a32', x, 50, w, 43); r('#8a6a4a', x, 50, 1, 43); }
    for (let i = 0; i < 26; i++) {
      const x = 10 + Math.floor(rnd() * 120), y0 = 40 + Math.floor(rnd() * 14), len = 14 + Math.floor(rnd() * 34);
      for (let y = y0; y < y0 + len; y++) r(rnd() < 0.5 ? '#7a5a3a' : '#5a3e2b', x, y);
    }
    const lumps = [];
    for (let i = 0; i < 16; i++) lumps.push({ x: 14 + rnd() * 112, y: 14 + rnd() * 26, r: 13 + rnd() * 10 });
    const can = blob(140, 62, (x, y) => lumps.some(l => (x - l.x) ** 2 + ((y - l.y) * 1.25) ** 2 < l.r * l.r), ['#1a301a', '#2a4f27', '#3a6a33', '#558a44'], 0.14, rnd);
    c.drawImage(can, 0, 0);
  }),

  mstation: () => bcv(130, 58, (r) => {
    const O = '#3d2a1e', OC = '#e1b45f', OC2 = '#c79a48', MR = '#7a2b25', TL = '#b5553a', TL2 = '#8a3a28';
    r(O, 8, 20, 114, 37); r(OC, 9, 21, 112, 35); r(OC2, 9, 21, 112, 2);
    r(MR, 9, 44, 112, 12); r('#5a1f1a', 9, 44, 112, 1);
    for (let x = 14; x < 118; x += 14) archWindow(r, x, 28, 6, 12, '#f4e9d0', '#3a2a20');
    r(O, 56, 26, 18, 30); r('#4a3020', 57, 28, 16, 28); r('#4a3020', 58, 27, 14, 1);
    r('#f4e9d0', 61, 14, 8, 8); r(O, 62, 15, 6, 6); r('#ffffff', 63, 16, 4, 4); r(O, 64, 17, 1, 2); r(O, 65, 18, 1, 1);
    // Tiled platform canopy on iron posts.
    r(O, 0, 6, 130, 13); r(TL, 1, 7, 128, 11);
    for (let y = 9; y < 18; y += 3) r(TL2, 1, y, 128, 1);
    for (let x = 1; x < 129; x += 4) r(TL2, x, 7 + (x % 8 ? 0 : 1), 1, 2);
    r('#5a1f1a', 1, 17, 128, 1);
    for (const x of [4, 124]) { r(O, x - 1, 18, 3, 38); r('#3a5a4a', x, 18, 1, 38); }
  }),

  board: () => bcv(40, 22, (r) => {
    const O = '#1d1816';
    for (const x of [6, 33]) { r(O, x, 9, 2, 13); for (let y = 10; y < 22; y += 4) r('#ffffff', x, y, 2, 2); }
    r(O, 0, 0, 40, 11); r('#f2cf3e', 1, 1, 38, 9);
  }),

  tunnel: () => bcv(50, 46, (r) => {
    const O = '#2f2a24';
    const rows = [];
    for (let y = 2; y < 46; y++) { const half = Math.round(25 * Math.sqrt(Math.min(1, (y - 2) / 20))); rows.push([y, 25 - half, 24 + half]); }
    bShape(r, rows, O, (x, y) => (y < 14 ? '#5d8a3e' : (x + y) % 7 < 2 ? '#8a7c64' : '#a59880'));
    for (let dy = 0; dy < 22; dy++) {
      const half = Math.round(10 * Math.sqrt(Math.max(0, 1 - (Math.max(0, dy - 10) / 12) ** 2)));
      r(dy < 10 ? '#0f0d0b' : '#0f0d0b', 25 - half, 45 - dy, half * 2, 1);
    }
    r('#d9cfb8', 13, 21, 24, 3);
  }),

  hut: () => bcv(40, 34, (r) => {
    const O = '#3d2a1e';
    r(O, 5, 16, 30, 17); r('#d8c39a', 6, 17, 28, 15); r(O, 16, 21, 8, 12); r('#3a2a20', 17, 22, 6, 11);
    for (let y = 2; y < 18; y++) { const half = Math.round((y - 2) * 1.3) + 2; r(O, 20 - half - 1, y, half * 2 + 2, 1); r(y % 3 ? '#c9a55a' : '#a8843e', 20 - half, y, half * 2, 1); }
  }),

  mempi: () => bcv(30, 22, (r) => {
    r('#3d2a1e', 4, 6, 2, 16); r('#3d2a1e', 0, 0, 30, 7); r('#f4e9d0', 1, 1, 26, 5); r('#f4e9d0', 27, 2, 2, 3);
  }),

  statue: () => bcv(12, 24, (r) => {
    r('#3a3530', 1, 16, 10, 8); r('#cfc4b2', 2, 17, 8, 6);
    r('#3a3530', 3, 3, 6, 14); r('#7d8a6a', 4, 4, 4, 12); r('#9aa886', 4, 4, 1, 12); r('#3a3530', 4, 0, 4, 4); r('#7d8a6a', 5, 1, 2, 2);
  }),

  flood: () => bcv(16, 78, (r) => {
    const O = '#2a2a2e';
    for (let y = 12; y < 78; y++) { r(O, 6, y, 4, 1); if (y % 4 === 0) r('#8a8f96', 7, y, 2, 1); }
    r(O, 0, 0, 16, 12); r('#4a4f58', 1, 1, 14, 10);
    for (let y = 2; y < 10; y += 3) for (let x = 2; x < 14; x += 3) r('#f4f1ea', x, y, 2, 2);
  }),

  lamp: () => bcv(8, 26, (r) => {
    r('#2a2a2e', 3, 4, 2, 22); r('#2a2a2e', 1, 2, 6, 3); r('#fff3c8', 2, 3, 4, 1);
  }),

  bench: () => bcv(16, 9, (r) => {
    r('#3d2a1e', 0, 0, 16, 7); r('#9a6a45', 1, 1, 14, 2); r('#b5824a', 1, 4, 14, 2); r('#3d2a1e', 1, 7, 2, 2); r('#3d2a1e', 13, 7, 2, 2);
  }),

  // Bangalore Palace: Tudor Revival, granite with battlements, turrets with
  // slate spires, pointed Gothic windows and ivy on the walls.
  palace: () => bcv(330, 164, (r) => {
    const O = '#3a3530', S1 = '#d8cfbd', S2 = '#bfb5a0', S3 = '#9c927e', SL = '#5d6470', SL2 = '#7a8290', WIN = '#363b46', IVY = '#4f7a35', IVY2 = '#6a9a45';
    const rnd = seeded(1878);
    const battle = (x, y, w) => { for (let i = x; i < x + w - 2; i += 6) { r(O, i, y, 5, 6); r(S1, i + 1, y + 1, 3, 5); } };
    const goth = (x, y, w, h) => { r(S3, x - 1, y, w + 2, h + 1); r(WIN, x, y + 2, w, h - 2); r(WIN, x + 1, y + 1, w - 2, 1); r('#5a6070', x, y + 2, 1, h - 2); };
    r(O, 4, 154, 322, 9); r(S2, 5, 155, 320, 7); r(S1, 5, 155, 320, 2);
    r(O, 14, 84, 302, 72); r(S1, 15, 85, 300, 70); r(S2, 15, 85, 300, 2); r(S3, 15, 120, 300, 1);
    battle(14, 78, 302);
    for (let x = 22; x < 310; x += 13) { goth(x, 92, 5, 18); goth(x, 126, 5, 20); }
    // Towers: [x, top, width, spire]
    for (const [x, top, w, spire] of [[24, 44, 26, true], [96, 58, 22, false], [148, 14, 34, false], [212, 58, 22, false], [280, 44, 26, true]]) {
      r(O, x - 1, top - 1, w + 2, 156 - top); r(S1, x, top, w, 155 - top); r(S3, x + w - 5, top, 5, 155 - top); r(S2, x, top, w, 2);
      battle(x - 1, top - 6, w + 2);
      for (let y = top + 8; y < 140; y += 22) goth(x + Math.floor(w / 2) - 2, y, 4, 12);
      if (spire) for (let k = 0; k < 20; k++) { const half = Math.round((k / 20) * (w / 2 + 1)); r(O, x + w / 2 - half - 1, top - 26 + k, half * 2 + 2, 1); r(k % 4 ? SL : SL2, x + w / 2 - half, top - 26 + k, half * 2, 1); }
    }
    // The central entrance and the flag on the great tower.
    r(O, 152, 120, 26, 36); r('#4a3020', 154, 124, 22, 32); r('#4a3020', 156, 122, 18, 2); r('#6b4a32', 164, 124, 2, 32);
    // Creeping ivy.
    for (let i = 0; i < 40; i++) {
      const x = 16 + Math.floor(rnd() * 296), y = 110 + Math.floor(rnd() * 40), w = 3 + Math.floor(rnd() * 8);
      r(IVY, x, y, w, 3 + Math.floor(rnd() * 6)); r(IVY2, x + 1, y, Math.max(1, w - 3), 2);
    }
  }),

  // KSR Bengaluru City: a long terminus with a clock tower over the entrance.
  ksr: () => bcv(300, 104, (r) => {
    const O = '#3a2a22', C1 = '#f0e2c0', C2 = '#d9c79e', RB = '#8a3a2a', WIN = '#3a3f4a';
    r(O, 4, 96, 292, 7); r('#bdb5a5', 5, 97, 290, 5);
    r(O, 6, 44, 288, 54); r(C1, 7, 45, 286, 52); r(C2, 7, 45, 286, 2);
    r(RB, 7, 44, 286, 9); r('#a84a36', 7, 44, 286, 1);
    for (let x = 14; x < 290; x += 12) {
      if (x > 120 && x < 180) continue;
      archWindow(r, x, 60, 6, 14, C2, WIN);
      r(O, x - 1, 80, 8, 16); r('#5a3a2a', x, 81, 6, 15); r('#5a3a2a', x + 1, 80, 4, 1);
    }
    // Clock tower.
    r(O, 124, 6, 52, 92); r(C1, 125, 7, 50, 90); r(C2, 168, 7, 7, 90); r(RB, 125, 7, 50, 3);
    for (let i = 0; i < 9; i++) r(i % 2 ? C1 : RB, 125 + i * 6, 2, 4, 5);
    r(O, 139, 14, 22, 22); r('#ffffff', 140, 15, 20, 20); r(O, 149, 18, 2, 8); r(O, 150, 24, 7, 2);
    for (const [dx, dy] of [[0, -8], [8, 0], [0, 8], [-8, 0]]) r(O, 149 + dx, 24 + dy, 2, 2);
    r(O, 132, 56, 36, 42); r('#4a3020', 134, 60, 32, 38); r('#4a3020', 136, 58, 28, 2); r('#ffd98a', 140, 66, 20, 10);
  }),

  ksrcanopy: () => bcv(480, 30, (r) => {
    const O = '#2f2a24';
    r(O, 0, 0, 480, 9); r('#a3a9ae', 1, 1, 478, 5); r('#c9ced2', 1, 1, 478, 1); r('#7d838e', 1, 6, 478, 2);
    for (let x = 6; x < 476; x += 40) { r(O, x, 9, 3, 21); r('#3a5a8a', x + 1, 9, 1, 21); }
    r('#bdb5a5', 0, 26, 480, 4); r('#e8d36a', 0, 25, 480, 1);
  }),

  // Kempegowda Bus Station: concrete canopies with buses lined up underneath.
  busstand: () => bcv(280, 96, (r) => {
    const O = '#2f2f33', CO = '#cfcabd', CO2 = '#a8a294';
    r(O, 20, 0, 240, 14); r('#3a4a6a', 21, 1, 238, 12);
    r(O, 0, 30, 280, 10); r(CO, 1, 31, 278, 5); r(CO2, 1, 36, 278, 3);
    for (let x = 6; x < 276; x += 34) { r(O, x, 40, 5, 50); r(CO, x + 1, 40, 3, 50); }
    r(O, 20, 14, 240, 17); r('#e9e4dc', 21, 15, 238, 15);
    for (let x = 26; x < 256; x += 10) r('#7fa6c4', x, 18, 6, 8);
    for (let i = 0; i < 7; i++) {
      const x = 12 + i * 37, red = i % 2 === 0;
      r(O, x, 54, 30, 34); r(red ? '#c0392b' : '#2f5fb3', x + 1, 55, 28, 32); r(red ? '#f1ead8' : '#9fc0e6', x + 1, 73, 28, 3);
      r('#9cc4dc', x + 3, 58, 24, 12); r('#ee8b3a', x + 4, 56, 22, 2); r('#fff3c8', x + 3, 82, 3, 2); r('#fff3c8', x + 24, 82, 3, 2);
      r(O, x + 2, 88, 6, 4); r(O, x + 22, 88, 6, 4);
    }
    r(CO2, 0, 92, 280, 4);
  }),

  // Freedom Park: the old jail's stone wall and round watchtower.
  freedom: () => bcv(210, 100, (r) => {
    const O = '#3a3530', S1 = '#b9ad94', S2 = '#a39778', S3 = '#857a60';
    r(O, 4, 50, 202, 48); r(S1, 5, 51, 200, 46);
    for (let y = 54; y < 96; y += 6) for (let x = 5 + ((y / 6) % 2) * 6; x < 204; x += 12) r(S2, x, y, 11, 1);
    for (let i = 5; i < 204; i += 8) { r(O, i, 44, 6, 7); r(S1, i + 1, 45, 4, 6); }
    // Watchtower.
    r(O, 88, 4, 34, 94); r(S1, 89, 5, 32, 92); r(S3, 113, 5, 8, 92); r(S2, 89, 5, 32, 2);
    for (let i = 88; i < 122; i += 6) { r(O, i, 0, 4, 6); r(S1, i + 1, 1, 2, 5); }
    for (const y of [16, 36]) { r(O, 102, y, 6, 10); r('#2b2620', 103, y + 1, 4, 9); }
    // Gate.
    r(O, 92, 60, 26, 38); r('#5a4a3a', 94, 64, 22, 34); r('#5a4a3a', 96, 62, 18, 2); r('#7a6a52', 104, 64, 2, 34);
    r('#2f6b3a', 75, 58, 60, 9); r('#3f8a4c', 75, 58, 60, 1);
  }),

  // Town Hall: neoclassical, a row of tall columns over a broad flight of steps.
  townhall: () => bcv(170, 94, (r) => {
    const O = '#3a3530', W1 = '#efe9dc', W2 = '#d3cbbb', W3 = '#b3ab9a';
    r(O, 4, 10, 162, 72); r(W1, 5, 11, 160, 70); r(W2, 5, 11, 160, 2);
    r(O, 2, 6, 166, 6); r(W1, 3, 7, 164, 4);
    r(W2, 20, 18, 130, 8); r(O, 20, 26, 130, 1);
    r('#9a9282', 22, 27, 126, 51);
    for (let i = 0; i < 9; i++) { const x = 24 + i * 15; r(O, x - 1, 26, 6, 52); r(W1, x, 27, 4, 51); r('#ffffff', x, 27, 1, 51); r(W3, x + 3, 27, 1, 51); r(W2, x - 1, 26, 6, 2); }
    for (const x of [8, 156]) { archWindow(r, x, 30, 5, 12, W3, '#4a4f58'); archWindow(r, x, 52, 5, 12, W3, '#4a4f58'); }
    for (let k = 0; k < 6; k++) { r(O, 16 - k * 2, 78 + k * 3, 138 + k * 4, 1); r(k % 2 ? W2 : W1, 16 - k * 2, 79 + k * 3, 138 + k * 4, 2); }
  }),

  // Visvesvaraya Industrial and Technological Museum.
  museum: () => bcv(170, 74, (r) => {
    const O = '#3a3530', C1 = '#e9dcc0', C2 = '#cdbb94', BR = '#a8553a';
    r(O, 4, 14, 162, 58); r(C1, 5, 15, 160, 56); r(C2, 5, 15, 160, 2);
    r(O, 2, 8, 166, 7); r(BR, 3, 9, 164, 5);
    for (let x = 10; x < 160; x += 14) { r(O, x, 22, 9, 14); r('#6f93b0', x + 1, 23, 7, 12); r(O, x, 44, 9, 14); r('#6f93b0', x + 1, 45, 7, 12); }
    r(O, 58, 16, 54, 56); r('#3a4a58', 60, 18, 50, 54);
    for (let x = 60; x < 110; x += 6) r('#9cbdd4', x, 18, 1, 54);
    for (const x of [56, 112]) { r(O, x - 1, 16, 4, 56); r(C1, x, 16, 2, 56); }
    r(BR, 4, 66, 162, 4);
  }),

  // St. Mark's Cathedral: white, a columned porch and a dome on a drum.
  stmarks: () => bcv(120, 104, (r) => {
    const O = '#3a3530', W1 = '#f3efe4', W2 = '#d9d2c2', W3 = '#b8b09e';
    r(O, 6, 50, 108, 52); r(W1, 7, 51, 106, 50); r(W3, 104, 51, 9, 50);
    for (const x of [12, 24, 88, 100]) archWindow(r, x, 62, 5, 16, W3, '#3a4a6a');
    r(O, 30, 20, 60, 32); r(W1, 31, 21, 58, 30);
    for (let x = 36; x < 86; x += 8) archWindow(r, x, 28, 3, 10, W3, '#3a4a6a');
    bDome(r, 60, 20, 24, 14, ['#3a3530', '#ffffff', '#ece6d8', '#c9c2b2'], 4);
    r(O, 58, 0, 5, 6); r(W1, 59, 1, 3, 4); r('#e2b54a', 60, -1, 1, 3);
    // Porch.
    r(O, 36, 58, 48, 44); r('#9a9282', 38, 62, 44, 40);
    for (let dy = 0; dy <= 10; dy++) { const half = Math.round((10 - dy) / 10 * 26); r(O, 60 - half - 1, 58 - dy, half * 2 + 3, 1); if (half > 1) r(W1, 60 - half + 1, 58 - dy, half * 2 - 1, 1); }
    for (let i = 0; i < 4; i++) { const x = 40 + i * 12; r(O, x - 1, 60, 5, 42); r(W1, x, 61, 3, 41); r(W3, x + 2, 61, 1, 41); }
    r('#5a3a2a', 56, 80, 8, 22);
  }),

  // Ulsoor's gurudwara: white, with a golden dome and the Nishan Sahib flag.
  gurudwara: () => bcv(84, 72, (r) => {
    const O = '#3a3530', W1 = '#f6f3ea', W2 = '#dcd6c8', GD = '#e6b33a';
    r(O, 8, 34, 64, 36); r(W1, 9, 35, 62, 34); r(W2, 64, 35, 7, 34);
    for (const x of [14, 26, 50, 60]) archWindow(r, x, 44, 4, 12, W2, '#3a4a6a');
    r(O, 34, 46, 12, 24); r('#5a3a2a', 35, 48, 10, 22); r('#5a3a2a', 36, 47, 8, 1);
    r(O, 6, 30, 68, 5); r(W1, 7, 31, 66, 3);
    for (const x of [12, 68]) { r(O, x - 4, 20, 8, 11); r(W1, x - 3, 21, 6, 9); bDome(r, x, 20, 4, 4, ['#3a3530', '#ffe08a', GD, '#b8892a']); }
    bDome(r, 40, 30, 15, 16, ['#3a3530', '#ffe08a', GD, '#b8892a'], 3);
    r(O, 78, 0, 2, 70); r('#ee8b3a', 80, 2, 4, 1); r('#ee8b3a', 80, 3, 3, 3); r('#ee8b3a', 80, 6, 2, 3); r('#ee8b3a', 80, 9, 1, 2);
  }),

  // K.R. Market: the old market hall with flower stalls in front.
  krmarket: () => bcv(230, 74, (r) => {
    const O = '#3a2a22', Y1 = '#f0d690', Y2 = '#d9b866', RD = '#a8443a';
    const rnd = seeded(1928);
    r(O, 6, 4, 218, 52); r(Y1, 7, 5, 216, 50); r(Y2, 7, 5, 216, 2); r(RD, 7, 4, 216, 8);
    for (let x = 14; x < 220; x += 16) { r(O, x - 1, 22, 12, 34); r('#3a2a20', x, 25, 10, 31); r('#3a2a20', x + 1, 24, 8, 1); r('#3a2a20', x + 2, 23, 6, 1); }
    // Stalls.
    const piles = ['#ee8b3a', '#f2c94c', '#ffffff', '#d8433b', '#f4a3b8', '#7cc35a'];
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 25;
      r(O, x, 54, 22, 14); r('#8a5a3a', x + 1, 55, 20, 12);
      for (let k = 0; k < 18; k++) r(piles[(i + (k % 2)) % piles.length], x + 2 + Math.floor(rnd() * 18), 52 + Math.floor(rnd() * 6), 2, 2);
      r(i % 2 ? '#2f6db0' : '#d8433b', x - 2, 40, 26, 3); r(O, x + 10, 43, 1, 11);
    }
    r('#bdb5a5', 0, 68, 230, 6);
  }),

  // Bangalore Fort's Delhi Gate: granite wall and a pointed Islamic arch.
  fort: () => bcv(100, 80, (r) => {
    const O = '#3a3530', G1 = '#b8b0a0', G2 = '#a39b8a', G3 = '#857d6e';
    r(O, 2, 16, 96, 63); r(G1, 3, 17, 94, 61);
    for (let y = 20; y < 78; y += 6) for (let x = 3 + ((y / 6) % 2) * 5; x < 96; x += 10) r(G2, x, y, 9, 1);
    for (let i = 2; i < 96; i += 9) { r(O, i, 8, 7, 9); r(G1, i + 1, 9, 5, 8); r(G1, i + 2, 7, 3, 1); }
    r(G3, 86, 17, 11, 61);
    // The pointed arch.
    for (let y = 26; y < 78; y++) {
      const k = y < 46 ? (y - 26) / 20 : 1;
      const half = Math.round(16 * Math.sqrt(k));
      r(O, 50 - half - 2, y, half * 2 + 4, 1);
      r('#2b2620', 50 - half, y, half * 2, 1);
    }
    r('#6b4a32', 38, 50, 24, 28); for (let x = 40; x < 62; x += 4) r('#4a3020', x, 50, 1, 28);
    r('#e6c15e', 49, 40, 2, 3);
  }),

  // Tipu Sultan's Summer Palace: teak, with cusped arches on both floors.
  tipu: () => bcv(190, 88, (r) => {
    const O = '#2b1a10', W = '#c99a5e', W2 = '#a87a44', TK = '#6b3f22', TK2 = '#8a5530', IN = '#7a3a22';
    r(O, 4, 78, 182, 9); r('#bdb5a5', 5, 79, 180, 7);
    r(O, 8, 8, 174, 72); r(W, 9, 9, 172, 70); r(W2, 9, 9, 172, 2);
    r(O, 4, 4, 182, 6); r(TK, 5, 5, 180, 4);
    r(TK, 9, 42, 172, 5); r(TK2, 9, 42, 172, 1);
    for (let x = 0; x < 172; x += 4) r(TK2, 9 + x, 40, 2, 2);
    // Cusped arches: three little lobes over each opening.
    for (const [y0, h] of [[14, 26], [50, 28]]) {
      for (let x = 12; x < 176; x += 14) {
        r(IN, x, y0 + 6, 11, h - 6);
        for (const [dx, dy] of [[1, 3], [4, 1], [7, 3]]) r(IN, x + dx, y0 + dy, 3, 4);
        r(O, x - 2, y0, 2, h); r(TK2, x - 2, y0, 1, h);
        r('#a8553a', x + 3, y0 + 10, 5, 4);
      }
      r(O, 176, y0, 2, h);
    }
  }),

  // Dodda Basavana Gudi: a granite shrine with a tower, Nandi inside.
  bulltemple: () => bcv(110, 104, (r) => {
    const O = '#3a3530', S1 = '#d9cfb8', S2 = '#b3a68a', S3 = '#8f8268';
    r(O, 4, 90, 102, 13); r(S2, 5, 91, 100, 11); for (let k = 0; k < 3; k++) r(S1, 30 - k * 4, 92 + k * 3, 50 + k * 8, 2);
    r(O, 10, 48, 90, 43); r(S1, 11, 49, 88, 41); r(S3, 90, 49, 9, 41);
    for (let x = 14; x < 96; x += 10) { r(O, x, 54, 3, 36); r(S2, x + 1, 54, 1, 36); }
    r(O, 40, 56, 30, 34); r('#2b2620', 42, 58, 26, 32);
    // The great Nandi, black granite.
    r('#1a1a1e', 44, 72, 22, 14); r('#2f3138', 45, 73, 20, 6); r('#1a1a1e', 58, 66, 8, 8); r('#2f3138', 59, 67, 4, 3);
    r('#e6c15e', 60, 64, 1, 2); r('#e6c15e', 64, 64, 1, 2); r('#d8433b', 50, 72, 6, 1);
    // Vimana tower over the shrine.
    for (let k = 0; k < 6; k++) {
      const w = 60 - k * 9, x = 55 - w / 2, y = 42 - k * 7;
      r(O, x - 1, y, w + 2, 8); r(k % 2 ? S2 : S1, x, y + 1, w, 6);
      for (let fx = x + 2; fx < x + w - 2; fx += 5) r(S3, fx, y + 2, 2, 4);
    }
    r(O, 50, 0, 10, 6); r('#e6c15e', 51, 1, 8, 4); r('#e6c15e', 54, -1, 2, 2);
  }),

  // Kadu Malleshwara: a painted gopuram above steps.
  malleshwara: () => bcv(100, 96, (r) => {
    const O = '#3d2a1e', ST = '#ecdfc0', ST2 = '#cdbb94', fig = ['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#ee8b3a', '#c3a0ec'];
    for (let k = 0; k < 6; k++) { r(O, 20 - k * 3, 78 + k * 3, 60 + k * 6, 1); r(k % 2 ? '#bdb5a5' : '#d3cbbb', 20 - k * 3, 79 + k * 3, 60 + k * 6, 2); }
    r(O, 18, 56, 64, 23); r(ST, 19, 57, 62, 21);
    for (let x = 20; x < 80; x += 4) r(x % 8 ? '#d8433b' : '#ffffff', x, 74, 3, 3);
    r(O, 42, 60, 16, 19); r('#3a2a20', 43, 61, 14, 18); r('#e6c15e', 49, 64, 2, 3);
    for (let k = 0; k < 7; k++) {
      const w = 56 - k * 7, x = 50 - w / 2, y = 49 - k * 7;
      r(O, x - 1, y, w + 2, 8); r(k % 2 ? ST2 : ST, x, y + 1, w, 6);
      for (let fx = x + 2; fx < x + w - 2; fx += 4) r(fig[(fx + k) % fig.length], fx, y + 2, 2, 4);
    }
    r(O, 43, 0, 14, 4); r('#e6c15e', 44, 1, 12, 2);
  }),

  vidyarthi: () => bcv(64, 46, (r) => {
    const O = '#2f2a24';
    r(O, 2, 10, 60, 35); r('#f1ead8', 3, 11, 58, 33); r('#d9d2c4', 54, 11, 7, 33);
    r(O, 2, 2, 60, 12); r('#2f6b3a', 3, 3, 58, 10); r('#f2c94c', 3, 12, 58, 1);
    for (const x of [8, 44]) { r(O, x, 18, 12, 10); r('#9cbdd4', x + 1, 19, 10, 8); r(O, x + 6, 19, 1, 8); }
    r(O, 24, 20, 16, 24); r('#5a3a2a', 25, 21, 14, 23);
    r('#bdb5a5', 0, 42, 64, 4);
  }),

  cinema: () => bcv(110, 84, (r) => {
    const O = '#2f2a24', W1 = '#e9d2b8', W2 = '#c9a27a';
    r(O, 4, 18, 102, 65); r(W1, 5, 19, 100, 63);
    for (let x = 5; x < 105; x += 10) r(W2, x, 19, 4, 63);
    r(O, 0, 0, 110, 18); r('#8f2a25', 1, 1, 108, 16);
    for (let x = 3; x < 108; x += 5) { r('#ffe08a', x, 1, 2, 1); r('#ffe08a', x, 16, 2, 1); }
    r(O, 30, 24, 50, 30); r('#2f4f8a', 31, 25, 48, 28); r('#f2c94c', 35, 30, 12, 12); r('#d8433b', 52, 30, 22, 6); r('#ffffff', 52, 40, 16, 3);
    r(O, 34, 60, 42, 22); r('#3a2a20', 35, 61, 40, 21); r('#ffd98a', 38, 64, 34, 4);
  }),

  // Koramangala: glass offices and apartment blocks with water tanks.
  office0: () => bOffice('#7fb3c4', '#5f93a8', 92, 120),
  office1: () => bOffice('#8fc0a8', '#6a9a86', 84, 104),
  office2: () => bOffice('#a6b4d4', '#7a88ae', 96, 132),
  apartment0: () => bApartment('#f2d7b8', 0),
  apartment1: () => bApartment('#dfe6ea', 1),
  apartment2: () => bApartment('#f0c9b0', 2),

  // Silk Board: a flyover over the junction.
  flyover: () => bcv(320, 64, (r) => {
    const O = '#2f2f33';
    r(O, 0, 8, 320, 16); r('#b3ada0', 1, 9, 318, 9); r('#8a857a', 1, 18, 318, 5);
    for (let x = 0; x < 320; x += 14) r('#ece6d4', x, 13, 7, 1);
    for (let x = 24; x < 320; x += 60) { r(O, x, 24, 12, 40); r('#a39b8a', x + 1, 24, 10, 40); r('#c9c2b6', x + 1, 24, 3, 40); }
    r(O, 120, 0, 80, 9); r('#2f6b3a', 121, 1, 78, 7);
  }),

  stairs: (col) => bcv(14, 18, (r) => {
    r('#3a3530', 2, 0, 10, 18); for (let y = 1; y < 18; y += 3) { r('#c9c2b6', 3, y, 8, 2); r('#a39b8a', 3, y + 2, 8, 1); }
    r('#3a3530', 0, 0, 4, 6); r(col, 1, 1, 2, 4);
  }),
};

function bOffice(glass, dark, w, h) {
  return bcv(w, h, (r) => {
    const O = '#22303f';
    r(O, 2, 6, w - 4, h - 6); 
    for (let y = 7; y < h - 12; y++) for (let x = 3; x < w - 3; x++) r((y - 7) % 6 < 1 ? dark : (x + y) % 23 < 3 ? '#d8eef6' : x > w - 12 ? dark : glass, x, y);
    r('#d9dee2', 2, 2, w - 4, 5); r(O, 2, 1, w - 4, 1);
    r(O, 2, h - 12, w - 4, 12); r('#3a4a58', 3, h - 11, w - 6, 11); for (let x = 6; x < w - 6; x += 8) r('#ffd98a', x, h - 9, 5, 8);
  });
}

function bApartment(wall, seed) {
  const rnd = seeded(seed * 41 + 3);
  return bcv(70, 96, (r) => {
    const O = '#3a302b', sh = shade(wall, -0.14);
    r(O, 3, 12, 64, 84); r(wall, 4, 13, 62, 82); r(sh, 56, 13, 10, 82);
    for (let f = 0; f < 6; f++) {
      const y = 16 + f * 13;
      r(sh, 4, y + 11, 62, 2);
      for (const x of [8, 26, 44]) { r(O, x, y, 12, 8); r('#7fa6c4', x + 1, y + 1, 10, 6); r(O, x + 5, y + 1, 1, 6); }
      r(O, 6, y + 8, 58, 1); for (let x = 6; x < 64; x += 3) r(O, x, y + 9, 1, 2);
      if (rnd() < 0.5) r(['#d8433b', '#5b8ee0', '#f2c94c'][f % 3], 10 + Math.floor(rnd() * 40), y + 5, 6, 3);
    }
    for (const x of [10, 30, 50]) { r(O, x, 0, 10, 12); r('#2a2a2e', x + 1, 1, 8, 11); r('#4a4a52', x + 2, 1, 2, 11); }
    r(O, 2, 10, 66, 3); r('#ffffff', 3, 11, 64, 1);
  });
}

function bHouseJ(seed) {
  const rnd = seeded(seed * 97 + 11);
  const pk = a => a[Math.floor(rnd() * a.length)];
  const wall = pk(['#f3e3c3', '#f2c9a8', '#cfe3d0', '#d8cfe8', '#f5e08a', '#bfd8e8', '#f0b9a0']);
  const door = pk(['#7a4a2a', '#5a3a6a', '#2f5a7a', '#8a2f2a']);
  return bcv(48, 48, (r) => {
    const O = '#3a302b', sh = shade(wall, -0.14), dk = shade(wall, -0.26);
    r(O, 3, 11, 42, 32); r(wall, 4, 12, 40, 30); r(sh, 37, 12, 7, 30);
    r(O, 2, 8, 44, 4); r('#ffffff', 3, 9, 42, 2);
    const tx = rnd() < 0.5 ? 30 : 8;
    r(O, tx, 0, 11, 9); r('#2a2a2e', tx + 1, 1, 9, 8); r('#4a4a52', tx + 2, 1, 2, 8); r('#1a1a1e', tx + 1, 0, 9, 1);
    r(dk, 4, 26, 40, 2);
    r(O, 6, 20, 20, 1); for (let x = 6; x < 26; x += 2) r(O, x, 21, 1, 5);
    r(O, 9, 13, 12, 7); r('#7fa6c4', 10, 14, 10, 5);
    r(O, 29, 14, 10, 8); r('#7fa6c4', 30, 15, 8, 6); r(O, 32, 15, 1, 6); r(O, 35, 15, 1, 6);
    r(O, 9, 30, 9, 12); r(door, 10, 31, 7, 11); r(shade(door, 0.2), 10, 31, 1, 11);
    r(O, 25, 31, 13, 8); r('#6f93b0', 26, 32, 11, 6); for (let x = 27; x < 37; x += 2) r(O, x, 32, 1, 6);
    const cw = pk(['#e9e4dc', '#c9c2b6', wall]);
    r(O, 0, 41, 48, 6); r(cw, 1, 42, 46, 4); r('#2a2a2e', 8, 41, 11, 6); for (let x = 9; x < 19; x += 2) r('#8a8f96', x, 42, 1, 4);
    r('#b5573a', 40, 38, 4, 4); r('#3f7a35', 39, 35, 6, 3); r('#5a9a45', 40, 34, 3, 2);
  });
}

function bHouseM(seed) {
  const rnd = seeded(seed * 53 + 7);
  const pk = a => a[Math.floor(rnd() * a.length)];
  const wall = pk(['#efe6d2', '#e8cf8a', '#c9dce0', '#e9d2b8']);
  return bcv(46, 40, (r) => {
    const O = '#3d2a1e', TL = '#b5553a', TL2 = '#8a3a28';
    r(O, 3, 15, 40, 22); r(wall, 4, 16, 38, 20); r(shade(wall, -0.12), 36, 16, 6, 20);
    r(O, 0, 3, 46, 14); r(TL, 1, 4, 44, 12); r('#cf7352', 1, 4, 44, 1);
    for (let y = 6; y < 16; y += 3) { r(TL2, 1, y, 44, 1); for (let x = 1 + (y % 2) * 2; x < 45; x += 4) r(TL2, x, y - 2, 1, 2); }
    r('#9a4a32', 4, 31, 38, 5); r('#7a3a28', 4, 35, 38, 1);
    for (const x of [6, 38]) { r('#6b4a32', x, 16, 2, 15); }
    r(O, 19, 19, 8, 13); r('#7a4a2a', 20, 20, 6, 12); r('#9a6a45', 20, 20, 1, 12);
    for (const x of [10, 30]) { r(O, x, 20, 6, 6); r('#3a2a20', x + 1, 21, 4, 4); r(wall, x + 2, 21, 1, 4); }
    r('#bdb5a5', 18, 36, 10, 3);
  });
}

// Trees are stamped from a few pre-drawn variants per kind.
const B_TREES = {
  rain: { w: 50, h: 46, pal: ['#1f3a1f', '#2f5a2a', '#46793a', '#6a9e4c'], cw: 50, ch: 30, trunk: 16 },
  pink: { w: 38, h: 40, pal: ['#6b2c48', '#c45386', '#e98bb5', '#fbd0e2'], cw: 38, ch: 26, trunk: 14 },
  gulmohar: { w: 42, h: 38, pal: ['#5a1f14', '#b5381d', '#e2552c', '#f7924f'], cw: 42, ch: 24, trunk: 14 },
  coconut: { w: 34, h: 50 },
  royal: { w: 22, h: 52 },
  bamboo: { w: 26, h: 42 },
};

function bTree(kind, seed) {
  const T = B_TREES[kind];
  const rnd = seeded(seed);
  return bcv(T.w, T.h, (r, c) => {
    if (T.pal) {
      const tx = Math.round(T.w / 2);
      r('#3a2618', tx - 2, T.ch - 6, 5, T.h - T.ch + 6); r('#6b4a32', tx - 1, T.ch - 6, 3, T.h - T.ch + 5); r('#8a6a4a', tx - 1, T.ch - 6, 1, T.h - T.ch + 5);
      r('#6b4a32', tx - 6, T.ch - 4, 5, 1); r('#6b4a32', tx + 2, T.ch - 3, 5, 1);
      const lumps = [];
      for (let i = 0; i < 7; i++) lumps.push({ x: T.cw * (0.2 + rnd() * 0.6), y: T.ch * (0.3 + rnd() * 0.4), r: T.ch * (0.28 + rnd() * 0.16) });
      const can = blob(T.cw, T.ch, (x, y) => lumps.some(l => (x - l.x) ** 2 + ((y - l.y) * 1.2) ** 2 < l.r * l.r), T.pal, 0.16, rnd);
      c.drawImage(can, 0, 0);
      if (kind === 'pink') for (let i = 0; i < 6; i++) r('#6a9e4c', Math.floor(T.cw * (0.25 + rnd() * 0.5)), Math.floor(T.ch * (0.3 + rnd() * 0.5)));
    } else if (kind === 'coconut') {
      const lean = rnd() < 0.5 ? -1 : 1;
      let topX = 17;
      for (let y = 49; y >= 14; y--) {
        const x = Math.round(17 + Math.sin((49 - y) / 35 * 1.3) * 5 * lean);
        topX = x;
        r('#4a3420', x - 2, y, 4, 1); r(y % 3 ? '#9a7a52' : '#7a5a3a', x - 1, y, 2, 1);
      }
      for (let f = 0; f < 8; f++) {
        const a = -Math.PI + (f / 7) * Math.PI + (rnd() - 0.5) * 0.3;
        for (let i = 2; i < 16; i++) {
          const px = Math.round(topX + Math.cos(a) * i), py = Math.round(14 + Math.sin(a) * i * 0.55 + i * i / 26);
          r('#2f5a2a', px, py); r('#5a9a45', px, py + 1);
        }
      }
      r('#6b4a2a', topX - 2, 15, 2, 2); r('#6b4a2a', topX + 1, 16, 2, 2);
    } else if (kind === 'royal') {
      for (let y = 51; y >= 12; y--) { const w = y > 44 ? 4 : 3; r('#5f5a52', 11 - Math.ceil(w / 2), y, w + 1, 1); r('#cfc8b8', 11 - Math.ceil(w / 2) + 1, y, w - 1, 1); }
      r('#3f7a35', 9, 10, 4, 4);
      for (let f = 0; f < 7; f++) {
        const a = -Math.PI + (f / 6) * Math.PI;
        for (let i = 1; i < 11; i++) { const px = Math.round(11 + Math.cos(a) * i), py = Math.round(10 + Math.sin(a) * i * 0.6 + i * i / 18); r('#2f5a2a', px, py); r('#6a9e4c', px, py - 1); }
      }
    } else if (kind === 'bamboo') {
      for (let s = 0; s < 8; s++) {
        const x = 4 + Math.floor(rnd() * 18), top = 4 + Math.floor(rnd() * 12);
        for (let y = top; y < 42; y++) { r('#2f4a1a', x - 1, y, 4, 1); r(y % 6 === 0 ? '#3f5a22' : '#7aa83e', x, y, 2, 1); }
        for (let k = 0; k < 6; k++) { const ly = top + Math.floor(rnd() * 18); r('#3f7a35', x + 2, ly, 4, 2); r('#5a9a45', x - 4, ly + 2, 4, 2); }
      }
    }
  });
}

