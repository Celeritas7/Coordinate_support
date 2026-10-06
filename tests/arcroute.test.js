// node tests/arcroute.test.js — lines + arcs solver on the 16 stations of route_343434_csys.stp
const fs = require("fs"), path = require("path");
const STEP = require("../js/step.js"), Arc = require("../js/arcroute.js");
const r = STEP.parse(fs.readFileSync(path.join(__dirname, "../samples/route_343434_csys.stp"), "utf8"));
const S = r.csys.map(c => [c.x, c.y, c.z]);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };

const res = Arc.solve(S, { R: 65, Rmax: 97.5, tol: 0.05 });
check(res.ok, `solves (${res.reason || "R " + res.R + ", " + res.W.length + " points"})`);
check(res.R >= 76.8, `radius ${res.R} beats the spline's 76.8 mm`);
check(res.W.length <= 15, `${res.W.length} points (spline needed 103)`);
check(Math.abs(res.R * 2 - Math.round(res.R * 2)) < 1e-9, "radius is a round 0.5 mm value for Creo");

// independent check on a 1 mm resample: no 3-point circle tighter than R, every station on the curve
const p = Arc.sample(res.G, 1).pts, sub = (a, b) => a.map((v, i) => v - b[i]), len = a => Math.hypot(...a);
let minR = Infinity;
for (let i = 1; i < p.length - 1; i++) {
  const a = len(sub(p[i], p[i - 1])), b = len(sub(p[i + 1], p[i])), c = len(sub(p[i + 1], p[i - 1])), s = (a + b + c) / 2;
  const ar = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c))); if (ar > 1e-9) minR = Math.min(minR, a * b * c / (4 * ar));
}
check(minR >= res.R - 0.5, `resampled min radius ${minR.toFixed(1)} mm`);
const worst = Math.max(...S.map(q => { let bd = Infinity;
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], d = sub(p[i], a), t = Math.max(0, Math.min(1, ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1] + (q[2] - a[2]) * d[2]) / (len(d) ** 2 || 1)));
    bd = Math.min(bd, len(sub(q, a.map((v, j) => v + d[j] * t)))); } return bd; }));
check(worst < 0.1, `every station within ${worst.toFixed(3)} mm of the resampled curve`);
check(res.minGap >= 0, `arcs never overlap (shortest straight ${res.minGap.toFixed(2)} mm)`);

// fixed start direction is honoured
const sd = [1, 0, 0], r2 = Arc.solve(S, { R: 65, startDir: sd });
const u = sub(r2.W[1], r2.W[0]), cos = u[0] / len(u);
check(r2.ok && cos > 0.9999, `start direction +X held (cos ${cos.toFixed(5)})`);

process.exit(fail ? 1 : 0);
