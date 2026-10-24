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

// ---- Phase 4b: pick the side (prefer + up axis), plain-word labels ----
const named = { ...box, part: "95651236" }, run = (o, st = [A, B], bx = [named]) => M.enumerate(st, { R, SF: 1.5, rad, boxes: bx, makeRoute, optimiser, ...o });
const up = run({ prefer: { "95651236": "above" } }), dn = run({ prefer: { "95651236": "below" } }), any = run({ prefer: { "95651236": "any" } });
check(up.tried === 1 && up.candidates.length === 1 && up.candidates[0].label === "over 95651236" && up.candidates[0].ok && !up.forced,
  `Above: ${up.tried} topology, “${up.candidates.map(c => c.label)}”`);
check(dn.tried === 1 && dn.candidates.length === 1 && dn.candidates[0].label === "under 95651236" && !dn.forced, `Below: “${dn.candidates.map(c => c.label)}”`);
check(any.tried === 4 && any.candidates.length >= 2, `Any: ${any.candidates.length} candidates (${any.candidates.map(c => c.label).join(" / ")})`);
check(C.every(c => !/[+-][XYZ]/.test(c.label)), "labels are words, never B1+Y");
const lt = run({ prefer: { "95651236": "left" } }), ax = run({ prefer: { "95651236": "-Y" } });
check(lt.candidates.length === 1 && lt.candidates[0].label === "left of 95651236" && lt.candidates[0].Q.some(p => p[1] > 100),
  "Left, travelling +X with +Z up: passes on +Y");
check(ax.candidates.length === 1 && ax.candidates[0].label === "right of 95651236", "an axis name works too: −Y is right of it");
const upY = run({ up: "+Y", prefer: { "95651236": "above" } });
check(upY.candidates.length === 1 && upY.candidates[0].Q.some(p => p[1] > 100), "Up = +Y: above means +Y");
const vert = run({ prefer: { "95651236": "above" } }, [[500, 0, -500], [500, 0, 500]]);
check(vert.tried === 4 && vert.notes.length === 1 && /up axis/.test(vert.notes[0]), `leg along the up axis: “above” ignored with a note (${vert.notes[0]})`);
const along = run({ prefer: { "95651236": "+X" } });
check(along.tried === 4 && /along leg 1/.test(along.notes[0]), "a side along the leg is not a side: any kept, with a note");
// a tall wall close to the stations: over it the radius cannot hold, under it is easy
// (stations 160 mm apart, both held along +X: over needs about 4R = 200 mm)
const wall = { min: [490, -100, -6], max: [510, 100, 600], part: "22577598" }, near = [{ p: [420, 0, 0], dir: [1, 0, 0] }, { p: [580, 0, 0], dir: [1, 0, 0] }];
const fo = run({ prefer: { "22577598": "above" } }, near, [wall]), fu = run({ prefer: { "22577598": "below" } }, near, [wall]);
console.log(`     over the wall: ${fo.candidates.map(c => `${c.label}, min R ${c.minR.toFixed(1)}, clearance ${c.clearance.toFixed(1)}`)}; ${fo.forced && fo.forced.text}`);
check(fo.forced && fo.candidates.length === 1 && fo.candidates[0].forced && /^above 22577598: /.test(fo.forced.text) && /needs R \d+, limit R 50|mm into/.test(fo.forced.why),
  "Above a wall too tall for R: best route that side, marked forced with the rule and the number");
check(!fu.forced && fu.candidates[0].ok && fu.candidates[0].label === "under 22577598", "Below the same wall: clean, not forced");

// ---- Phase 4: no clean route — say which part is in the way on every side ----
const plate = { min: [490, -600, -600], max: [510, 600, 600], part: "FRAME / PLATE 22648999" };
const nc = M.enumerate([{ p: [420, 0, 0], dir: [1, 0, 0] }, { p: [580, 0, 0], dir: [1, 0, 0] }], { R, SF: 1.5, rad, boxes: [plate], makeRoute, optimiser });
console.log(`     none clean: ${nc.none && nc.none.text}`);
check(!nc.candidates.some(c => c.ok) && nc.none, "a plate 1200 mm wide between stations 160 mm apart: nothing clean, and the result says why");
check(nc.none.part === "FRAME / PLATE 22648999" && nc.none.every && nc.none.sides.length >= 2 && nc.none.sides.every(s => s.gap < 0),
  `the plate is named, in the way on every side (${nc.none.sides.map(s => s.side + " " + s.gap.toFixed(1)).join(", ")})`);
check(/^PLATE 22648999 is in the way on every side tried: /.test(nc.none.text), "the text names the part by the last step of its path");
check(nc.candidates.every(c => c.near && c.near.part === "FRAME / PLATE 22648999"), "each route records the part it gets closest to");
check(res.none === null && up.none === null, "a clean result has no 'none' report");
// the faster clearance (boxes sorted by distance to the curve's box) gives the same smallest gap as testing every box
{ const many = [box, ...Array.from({ length: 40 }, (_, i) => ({ min: [i * 100 - 2000, 900, -50], max: [i * 100 - 1950, 950, 50] }))];
  const m = M.enumerate([A, B], { R, SF: 1.5, rad, boxes: many, makeRoute, optimiser, keep: 1 }), c = m.candidates[0];
  let g = Infinity; for (const p of c.Q) for (const b of many) g = Math.min(g, M.boxDist(p, b) - rad);
  check(Math.abs(g - c.clearance) < 1e-9, `clearance with the early stop = every box tested (${c.clearance.toFixed(3)} mm)`); }

if (fail) { console.log(`${fail} failed`); process.exit(1); }
