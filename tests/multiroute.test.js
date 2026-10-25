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
// the faster clearance (boxes sorted by distance to the curve's box) gives the same smallest gap as testing every box (on the same dense samples)
{ const many = [box, ...Array.from({ length: 40 }, (_, i) => ({ min: [i * 100 - 2000, 900, -50], max: [i * 100 - 1950, 950, 50] }))];
  const m = M.enumerate([A, B], { R, SF: 1.5, rad, boxes: many, makeRoute, optimiser, keep: 1 }), c = m.candidates[0];
  let g = Infinity; for (const p of M.denseCurve(c.route, c.x, M.spacing(rad))) for (const b of many) g = Math.min(g, M.boxDist(p, b) - rad);
  check(Math.abs(g - c.clearance) < 1e-9, `clearance with the early stop = every box tested (${c.clearance.toFixed(3)} mm)`); }

// ---- Phase 13: a 9 m rail across the leg is passed over its short side, not walked round lengthwise ----
{ const rail = { min: [480, -4500, -150], max: [520, 4500, 150], part: "FRAME / RAIL" }, Lr = 1000;
  const rr = M.enumerate([A, B], { R, SF: 1.5, rad, boxes: [rail], makeRoute, optimiser });
  console.log(`     rail: ${rr.tried} ways, ${rr.candidates.map(c => `${c.label} ${c.len.toFixed(0)} mm`).join(" / ")}${rr.notes.length ? "; " + rr.notes.join("; ") : ""}`);
  check(rr.tried === 2 && rr.candidates.every(c => /^(over|under) RAIL$/.test(c.label)), `only over / under are tried: the ±Y sides would be a 4.5 m detour (${rr.candidates.map(c => c.label)})`);
  check(rr.candidates.length >= 1 && rr.candidates.every(c => c.ok && c.len < 1.5 * Lr), `every route is short and clean (${rr.candidates.map(c => c.len.toFixed(0)).join(", ")} mm for a 1000 mm leg)`); }
// a station inside what holds it (a port on a tank): no gap asked there
{ const tank = { min: [-300, -300, -300], max: [0, 300, 300], part: "TANK" };
  const tr = M.enumerate([[0, 0, 0], [800, 0, 0]], { R, SF: 1.5, rad, boxes: [tank], makeRoute, optimiser });
  check(tr.tried === 1 && tr.candidates[0].ok, `a route leaving a port on the tank's face is clean (${tr.candidates[0].label}, gap ${tr.candidates[0].clearance.toFixed(1)})`); }

// the station zone exempts only what holds the station (faces the station point is within rad of), not every part near it
{ const st = [{ p: [0, 0, 0], dir: [1, 0, 0] }, { p: [800, 0, 0], dir: [1, 0, 0] }], tank = { min: [-300, -300, -300], max: [0, 300, 300], part: "TANK" },
    frame = { min: [10, -300, -300], max: [12, 300, 300], part: "FRAME PLATE" }, Z = M.zones(st, [tank, frame], rad);
  check(Z[0].hold.has(tank) && !Z[0].hold.has(frame) && Z[1].hold.size === 0, "zones: the tank holds the port's station; a plate 10 mm in front of it does not");
  const fr = M.enumerate(st, { R, SF: 1.5, rad, boxes: [frame], makeRoute, optimiser });
  console.log(`     plate in front of a station: ${fr.tried} ways; ${fr.none && fr.none.text}`);
  check(fr.tried > 1 && !fr.candidates.some(c => c.ok) && fr.candidates.every(c => c.clearance < 0),
    `a plate 10 mm in front of a station is in the way (${fr.tried} ways, gaps ${fr.candidates.map(c => c.clearance.toFixed(1))}), not silenced by the zone`);
  check(fr.none && fr.none.rule !== "radius" && fr.none.part === "FRAME PLATE" && /^FRAME PLATE is in the way/.test(fr.none.text), "and the report names it");
  // a 14 mm plate near a station: the leg's samples and the clearance's no longer step over it, and a route that holds R is
  // never reported as a radius problem (it was “… tighter than R 50 (best R Infinity)”)
  const thin = { min: [15, -300, -300], max: [29, 300, 300] }, th = M.enumerate(st, { R, SF: 1.5, rad, boxes: [thin], makeRoute, optimiser });
  console.log(`     14 mm plate: ${th.tried} ways; ${th.none && th.none.text}`);
  check(M.blockers(st[0].p, st[1].p, [thin], rad, null, M.zones(st, [thin], rad)).length === 1, "a 14 mm plate across the leg is a blocker (samples every ≤ rad)");
  check(th.candidates.every(c => c.ok || c.clearance < 0 || c.minR < R), "every route that is not clean says why by its gap or its radius (no hidden solver depth)");
  check(th.none && th.none.rule !== "radius" && th.none.part === "B1" && !/Infinity/.test(th.none.text), `the report is a gap one and names the plate (${th.none && th.none.rule})`); }
// a solver that still counts depth where the measured gap holds (r.obs > 0, clearance ≥ 0) on a straight route (min R ∞):
// a gap failure in plain words, not “needs a bend tighter than R 50 (best R Infinity)”
{ const stuck = (route, dR) => ({ step: () => { const e = route.evalX(route.x, 60); return { x: route.x.slice(), it: 900, minR: 1 / e.kmax, len: e.len, obs: 1, done: true }; } });
  const sk = M.enumerate([A, B], { R, rad, boxes: [{ min: [400, 300, -50], max: [600, 400, 50] }], makeRoute, optimiser: stuck });
  console.log(`     solver depth only: ${sk.none && sk.none.text}`);
  check(sk.none && sk.none.rule === "gap" && !/Infinity|tighter/.test(sk.none.text) && /in the way/.test(sk.none.text), `solver depth only: reported as a part in the way (${sk.none && sk.none.rule})`); }
// an unnamed plate given as two faces is one obstacle, named after its first face whichever face a route is closest to
{ const halves = [{ min: [490, -600, -600], max: [510, 600, 0] }, { min: [490, -600, 0], max: [510, 600, 600] }];
  const hv = M.enumerate([{ p: [420, 0, 0], dir: [1, 0, 0] }, { p: [580, 0, 0], dir: [1, 0, 0] }], { R, SF: 1.5, rad, boxes: halves, makeRoute, optimiser });
  console.log(`     two-face plate: ${hv.none && hv.none.text}`);
  check(hv.none && /^B1 is in the way on every side tried: /.test(hv.none.text) && hv.candidates.every(c => c.near.part === "B1"), "an unnamed two-face plate (lower and upper half) is reported as B1 on every side, not B1 on some and B2 on others"); }
// repeated clips of one product share a name: far apart they are two obstacles (4 × 4 ways), close together one
{ const clip = x => ({ min: [x - 10, -30, -30], max: [x + 10, 30, 30], part: "992328" });
  const two = M.start([A, B], { R, rad, boxes: [clip(300), clip(700)], makeRoute, optimiser }), one = M.start([A, B], { R, rad, boxes: [clip(490), clip(510)], makeRoute, optimiser });
  check(two.tried === 16 && one.tried === 4, `two 992328 clips 400 mm apart: ${two.tried} ways (two obstacles); touching: ${one.tried} (one)`); }

if (fail) { console.log(`${fail} failed`); process.exit(1); }
