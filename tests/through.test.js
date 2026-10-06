// node tests/through.test.js — Phase 12b: route a pipe straight through clamp bores
const fs = require("fs"), path = require("path");
global.ArcRoute = require("../js/arcroute.js");
const S = require("../js/step-asm.js"), T = require("../js/through.js"), A = global.ArcRoute;
const read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a);
const norm = a => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const clampsOf = (r, pi) => r.clampsFor(pi).filter(c => c.use).map(c => ({ c: c.fix.c, a: c.fix.d, length: c.fix.length, name: c.fix.name }));

// ---- piping2: the target ----
const r2 = S.parse(read("piping2_practice_asm.stp")), p = r2.pipes[0];
check(r2.fixings.length === 1, `piping2: ${r2.fixings.length} clamp found`);
const fx = r2.fixings[0];
check(fx.name === "U104904_990224" && fx.csys === "CS0", `clamp ${fx.name}, CSYS ${fx.csys} at the hole centre`);
check(Math.abs(fx.D - 22) < 1e-6 && Math.abs(fx.length - 18) < 1e-6, `bore Ø${fx.D} × ${fx.length} mm`);
check(Math.abs(Math.abs(fx.d[1]) - 1) < 1e-9, "bore axis along Y, from the hole (its CSYS Z points along X)");
check(len(sub(fx.c, [484, 1552, -3168.2])) < 1e-3, "bore centre (484, 1552, -3168.2)");
check(S.nearest(p.chain, fx.c).d > 60, `today the pipe misses it by ${S.nearest(p.chain, fx.c).d.toFixed(1)} mm`);

const res = T.solve(p.Q, { R: 40, clamps: clampsOf(r2, 0), minStraight: 30, margin: 2 });
check(res.ok, `routed (${res.ok ? res.steps.map(s => s.how).join("; ") : res.reason})`);
const W = res.W, m = W.length - 1, G = A.build(W, 40);
// independent check on a 0.1 mm resample of the exact lines + arcs
const smp = A.sample(G, 0.1), half = fx.length / 2;
let off = 0, n = 0, lo = Infinity, hi = -Infinity;
smp.pts.forEach(q => { const v = sub(q, fx.c), u = dot(v, fx.d), rr = len(sub(v, fx.d.map(x => x * u)));
  if (rr < 20 && Math.abs(u) <= half) { off = Math.max(off, rr); n++; lo = Math.min(lo, u); hi = Math.max(hi, u); } });
check(off <= 0.05, `centreline within ${off.toFixed(4)} mm of the bore axis (limit 0.05)`);
check(n > 150 && lo <= -half + 0.1 && hi >= half - 0.1, `over the whole bore: ${lo.toFixed(2)} … ${hi.toFixed(2)} mm (${n} samples)`);
check(len(sub(W[0], p.Q[0])) < 1e-3 && len(sub(W[m], p.Q[p.Q.length - 1])) < 1e-3, "both ends unchanged");
const ang = (a, b) => Math.acos(Math.min(1, dot(norm(a), norm(b)))) * 180 / Math.PI;
check(ang(sub(W[1], W[0]), sub(p.Q[1], p.Q[0])) < 1e-3 && ang(sub(W[m], W[m - 1]), sub(p.Q[p.Q.length - 1], p.Q[p.Q.length - 2])) < 1e-3, "both end directions unchanged");
const gaps = G.lines.map(l => l.gap);
check(Math.min(...gaps.slice(1, -1)) >= 30 - 1e-3, `every straight between bends ≥ 30 mm (shortest ${Math.min(...gaps.slice(1, -1)).toFixed(1)})`);
check(G.corners.slice(1).every(c => c.th < Math.PI), "single radius 40 at every corner, no reversal");
const moved = res.report.rows.filter(x => x.moved != null).map(x => x.moved);
check(W.length === 8 && Math.max(...moved) < 1e-3, `${W.length} points: one corner added, the others not moved (max ${Math.max(...moved).toFixed(4)} mm)`);

// ---- piping3: clamps the pipes already pass through are kept ----
const r3 = S.parse(read("piping3_practice_asm.stp"));
r3.pipes.forEach((q, pi) => {
  const cl = clampsOf(r3, pi), out = T.solve(q.Q, { R: q.R, clamps: cl, minStraight: 30 });
  check(cl.length >= 2 && cl.every(c => c.length > 15), `${q.name}: ${cl.length} clamps of its own size (other pipe's clamps, bolt holes, end fittings left out)`);
  check(out.ok && out.report.clamps.every(c => c.ok) && out.W.length === q.Q.length, `${q.name}: kept through all of them, ${out.W.length} points`);
});

process.exit(fail ? 1 : 0);
