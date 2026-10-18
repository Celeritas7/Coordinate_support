// node tests/multiroute.test.js — topology enumeration: several distinct routes round the same obstacles
const fs = require("fs"), path = require("path"), vm = require("vm");
const M = require("../js/multiroute.js");
// makeRoute + optimiser live in the no-DOM top of route-studio.js; run just that part
const src = fs.readFileSync(path.join(__dirname, "../js/route-studio.js"), "utf8");
const core = src.slice(0, src.indexOf("// ---------- clearance between two routes"));
const ctx = { Math, Infinity, Number, Array, Map, Set }; vm.createContext(ctx); vm.runInContext(core, ctx);
const { makeRoute, optimiser } = ctx;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(...a);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };

// ---- one box between two stations ----
const A = [0, 0, 0], B = [1000, 0, 0], box = { min: [400, -100, -100], max: [600, 100, 100] };
const R = 50, rad = 5;
const t0 = Date.now();
const res = M.enumerate([A, B], { R, SF: 1.5, rad, boxes: [box], makeRoute, optimiser });
const C = res.candidates;
console.log(`     ${res.tried} topologies, ${res.polished} polished, ${Date.now() - t0} ms`);
C.forEach(c => console.log(`     #${c.rank} ${c.label}: length ${c.len.toFixed(1)}, min R ${c.minR.toFixed(1)}, clearance ${c.clearance.toFixed(1)}${c.ok ? "" : " (not clean)"}`));
check(M.blockers(A, B, [box], rad).length === 1, "the straight line runs into the box");
check(res.tried === 4, `four ways round one box (${res.tried})`);
check(C.length >= 2 && C.length <= 3, `${C.length} distinct candidates returned (want ≥ 2, at most 3)`);
check(new Set(C.map(c => c.sig)).size === C.length, `each passes the box on a different side (${C.map(c => c.label).join(" / ")})`);
let apart = Infinity;
for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
  let m = 0; for (const p of C[i].Q) { let d = Infinity; for (const q of C[j].Q) d = Math.min(d, len(sub(p, q))); m = Math.max(m, d); }
  apart = Math.min(apart, m); }
check(apart > 100, `the curves really differ (closest pair is ${apart.toFixed(0)} mm apart somewhere)`);
check(C.every(c => c.ok && c.clearance >= 0 && c.minR >= R), "every candidate clears the box and holds min R");
check(C.every(c => len(sub(c.Q[0], A)) < 1e-6 && len(sub(c.Q[c.Q.length - 1], B)) < 1e-6), "every candidate starts and ends on the stations");
check(C.every((c, i) => !i || c.len >= C[i - 1].len * 0.99 || (!C[i - 1].ok && c.ok)), "ranked by length (1 % buckets)");

// ---- nothing in the way: one route, no detour ----
const free = M.enumerate([A, B], { R, rad, boxes: [{ min: [400, 300, -50], max: [600, 400, 50] }], makeRoute, optimiser });
check(free.tried === 1 && free.candidates.length === 1 && free.candidates[0].label === "direct", "clear line: single direct candidate");

// ---- chunked: start() + step(ms) gives the same answer in short slices ----
const job = M.start([A, B], { R, SF: 1.5, rad, boxes: [box], makeRoute, optimiser });
let r, slices = 0, longest = 0;
do { const t = Date.now(); r = job.step(20); longest = Math.max(longest, Date.now() - t); slices++; } while (!r.done);
check(slices > 10 && r.result.candidates.length === C.length && r.result.candidates.every((c, i) => c.sig === C[i].sig),
  `chunked run: ${slices} slices, same ${C.length} candidates in the same order`);
check(longest < 200, `no slice blocks for long (longest ${longest} ms)`);
check(C.every(c => c.route && Array.isArray(c.x)), "candidates carry route + solver state for “Use this”");

// ---- a part given as several face boxes counts as one obstacle (4 ways round, not 4^3) ----
const faces = [{ min: [400, -100, -100], max: [600, -90, 100] }, { min: [400, 90, -100], max: [600, 100, 100] }, { min: [400, -100, -100], max: [410, 100, 100] }];
const fj = M.start([A, B], { R, rad, boxes: faces, makeRoute, optimiser });
check(fj.tried === 4, `three touching face boxes → one obstacle, ${fj.tried} ways round`);

if (fail) { console.log(`${fail} failed`); process.exit(1); }
