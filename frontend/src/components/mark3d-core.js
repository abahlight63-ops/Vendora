// ── frontend/src/components/mark3d-core.js ─────────────────────────
// WHAT: the welcome scene — the brand mark as a real 3D object, with the sales
// channels orbiting it. Plain canvas maths, no framework and no 3D library, so
// it weighs a few KB and runs on cheap phones.
//
// WHY NOT A MODEL FILE: the mark is three triangles. Extruding them keeps the
// exact logo geometry, stays sharp at any size and can come apart for real.
//
// PARITY: mobile/lib/widgets/mark_3d.dart draws the same scene from the same
// numbers. If a value in SCENE changes, change it there too.

export const SCENE = {
  depth: 120, // extrusion, in artwork units (the mark is 602 x 696)
  focal: 1800, // camera distance: smaller = stronger perspective
  orbitRadius: 510,
  orbitTilt: 0.52, // the ring's pitch toward the viewer
  orbitRoll: -0.22,
  orbitPeriod: 14, // seconds per lap
  tile: 190, // channel tile size
  tileMaxScale: 1.16, // the front of the orbit must not swallow the logo
  sway: 0.34,
  stillYaw: -0.38,
  stillPitch: -0.14,
  stillOrbit: 0.62, // reduced motion: an angle where every tile is visible
};

const PIECES = [
  { v: [[301, 0], [602, 189], [0, 189]], dx: 0, dy: -190, rot: -17, ramp: ['#ffb199', '#ff7650', '#d03c16'], side: ['#6b1d08', '#d03c16'] },
  { v: [[0, 189], [0, 513], [301, 696]], dx: -185, dy: 80, rot: 15, ramp: ['#9c8ffa', '#5b4bd6', '#3b2e9e'], side: ['#1f1659', '#6d5bf6'] },
  { v: [[602, 189], [602, 513], [301, 696]], dx: 185, dy: 80, rot: -15, ramp: ['#ff8a6b', '#b44ba0', '#4f3fc7'], side: ['#4a1d5e', '#b44ba0'] },
];

export const CHANNELS = [
  { id: 'whatsapp', from: '#3DDC84', to: '#1FAF5A', side: '#0F6F38' },
  { id: 'telegram', from: '#37B7F3', to: '#1F8AC0', side: '#125E85' },
  { id: 'instagram', from: '#F9CE34', mid: '#EE2A7B', to: '#6228D7', side: '#3D1590', tag: 'soon' },
];

const LIGHT = norm([-0.45, -0.65, -0.62]);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeBack = (x) => { const c = 1.45; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function mean(pts) {
  const n = pts.length;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n, pts.reduce((s, p) => s + p[2], 0) / n];
}

function rotate(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x = p[0] * cy + p[2] * sy;
  const z = -p[0] * sy + p[2] * cy;
  return [x, p[1] * cp - z * sp, p[1] * sp + z * cp];
}

function mix(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

function tracePoly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const WA_PHONE = new Path2D('M6.62 10.79C8.06 13.62 10.38 15.93 13.21 17.38L15.41 15.18C15.68 14.91 16.08 14.82 16.43 14.94C17.55 15.31 18.76 15.51 20 15.51C20.55 15.51 21 15.96 21 16.51L21 20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3L7.5 3C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59Z');
const TG_PLANE = new Path2D('M2.7 20.1L22.1 12L2.7 3.9L2.7 9.8L15.2 12L2.7 14.2Z');

// The same white glyphs as mobile/lib/widgets/channel_marks.dart, in a 24-unit box.
function drawGlyph(ctx, ch) {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.9;
  if (ch.id === 'instagram') {
    roundRect(ctx, 3.1, 3.1, 17.8, 17.8, 5.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, 12, 4.25, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(17.4, 6.7, 1.15, 0, Math.PI * 2); ctx.fill();
  } else if (ch.id === 'whatsapp') {
    ctx.beginPath(); ctx.arc(12, 11.6, 8.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5.4, 17.7); ctx.lineTo(4.5, 21.1); ctx.lineTo(8.1, 19.7); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(12, 11.7); ctx.scale(0.6, 0.6); ctx.translate(-12, -12);
    ctx.fillStyle = ch.to;
    ctx.fill(WA_PHONE);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(12, 12); ctx.rotate(-0.2); ctx.translate(-12, -12);
    ctx.fill(TG_PLANE);
    ctx.restore();
  }
}

function drawTile(ctx, ch, x, y, size, yaw, dim, alpha) {
  const half = size / 2, r = size * 0.3;
  const step = size * 0.024;
  const dirX = -Math.sin(yaw), dirY = 0.72;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // The tile's thickness: stacked copies of its outline, walked backward.
  ctx.save();
  ctx.transform(Math.cos(yaw), 0.18 * Math.sin(yaw), 0, 1, 0, 0);
  ctx.fillStyle = ch.side;
  for (let i = 7; i >= 1; i -= 1) {
    roundRect(ctx, -half + dirX * step * i, -half + dirY * step * i, size, size, r);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(-half, -half, half, half);
  g.addColorStop(0, ch.from);
  if (ch.mid) g.addColorStop(0.55, ch.mid);
  g.addColorStop(1, ch.to);
  roundRect(ctx, -half, -half, size, size, r);
  ctx.fillStyle = g;
  ctx.fill();
  // Top-lit gloss, then a bright rim, so it reads as a solid object.
  ctx.save();
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, -half, 0, half * 0.1);
  gloss.addColorStop(0, 'rgba(255,255,255,.3)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(-half, -half, size, size);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.34)';
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.stroke();
  const glyph = size * 0.6;
  ctx.save();
  ctx.translate(-glyph / 2, -glyph / 2);
  ctx.scale(glyph / 24, glyph / 24);
  drawGlyph(ctx, ch);
  ctx.restore();
  // Further away = a little darker, which is most of what sells the depth.
  if (dim > 0) {
    roundRect(ctx, -half, -half, size, size, r);
    ctx.fillStyle = `rgba(20,14,70,${dim})`;
    ctx.fill();
  }
  ctx.restore();
  if (ch.tag) {
    const fs = Math.max(11, size * 0.19);
    ctx.font = `700 ${fs}px Manrope, system-ui, sans-serif`;
    const tw = ctx.measureText(ch.tag).width + fs * 1.3;
    const th = fs * 1.7;
    const ty = half + step * 7 + fs * 0.45;
    roundRect(ctx, -tw / 2, ty, tw, th, th / 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.fillStyle = '#2a1e6b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.tag, 0, ty + th / 2 + 0.5);
  }
  ctx.restore();
}

/**
 * Draws one frame.
 * state: { t: seconds since the scene started, px, py: pointer offset (-1..1), still: bool }
 */
export function drawScene(ctx, w, h, { t, px = 0, py = 0, still = false }) {
  const S = Math.min(w / 1320, h / 1120);
  const cx = w / 2, cy = h / 2;
  const time = still ? 99 : t;
  const settle = still ? 1 : easeOut(clamp(time / 1.1));
  const yaw = still
    ? SCENE.stillYaw
    : Math.sin(time * 0.55) * SCENE.sway + px * 0.45 + (1 - settle) * 1.4;
  const pitch = still
    ? SCENE.stillPitch
    : -0.1 + Math.sin(time * 0.4) * 0.05 - py * 0.3;
  const project = (p) => {
    const k = SCENE.focal / (SCENE.focal + p[2]);
    return [cx + p[0] * k * S, cy + p[1] * k * S, k];
  };

  ctx.clearRect(0, 0, w, h);

  // Halo behind the object and a contact shadow beneath it: weight in space.
  const haloR = 620 * S;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
  halo.addColorStop(0, 'rgba(190,178,255,.42)');
  halo.addColorStop(0.55, 'rgba(139,92,246,.14)');
  halo.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(cx, cy + 440 * S);
  ctx.scale(1, 0.16);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 300 * S);
  shadow.addColorStop(0, `rgba(10,6,40,${0.5 * settle})`);
  shadow.addColorStop(1, 'rgba(10,6,40,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.arc(0, 0, 300 * S, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Orbit plane: a tilted, rolled circle.
  const cr = Math.cos(SCENE.orbitRoll), sr = Math.sin(SCENE.orbitRoll);
  const orbitPoint = (a, radius) => {
    const x0 = radius * Math.cos(a);
    const s = radius * Math.sin(a);
    const y0 = -s * Math.sin(SCENE.orbitTilt);
    return [x0 * cr - y0 * sr, x0 * sr + y0 * cr, s * Math.cos(SCENE.orbitTilt)];
  };
  const ringAlpha = still ? 1 : clamp((time - 0.9) / 0.5);
  const drawRing = (back) => {
    if (!ringAlpha) return;
    ctx.beginPath();
    for (let i = 0; i <= 48; i += 1) {
      const a = (back ? 0 : Math.PI) + (i / 48) * Math.PI;
      const p = project(orbitPoint(a, SCENE.orbitRadius));
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.strokeStyle = `rgba(214,207,255,${(back ? 0.2 : 0.42) * ringAlpha})`;
    ctx.lineWidth = Math.max(1, 3 * S);
    ctx.stroke();
  };
  drawRing(true);

  const items = [];

  // ── the mark ──
  const gradA = project(rotate([0, -348, -SCENE.depth / 2], yaw, pitch));
  const gradB = project(rotate([0, 348, -SCENE.depth / 2], yaw, pitch));
  const sweepEvery = 7;
  const sweep = still || time < 1 ? -1 : ((time - 1) % sweepEvery) / 1.2;
  PIECES.forEach((piece, n) => {
    const e = still ? 1 : easeOut(clamp((time - 0.05 - n * 0.06) / 0.95));
    const pts2 = piece.v.map(([x, y]) => [x - 301, y - 348]);
    const c = [(pts2[0][0] + pts2[1][0] + pts2[2][0]) / 3, (pts2[0][1] + pts2[1][1] + pts2[2][1]) / 3];
    const fly = (1 - e) * 3.4;
    const swirl = (1 - e) * 0.9;
    const ox = (piece.dx * Math.cos(swirl) - piece.dy * Math.sin(swirl)) * fly;
    const oy = (piece.dx * Math.sin(swirl) + piece.dy * Math.cos(swirl)) * fly;
    const spin = ((1 - e) * piece.rot * Math.PI) / 30;
    const scale = 0.4 + 0.6 * e;
    const place = (x, y, z) => {
      const lx = (x - c[0]) * scale, ly = (y - c[1]) * scale, lz = z * scale;
      const rx = lx * Math.cos(spin) - ly * Math.sin(spin);
      const ry = lx * Math.sin(spin) + ly * Math.cos(spin);
      return rotate([rx + c[0] + ox, ry + c[1] + oy, lz], yaw, pitch);
    };
    const front = pts2.map(([x, y]) => place(x, y, -SCENE.depth / 2));
    const back = pts2.map(([x, y]) => place(x, y, SCENE.depth / 2));
    const centre = mean(front.concat(back));
    const faces = [{ pts: front, front: true }, { pts: back }];
    for (let i = 0; i < 3; i += 1) {
      const j = (i + 1) % 3;
      faces.push({ pts: [front[i], front[j], back[j], back[i]] });
    }
    items.push({
      z: centre[2] + 40,
      draw() {
        ctx.save();
        ctx.globalAlpha = clamp(e * 3);
        faces.forEach((f) => {
          let nrm = norm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0])));
          const mid = mean(f.pts);
          if (dot(nrm, sub(mid, centre)) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
          if (dot(nrm, sub(mid, [0, 0, -SCENE.focal])) >= 0) return; // faces away
          const lit = clamp(dot(nrm, LIGHT));
          const pts = f.pts.map(project);
          tracePoly(ctx, pts);
          if (f.front) {
            const shade = 0.72 + lit * 0.28;
            const g = ctx.createLinearGradient(gradA[0], gradA[1], gradB[0], gradB[1]);
            g.addColorStop(0, mix('#352a7f', piece.ramp[0], shade));
            g.addColorStop(0.5, mix('#352a7f', piece.ramp[1], shade));
            g.addColorStop(1, mix('#352a7f', piece.ramp[2], shade));
            ctx.fillStyle = g;
            ctx.fill();
            if (sweep >= 0 && sweep <= 1) {
              ctx.save();
              ctx.clip();
              const at = gradA[0] - 400 * S + sweep * 800 * S;
              const band = ctx.createLinearGradient(at - 90 * S, cy - 200 * S, at + 90 * S, cy + 200 * S);
              band.addColorStop(0, 'rgba(255,255,255,0)');
              band.addColorStop(0.5, 'rgba(255,255,255,.75)');
              band.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = band;
              ctx.fillRect(0, 0, w, h);
              ctx.restore();
              tracePoly(ctx, pts);
            }
            ctx.strokeStyle = 'rgba(255,255,255,.7)';
            ctx.lineWidth = Math.max(0.8, 2.2 * S);
            ctx.lineJoin = 'round';
            ctx.stroke();
          } else {
            ctx.fillStyle = mix(piece.side[0], piece.side[1], lit);
            ctx.fill();
            ctx.strokeStyle = mix(piece.side[0], piece.side[1], lit);
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });
        ctx.restore();
      },
    });
  });

  // ── the channels ──
  const base = still ? SCENE.stillOrbit : (time / SCENE.orbitPeriod) * Math.PI * 2;
  CHANNELS.forEach((ch, i) => {
    const e = still ? 1 : easeBack(clamp((time - 0.8 - i * 0.12) / 0.7));
    if (e <= 0) return;
    const a = base + (i * Math.PI * 2) / 3;
    const p = orbitPoint(a, SCENE.orbitRadius * e);
    if (!still) p[1] += Math.sin(time * 0.9 + i * 2.1) * 14;
    const [x, y, k] = project(p);
    const size = SCENE.tile * S * Math.min(k, SCENE.tileMaxScale) * clamp(e, 0, 1.15);
    items.push({
      z: p[2],
      draw() {
        drawTile(ctx, ch, x, y, size, Math.cos(a) * 0.6, clamp((p[2] / SCENE.orbitRadius) * 0.36, 0, 0.36), clamp(e * 2));
      },
    });
  });

  items.sort((a, b) => b.z - a.z).forEach((it) => it.draw());
  drawRing(false);
}
