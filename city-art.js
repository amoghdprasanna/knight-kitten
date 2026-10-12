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
      // Any front profile pushed back d deep: inside(u, v) says which pixels of
      // the w x h front are solid (u along the facade, v up from the base).
      // Back slices show as the top and right faces, the front gets an outline.
      prism(x, y, z, w, h, d, inside, col) {
        const at = (u, v) => u >= 0 && v >= 0 && u < w && v < h && inside(u, v);
        for (let t = d; t >= 0; t--) {
          for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
            if (!at(u, v)) continue;
            const [sx, sy] = P(x + u, y + t, z + v);
            let cl;
            if (t === 0) cl = !at(u - 1, v) || !at(u + 1, v) || !at(u, v + 1) || !at(u, v - 1) ? col.line || '#3a2a1a' : col.front;
            else cl = !at(u, v + 1) ? (t === d ? col.line || '#3a2a1a' : col.top) : !at(u + 1, v) && t === d ? col.line || '#3a2a1a' : col.side;
            r(cl, Math.round(sx), Math.round(sy), 1, 1);
          }
        }
      },
      // A face on the right-hand side wall at x, from depth y0..y1 and height z0..z1.
      sideRect(x, y0, y1, z0, z1, col) { polyFill(c, [P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)], col); },
    };
    bKit(g);
    fn(g);
  });
}

// ---------------------------------------------------------------------------
// The furniture of a Bengaluru roof and facade, added to the 3D kit: black
// plastic water tanks on stands, stair rooms, dish antennas, hoardings and
// washing lines up top; windows with grilles and concrete sunshades (chajjas),
// balconies with potted plants below.
// ---------------------------------------------------------------------------
const TANK = ['#0c0c0e', '#18181c', '#25252b', '#34343c', '#4a4a54'];

function bKit(g) {
  const { r, P } = g;
  const R = Math.round;
  const O = '#3a3530';
  g.tank = (x, y, z, rad = 3, h = 6) => {
    g.box(x - rad - 1, y - 1, z, rad * 2 + 3, 3, 1, { front: '#8a8f96', top: '#b9bec2', side: '#6e7378', line: O });
    g.cyl(x, y, z + 1, rad, h, TANK, '#0a0a0c');
    const [cx, cy] = P(x, y, z + 1);
    const X = R(cx), Y = R(cy);
    for (const j of [2, 4]) if (j < h - 1) r(TANK[3], X - rad, Y - j, rad * 2 + 1, 1);
    r('#0a0a0c', X - rad, Y - h, rad * 2 + 1, 1);
    r('#4a4a54', X - rad + 1, Y - h + 1, rad * 2 - 1, 1);
    r('#6a6a76', X - 1, Y - h - 1, 3, 1);
  };
  g.stairRoom = (x, y, z, w, d, h, wall) => {
    const f = g.box(x, y, z, w, d, h, { front: wall, top: shade(wall, 0.25), side: shade(wall, -0.3), line: O });
    r('#2b2620', f.x + 2, f.y + 3, Math.min(4, f.w - 4), f.h - 3);
    return f;
  };
  g.dish = (x, y, z) => {
    const [sx, sy] = P(x, y, z);
    const X = R(sx), Y = R(sy);
    r('#5d6369', X, Y - 4, 1, 4);
    r(O, X - 3, Y - 8, 6, 4); r('#eef0f2', X - 2, Y - 7, 4, 2); r('#b9bec2', X - 2, Y - 5, 4, 1); r(O, X + 2, Y - 9, 1, 1);
  };
  g.acUnit = (x, y, z) => {
    const f = g.box(x, y, z, 6, 4, 4, { front: '#d9dee2', top: '#f2f4f5', side: '#a3a9ae', line: O });
    r('#5d6369', f.x + 2, f.y + 1, 3, 2);
  };
  g.washing = (x0, x1, y, z, rnd) => {
    const a = P(x0, y, z), b = P(x1, y, z);
    r('#5d6369', R(a[0]), R(a[1]) - 8, 1, 8); r('#5d6369', R(b[0]), R(b[1]) - 8, 1, 8);
    const cols = ['#d8433b', '#f2c94c', '#5b8ee0', '#f4f1ea', '#7cc35a', '#c3a0ec', '#ee8b3a'];
    for (let x = R(a[0]) + 1; x < R(b[0]); x++) {
      const y0 = R(a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(1, b[0] - a[0])) - 7;
      r('#8a8f96', x, y0, 1, 1);
      if ((x + R(a[0])) % 4 < 2) r(cols[Math.floor(rnd() * cols.length)], x, y0 + 1, 1, 2 + Math.floor(rnd() * 2));
    }
  };
  // A rooftop hoarding on two legs; returns its board, ready for a picture.
  g.hoarding = (x, y, z, w, h) => {
    for (const px of [x + 3, x + w - 4]) { const [sx, sy] = P(px, y, z); r('#4a4740', R(sx), R(sy) - 6, 1, 6); }
    return g.box(x, y, z + 6, w, 1, h, { front: '#f4f1ea', top: '#c9c2b6', side: '#8a857a', line: '#2b2620' });
  };
  // A window with a frame, a grille and a concrete sunshade over it.
  g.win = (x, y, w, h, wall, glass = '#5f87a6', grille = true) => {
    r(O, x - 1, y - 1, w + 2, h + 2); r(glass, x, y, w, h); r(shade(glass, 0.35), x, y, 1, h); r(shade(glass, -0.25), x, y + h - 1, w, 1);
    if (grille) for (let gx = x + 2; gx < x + w - 1; gx += 3) r(shade(glass, -0.45), gx, y, 1, h - 1);
    r(shade(wall, 0.3), x - 2, y - 3, w + 4, 1); r(shade(wall, -0.35), x - 2, y - 2, w + 4, 1);
  };
  // A balcony railing across x..x+w at screen row y, with pots on the ledge.
  g.balcony = (x, y, w, rnd) => {
    r(O, x, y, w, 1); r(O, x, y + 4, w, 1);
    for (let bx = x; bx < x + w; bx += 2) r(O, bx, y + 1, 1, 3);
    for (let k = 0; k < 2; k++) if (rnd() < 0.7) { const px = x + 2 + Math.floor(rnd() * (w - 5)); r('#b5573a', px, y - 2, 3, 2); r('#4f8a3c', px - 1, y - 4, 5, 2); r('#7cc35a', px, y - 5, 2, 1); }
  };
  // A pitched tile roof over x..x+w, y..y+d from height z, ridge h higher,
  // running along the facade with its gable end on the right.
  g.roof = (x, y, z, w, d, h, tile = '#b5553a', line = O) => {
    const a = P(x, y, z), b = P(x + w, y, z), c2 = P(x + w, y + d / 2, z + h), d2 = P(x, y + d / 2, z + h), e = P(x + w, y + d, z);
    polyFill(g.c, [b, e, c2], shade(tile, -0.3));
    polyFill(g.c, [a, b, c2, d2], tile);
    for (let k = 1; k < 8; k++) { const t = k / 8; pixLine(g.c, [a[0] + (d2[0] - a[0]) * t, a[1] + (d2[1] - a[1]) * t], [b[0] + (c2[0] - b[0]) * t, b[1] + (c2[1] - b[1]) * t], shade(tile, -0.18)); }
    pixLine(g.c, a, b, line); pixLine(g.c, d2, c2, line); pixLine(g.c, a, d2, line); pixLine(g.c, b, c2, line); pixLine(g.c, c2, e, line); pixLine(g.c, b, e, line);
  };
  // Gold pot finials (kalashas) in a row on a ridge.
  g.kalashas = (x0, x1, y, z, n) => {
    for (let i = 0; i < n; i++) {
      const [sx, sy] = P(x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y, z);
      const X = R(sx), Y = R(sy);
      r('#4a3410', X - 2, Y - 4, 5, 4); r('#d4a83a', X - 1, Y - 3, 3, 3); r('#fff0a8', X - 1, Y - 3, 1, 1); r('#4a3410', X, Y - 6, 1, 2);
    }
  };
  // A Dravidian gateway tower (gopuram): tapering tiers of niches and
  // miniature shrines under a wagon-vault roof with a row of kalashas.
  g.gopuram = (cx, cy, z, w, d, tiers, pal, rnd = null) => {
    let ww = w, dd = d, zz = z;
    const figs = ['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#ee8b3a', '#c3a0ec'];
    for (let k = 0; k < tiers; k++) {
      const th = k === 0 ? 11 : 8;
      const f = g.box(cx - ww / 2, cy - dd / 2, zz, ww, dd, th, pal);
      r(pal.line, f.x + 1, f.y + 2, f.w - 1, 1);
      for (let x = f.x + 2; x < f.x + f.w - 2; x += 4) {
        r(shade(pal.front, -0.22), x, f.y + 3, 2, f.h - 4);
        if (rnd) r(figs[Math.floor(rnd() * figs.length)], x, f.y + 4, 2, 2);
      }
      for (let x = f.x + 1; x < f.x + f.w; x += Math.max(4, Math.round(ww / 5))) { r(pal.line, x, f.y - 2, 3, 2); r(pal.top, x + 1, f.y - 2, 1, 1); }
      zz += th; ww = Math.max(8, ww - 5); dd = Math.max(4, dd - 1);
    }
    const vw = ww + 4, vh = 8;
    g.prism(cx - vw / 2, cy - dd / 2, zz, vw, vh, dd, (u, v) => {
      const e = Math.min(u, vw - 1 - u);
      return e >= 3 || v < 4 + e;
    }, { front: pal.front, top: pal.top, side: pal.side, line: pal.line });
    g.kalashas(cx - vw / 2 + 3, cx + vw / 2 - 3, cy - dd / 2 + 1, zz + vh, Math.max(3, Math.round(vw / 6)));
    return zz + vh;
  };
  // A temple tower over the sanctum (vimana): square tiers and a dome on top.
  g.vimana = (cx, cy, z, w, tiers, pal) => {
    let ww = w, zz = z;
    for (let k = 0; k < tiers; k++) {
      const th = k === 0 ? 9 : 6;
      const f = g.box(cx - ww / 2, cy - ww / 2, zz, ww, ww, th, pal);
      for (let x = f.x + 2; x < f.x + f.w - 1; x += 4) r(shade(pal.front, -0.22), x, f.y + 2, 2, f.h - 3);
      for (const kx of [0, 0.5, 1]) { const [sx, sy] = P(cx - ww / 2 + 1 + (ww - 3) * kx, cy - ww / 2, zz + th); r(pal.line, R(sx) - 1, R(sy) - 3, 3, 3); r(pal.top, R(sx), R(sy) - 2, 1, 2); }
      zz += th; ww = Math.max(6, ww - 6);
    }
    const ramp = [pal.line, shade(pal.side, -0.2), pal.side, pal.front, pal.top, shade(pal.top, 0.4)];
    const [tx, ty] = g.dome(cx, cy, zz, Math.round(ww / 2) + 2, Math.round(ww / 2) + 3, ramp, 0.5, pal.line);
    r('#4a3410', R(tx) - 2, R(ty) - 6, 5, 6); r('#d4a83a', R(tx) - 1, R(ty) - 5, 3, 4); r('#fff0a8', R(tx) - 1, R(ty) - 5, 1, 1); r('#4a3410', R(tx), R(ty) - 8, 1, 2);
  };
}

// Runs a sprite builder that reports where its name board is, and keeps that
// as the sprite's `sign` anchor (x, y of the board's centre, w its width).
function bSigned(build) {
  let at = null;
  const img = build(a => { at = a; });
  img.anchors = { ...(img.anchors || {}), sign: { ...at, y: at.y - img.trim } };
  return img;
}

// A canvas for a block w wide, d deep and h tall with `top` pixels of rooftop
// clutter above it. The front of the block spans x = 1..w+1 of the image.
function b3dBlock(w, d, h, top, fn) {
  const dx = Math.ceil(d * OB.SX) + 3, dy = Math.ceil(d * OB.SY);
  const H0 = h + dy + top + 2;
  const img = bTrimTop(b3dCanvas(w + dx + 3, H0, 1, H0 - 2, fn));
  img.fw = w + 2;
  return img;
}

// Drops empty rows above a sprite, so its height is the height of the picture.
// Anchors found while drawing are moved up by `trim`.
function bTrimTop(cv) {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let t = 0;
  rows: for (; t < cv.height - 1; t++) for (let x = 0; x < cv.width; x++) if (d[(t * cv.width + x) * 4 + 3]) break rows;
  if (!t) { cv.trim = 0; return cv; }
  const out = document.createElement('canvas');
  out.width = cv.width; out.height = cv.height - t;
  out.getContext('2d').drawImage(cv, 0, -t);
  out.trim = t;
  return out;
}

// A shophouse: a shop on the ground floor under its signboard, homes above,
// tanks and washing on the roof. `style` is bazaar (old city markets),
// street (glass shop fronts on MG Road, Indiranagar, Koramangala) or lodge.
function bShopHouse(wall, board, awning, seed, style = 'bazaar') {
  const rnd = seeded(seed * 131 + 17);
  const W0 = 58, D = 22, GF = 23, SB = 9, FH = 14;
  const floors = style === 'street' ? 1 + (seed % 2) : 1 + Math.floor(rnd() * 2.8);
  const H = GF + SB + floors * FH + 2;
  let sign = null;
  const img = b3dBlock(W0, D, H, 24, g => {
    const { r } = g;
    const O = '#3a3530', dk = shade(wall, -0.2);
    const f = g.box(0, 0, 0, W0, D, H, { front: wall, top: shade(wall, 0.3), side: shade(wall, -0.32), line: O });
    const Z = z => f.y + f.h - z;
    for (let k = 0; k < floors; k++) {
      const z = GF + SB + k * FH + 4;
      g.sideRect(W0, 6, 15, z, z + 7, O); g.sideRect(W0, 7, 14, z + 1, z + 6, '#4f6f8a');
    }
    r(dk, f.x + 1, Z(2), f.w - 1, 2);
    const gx = f.x + 2, gw = f.w - 3, top = Z(GF - 2), gh = GF - 4;
    if (style === 'street') {
      // Glass shop front: big panes with reflections, a door, things on display.
      r(O, gx, top, gw, gh); r('#9cc4dc', gx + 1, top + 1, gw - 2, gh - 1);
      for (let k = 0; k < gw + gh; k += 9) for (let i = 0; i < 3; i++) { const x = gx + 1 + k - i, y = top + 1 + i; if (x > gx && x < gx + gw - 1) r('#d8eef6', x, y, 1, Math.min(gh - 1 - i, 3)); }
      for (let x = gx + 14; x < gx + gw - 1; x += 14) r(O, x, top, 1, gh);
      r('#ffd98a', gx + 2, top + gh - 6, gw - 4, 1);
      for (let x = gx + 3; x < gx + gw - 4; x += 5) r(['#d8433b', '#2f6db0', '#f2c94c', '#2f8a3a', '#c3a0ec'][Math.floor(rnd() * 5)], x, top + gh - 9, 3, 3);
      r(O, gx + gw / 2 - 4, top + 3, 9, gh - 3); r('#2b3a48', gx + gw / 2 - 3, top + 4, 7, gh - 4); r('#ffd98a', gx + gw / 2 + 2, top + 10, 1, 2);
    } else {
      // Two bays with their rolling shutters pulled up and the goods spilling out.
      const goods = style === 'lodge' ? null : [board, awning, '#f2c94c', '#d8433b', '#5b8ee0', '#7cc35a', '#f4a3b8'];
      for (const [bx, bw] of [[gx, 26], [gx + 28, gw - 28]]) {
        r(O, bx, top, bw, gh);
        r('#2b2620', bx + 1, top + 4, bw - 2, gh - 4);
        for (let k = 0; k < 3; k++) r(k % 2 ? '#8a8f96' : '#c4c9cc', bx + 1, top + 1 + k, bw - 2, 1);
        if (goods) {
          for (let x = bx + 2; x < bx + bw - 2; x += 3) r(goods[Math.floor(rnd() * goods.length)], x, top + 4, 2, 5 + Math.floor(rnd() * 4));
          r('#8a5a3a', bx + 1, top + gh - 5, bw - 2, 4); r('#b5824a', bx + 1, top + gh - 5, bw - 2, 1);
          for (let x = bx + 2; x < bx + bw - 3; x += 2) if (rnd() < 0.7) r(goods[Math.floor(rnd() * goods.length)], x, top + gh - 7, 2, 2);
        } else {
          r('#ffd98a', bx + 3, top + 6, bw - 6, gh - 7); r('#8a5a3a', bx + 4, top + gh - 6, bw - 8, 3); r('#2b2620', bx + bw / 2 - 1, top + 6, 2, gh - 7);
        }
      }
    }
    // A striped awning, then the signboard (its words are drawn on the UI layer).
    for (let x = f.x; x <= f.x + f.w; x++) r(((x - f.x) >> 2) % 2 ? awning : '#fbf7ee', x, Z(GF) - 1, 1, 3);
    r(shade(awning, -0.35), f.x, Z(GF) + 2, f.w + 1, 1);
    const sy = Z(GF + SB) + 1;
    r(O, f.x + 2, sy, f.w - 3, SB - 1); r(board, f.x + 3, sy + 1, f.w - 5, SB - 3); r(shade(board, 0.3), f.x + 3, sy + 1, f.w - 5, 1);
    sign = { x: f.x + f.w / 2, y: sy + (SB - 1) / 2, w: f.w - 7 };
    // Homes above: windows with grilles and sunshades, sometimes a balcony.
    for (let k = 0; k < floors; k++) {
      const zb = GF + SB + k * FH;
      r(dk, f.x + 1, Z(zb + 1), f.w - 1, 1);
      if (rnd() < 0.45) {
        for (const wx of [8, 36]) g.win(f.x + wx, Z(zb + FH - 2), 14, 8, wall, '#5f87a6', false);
        g.balcony(f.x + 3, Z(zb + 5), f.w - 5, rnd);
      } else for (const wx of [5, 24, 43]) g.win(f.x + wx, Z(zb + FH - 3), 10, 7, wall);
    }
    // The roof.
    const tx = 8 + Math.floor(rnd() * 20);
    if (rnd() < 0.5) g.stairRoom(W0 - 20, 9, H, 13, 10, 9, shade(wall, 0.15));
    else if (style === 'street' || rnd() < 0.3) {
      const hb = g.hoarding(W0 - 30, 14, H, 26, 10);
      r(['#d8433b', '#2f6db0', '#2f8a3a', '#ee8b3a'][seed % 4], hb.x + 2, hb.y + 2, hb.w - 3, hb.h - 4);
      r('#ffffff', hb.x + 4, hb.y + 4, 10, 2); r('#f2c94c', hb.x + 17, hb.y + 3, 5, 5);
    }
    g.tank(tx, 13, H, 3, 6);
    if (rnd() < 0.5) g.tank(tx + 9, 14, H, 2, 5);
    if (rnd() < 0.5) g.washing(4, 26, 4, H, rnd);
    else if (rnd() < 0.6) g.dish(W0 - 8, 4, H);
  });
  img.anchors = { sign: { ...sign, y: sign.y - img.trim } };
  return img;
}

// An apartment block on stilts: parked scooters below, balconies with plants
// and washing on every floor, a row of tanks and the lift room on the roof.
function bApartment3D(wall, seed) {
  const rnd = seeded(seed * 41 + 3);
  const W0 = 62, D = 30, FH = 13, GF = 12, floors = 5 + (seed % 2);
  const H = GF + floors * FH + 3;
  return b3dBlock(W0, D, H, 20, g => {
    const { r } = g;
    const O = '#3a302b', dk = shade(wall, -0.18);
    const f = g.box(0, 0, 0, W0, D, H, { front: wall, top: shade(wall, 0.3), side: shade(wall, -0.3), line: O });
    const Z = z => f.y + f.h - z;
    for (let k = 0; k < floors; k++) for (const yy of [5, 18]) { const z = GF + k * FH + 4; g.sideRect(W0, yy, yy + 7, z, z + 6, O); g.sideRect(W0, yy + 1, yy + 6, z + 1, z + 5, '#5f87a6'); }
    // Stilt parking.
    r('#2b2620', f.x + 1, Z(GF - 1), f.w - 1, GF - 1);
    for (let x = f.x + 1; x < f.x + f.w; x += 15) r(dk, x, Z(GF - 1), 3, GF - 1);
    for (let i = 0; i < 6; i++) { const x = f.x + 5 + i * 9 + Math.floor(rnd() * 3); r(['#d8433b', '#5b8ee0', '#f2c94c', '#f4f1ea', '#2f8a3a'][Math.floor(rnd() * 5)], x, Z(4), 5, 2); r('#1d1816', x, Z(2), 2, 2); r('#1d1816', x + 4, Z(2), 2, 2); }
    // Floors: three bays each, balconies and windows alternating.
    for (let k = 0; k < floors; k++) {
      const zb = GF + k * FH;
      r(dk, f.x + 1, Z(zb + 1), f.w - 1, 2);
      for (let b = 0; b < 3; b++) {
        const bx = f.x + 3 + b * 20;
        if ((b + k) % 2 === 0) {
          r('#3a4a58', bx + 2, Z(zb + FH - 2), 14, 9); r('#5f87a6', bx + 3, Z(zb + FH - 3), 5, 7);
          g.balcony(bx, Z(zb + 6), 18, rnd);
          if (rnd() < 0.5) for (let x = bx + 2; x < bx + 16; x += 3) r(['#d8433b', '#f2c94c', '#f4f1ea', '#5b8ee0'][Math.floor(rnd() * 4)], x, Z(zb + FH - 3), 2, 3);
        } else g.win(bx + 3, Z(zb + FH - 3), 12, 7, wall);
      }
    }
    // The roof: tanks in a row, the lift room, a dish.
    g.stairRoom(W0 - 22, 12, H, 16, 14, 11, shade(wall, 0.1));
    for (let i = 0; i < 3; i++) g.tank(8 + i * 10, 18, H, 3, 7);
    if (seed % 2) g.dish(6, 6, H); else g.washing(4, 30, 6, H, rnd);
  });
}

// A Jayanagar house: compound wall and gate in front, two floors with a
// balcony, a black tank and pots on the terrace.
function bHouseJ3D(seed) {
  const rnd = seeded(seed * 97 + 11);
  const pk = a => a[Math.floor(rnd() * a.length)];
  const wall = pk(['#f3e3c3', '#f2c9a8', '#cfe3d0', '#d8cfe8', '#f5e08a', '#bfd8e8', '#f0b9a0']);
  const door = pk(['#7a4a2a', '#5a3a6a', '#2f5a7a', '#8a2f2a']);
  const W0 = 42, D = 26, H = 29;
  return b3dBlock(W0, D, H, 14, g => {
    const { r } = g;
    const O = '#3a302b';
    const f = g.box(1, 8, 0, W0 - 2, D - 8, H, { front: wall, top: shade(wall, 0.35), side: shade(wall, -0.3), line: O });
    const Z = z => f.y + f.h - z;
    g.sideRect(W0 - 1, 12, 18, 6, 12, O); g.sideRect(W0 - 1, 13, 17, 7, 11, '#5f87a6');
    r(shade(wall, -0.2), f.x + 1, Z(15), f.w - 1, 2);
    r(O, f.x + 5, Z(13), 9, 13); r(door, f.x + 6, Z(12), 7, 12); r(shade(door, 0.25), f.x + 6, Z(12), 1, 12);
    g.win(f.x + 20, Z(11), 13, 7, wall);
    if (rnd() < 0.6) { r('#3a4a58', f.x + 4, Z(H - 3), 12, 9); g.balcony(f.x + 2, Z(20), 18, rnd); g.win(f.x + 23, Z(H - 4), 10, 7, wall); }
    else { g.win(f.x + 5, Z(H - 4), 10, 7, wall); g.win(f.x + 23, Z(H - 4), 10, 7, wall); }
    r(shade(wall, 0.4), f.x, f.y - 1, f.w + 1, 1);
    g.tank(rnd() < 0.5 ? 30 : 12, 18, H, 3, 6);
    if (rnd() < 0.5) g.washing(4, 20, 14, H, rnd);
    else for (const px of [6, 12]) { const [sx, sy] = g.P(px, 10, H); r('#b5573a', Math.round(sx), Math.round(sy) - 2, 3, 2); r('#4f8a3c', Math.round(sx) - 1, Math.round(sy) - 4, 5, 2); }
    // Compound wall with the gate.
    const cw = pk(['#e9e4dc', '#c9c2b6', wall]);
    const cf = g.box(0, 0, 0, W0, 2, 6, { front: cw, top: shade(cw, 0.3), side: shade(cw, -0.3), line: O });
    r('#2a2a2e', cf.x + 7, cf.y, 11, cf.h); for (let x = cf.x + 8; x < cf.x + 17; x += 2) r('#8a8f96', x, cf.y + 1, 1, cf.h - 2);
    r('#b5573a', cf.x + cf.w - 6, cf.y - 3, 4, 3); r('#3f7a35', cf.x + cf.w - 7, cf.y - 6, 6, 3); r('#5a9a45', cf.x + cf.w - 6, cf.y - 7, 3, 2);
  });
}

// A glass office tower on a podium, the way Koramangala builds them.
function bOffice3D(glass, dark, W0, H, seed) {
  const D = 38;
  return b3dBlock(W0, D, H, 12, g => {
    const { r } = g;
    const O = '#22303f';
    const pod = g.box(0, 0, 0, W0, D, 14, { front: '#d9dee2', top: '#eef1f3', side: '#a3a9ae', line: O });
    r('#3a4a58', pod.x + 3, pod.y + 3, pod.w - 5, pod.h - 4);
    for (let x = pod.x + 5; x < pod.x + pod.w - 6; x += 8) r('#ffd98a', x, pod.y + 5, 5, pod.h - 7);
    r(O, pod.x + pod.w / 2 - 12, pod.y + 1, 24, 2); r('#eef1f3', pod.x + pod.w / 2 - 11, pod.y + 1, 22, 1);
    const f = g.box(5, 5, 14, W0 - 10, D - 10, H - 14, { front: glass, top: '#d9dee2', side: dark, line: O });
    for (let y = f.y + 3; y < f.y + f.h - 1; y += 6) r(shade(glass, -0.25), f.x + 1, y, f.w - 1, 1);
    for (let x = f.x + 6; x < f.x + f.w - 1; x += 9) r(shade(glass, -0.12), x, f.y + 1, 1, f.h - 2);
    for (let k = 0; k < f.w + f.h; k += 23) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = f.x + 1 + k - Math.floor((f.y + f.h - 1 - (f.y + 1 + i * 6 + j)) * 0.5) + j, y = f.y + f.h - 2 - i * 6 - j; if (x > f.x && x < f.x + f.w && y > f.y) r('#d8eef6', x, y, 1, 1); }
    for (let z = 20; z < H - 4; z += 6) g.sideRect(W0 - 5, 6, D - 6, z, z + 1, shade(dark, -0.25));
    r(O, f.x, f.y + 4, f.w + 1, 1); r(shade(glass, -0.4), f.x + 1, f.y + 1, f.w - 1, 3);
    g.acUnit(8, 14, H); g.acUnit(18, 14, H);
    g.stairRoom(W0 - 26, 12, H, 14, 12, 8, '#c9ced2');
    if (seed % 2) g.dish(W0 - 14, 8, H);
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

// A cone (turret roofs, spires) on a round base.
function bCone(g, x, y, z, rad, h, ramp, line = '#2a2a30') {
  const [cx, cy] = g.P(x, y, z);
  for (let j = 0; j <= h; j++) {
    const half = rad * (1 - j / h);
    for (let i = Math.round(-half); i <= Math.round(half); i++) {
      const nx = half ? i / (half + 0.5) : 0;
      const v = nx * LIGHT[0] + Math.sqrt(Math.max(0, 1 - nx * nx)) * LIGHT[2] + 0.2;
      g.r(rampAt(ramp, v, i + 64, j), Math.round(cx + i), Math.round(cy - j), 1, 1);
    }
    g.r(line, Math.round(cx - half) - 1, Math.round(cy - j), 1, 1); g.r(line, Math.round(cx + half) + 1, Math.round(cy - j), 1, 1);
  }
  g.r(line, Math.round(cx), Math.round(cy - h) - 3, 1, 3);
}

// Battlements: square merlons along the front top edge of a box.
function bMerlons(g, x, y, z, w, col) {
  for (let i = x; i < x + w - 2; i += 6) g.box(i, y, z, 4, 3, 4, col);
}

// Bangalore Palace: grey granite in Tudor style, with a crenellated entrance
// tower, octagonal corner towers, slender turrets with pointed slate roofs,
// pointed Gothic windows in white frames, and ivy on the walls.
function bPalace3D() {
  const W0 = 372, H0 = 190, OX = 6, OY = H0 - 8;
  const STONE = ['#2e2c2a', '#5e5850', '#7e776c', '#9a9284', '#b3ab9b', '#c9c1b0', '#ddd6c6'];
  const SLATE = ['#1e2228', '#363c46', '#4e5664', '#68717f', '#858e9b'];
  const F = { front: '#aea694', top: '#cfc8b6', side: '#7d7668', line: '#2e2c2a' };
  const M = { front: '#bdb5a2', top: '#d6cfbe', side: '#857e70', line: '#2e2c2a' };
  const WIN = '#30353f', TRIM = '#ece7dc';
  return b3dCanvas(W0, H0, OX, OY, g => {
    const { r, P } = g;
    const rnd = seeded(1887);
    const lancet = (x, y, w, h) => { r(TRIM, x - 1, y + 1, w + 2, h); r(TRIM, x, y, w, 1); r(WIN, x, y + 2, w, h - 2); r(WIN, x + 1, y + 1, w - 2, 1); r('#4a5262', x, y + 2, 1, h - 2); };
    const mortar = f => { for (let y = f.y + 3; y < f.y + f.h - 1; y += 4) r('#a39b89', f.x + 1, y, f.w - 1, 1); };
    const ivy = f => { for (let i = 0; i < f.w / 9; i++) { const x = f.x + 1 + Math.floor(rnd() * (f.w - 6)), y = f.y + f.h - 4 - Math.floor(rnd() * f.h * 0.6), w = 3 + Math.floor(rnd() * 6); r('#3f6a2e', x, y, w, 3 + Math.floor(rnd() * 5)); r('#5a8a3e', x + 1, y, Math.max(1, w - 2), 2); } };
    g.box(0, 4, 0, 360, 66, 6, { front: '#cfc8b6', top: '#ddd6c6', side: '#9a9284', line: '#2e2c2a' });
    // Wings: two floors of paired pointed windows, battlements on top.
    for (const wx of [22, 220]) {
      const f = g.box(wx, 16, 6, 118, 44, 50, F);
      mortar(f);
      for (let x = f.x + 6; x < f.x + f.w - 8; x += 14) { lancet(x, f.y + 8, 4, 13); lancet(x + 6, f.y + 8, 4, 13); lancet(x, f.y + 30, 4, 14); lancet(x + 6, f.y + 30, 4, 14); }
      r(TRIM, f.x + 1, f.y + 25, f.w - 1, 1);
      ivy(f);
      bMerlons(g, wx, 16, 56, 118, M);
    }
    // Slender turrets with pointed slate roofs where the wings meet the centre.
    for (const tx of [136, 224]) {
      g.cyl(tx, 12, 6, 6, 70, STONE);
      for (let z = 20; z < 70; z += 16) { const [sx, sy] = P(tx, 12, z); r(WIN, Math.round(sx) - 1, Math.round(sy) - 7, 2, 6); }
      bCone(g, tx, 12, 76, 8, 22, SLATE);
    }
    // Centre block and the great entrance tower.
    const c = g.box(140, 10, 6, 80, 48, 62, F);
    mortar(c);
    for (let x = c.x + 6; x < c.x + c.w - 6; x += 12) lancet(x, c.y + 10, 5, 16);
    bMerlons(g, 140, 10, 68, 80, M);
    const t = g.box(158, 4, 6, 44, 30, 96, M);
    mortar(t);
    r('#2e2c2a', t.x + 12, t.y + t.h - 34, 21, 34); r('#4a3020', t.x + 14, t.y + t.h - 31, 17, 31);
    for (let k = 0; k < 6; k++) r('#4a3020', t.x + 15 + k, t.y + t.h - 32 - Math.round(Math.sqrt(36 - (k - 3) ** 2) / 2), 1, 2);
    r('#6b4a32', t.x + 22, t.y + t.h - 30, 1, 30);
    lancet(t.x + 10, t.y + 26, 6, 18); lancet(t.x + 28, t.y + 26, 6, 18);
    r(TRIM, t.x + 16, t.y + 8, 12, 12); r(WIN, t.x + 17, t.y + 9, 10, 10); r(TRIM, t.x + 21, t.y + 9, 2, 10); r(TRIM, t.x + 17, t.y + 13, 10, 2);
    bMerlons(g, 158, 4, 102, 44, M);
    for (const [bx, by] of [[160, 6], [200, 6]]) { g.cyl(bx, by, 98, 4, 14, STONE); const [sx, sy] = P(bx, by, 112); r('#2e2c2a', Math.round(sx) - 5, Math.round(sy) - 4, 11, 4); r(TRIM, Math.round(sx) - 4, Math.round(sy) - 4, 9, 2); }
    ivy(t);
    // Octagonal towers at the ends, crenellated, with narrow windows.
    for (const tx of [14, 346]) {
      g.cyl(tx, 30, 6, 15, 74, STONE);
      for (let z = 14; z < 74; z += 20) { const [sx, sy] = P(tx, 30, z); lancet(Math.round(sx) - 2, Math.round(sy) - 14, 4, 12); }
      g.cyl(tx, 30, 80, 17, 5, STONE);
      const [sx, sy] = P(tx, 30, 85);
      for (let i = -16; i < 17; i += 6) g.c.clearRect(Math.round(sx + i), Math.round(sy) - 1, 3, 3);
    }
  });
}

// M. Chinnaswamy Stadium: an oval bowl of stands in red and gold, cantilever

// roofs with solar panels over the far side, four tall floodlight towers.
function bStadium3D() {
  const S = B_STADIUM, Hs = 34;
  const W0 = S.rx * 2 + 24, H0 = S.ry * 2 + Hs + 120;
  const cx = W0 / 2, cy = H0 - 6 - S.ry;
  let anchorName = null;
  const img = bcv(W0, H0, (r, c) => {
    const rnd = seeded(1974);
    const ell = (rx, ry, z, col) => { c.fillStyle = col; pixEllipse(c, cx, cy - z, Math.round(rx), Math.round(ry)); };
    const flood = (a, back) => {
      const x = Math.round(cx + Math.cos(a) * (S.rx + 4)), y = Math.round(cy + Math.sin(a) * (S.ry + 3));
      r('#2a2a2e', x - 2, y - 112, 4, 112); for (let k = y - 110; k < y; k += 6) r('#8a8f96', x - 1, k, 2, 1);
      r('#2a2a2e', x - 9, y - 124, 18, 14); r('#4a4f58', x - 8, y - 123, 16, 12);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) r('#fff6d8', x - 7 + j * 3, y - 122 + k * 4, 2, 2);
      void back;
    };
    flood(Math.PI * 1.25, true); flood(Math.PI * 1.75, true);
    // Seating tiers from the outside in, so the bowl reads from above.
    const N = 12;
    for (let k = N; k >= 0; k--) {
      const t = k / N;
      const rx = S.irx + (S.rx - S.irx) * t, ry = S.iry + (S.ry - S.iry) * t, z = 2 + (Hs - 2) * t;
      ell(rx + 1, ry + 1, z, '#3a3530');
      ell(rx, ry, z, k % 2 ? '#c0392b' : k % 3 === 0 ? '#c9a227' : '#a8312a');
    }
    // Crowd specks and aisles.
    for (let i = 0; i < 2600; i++) {
      const a = rnd() * Math.PI * 2, t = rnd();
      const rx = S.irx + (S.rx - S.irx) * t, ry = S.iry + (S.ry - S.iry) * t, z = 2 + (Hs - 2) * t;
      r(['#f1ead8', '#2b2220', '#f2c94c', '#5b8ee0', '#d8433b'][Math.floor(rnd() * 5)], Math.round(cx + Math.cos(a) * rx), Math.round(cy - z + Math.sin(a) * ry), 1, 1);
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) for (let t = 0; t <= 1; t += 0.03) {
      const rx = S.irx + (S.rx - S.irx) * t, ry = S.iry + (S.ry - S.iry) * t, z = 2 + (Hs - 2) * t;
      r('#d9d2c4', Math.round(cx + Math.cos(a) * rx), Math.round(cy - z + Math.sin(a) * ry), 1, 1);
    }
    // The field: mowed stripes, the boundary rope, the pitch.
    for (let dy = -S.iry + 2; dy <= S.iry - 2; dy++) {
      const half = Math.round((S.irx - 2) * Math.sqrt(1 - (dy / S.iry) ** 2));
      r(Math.floor((dy + S.iry) / 7) % 2 ? '#5fa040' : '#6aae49', cx - half, cy - 1 + dy, half * 2 + 1, 1);
    }
    for (let a = 0; a < Math.PI * 2; a += 0.01) r('#f4f1ea', Math.round(cx + Math.cos(a) * (S.irx - 10)), Math.round(cy - 1 + Math.sin(a) * (S.iry - 8)), 1, 1);
    r('#d6c08a', cx - 4, cy - 15, 9, 28); r('#ffffff', cx - 4, cy - 12, 9, 1); r('#ffffff', cx - 4, cy + 10, 9, 1);
    // Cantilever roofs over the far stands, covered in solar panels.
    for (let a = Math.PI * 1.08; a < Math.PI * 1.92; a += 0.004) {
      for (let t = 0.55; t <= 1.02; t += 0.02) {
        const rx = S.irx + (S.rx - S.irx) * t, ry = S.iry + (S.ry - S.iry) * t;
        const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy - Hs - 12 + Math.sin(a) * ry);
        const panel = Math.floor(a * 40) % 3 !== 0 && t > 0.62 && t < 0.97;
        r(panel ? (Math.floor(t * 30) % 2 ? '#2f4f8a' : '#3a5f9e') : '#e9eef2', x, y, 1, 1);
      }
      const x = Math.round(cx + Math.cos(a) * S.rx), y = Math.round(cy - Hs - 12 + Math.sin(a) * S.ry);
      r('#3a3530', x, y + 1, 1, 1);
      if (Math.floor(a * 60) % 7 === 0) r('#8a8f96', x, y + 1, 1, 12);
    }
    // The outer wall of the near stands, with gates.
    for (let x = -S.rx; x <= S.rx; x++) {
      const yb = Math.round(cy + S.ry * Math.sqrt(1 - (x / S.rx) ** 2));
      const nx = x / S.rx;
      const v = nx * LIGHT[0] + Math.sqrt(1 - nx * nx) * LIGHT[2] + 0.2;
      const ramp = ['#4a4740', '#6e6a62', '#8a857a', '#a8a294', '#c4bfb2', '#d9d4c8'];
      for (let z = 0; z < Hs; z++) r(rampAt(ramp, v, x + 400, z), cx + x, yb - z, 1, 1);
      r('#3a3530', cx + x, yb - Hs, 1, 1); r('#3a3530', cx + x, yb, 1, 1);
      if (Math.abs(x) % 34 < 7 && Math.abs(x) < S.rx - 12) for (let z = 1; z < 13; z++) r('#2b2620', cx + x, yb - z, 1, 1);
      if (Math.abs(x) % 34 >= 7 && z0band(x)) r('#c0392b', cx + x, yb - 20, 1, 3);
    }
    function z0band(x) { return Math.abs(x) < S.rx - 6; }
    anchorName = { x: cx, y: cy + S.ry - 26 };
    flood(Math.PI * 0.25, false); flood(Math.PI * 0.75, false);
  });
  img.fw = W0;
  img.anchors = { name: anchorName };
  return img;
}

// Kingfisher Towers: two tall white-framed glass towers on Kasturba Road;
// on top of the taller one, a white villa with columns in a rooftop garden.
function bKingfisher3D() {
  const W0 = 132, H0 = 262, OX = 8, OY = H0 - 6;
  const GLASS = '#7fa6c4', GL2 = '#a9c8dc', WH = '#eef1f3', WH2 = '#c9ced2';
  return b3dCanvas(W0, H0, OX, OY, g => {
    const { r } = g;
    const tower = (x, y, w, d, h) => {
      const f = g.box(x, y, 0, w, d, h, { front: GLASS, top: WH, side: '#5d84a6', line: '#22303f' });
      for (let yy = f.y + 3; yy < f.y + f.h - 2; yy += 5) { r(WH, f.x + 1, yy, f.w - 1, 1); r(WH2, f.x + 1, yy + 1, f.w - 1, 1); }
      for (let xx = f.x + 4; xx < f.x + f.w - 2; xx += 7) r(WH, xx, f.y + 1, 1, f.h - 2);
      for (let k = 0; k < 6; k++) r(GL2, f.x + 2 + k, f.y + 8 + k * 30, 1, 20);
      return f;
    };
    tower(52, 10, 34, 26, 176);
    const a = tower(4, 4, 36, 30, 204);
    // The rooftop garden and the villa.
    g.box(2, 2, 204, 40, 34, 3, { front: '#3f7a35', top: '#5a9a45', side: '#2f5a2a', line: '#1f3a1f' });
    const v = g.box(8, 10, 207, 26, 18, 13, { front: '#ffffff', top: '#e9e4dc', side: '#c9c2b6', line: '#3a3530' });
    for (let x = v.x + 2; x < v.x + v.w - 1; x += 4) r('#c9c2b6', x, v.y + 3, 1, v.h - 3);
    r('#3a3530', v.x - 1, v.y, v.w + 2, 1); r('#e9e4dc', v.x + 9, v.y - 4, 8, 4); r('#3a3530', v.x + 8, v.y - 5, 10, 1);
    for (const [tx, ty] of [[4, 6], [40, 6], [4, 32], [40, 32]]) { const [sx, sy] = g.P(tx, ty, 207); r('#2f5a2a', Math.round(sx) - 2, Math.round(sy) - 5, 5, 5); r('#5a9a45', Math.round(sx) - 1, Math.round(sy) - 5, 3, 3); }
    r('#3a3530', a.x + 10, a.y + a.h - 14, 16, 14); r('#ffd98a', a.x + 12, a.y + a.h - 12, 12, 10);
  });
}

// ISKCON Bengaluru on its hill: a cream temple with a tall gold-and-glass
// tower, smaller towers either side, and a long flight of granite steps.
function bIskcon3D() {
  const W0 = 196, H0 = 232, OX = 8, OY = H0 - 6;
  const GOLD = ['#5a3a10', '#8a5e1a', '#b8862a', '#e0b448', '#f6d878', '#fff2b8'];
  const CR = { front: '#f2e2b8', top: '#fbf0d4', side: '#c9b48a', line: '#4a3a24' };
  return b3dCanvas(W0, H0, OX, OY, g => {
    const { r, P } = g;
    // The hill and its steps.
    g.box(0, 0, 0, 176, 70, 20, { front: '#6a9a45', top: '#7fb44f', side: '#4f7a35', line: '#2f4a22' });
    for (let k = 0; k < 7; k++) g.box(70, -14 + k * 2, 0, 36, 2, 3 + k * 3, { front: k % 2 ? '#bdb5a5' : '#d3cbbb', top: '#e9e4dc', side: null, line: k ? null : '#3a3530' });
    // The temple hall with arches.
    const h = g.box(18, 16, 20, 140, 46, 34, CR);
    for (let x = h.x + 6; x < h.x + h.w - 6; x += 10) { r('#b8862a', x - 1, h.y + 10, 7, 20); r('#7a5a2a', x, h.y + 12, 5, 18); r('#7a5a2a', x + 1, h.y + 11, 3, 1); }
    r('#e0b448', h.x + 1, h.y + 3, h.w - 1, 2);
    // Side towers.
    for (const tx of [26, 128]) {
      for (let k = 0; k < 4; k++) g.box(tx + k * 2, 22 + k * 2, 54 + k * 10, 22 - k * 4, 22 - k * 4, 10, k % 2 ? { front: '#e0b448', top: '#f6d878', side: '#b8862a', line: '#5a3a10' } : CR);
      const [sx, sy] = P(tx + 11, 33, 94); r('#5a3a10', Math.round(sx) - 2, Math.round(sy) - 6, 5, 6); r('#f6d878', Math.round(sx) - 1, Math.round(sy) - 6, 3, 5);
    }
    // The main tower: tiers of gold glass narrowing to a kalasha.
    for (let k = 0; k < 9; k++) {
      const w = 46 - k * 4.4, x = 88 - w / 2, y = 26 + k * 2.2;
      const f = g.box(x, y, 54 + k * 14, w, w, 14, { front: k % 2 ? '#e0b448' : '#f2c95a', top: '#fff2b8', side: '#a8761e', line: '#5a3a10' });
      for (let xx = f.x + 2; xx < f.x + f.w - 1; xx += 4) r(k % 2 ? '#b8862a' : '#c99a3a', xx, f.y + 2, 1, f.h - 3);
      r('#fff6d0', f.x + 2, f.y + 2, 1, f.h - 4);
    }
    const [kx, ky] = P(88, 46, 180);
    g.dome(88, 46, 180, 6, 7, GOLD, 1);
    r('#5a3a10', Math.round(kx) - 1, Math.round(ky) - 18, 3, 6); r('#f6d878', Math.round(kx), Math.round(ky) - 18, 1, 5);
    r('#ee8b3a', Math.round(kx) + 1, Math.round(ky) - 22, 6, 3);
  });
}

// World Trade Center Bengaluru: a tall glass tower with a slanted crown.
function bWtc3D() {
  const W0 = 92, H0 = 270, OX = 6, OY = H0 - 6;
  return b3dCanvas(W0, H0, OX, OY, g => {
    const { r, P, c } = g;
    g.box(0, 0, 0, 62, 40, 14, { front: '#c9ced2', top: '#e9eef2', side: '#9aa0a8', line: '#22303f' });
    const f = g.box(8, 6, 14, 46, 32, 214, { front: '#3f6a8f', top: '#7fa6c4', side: '#2a4a68', line: '#14202c' });
    for (let y = f.y + 2; y < f.y + f.h; y += 4) r('#5a86ab', f.x + 1, y, f.w - 1, 1);
    for (let x = f.x + 5; x < f.x + f.w; x += 6) r('#2f5578', x, f.y + 1, 1, f.h - 2);
    for (let k = 0; k < 8; k++) r('#9cc4dc', f.x + 3 + k * 2, f.y + 20 + k * 22, 2, 18);
    // Slanted crown.
    polyFill(c, [P(8, 6, 228), P(54, 6, 228), P(54, 6, 252), P(8, 6, 236)], '#5a86ab');
    polyFill(c, [P(54, 6, 228), P(54, 38, 228), P(54, 38, 252), P(54, 6, 252)], '#2a4a68');
    polyFill(c, [P(8, 6, 236), P(54, 6, 252), P(54, 38, 252), P(8, 38, 236)], '#9cc4dc');
    pixLine(c, P(8, 6, 236), P(54, 6, 252), '#14202c'); pixLine(c, P(8, 6, 228), P(8, 6, 236), '#14202c');
  });
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
    // The right-hand wall is the end of the last run that is wider than a pole:
    // a flagstaff or a lamp post standing beside the building is not its wall.
    let xr = -1;
    for (let x = w - 1; x >= 0; x--) {
      if (!solid(x, y)) continue;
      let x0 = x;
      while (x0 > 0 && solid(x0 - 1, y)) x0--;
      if (x - x0 >= 3 || xr < 0 && x0 === 0) { xr = x; break; }
      if (xr < 0) xr = -2;
      x = x0;
    }
    if (xr === -2) for (let x = w - 1; x >= 0; x--) if (solid(x, y)) { xr = x; break; }
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
  out.anchors = src.anchors && Object.fromEntries(Object.entries(src.anchors).map(([k, a]) => [k, { ...a, y: a.y + dy }]));
  return out;
}

// Temple stone: weathered granite, lime-washed stucco, darker grey granite.
const B_STONE = { front: '#d3c7ad', top: '#ebe2cc', side: '#a39578', line: '#3d3428' };
const B_STUCCO = { front: '#ece0c2', top: '#f7efdc', side: '#c2b190', line: '#3d2a1e' };
const B_GRANITE = { front: '#bdb8ac', top: '#d9d5cb', side: '#8c877c', line: '#33302b' };

// A South Indian temple: a pillared hall on a plinth, a gopuram over its
// entrance and the vimana over the sanctum behind it. Options: w, d, hall
// height, gop (gopuram tiers) and gopW, vim (vimana tiers), steps, nandi,
// paint (coloured figures in the niches), stripes (red and white walls).
function bTemple3D(o) {
  const { w, d, pal } = o;
  const rnd = seeded(w * 7 + d * 3 + (o.gop || 0));
  const plinth = o.steps || 4;
  const gH = o.gop ? 11 + 8 * (o.gop - 1) + 16 : 0, vH = o.vim ? 9 + 6 * (o.vim - 1) + 22 : 0;
  const H = plinth + o.hall + Math.max(gH, vH);
  const img = b3dBlock(w, d, H, 4, g => {
    const { r } = g;
    const L = pal.line;
    const base = g.box(0, 0, 0, w, d, plinth, { front: shade(pal.side, 0.15), top: pal.top, side: shade(pal.side, -0.15), line: L });
    if (o.steps) for (let k = 0; k < plinth; k += 2) { r(L, base.x + w / 2 - 14 - k, base.y + k, 29 + k * 2, 1); r(pal.top, base.x + w / 2 - 13 - k, base.y + k + 1, 27 + k * 2, 1); }
    const hall = g.box(4, 6, plinth, w - 8, d - 10, o.hall, pal);
    r(L, hall.x + 1, hall.y + 3, hall.w - 1, 1);
    for (let x = hall.x + 2; x < hall.x + hall.w - 1; x += 5) { r(L, x, hall.y - 2, 3, 2); r(pal.top, x + 1, hall.y - 2, 1, 1); }
    const cx = hall.x + hall.w / 2;
    if (o.stripes) {
      for (let x = hall.x + 1; x < hall.x + hall.w; x++) r(((x - hall.x) >> 2) % 2 ? '#c8402f' : '#f7efdc', x, hall.y + 4, 1, hall.h - 5);
      r(L, cx - 6, hall.y + 6, 12, hall.h - 6); r('#2b2620', cx - 5, hall.y + 7, 10, hall.h - 7); r('#e6c15e', cx - 1, hall.y + 9, 2, 3);
    } else {
      // A row of square pillars in front of the dark hall.
      r('#2b2620', hall.x + 2, hall.y + 4, hall.w - 3, hall.h - 4);
      const door = o.nandi ? 14 : 7;
      for (let x = hall.x + 2; x < hall.x + hall.w - 2; x += 8) {
        if (Math.abs(x + 1 - cx) < door) continue;
        r(pal.front, x, hall.y + 4, 3, hall.h - 4); r(pal.top, x, hall.y + 4, 1, hall.h - 4); r(L, x + 3, hall.y + 4, 1, hall.h - 4);
        r(pal.top, x - 1, hall.y + 4, 5, 1); r(pal.top, x - 1, hall.y + hall.h - 2, 5, 1);
      }
      if (o.nandi) {
        // The great Nandi, black granite, seated and garlanded, filling the doorway.
        r(pal.top, cx - 13, hall.y + 4, 26, 2); r('#16100c', cx - 12, hall.y + 6, 24, hall.h - 6);
        const ny = hall.y + hall.h - 1;
        r('#0e0e11', cx - 10, ny - 9, 17, 9); r('#2a2c33', cx - 9, ny - 8, 15, 3); r('#3c3f48', cx - 8, ny - 8, 6, 1);
        r('#0e0e11', cx - 5, ny - 12, 7, 4); r('#2a2c33', cx - 4, ny - 11, 5, 2);
        r('#0e0e11', cx + 4, ny - 14, 7, 9); r('#2a2c33', cx + 5, ny - 13, 5, 6); r('#3c3f48', cx + 5, ny - 13, 1, 5);
        r('#cfc6b4', cx + 4, ny - 16, 1, 3); r('#cfc6b4', cx + 9, ny - 16, 1, 3);
        r('#ee8b3a', cx + 3, ny - 7, 9, 1); r('#f2c94c', cx + 4, ny - 6, 7, 1); r('#d8433b', cx - 2, ny - 9, 3, 1);
      } else { r('#3a2a20', cx - 5, hall.y + 5, 10, hall.h - 5); r('#e6c15e', cx - 1, hall.y + 7, 2, 2); }
    }
    if (o.vim) g.vimana(w * 0.68, d - 12, plinth + o.hall, 20, o.vim, pal);
    if (o.gop) g.gopuram(w / 2, 13, plinth + o.hall, o.gopW, 12, o.gop, pal, o.paint ? rnd : null);
    if (o.flagpost) {
      // The brass flagstaff (dhwaja stambha) in front of the gateway.
      const [fx, fy] = g.P(o.flagpost, 3, plinth);
      r('#4a3410', Math.round(fx) - 2, Math.round(fy) - 40, 4, 40); r('#d4a83a', Math.round(fx) - 1, Math.round(fy) - 40, 2, 39); r('#fff0a8', Math.round(fx) - 1, Math.round(fy) - 40, 1, 39);
      for (let k = 0; k < 40; k += 7) r('#7a5a1a', Math.round(fx) - 2, Math.round(fy) - 38 + k, 4, 1);
      r('#4a3410', Math.round(fx) - 4, Math.round(fy) - 44, 8, 4); r('#f0cc5c', Math.round(fx) - 3, Math.round(fy) - 43, 6, 2);
    }
  });
  return img;
}

// Details added after extrusion, so they stay flat: signs on posts and the like.
const B_DECOR = {
  // The round Hard Rock Cafe sign on its post, at the front corner.
  hardrock: (c, oy) => {
    const r = (col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    r('#2b2620', 89, oy + 40, 2, 44);
    for (let dy = -10; dy <= 10; dy++) for (let dx = -12; dx <= 12; dx++) {
      const d = Math.hypot(dx / 12, dy / 10);
      if (d <= 1) r(d > 0.86 ? '#2b2620' : d > 0.72 ? '#f2c94c' : '#c0392b', 82 + dx, oy + 30 + dy);
    }
  },
};

// How deep each kind of building is drawn, and where its domes start.
const B_DEPTH = {
  highcourt: [44], library: [30, 20], holidayinn: [40], ksr: [44], busstand: [40], freedom: [34, 6], townhall: [40],
  museum: [32], stmarks: [36, 32], ubcity: [56], krmarket: [26], fort: [18], tipu: [38],
  vidyarthi: [20], cinema: [28], mtr: [22], darshini: [14], complex: [32], bakery: [18],
  glasshouse: [44], grandstand: [30], stables: [22], toteboard: [6], hardrock: [30], orion: [36],
  gurudwara: [30, 32], mhouse: [16],
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

  // The Bangalore Turf Club grandstand: raked stands under a cantilevered
  // roof, a clock tower in the middle, and the members' enclosure in front.
  grandstand: () => bcv(232, 72, (r) => {
    const O = '#3a3530', RF = '#ece6da', RF2 = '#c7bfb0', crowd = ['#d8433b', '#f2c94c', '#5b8ee0', '#f1ead8', '#7cc35a', '#c3a0ec', '#2b2220'];
    const rnd = seeded(1920);
    // Clock tower.
    r(O, 100, 0, 32, 30); r('#efe6d2', 101, 1, 30, 29); r('#cfc4b2', 101, 1, 30, 2);
    r(O, 108, 6, 16, 16); r('#ffffff', 109, 7, 14, 14); r(O, 115, 9, 2, 6); r(O, 115, 14, 5, 2);
    // Roof on slender columns over the stands.
    r(O, 2, 20, 228, 9); r(RF, 3, 21, 226, 4); r(RF2, 3, 25, 226, 3);
    for (let x = 6; x < 226; x += 22) { r(O, x, 29, 2, 26); r('#8a8f96', x, 29, 1, 26); }
    // Tiers of seats with a racing crowd.
    r(O, 4, 30, 224, 26); r('#9a948a', 5, 31, 222, 24);
    for (let k = 0; k < 6; k++) {
      const y = 32 + k * 4;
      r('#b5ada0', 5, y, 222, 1);
      for (let x = 6; x < 226; x += 2) if (rnd() < 0.78) r(crowd[Math.floor(rnd() * crowd.length)], x, y + 1, 1, 2);
    }
    // Front wall of the enclosure, with the club's green and a rail.
    r(O, 4, 56, 224, 15); r('#2f6b3a', 5, 57, 222, 13); r('#3f8a4c', 5, 57, 222, 1);
    for (let x = 12; x < 222; x += 18) { r('#244f2c', x, 60, 8, 8); r('#ffd98a', x + 1, 61, 6, 6); }
    r('#f4f1ea', 0, 70, 232, 2);
  }),

  // The winning post on the home straight, with the judge's box.
  winpost: () => bcv(18, 40, (r) => {
    const O = '#2b2220';
    r(O, 0, 0, 14, 12); r('#f4f1ea', 1, 1, 12, 10); r('#3a4a58', 3, 3, 8, 5);
    r(O, 6, 12, 3, 28); r('#ffffff', 7, 12, 1, 28);
    for (let y = 14; y < 40; y += 6) r('#d8433b', 7, y, 1, 3);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.hypot(dx, dy) <= 4) r(Math.hypot(dx, dy) > 3 ? O : '#d8433b', 14 + dx, 17 + dy, 1, 1);
  }),

  // Starting stalls, parked by the back straight.
  startgate: () => bcv(74, 26, (r) => {
    const O = '#1f3a24';
    r(O, 0, 0, 74, 6); r('#3f8a4c', 1, 1, 72, 4);
    for (let x = 0; x < 74; x += 9) { r(O, x, 6, 2, 18); r('#7cc35a', x, 6, 1, 18); }
    for (let x = 2; x < 72; x += 9) { r('#d9d2c4', x, 9, 7, 1); r('#ffffff', x + 2, 2, 3, 3); }
    r(O, 0, 23, 74, 3);
  }),

  // The tote board in the infield, lit with the odds.
  toteboard: () => bcv(70, 44, (r) => {
    const O = '#1d1816';
    r(O, 4, 0, 62, 32); r('#2b2620', 5, 1, 60, 30); r('#f4f1ea', 5, 1, 60, 3);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) r((row + col) % 3 ? '#f2c94c' : '#ee8b3a', 8 + col * 8, 7 + row * 6, 5, 3);
    for (const x of [14, 54]) { r(O, x, 32, 3, 12); r('#8a8f96', x, 32, 1, 12); }
  }),

  // A row of stables with red tiled roofs and half doors.
  stables: () => bcv(110, 30, (r) => {
    const O = '#3a2a22';
    r(O, 0, 4, 110, 10); r('#b5553a', 1, 5, 108, 8); for (let y = 7; y < 13; y += 2) r('#8a3a28', 1, y, 108, 1);
    r(O, 2, 14, 106, 16); r('#efe2c0', 3, 15, 104, 14);
    for (let x = 6; x < 104; x += 13) { r(O, x, 17, 8, 12); r('#6b4a32', x + 1, 18, 6, 5); r('#3a2618', x + 1, 23, 6, 6); }
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

  // A small temple with a painted gopuram, red and white stripes below.
  temple: () => bTemple3D({ w: 50, d: 24, hall: 14, gop: 4, gopW: 30, vim: 0, pal: B_STUCCO, paint: true, stripes: true }),

  statue: () => bcv(12, 24, (r) => {
    r('#3a3530', 1, 16, 10, 8); r('#cfc4b2', 2, 17, 8, 6);
    r('#3a3530', 3, 3, 6, 14); r('#7d8a6a', 4, 4, 4, 12); r('#9aa886', 4, 4, 1, 12); r('#3a3530', 4, 0, 4, 4); r('#7d8a6a', 5, 1, 2, 2);
  }),

  lamp: () => bcv(8, 26, (r) => {
    r('#2a2a2e', 3, 4, 2, 22); r('#2a2a2e', 1, 2, 6, 3); r('#fff3c8', 2, 3, 4, 1);
  }),

  bench: () => bcv(16, 9, (r) => {
    r('#3d2a1e', 0, 0, 16, 7); r('#9a6a45', 1, 1, 14, 2); r('#b5824a', 1, 4, 14, 2); r('#3d2a1e', 1, 7, 2, 2); r('#3d2a1e', 13, 7, 2, 2);
  }),

  // Bangalore Palace: Tudor Revival, granite with battlements, turrets with
  // slate spires, pointed Gothic windows and ivy on the walls.
  palace: () => bPalace3D(),
  stadium: () => bStadium3D(),
  kingfisher: () => bKingfisher3D(),
  iskcon: () => bIskcon3D(),
  wtc: () => bWtc3D(),

  // Orion Mall: a long glass front under a white frame, with its sign.
  orion: () => { const cv = bcv(150, 64, (r) => {
    const O = '#22303f';
    r(O, 2, 8, 146, 55); r('#eef1f3', 3, 9, 144, 53);
    r(O, 2, 2, 146, 8); r('#2f6db0', 3, 3, 144, 6);
    for (let y = 14; y < 58; y++) for (let x = 6; x < 144; x++) if ((x - 6) % 10 && (y - 14) % 12) r((x + y) % 19 < 3 ? '#cfe3ee' : y > 44 ? '#ffd98a' : '#8fb4cc', x, y);
    r(O, 58, 40, 34, 22); r('#2b3a48', 59, 41, 32, 21); r('#ffd98a', 62, 44, 12, 18); r('#ffd98a', 76, 44, 12, 18);
  }); cv.anchors = { sign: { x: 75, y: 6 } }; return cv; },

  // Hard Rock Cafe on St. Mark's Road: a restored grey stone building with a
  // gabled roof, pointed windows, a guitar over the door and the round sign.
  hardrock: () => { const cv = bcv(96, 84, (r) => {
    const O = '#2b2620', ST = '#9a948a', ST2 = '#7d776e', ST3 = '#b5afa3';
    // Gabled roof.
    for (let y = 2; y < 26; y++) { const half = Math.round((y - 2) * 1.9) + 4; r(O, 48 - half - 1, y + 8, half * 2 + 2, 1); r(y % 3 ? '#5a3a2e' : '#4a2e24', 48 - half, y + 8, half * 2, 1); }
    r(O, 4, 33, 88, 50); r(ST, 5, 34, 86, 48);
    for (let y = 37; y < 80; y += 4) for (let x = 5 + ((y >> 2) % 2) * 5; x < 90; x += 10) { r(ST2, x, y, 9, 1); r(ST3, x, y - 1, 9, 1); }
    for (const x of [12, 26, 62, 76]) { r(O, x - 1, 44, 8, 22); r('#ffd98a', x, 47, 6, 18); r('#ffd98a', x + 1, 46, 4, 1); r(O, x + 2, 47, 1, 18); }
    r(O, 40, 54, 16, 28); r('#3a2418', 41, 56, 14, 26); r('#ffd98a', 42, 58, 12, 8);
    // Guitar over the door.
    r(O, 46, 36, 4, 6); r('#c0392b', 47, 37, 2, 4); r(O, 47, 28, 2, 9); r('#d9c7a2', 47, 29, 1, 8); r(O, 44, 42, 8, 8); r('#c0392b', 45, 43, 6, 6); r('#2b2220', 47, 45, 2, 2);
  }); cv.anchors = { sign: { x: 82, y: 30 } }; return cv; },

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
    r(O, 124, 1, 52, 6); r(RB, 125, 2, 50, 4); r('#a84a36', 125, 2, 50, 1);
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

  // Dodda Basavana Gudi: a granite hall on a plinth with the black Nandi
  // looking out of its door, a small gopuram over the entrance and the
  // shrine's tower behind.
  bulltemple: () => bTemple3D({ w: 96, d: 44, hall: 26, gop: 3, gopW: 40, vim: 3, nandi: true, pal: B_STONE }),

  // Kadu Malleshwara: steps up to a stone gopuram, the shrine tower behind.
  malleshwara: () => bTemple3D({ w: 88, d: 40, hall: 20, gop: 5, gopW: 46, vim: 3, steps: 6, pal: B_STONE, paint: false }),

  // Someshwara Temple, Halasuru: a tall granite gopuram from Vijayanagara
  // times, the shrine behind it and the brass flagstaff in front.
  someshwara: () => bTemple3D({ w: 96, d: 44, hall: 18, gop: 7, gopW: 50, vim: 3, steps: 4, pal: B_GRANITE, flagpost: 18 }),

  // St. Mary's Basilica, Shivajinagar: neo-Gothic, a tall spire over the
  // west door, lancet windows and pinnacles along the aisles.
  stmarys: () => b3dBlock(104, 52, 132, 4, g => {
    const { r, P } = g;
    const W = { front: '#efe7d8', top: '#fbf7ee', side: '#c4b8a3', line: '#3a3530' };
    const SL = ['#24272c', '#3a3f47', '#525861', '#6c737d', '#8f969f', '#b9bec4'];
    const lancet = (x, y, w, h) => { r('#3a3530', x - 1, y + 1, w + 2, h); r('#3a3530', x, y, w, 1); r('#33467a', x, y + 1, w, h - 1); r('#d8433b', x + 1, y + 3, 1, 1); r('#f2c94c', x + w - 2, y + 5, 1, 1); r('#5b8ee0', x, y + 1, 1, h - 2); };
    const nave = g.box(4, 14, 0, 96, 38, 34, W);
    g.prism(4, 14, 34, 96, 14, 38, (u, v) => v < 14 - Math.abs(u - 47.5) * 14 / 48, { front: W.front, top: '#9aa0a8', side: '#7d838c', line: W.line });
    for (let x = nave.x + 4; x < nave.x + nave.w - 4; x += 10) { if (Math.abs(x - nave.x - 46) < 18) continue; lancet(x, nave.y + 8, 4, 14); r(W.side, x + 6, nave.y + 2, 2, nave.h - 2); }
    for (const px of [0, 32, 64, 96]) { const [sx, sy] = P(4 + px, 14, 34); r('#3a3530', Math.round(sx) - 1, Math.round(sy) - 9, 3, 9); r(W.top, Math.round(sx), Math.round(sy) - 8, 1, 7); }
    // The tower: door, rose window, belfry, then the slate spire.
    const tw = g.box(38, 4, 0, 28, 26, 74, W);
    const cx = tw.x + 14;
    r('#3a3530', cx - 6, tw.y + tw.h - 22, 12, 22); r('#3a3530', cx - 5, tw.y + tw.h - 24, 10, 2); r('#5a3a2a', cx - 5, tw.y + tw.h - 21, 10, 21); r('#7a4a2a', cx, tw.y + tw.h - 21, 1, 21);
    for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) { const dd = Math.hypot(xx, yy); if (dd <= 5.4) r(dd > 4.4 ? '#3a3530' : (Math.round(Math.atan2(yy, xx) * 3) & 1) ? '#d8433b' : '#33467a', cx + xx, tw.y + 30 + yy, 1, 1); }
    lancet(cx - 6, tw.y + 8, 4, 12); lancet(cx + 3, tw.y + 8, 4, 12);
    for (const [px, py] of [[38, 4], [66, 4]]) { const [sx, sy] = P(px, py, 74); r('#3a3530', Math.round(sx) - 1, Math.round(sy) - 12, 3, 12); r(W.top, Math.round(sx), Math.round(sy) - 11, 1, 10); }
    const [sx0, sy0] = P(52, 17, 74);
    for (let k = 0; k < 52; k++) {
      const half = Math.round(12 * (1 - k / 52)), X = Math.round(sx0), Y = Math.round(sy0) - k;
      r('#24272c', X - half - 1, Y, half * 2 + 3, 1);
      for (let i = -half; i <= half; i++) r(rampAt(SL, 0.7 - (i / Math.max(1, half)) * 0.45 + (k % 6 === 0 ? -0.15 : 0), i + 64, k), X + i, Y, 1, 1);
    }
    r('#3a3530', Math.round(sx0), Math.round(sy0) - 60, 1, 8); r('#3a3530', Math.round(sx0) - 2, Math.round(sy0) - 57, 5, 1);
  }),

  // Russell Market (1927): a stone hall with a tall arched gateway, piled
  // with fruit and vegetables.
  russell: () => bSigned(sign => b3dBlock(132, 46, 56, 4, g => {
    const { r } = g;
    const S = { front: '#cbb48c', top: '#e4d3b2', side: '#9c8662', line: '#3a2a1a' };
    const hall = g.box(0, 8, 0, 132, 38, 24, S);
    g.roof(0, 8, 24, 132, 38, 12, '#a8553a', '#3a2a1a');
    const rnd = seeded(1927);
    const piles = ['#ee8b3a', '#f2c94c', '#7cc35a', '#d8433b', '#3f8a3c', '#c3a0ec', '#f4f1ea'];
    for (let x = hall.x + 4; x < hall.x + hall.w - 10; x += 14) {
      if (Math.abs(x + 5 - (hall.x + 66)) < 22) continue;
      r('#3a2a1a', x, hall.y + 5, 10, hall.h - 5); r('#2b2014', x + 1, hall.y + 6, 8, hall.h - 6); r('#3a2a1a', x + 1, hall.y + 4, 8, 1);
      for (let k = 0; k < 12; k++) r(piles[Math.floor(rnd() * piles.length)], x + 1 + Math.floor(rnd() * 7), hall.y + hall.h - 6 + Math.floor(rnd() * 4), 2, 2);
    }
    const gate = g.box(46, 0, 0, 40, 12, 44, S);
    r('#3a2a1a', gate.x + 9, gate.y + 16, 22, 28); r('#2b2014', gate.x + 10, gate.y + 18, 20, 26);
    for (let dy = 0; dy < 7; dy++) { const half = Math.round(10 * Math.sqrt(1 - (dy / 7) ** 2)); r('#3a2a1a', gate.x + 20 - half, gate.y + 17 - dy, half * 2, 1); r('#2b2014', gate.x + 21 - half, gate.y + 18 - dy, half * 2 - 2, 1); }
    for (let k = 0; k < 14; k++) r(piles[Math.floor(rnd() * piles.length)], gate.x + 11 + Math.floor(rnd() * 17), gate.y + 38 + Math.floor(rnd() * 5), 2, 2);
    r('#3a2a1a', gate.x + 1, gate.y + 3, 39, 9); r('#7a2b25', gate.x + 2, gate.y + 4, 37, 7);
    sign({ x: gate.x + 20.5, y: gate.y + 7.5, w: 36 });
    for (const x of [gate.x - 1, gate.x + 36]) { r('#3a2a1a', x, gate.y - 6, 5, 6); r(S.top, x + 1, gate.y - 5, 3, 5); r('#3a2a1a', x + 2, gate.y - 8, 1, 2); }
  })),

  // Bengaluru Cantonment station: a long colonial building under tiles with
  // a gabled porch, and the platform canopy behind.
  cantonment: () => bSigned(sign => b3dBlock(150, 44, 46, 4, g => {
    const { r } = g;
    const C = { front: '#efe0bf', top: '#f7ecd4', side: '#c4b08a', line: '#3a2a22' };
    g.box(0, 26, 0, 150, 14, 18, { front: '#9aa0a6', top: '#c9ced2', side: '#6e7378', line: '#2f2a24' });
    const b = g.box(4, 8, 0, 142, 26, 22, C);
    g.roof(4, 8, 22, 142, 26, 12, '#b5553a', '#3a2a22');
    r('#8a3a2a', b.x + 1, b.y + b.h - 6, b.w - 1, 5);
    for (let x = b.x + 6; x < b.x + b.w - 6; x += 10) { if (Math.abs(x + 3 - (b.x + 71)) < 16) continue; archWindow(r, x, b.y + 5, 6, 10, '#c4b08a', '#3a3f4a'); }
    const p = g.box(56, 0, 0, 38, 10, 28, C);
    g.prism(56, 0, 28, 38, 12, 10, (u, v) => v < 12 - Math.abs(u - 18.5) * 12 / 19, { front: C.front, top: '#b5553a', side: '#8a3a28', line: C.line });
    r('#3a2a22', b.x + 2, b.y + 1, 56, 7); r('#8a3a2a', b.x + 3, b.y + 2, 54, 5);
    sign({ x: b.x + 30, y: b.y + 4.5, w: 52 });
    r('#3a2a22', p.x + 6, p.y + 4, 27, 8); r('#e9e4dc', p.x + 7, p.y + 5, 25, 6); r('#3a2a22', p.x + 19, p.y + 6, 1, 3); r('#3a2a22', p.x + 19, p.y + 8, 3, 1);
    r('#3a2a22', p.x + 12, p.y + 14, 14, 14); r('#4a3020', p.x + 13, p.y + 15, 12, 13); r('#ffd98a', p.x + 15, p.y + 18, 8, 5);
    for (let dy = 0; dy < 5; dy++) { const [sx, sy] = g.P(75, 0, 28 + dy); r('#ffffff', Math.round(sx) - 2, Math.round(sy) - 6, 5, 1); }
  })),

  // Gavi Gangadhareshwara: a cave temple cut into a granite outcrop. In the
  // forecourt stand two giant stone discs, the sun and the moon.
  gavi: () => b3dBlock(124, 50, 62, 4, g => {
    const { r } = g;
    const rnd = seeded(1536);
    const RK = { front: '#a8a397', top: '#c7c3b8', side: '#7f7a70', line: '#33302b' };
    g.prism(0, 22, 0, 124, 44, 26, (u, v) => v < 44 * Math.sqrt(Math.max(0, 1 - ((u - 62) / 63) ** 2)) * (0.92 + Math.sin(u * 0.4) * 0.05), RK);
    for (let i = 0; i < 40; i++) { const [sx, sy] = g.P(10 + rnd() * 104, 22, 4 + rnd() * 30); r('#8f8a7f', Math.round(sx), Math.round(sy), 2 + Math.floor(rnd() * 3), 1); }
    const [cx, cy] = g.P(62, 22, 0);
    r('#33302b', Math.round(cx) - 16, Math.round(cy) - 22, 32, 22); r('#1a1714', Math.round(cx) - 15, Math.round(cy) - 21, 30, 21);
    for (const px of [-12, -4, 4, 12]) { r('#bdb8ac', Math.round(cx) + px - 1, Math.round(cy) - 18, 3, 18); r('#33302b', Math.round(cx) + px + 2, Math.round(cy) - 18, 1, 18); }
    r('#ffd98a', Math.round(cx) - 1, Math.round(cy) - 12, 2, 3);
    g.box(0, 0, 0, 124, 22, 3, { front: '#bdb5a5', top: '#d9d2c4', side: '#9a9282', line: '#33302b' });
    for (const [px, rad] of [[24, 11], [100, 11]]) {
      g.box(px - 3, 8, 3, 6, 6, 18, { front: '#c7c3b8', top: '#e0ddd5', side: '#9a958a', line: '#33302b' });
      const [dx, dy] = g.P(px, 11, 21 + rad);
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) {
        const dd = Math.hypot(xx, yy);
        if (dd > rad + 0.4) continue;
        r(dd > rad - 1 ? '#33302b' : dd > rad - 3 ? '#9a958a' : (xx + yy) < 0 ? '#d9d5cb' : '#bdb8ac', Math.round(dx) + xx, Math.round(dy) + yy, 1, 1);
      }
    }
    for (const px of [50, 74]) { const [sx, sy] = g.P(px, 6, 3); r('#33302b', Math.round(sx) - 1, Math.round(sy) - 20, 3, 20); r('#c7c3b8', Math.round(sx), Math.round(sy) - 19, 1, 18); }
    { const [sx, sy] = g.P(50, 6, 23); r('#33302b', Math.round(sx) - 3, Math.round(sy) - 5, 7, 2); r('#33302b', Math.round(sx) - 3, Math.round(sy) - 8, 1, 4); r('#33302b', Math.round(sx) + 3, Math.round(sy) - 8, 1, 4); r('#33302b', Math.round(sx), Math.round(sy) - 9, 1, 5); }
    { const [sx, sy] = g.P(74, 6, 23); r('#33302b', Math.round(sx) - 3, Math.round(sy) - 7, 7, 3); r('#33302b', Math.round(sx) - 1, Math.round(sy) - 5, 3, 1); r('#c7c3b8', Math.round(sx) - 2, Math.round(sy) - 6, 5, 1); }
  }),

  // Mayo Hall (1883): two storeys of round arches, a balustrade and a pediment.
  mayohall: () => b3dBlock(118, 40, 58, 4, g => {
    const { r } = g;
    const M = { front: '#f1e8d6', top: '#fbf6ea', side: '#c8bca4', line: '#3a3530' };
    const f = g.box(0, 0, 0, 118, 40, 46, M);
    for (const [y0, h] of [[f.y + 8, 14], [f.y + 28, 14]]) for (let x = f.x + 5; x < f.x + f.w - 6; x += 11) { r(M.side, x - 2, y0 - 1, 1, h + 2); if (Math.abs(x + 3 - (f.x + 59)) < 8 && y0 > f.y + 20) continue; archWindow(r, x, y0, 6, h, '#b8ab90', '#4a5260'); r('#ffffff', x + 2, y0 - 2, 2, 1); }
    r(M.side, f.x + 1, f.y + 24, f.w - 1, 2); r('#ffffff', f.x + 1, f.y + 24, f.w - 1, 1);
    r('#3a3530', f.x + 53, f.y + 30, 13, 16); r('#5a3a2a', f.x + 54, f.y + 31, 11, 15);
    for (let x = f.x + 2; x < f.x + f.w; x += 3) r(M.top, x, f.y - 4, 2, 4);
    r('#3a3530', f.x, f.y - 5, f.w + 1, 1);
    g.prism(39, 0, 46, 40, 13, 6, (u, v) => v < 13 - Math.abs(u - 19.5) * 13 / 20, { front: '#e0d2b4', top: '#f6efe0', side: M.side, line: M.line });
    { const [px, py] = g.P(59, 0, 50); r('#3a3530', Math.round(px) - 2, Math.round(py) - 2, 5, 5); r('#ffffff', Math.round(px) - 1, Math.round(py) - 1, 3, 3); }
  }),

  // Government Museum (1877): red walls, white columns and a pediment, like
  // its neighbours in Cubbon Park.
  govmuseum: () => b3dBlock(126, 40, 56, 4, g => {
    const { r } = g;
    const RD = { front: '#b8483d', top: '#d06a5c', side: '#8a3530', line: '#3d2724' };
    const WH = '#f1e9dc';
    const f = g.box(0, 6, 0, 126, 34, 36, RD);
    r(WH, f.x + 1, f.y + 1, f.w - 1, 3); r(WH, f.x + 1, f.y + 18, f.w - 1, 2);
    for (let x = f.x + 6; x < f.x + f.w - 6; x += 12) { if (Math.abs(x - f.x - 60) < 22) continue; archWindow(r, x, f.y + 7, 6, 9, WH, '#3a2f2f'); archWindow(r, x, f.y + 23, 6, 10, WH, '#3a2f2f'); }
    const p = g.box(38, 0, 0, 50, 8, 40, { front: '#9a3a30', top: '#d06a5c', side: '#7a2a25', line: '#3d2724' });
    for (let i = 0; i < 6; i++) { const x = p.x + 3 + i * 9; r('#3d2724', x - 1, p.y + 2, 5, p.h - 2); r(WH, x, p.y + 3, 3, p.h - 3); r('#ffffff', x, p.y + 3, 1, p.h - 3); r(WH, x - 1, p.y + 2, 5, 2); }
    g.prism(36, 0, 40, 54, 12, 8, (u, v) => v < 12 - Math.abs(u - 26.5) * 12 / 27, { front: WH, top: '#d06a5c', side: '#8a3530', line: '#3d2724' });
  }),

  // Jawaharlal Nehru Planetarium: a white dome on a round hall.
  planetarium: () => bSigned(sign => b3dBlock(70, 36, 52, 4, g => {
    const { r } = g;
    const WH = ['#3a3530', '#9c968a', '#c9c4b8', '#e4e0d6', '#f4f1ea', '#ffffff'];
    g.box(0, 0, 0, 70, 36, 4, { front: '#c9c2b6', top: '#e9e4dc', side: '#9a9282', line: '#3a3530' });
    g.cyl(35, 18, 4, 30, 18, WH);
    g.dome(35, 18, 22, 31, 24, WH, 0, '#3a3530');
    const [sx, sy] = g.P(35, 0, 4);
    r('#3a3530', Math.round(sx) - 22, Math.round(sy) - 16, 44, 9); r('#2f4f8a', Math.round(sx) - 21, Math.round(sy) - 15, 42, 7);
    sign({ x: Math.round(sx), y: Math.round(sy) - 11.5, w: 40 });
    r('#3a3530', Math.round(sx) - 6, Math.round(sy) - 6, 12, 6); r('#5a3a2a', Math.round(sx) - 5, Math.round(sy) - 5, 10, 5);
    for (const k of [-1, 0, 1]) { const [tx, ty] = g.P(35 + k * 9, 18, 46 - Math.abs(k) * 4); r('#f2c94c', Math.round(tx), Math.round(ty), 1, 1); }
  })),

  // A tiffin room in an old tiled house: CTR in Malleswaram, and its cousins.
  tiffin: () => bSigned(sign => b3dBlock(70, 30, 34, 4, g => {
    const { r } = g;
    const C = { front: '#f2e6c8', top: '#fbf3e0', side: '#c9b88e', line: '#3d2a1e' };
    const f = g.box(0, 0, 0, 70, 30, 20, C);
    g.roof(0, 0, 20, 70, 30, 12, '#b5553a', '#3d2a1e');
    r('#3d2a1e', f.x + 10, f.y + 1, f.w - 19, 7); r('#2f6b3a', f.x + 11, f.y + 2, f.w - 21, 5);
    sign({ x: f.x + f.w / 2, y: f.y + 4.5, w: f.w - 23 });
    r('#3d2a1e', f.x + 4, f.y + 9, f.w - 7, 11); r('#2b2014', f.x + 5, f.y + 10, f.w - 9, 10);
    for (let x = f.x + 7; x < f.x + f.w - 6; x += 9) { r('#8a5a3a', x, f.y + 15, 6, 2); r('#f4f1ea', x + 1, f.y + 13, 2, 2); r('#e6c15e', x + 3, f.y + 13, 2, 2); }
    for (let x = f.x + 4; x < f.x + f.w - 3; x += 12) r('#6b4a32', x, f.y + 9, 2, 11);
  })),

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
    for (let x = 3; x < 108; x += 5) { r('#ffe08a', x, 3, 2, 1); r('#ffe08a', x, 14, 2, 1); }
    r(O, 30, 24, 50, 30); r('#2f4f8a', 31, 25, 48, 28); r('#f2c94c', 35, 30, 12, 12); r('#d8433b', 52, 30, 22, 6); r('#ffffff', 52, 40, 16, 3);
    r(O, 34, 60, 42, 22); r('#3a2a20', 35, 61, 40, 21); r('#ffd98a', 38, 64, 34, 4);
  }),

  // Koramangala: glass offices and apartment blocks with water tanks.
  office0: () => bOffice3D('#7fb3c4', '#4f7f94', 84, 112, 0),
  office1: () => bOffice3D('#8fc0a8', '#5a8a76', 78, 96, 1),
  office2: () => bOffice3D('#a6b4d4', '#6a789e', 88, 124, 2),
  apartment0: () => bApartment3D('#f2d7b8', 0),
  apartment1: () => bApartment3D('#dfe6ea', 1),
  apartment2: () => bApartment3D('#f0c9b0', 2),

  // Silk Board: a flyover over the junction.
  flyover: () => bcv(320, 64, (r) => {
    const O = '#2f2f33';
    r(O, 0, 8, 320, 16); r('#b3ada0', 1, 9, 318, 9); r('#8a857a', 1, 18, 318, 5);
    for (let x = 0; x < 320; x += 14) r('#ece6d4', x, 13, 7, 1);
    for (let x = 24; x < 320; x += 60) { r(O, x, 24, 12, 40); r('#a39b8a', x + 1, 24, 10, 40); r('#c9c2b6', x + 1, 24, 3, 40); }
    r(O, 120, 0, 80, 9); r('#2f6b3a', 121, 1, 78, 7);
  }),

  // The way down to an underground station: a glass canopy over the stairs
  // and a totem with the Namma Metro sign.
  entrance: (col) => b3dBlock(26, 14, 20, 6, g => {
    const { r, P } = g;
    g.box(0, 0, 0, 26, 14, 2, { front: '#bdb5a5', top: '#d9d2c4', side: '#9a9282', line: '#3a3530' });
    polyFill(g.c, [P(4, 2, 2), P(18, 2, 2), P(18, 12, 2), P(4, 12, 2)], '#2b2620');
    for (let k = 0; k < 5; k++) { const [sx, sy] = P(5, 3 + k * 2, 2); r('#8a857a', Math.round(sx), Math.round(sy), 13, 1); }
    for (const px of [3, 19]) { const [sx, sy] = P(px, 1, 2); r('#4a4f58', Math.round(sx), Math.round(sy) - 13, 1, 13); }
    g.box(1, -1, 15, 22, 15, 2, { front: col, top: '#cfe6ee', side: shade(col, -0.35), line: '#2b2620' });
    const t = g.box(22, 2, 2, 3, 3, 16, { front: '#3a3530', top: '#5d6369', side: '#2b2620', line: '#1d1816' });
    r(col, t.x, t.y + 1, 4, 5); r('#ffffff', t.x + 1, t.y + 2, 2, 3);
  }),

  // An auto stand: a parked auto-rickshaw under a black and yellow board.
  autostand: () => bcv(40, 30, (r) => {
    r('#2b2220', 32, 4, 2, 26); r('#1d1816', 25, 0, 15, 8); r('#f2c94c', 26, 1, 13, 6); r('#1d1816', 28, 3, 9, 2);
    r('#2b2220', 2, 12, 22, 14); r('#f0c419', 3, 13, 20, 6); r('#ffe27a', 3, 13, 20, 1); r('#2e7d32', 3, 19, 20, 6);
    r('#9cc4dc', 16, 14, 6, 5); r('#1d1816', 12, 14, 3, 11); r('#fff3c8', 22, 20, 2, 2);
    r('#1d1816', 4, 25, 5, 5); r('#1d1816', 17, 25, 5, 5); r('#5d6369', 5, 26, 3, 3); r('#5d6369', 18, 26, 3, 3);
  }),

  // A hawker's stall under a big umbrella, piled with flowers, fruit or vegetables.
  stall: (kind) => bcv(26, 26, (r) => {
    const goods = [['#f2c94c', '#ee8b3a', '#ffffff', '#d8433b'], ['#d8433b', '#7cc35a', '#f2c94c', '#ee8b3a'], ['#3f8a3c', '#7cc35a', '#c3a0ec', '#d8433b']][kind % 3];
    const top = ['#d8433b', '#2f6db0', '#2f8a3a'][kind % 3];
    r('#3a3530', 12, 6, 2, 12);
    for (let k = 0; k < 6; k++) { const half = 3 + k * 2; r('#1d1816', 13 - half - 1, k, half * 2 + 2, 1); r(k % 2 ? top : shade(top, 0.25), 13 - half, k, half * 2, 1); }
    r('#1d1816', 2, 15, 22, 8); r('#8a5a3a', 3, 16, 20, 6); r('#b5824a', 3, 16, 20, 1);
    for (let x = 4; x < 22; x += 2) r(goods[(x >> 1) % 4], x, 13 + ((x >> 1) % 2), 2, 3);
    r('#1d1816', 4, 22, 3, 4); r('#1d1816', 19, 22, 3, 4);
  }),

  // A level-crossing barrier, raised.
  boom: () => bcv(30, 24, (r) => {
    r('#2b2220', 2, 8, 4, 16); r('#d9d2c4', 3, 9, 2, 14);
    for (let i = 0; i < 24; i++) { const x = 4 + i, y = 9 - Math.round(i * 0.35); r(((i >> 2) % 2) ? '#ffffff' : '#d8433b', x, y, 1, 2); }
    r('#2b2220', 0, 6, 8, 3); r('#d8433b', 1, 7, 2, 1);
  }),

  stairs: (col) => bcv(14, 18, (r) => {
    r('#3a3530', 2, 0, 10, 18); for (let y = 1; y < 18; y += 3) { r('#c9c2b6', 3, y, 8, 2); r('#a39b8a', 3, y + 2, 8, 1); }
    r('#3a3530', 0, 0, 4, 6); r(col, 1, 1, 2, 4);
  }),
};

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

