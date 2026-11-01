// node tests/through-avoid.test.js — Phase 6 step 3: Through.solve with opt.avoid keeps the route clear of parts.
// Synthetic: exact box obstacles (signed distance), no samples needed.
const T = require("../js/through.js"), AR = require("../js/arcroute.js");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(...a);
// signed distance to a box (negative inside)
const sdf = (p, b) => { const q = [0, 1, 2].map(k => Math.max(b.min[k] - p[k], p[k] - b.max[k]));
  const out = Math.hypot(...q.map(v => Math.max(v, 0))), inn = Math.min(Math.max(...q), 0); return out + inn; };
const avoidOf = (boxes, OD, need) => ({ need, rad: OD / 2, step: 2,
  gap: p => Math.min(...boxes.map(b => sdf(p, b))) - OD / 2,
  local: pts => { const near = boxes.filter(b => pts.some(p => sdf(p, b) < OD / 2 + need + 5)), use = near.length ? near : boxes;
    return { gap: p => Math.min(...use.map(b => sdf(p, b))) - OD / 2, box: { min: [0, 1, 2].map(k => Math.min(...use.map(b => b.min[k]))), max: [0, 1, 2].map(k => Math.max(...use.map(b => b.max[k]))) }, name: use.map(b => b.name).join(", ") }; } });
const minGap = (W, R, f) => Math.min(...AR.sample(AR.build(W, R), 1).pts.map(f));
const endsKept = (W, W0) => len(sub(W[0], W0[0])) < 1e-6 && len(sub(W[W.length - 1], W0[W0.length - 1])) < 1e-6;

// 1. a U route; a block 3 mm into the middle straight: the corners slide (end straights keep their directions)
const W0 = [[0, 0, 0], [350, 0, 0], [350, 400, 0], [650, 400, 0]], R = 50, OD = 12;
const B1 = { name: "BLOCK_1", min: [353, 200, -30], max: [453, 260, 30] };
const a1 = avoidOf([B1], OD, 4);
check(minGap(W0, R, a1.gap) < -2.9, `before: ${minGap(W0, R, a1.gap).toFixed(1)} mm (3 mm into BLOCK_1)`);
let r = T.solve(W0, { R, clamps: [], avoid: a1 });
check(r.ok && minGap(r.W, R, a1.gap) >= 4 - 0.06, `moved clear: smallest gap ${minGap(r.W, R, a1.gap).toFixed(2)} mm (need 4)`);
check(endsKept(r.W, W0) && r.report.endDirErr < 1e-3, "ends and end directions kept");
check(r.steps.some(s => s.avoid && /BLOCK_1: corners near it moved/.test(s.how)), "step says how: " + r.steps.map(s => s.how).join("; "));
check(!r.left.length, "nothing left too close");

// 2. a wall across the middle straight, too wide to slide past: corners added, over or under it
const B2 = { name: "WALL", min: [-100, 180, -40], max: [800, 200, 40] };
const a2 = avoidOf([B2], OD, 4);
r = T.solve(W0, { R, clamps: [], avoid: a2, minStraight: 20 });
console.log("     " + r.steps.map(s => s.how).join("; ") + ` · ${r.W.length} points`);
check(r.ok && minGap(r.W, R, a2.gap) >= 4 - 0.06, `round the wall: smallest gap ${minGap(r.W, R, a2.gap).toFixed(2)} mm, ${r.W.length} points`);
check(endsKept(r.W, W0) && r.report.endDirErr < 1e-3, "ends and end directions kept");
check(r.report.straights.slice(1, -1).every(s => s >= 20 - 1e-3), `every inner straight ≥ min straight (${r.report.straights.map(s => s.toFixed(0)).join(", ")})`);

// 3. a clamp on the middle straight is held while another part is avoided
const clamp = { c: [350, 120, 0], a: [0, 1, 0], length: 20, name: "CLAMP" };
r = T.solve(W0, { R, clamps: [clamp], avoid: avoidOf([{ name: "BOX", min: [353, 300, -30], max: [400, 340, 30] }], OD, 4) });
console.log("     " + r.steps.map(s => s.how).join("; "));
check(r.ok && r.report.clamps[0].ok, `clamp still straight through (${r.report.clamps[0].maxOff.toFixed(3)} mm off its axis)`);
check(minGap(r.W, R, avoidOf([{ min: [353, 300, -30], max: [400, 340, 30] }], OD, 4).gap) >= 4 - 0.06, "and the box is cleared");

// 4. a part on an end straight cannot be avoided (the end and its direction are fixed): reported, route unchanged
const BE = { name: "END_BLOCK", min: [500, 403, -30], max: [560, 450, 30] };
r = T.solve(W0, { R, clamps: [], avoid: avoidOf([BE], OD, 4) });
check(r.ok && r.left.length === 1 && r.left[0].name === "END_BLOCK", `left: ${r.left.map(x => `${x.name} ${x.g.toFixed(1)} mm`).join(", ")}`);
check(r.W.every((p, i) => len(sub(p, W0[i])) < 1e-3), "route unchanged when nothing helps");

// 5. no avoid: same result as before
const r0 = T.solve(W0, { R, clamps: [clamp] }), r1 = T.solve(W0, { R, clamps: [clamp], avoid: avoidOf([{ min: [1e4, 1e4, 1e4], max: [1e4 + 1, 1e4 + 1, 1e4 + 1] }], OD, 4) });
check(JSON.stringify(r0.W) === JSON.stringify(r1.W), "nothing near: the same route as without avoid");
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
