// node tests/clamp-suggest.test.js — Q7: where to add clamps on a route
const G = require("../js/clamp-suggest.js");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
// a route: 1000 mm straight along X, a 90° bend R 100 up to +Z, then 600 mm straight up
const pts = [], s = [], k = [];
const push = (p, kk) => { if (pts.length) s.push(s[s.length - 1] + Math.hypot(...p.map((v, j) => v - pts[pts.length - 1][j]))); else s.push(0); pts.push(p); k.push(kk); };
for (let x = 0; x <= 1000; x += 10) push([x, 0, 0], 0);
for (let a = 1; a <= 30; a++) { const t = a / 30 * Math.PI / 2; push([1000 + 100 * Math.sin(t), 0, 100 - 100 * Math.cos(t)], 1 / 100); }
for (let z = 110; z <= 700; z += 10) push([1100, 0, z], 0);
const route = { pts, s, k }, L = s[s.length - 1];
const st = [{ name: "S1", c: [0, 0, 0], part: "22402156" }, { name: "S2", c: [500, 0, 0], part: "22402156" }, { name: "S3", c: [1100, 0, 700], part: "990224" }];
// a rail under the straight, a bracket beside the vertical leg, an existing pipe right on the route (must be ignored)
const solids = [{ name: "FRAME / RAIL", faces: [{ min: [-50, -40, -60], max: [1050, 40, -20] }] }, { name: "FRAME / BRACKET", faces: [{ min: [1120, -30, 0], max: [1160, 30, 720] }] },
  { name: "S1 clip", faces: [{ min: [-10, -10, -10], max: [10, 10, 10] }] }, { name: "OLD PIPE", pipe: true, faces: [{ min: [0, -5, -5], max: [1100, 5, 5] }] }];

const r = G.suggest(route, st, { maxSpan: 300, nearBend: 60, R: 65, reach: 60, solids });
r.list.forEach((q, i) => console.log(`     +${i + 1} at ${q.s.toFixed(0)} mm: ${q.why}; ${q.mount ? "on " + q.mount.name + " " + q.mount.gap.toFixed(1) + " mm" : "no mount"}; like ${q.like && q.like.name} (${q.like && q.like.why})`));
check(Math.abs(L - (1000 + Math.PI * 50 + 600)) < 1, `route length ${L.toFixed(1)} mm`);
check(r.supports.filter(x => !x.end).length === 3, "the 3 stations on the route hold it");
const bendA = 1000, bendB = 1000 + Math.PI * 50;
check(r.list.some(q => /before the bend/.test(q.why) && q.s < bendA && q.s >= bendA - 60) && r.list.some(q => /after the bend/.test(q.why) && q.s > bendB && q.s <= bendB + 60),
  "one clamp before the bend and one after, each within 60 mm of it");
const all = r.supports.map(x => x.s).concat(r.list.map(q => q.s)).sort((a, b) => a - b);
let worst = 0; for (let i = 1; i < all.length; i++) worst = Math.max(worst, all[i] - all[i - 1]);
check(worst <= 300 + 1e-6, `no span over 300 mm afterwards (longest ${worst.toFixed(0)})`);
check(r.list.filter(q => q.s > 0 && q.s < 500).length === 1, `S1–S2: exactly one added (${r.list.filter(q => q.s > 0 && q.s < 500).map(q => q.s.toFixed(0))})`);
const onRail = r.list.filter(q => q.s < bendA), onBr = r.list.filter(q => q.s > bendB + 100);
check(onRail.every(q => q.mount && q.mount.name === "FRAME / RAIL"), "on the straight: mounts on the rail, the existing pipe is not a mount");
check(onRail.every(q => q.like && /^S[12]$/.test(q.like.name) && q.like.why === "same mounting part"), "and is like S1 / S2 (same rail)");
check(onBr.length && onBr.every(q => q.mount && q.mount.name === "FRAME / BRACKET" && q.like.name === "S3"), "on the vertical leg: mounts on the bracket, like S3");
const none = G.suggest(route, st, { maxSpan: 300, R: 65, reach: 5, solids });
check(none.list.some(q => !q.mount), "reach 5 mm: some have no part to mount on (needs a bracket)");
const fine = G.suggest(route, [{ name: "A", c: [0, 0, 0] }, ...[250, 500, 750, 950].map((x, i) => ({ name: "B" + i, c: [x, 0, 0] })), { name: "C", c: [1100, 0, 140] }, { name: "D", c: [1100, 0, 420] }, { name: "E", c: [1100, 0, 700] }], { maxSpan: 300, R: 65 });
check(fine.list.length === 0, `held well enough already: nothing to add (${fine.list.map(q => q.why)})`);
const nob = G.suggest(route, st, { maxSpan: 300, R: 65, bends: false });
check(!nob.list.some(q => /bend/.test(q.why)), "bend rule off: spans only");
if (fail) { console.log(`${fail} failed`); process.exit(1); }
