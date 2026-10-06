/* arcroute.js — line-arc-line route solver.
 * The route is a polyline of corner vertices; every corner is filleted with one radius R
 * (what Creo builds from "Curve through points > Single radius"). The vertices are free:
 * they are moved until the filleted curve passes through every station, so the .pts file
 * only needs the vertices, not hundreds of spline samples.
 * No DOM. Loaded in the browser before route-studio.js, and in Node for tests.
 */
(function (root) {
"use strict";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1e-12; return [a[0] / l, a[1] / l, a[2] / l]; };
const DEG = 180 / Math.PI;

// ---------- geometry of one vertex set ----------
// corners[j] for j = 1..m-1, lines[j] for j = 0..m-1 (W[j] -> W[j+1], trimmed by the arcs)
function build(W, R) {
  const m = W.length - 1, corners = [], lines = [];
  for (let j = 1; j < m; j++) {
    const uin = norm(sub(W[j], W[j - 1])), uout = norm(sub(W[j + 1], W[j]));
    const th = Math.acos(Math.max(-1, Math.min(1, dot(uin, uout))));
    if (th < 1e-7) { corners[j] = { th: 0, t: 0, A: W[j], B: W[j] }; continue; }
    const t = R * Math.tan(Math.min(th, Math.PI - 1e-6) / 2);
    const A = sub(W[j], mul(uin, t)), B = add(W[j], mul(uout, t));
    const C = add(W[j], mul(norm(sub(uout, uin)), R / Math.cos(Math.min(th, Math.PI - 1e-6) / 2)));
    const a = norm(sub(A, C)), n = norm(cross(sub(A, C), sub(B, C)));
    corners[j] = { th, t, A, B, C, a, b: cross(n, a), n, R };
  }
  for (let j = 0; j < m; j++) {
    const L = len(sub(W[j + 1], W[j]));
    const t0 = j > 0 ? corners[j].t : 0, t1 = j + 1 < m ? corners[j + 1].t : 0;
    lines[j] = { P: j > 0 ? corners[j].B : W[0], Q: j + 1 < m ? corners[j + 1].A : W[m], L, gap: L - t0 - t1 };
  }
  return { W, R, m, corners, lines };
}

function nearLine(p, l) {
  const d = sub(l.Q, l.P), dd = dot(d, d);
  const u = dd > 1e-12 ? Math.max(0, Math.min(1, dot(sub(p, l.P), d) / dd)) : 0;
  return add(l.P, mul(d, u));
}
function nearArc(p, c) {
  if (!c.th) return c.A;
  const q = sub(p, c.C), qn = sub(q, mul(c.n, dot(q, c.n)));
  let f = len(qn) < 1e-9 ? 0 : Math.atan2(dot(qn, c.b), dot(qn, c.a));
  if (f < 0) f = f < -0.5 * (2 * Math.PI - c.th) ? f + 2 * Math.PI : 0;  // nearer end
  if (f > c.th) f = f - c.th < 0.5 * (2 * Math.PI - c.th) ? c.th : 0;
  return add(c.C, add(mul(c.a, c.R * Math.cos(f)), mul(c.b, c.R * Math.sin(f))));
}
// closest point to p on the pieces between vertex lo and vertex hi
function nearest(G, p, lo, hi) {
  let best = null, bd = Infinity;
  const tryPt = q => { const d = len(sub(p, q)); if (d < bd) { bd = d; best = q; } };
  for (let j = Math.max(0, lo - 1); j <= Math.min(G.m - 1, hi); j++) tryPt(nearLine(p, G.lines[j]));
  for (let j = Math.max(1, lo); j <= Math.min(G.m - 1, hi); j++) tryPt(nearArc(p, G.corners[j]));
  return { q: best, d: bd };
}

// ---------- problem state ----------
// st: { S: stations, owner: station -> vertex index or -1, W: vertices, sd, ed }
function windows(st) {
  const n = st.S.length, m = st.W.length - 1, out = [];
  for (let k = 0; k < n; k++) {
    let lo = 0, hi = m;
    for (let i = k - 1; i >= 0; i--) if (st.owner[i] >= 0) { lo = st.owner[i]; break; }
    for (let i = k + 1; i < n; i++) if (st.owner[i] >= 0) { hi = st.owner[i]; break; }
    out.push([lo, hi]);
  }
  return out;
}
// unknowns: interior vertices (3 each); vertex 1 / m-1 are 1-D along a given start / end direction
function packer(st) {
  const m = st.W.length - 1, S0 = st.W[0], Sm = st.W[m], slots = [];
  for (let j = 1; j < m; j++) {
    if (j === 1 && st.sd) slots.push({ j, ray: S0, dir: st.sd });
    else if (j === m - 1 && st.ed && !(j === 1 && st.sd)) slots.push({ j, ray: Sm, dir: mul(st.ed, -1) });
    else slots.push({ j });
  }
  const pack = W => { const x = []; for (const s of slots) { if (s.dir) x.push(Math.max(0, dot(sub(W[s.j], s.ray), s.dir))); else x.push(...W[s.j]); } return x; };
  const unpack = x => { const W = st.W.slice(); let i = 0;
    for (const s of slots) { if (s.dir) W[s.j] = add(s.ray, mul(s.dir, x[i++])); else { W[s.j] = [x[i], x[i + 1], x[i + 2]]; i += 3; } }
    return W; };
  return { pack, unpack };
}
function residuals(st, W, R, win, margin) {
  const G = build(W, R), r = [];
  st.S.forEach((p, k) => { const q = nearest(G, p, win[k][0], win[k][1]).q; r.push(p[0] - q[0], p[1] - q[1], p[2] - q[2]); });
  for (const l of G.lines) r.push(Math.max(0, margin - l.gap));
  return r;
}
function score(st, R, margin) {
  const G = build(st.W, R), win = windows(st);
  const errs = st.S.map((p, k) => nearest(G, p, win[k][0], win[k][1]).d);
  const minGap = Math.min(...G.lines.map(l => l.gap));
  return { G, errs, maxErr: Math.max(...errs), minGap };
}

// Levenberg-Marquardt, numeric Jacobian
function solveLinear(A, b) {
  const n = b.length, M = A.map((row, i) => row.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
function fit(st, R, opt) {
  const margin = opt.margin, win = windows(st), P = packer(st);
  const F = x => residuals(st, P.unpack(x), R, win, margin);
  const ss = r => r.reduce((s, v) => s + v * v, 0);
  let x = P.pack(st.W), r = F(x), f = ss(r), lam = 1e-3;
  const n = x.length, h = 1e-4;
  for (let it = 0; it < opt.iters && f > 1e-12; it++) {
    const J = [];
    for (let i = 0; i < n; i++) { const xi = x.slice(); xi[i] += h; const ri = F(xi); J.push(ri.map((v, k) => (v - r[k]) / h)); }
    const A = [], g = [];
    for (let i = 0; i < n; i++) {
      A.push([]); let gi = 0; for (let k = 0; k < r.length; k++) gi += J[i][k] * r[k]; g.push(-gi);
      for (let j = 0; j < n; j++) { let s = 0; const a = J[i], b = J[j]; for (let k = 0; k < r.length; k++) s += a[k] * b[k]; A[i].push(s); }
    }
    let moved = false;
    for (let tries = 0; tries < 8; tries++) {
      const Ad = A.map((row, i) => row.map((v, j) => i === j ? v * (1 + lam) + 1e-9 : v));
      const dx = solveLinear(Ad, g);
      if (!dx) { lam *= 10; continue; }
      const xn = x.map((v, i) => v + dx[i]), rn = F(xn), fn = ss(rn);
      if (fn < f) { const gain = f - fn; x = xn; r = rn; f = fn; lam = Math.max(1e-9, lam / 3); moved = gain > 1e-14 * (1 + f); break; }
      lam *= 5;
    }
    if (!moved) break;
  }
  st.W = P.unpack(x);
  const s = score(st, R, margin);
  s.ok = s.maxErr <= opt.tol && s.minGap >= -1e-6;
  return s;
}

// ---------- structure changes ----------
const clone = st => ({ S: st.S, sd: st.sd, ed: st.ed, owner: st.owner.slice(), W: st.W.map(p => p.slice()) });
// a corner of angle th at W[j] becomes two corners of th/2 (same R) with a short straight between
function split(st, j, R) {
  const W = st.W, uin = norm(sub(W[j], W[j - 1])), uout = norm(sub(W[j + 1], W[j]));
  const th = Math.acos(Math.max(-1, Math.min(1, dot(uin, uout)))), t = R * Math.tan(th / 4) * 1.2;
  const out = clone(st);
  out.W.splice(j, 1, sub(W[j], mul(uin, t)), add(W[j], mul(uout, t)));
  out.owner = out.owner.map(o => o > j ? o + 1 : o);
  return out;
}
function drop(st, j) {
  const out = clone(st);
  out.W.splice(j, 1);
  out.owner = out.owner.map(o => o === j ? -1 : o > j ? o - 1 : o);
  return out;
}

// ---------- driver ----------
// S: station points (route order). opt: { R, Rmax, tol, margin, startDir, endDir, minTurnDeg, maxSplits, onStep }
function solve(S, opt) {
  opt = Object.assign({ tol: 0.05, margin: 0.1, minTurnDeg: 0.5, maxSplits: 10, iters: 60 }, opt);
  const R0 = opt.R, Rmax = Math.max(opt.Rmax || R0, R0), n = S.length, log = [];
  const say = m => { log.push(m); if (opt.onStep) opt.onStep(m); };
  if (n < 2) throw new Error("Need at least two stations.");

  // start: one vertex per station that turns, pushed outward so the arc's middle lands on the station
  const owner = new Array(n).fill(-1), W = [S[0]];
  for (let k = 1; k < n - 1; k++) {
    const uin = norm(sub(S[k], S[k - 1])), uout = norm(sub(S[k + 1], S[k]));
    const th = Math.acos(Math.max(-1, Math.min(1, dot(uin, uout))));
    if (th * DEG < opt.minTurnDeg) continue;
    owner[k] = W.length;
    W.push(sub(S[k], mul(norm(sub(uout, uin)), R0 * (1 / Math.cos(th / 2) - 1))));
  }
  W.push(S[n - 1]);
  let st = { S, owner, W, sd: opt.startDir ? norm(opt.startDir) : null, ed: opt.endDir ? norm(opt.endDir) : null };

  // 1. make it work at the limit radius, splitting corners where one arc can't reach
  let res = fit(st, R0, opt), splits = 0;
  while (!res.ok && splits < opt.maxSplits) {
    // the corner nearest the worst station (or the worst overlap) gets split
    let j;
    const worstK = res.errs.indexOf(Math.max(...res.errs));
    if (res.maxErr > opt.tol) {
      const q = st.S[worstK]; let bd = Infinity;
      for (let i = 1; i < st.W.length - 1; i++) { const d = len(sub(st.W[i], q)); if (d < bd) { bd = d; j = i; } }
    } else {
      const li = res.G.lines.findIndex(l => l.gap === res.minGap);
      const c = res.G.corners; j = li === 0 ? 1 : li === res.G.m - 1 ? li : (c[li].th > c[li + 1].th ? li : li + 1);
    }
    if (!j) break;
    const tryS = split(st, j, R0), r2 = fit(tryS, R0, opt);
    splits++;
    say(`Split corner ${j}: worst station ${r2.maxErr.toFixed(2)} mm off`);
    st = tryS; res = r2;
  }
  if (!res.ok) return { ok: false, R: R0, W: st.W, G: res.G, errs: res.errs, minGap: res.minGap, owner: st.owner, log,
    reason: res.maxErr > opt.tol ? `stations up to ${res.maxErr.toFixed(2)} mm off the curve` : `arcs overlap by ${(-res.minGap).toFixed(2)} mm on a straight` };
  say(`Holds R ${R0} with ${st.W.length} points`);

  // 2. raise R toward Rmax
  let best = { st: clone(st), R: R0, res };
  if (Rmax > R0 + 0.05) {
    let lo = R0, hi = Rmax;
    for (let it = 0; it < 8 && hi - lo > 0.2; it++) {
      const Rt = it === 0 ? hi : (lo + hi) / 2, tryS = clone(best.st), r2 = fit(tryS, Rt, opt);
      if (r2.ok) { lo = Rt; best = { st: tryS, R: Rt, res: r2 }; say(`Holds R ${Rt.toFixed(1)}`); if (it === 0) break; }
      else hi = Rt;
    }
  }
  // the radius typed into Creo must be the one the corners were fitted for, so make it a round number
  const step = opt.roundTo || 0.5, Rr = Math.max(R0, Math.floor(best.R / step + 1e-9) * step);
  if (Math.abs(Rr - best.R) > 1e-9) {
    const tryS = clone(best.st), r2 = fit(tryS, Rr, opt);
    if (r2.ok) best = { st: tryS, R: Rr, res: r2 };
  }

  // 3. drop vertices the route doesn't need at that radius, gentlest corners first
  for (let pass = 0; pass < 2; pass++) {
    const order = [];
    for (let j = 1; j < best.st.W.length - 1; j++) { const c = best.res.G.corners[j]; order.push({ j, th: c.th }); }
    order.sort((a, b) => a.th - b.th);
    let dropped = false;
    for (const { th } of order) {
      // indices shift after a drop; find the corner again by angle
      const G = build(best.st.W, best.R);
      const j = G.corners.findIndex((c, i) => i > 0 && c && Math.abs(c.th - th) < 1e-9);
      if (j < 1) continue;
      const tryS = drop(best.st, j), r2 = fit(tryS, best.R, opt);
      if (r2.ok) { best = { st: tryS, R: best.R, res: r2 }; dropped = true; say(`Dropped a ${(th * DEG).toFixed(1)}° corner, ${tryS.W.length} points`); }
    }
    if (!dropped) break;
  }
  const r = best.res;
  return { ok: true, R: best.R, W: best.st.W, G: r.G, errs: r.errs, minGap: r.minGap, owner: best.st.owner, log };
}

// dense samples with exact curvature, in the shape route-studio's runs use: {pts,k,s,d1s,d2s}
function sample(G, step) {
  step = step || 10;
  const pts = [], k = [], d1s = [], d2s = [], STRAIGHT = 1e-9;
  const push = (p, kk, d1, d2) => { pts.push(p); k.push(kk); d1s.push(d1); d2s.push(d2); };
  for (let j = 0; j < G.m; j++) {
    const l = G.lines[j], d = sub(l.Q, l.P), L = len(d), u = norm(d), N = Math.max(1, Math.ceil(L / step));
    for (let i = j ? 1 : 0; i <= N; i++) push(add(l.P, mul(d, i / N)), STRAIGHT, u, [0, 0, 0]);
    const c = G.corners[j + 1];
    if (j + 1 < G.m && c.th) {
      const N2 = Math.max(2, Math.ceil(c.th * DEG / 3));
      for (let i = 1; i <= N2; i++) {
        const f = c.th * i / N2, ca = Math.cos(f), sa = Math.sin(f);
        const p = add(c.C, add(mul(c.a, c.R * ca), mul(c.b, c.R * sa)));
        const T = add(mul(c.a, -sa), mul(c.b, ca));
        push(p, 1 / c.R, T, mul(norm(sub(c.C, p)), 1 / c.R));
      }
    }
  }
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + len(sub(pts[i], pts[i - 1])));
  return { pts, k, s, d1s, d2s };
}

const API = { solve, build, sample, nearest };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.ArcRoute = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
