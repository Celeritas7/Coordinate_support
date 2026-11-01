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

// 6. a pipe bend (torus face) is held to its arc: where the rest of the ring would be, the distance is to the nearer end of
// the bend, not to the full ring (generated sample, PIPE_A's first bend: centre 300 50 0, R 50, from (300,0,0) to (350,50,0))
const fs = require("fs"), path = require("path"), S = require("../js/step-asm.js"), C = require("../js/cad-solids.js");
const tor = C.read(require("./make-pipe-sample.js").makePipeSample(), "s.stp").faces.filter(f => f.shape && f.shape.kind === "tor")
  .find(f => Math.abs(f.shape.c[0] - 300) < 1e-6 && Math.abs(f.shape.c[1] - 50) < 1e-6);
const dRing = C.shapeDist(tor.shape, [300, 100, 0]), dArc = C.shapeDist(tor.shape, [300 + 50 * Math.SQRT1_2, 50 - 50 * Math.SQRT1_2, 9]);
check(tor.shape.th > 0 && Math.abs(tor.shape.th - Math.PI / 2) < 1e-3, `bend face arc: ${(tor.shape.th * 180 / Math.PI).toFixed(1)}°`);
check(Math.abs(dRing - Math.hypot(44, 50)) < 0.01, `where the rest of the ring would be: ${dRing.toFixed(2)} mm to the bend's end (was −6, "into" the full ring)`);
check(Math.abs(dArc - 3) < 1e-6, `on the arc: ${dArc.toFixed(3)} mm (3 mm off the tube)`);

// 7. piping3 (skipped without it): the gap between pipes 111 and 211 read from the faces = the gap between their
// centrelines; Go round on 111 (and 211) only nudges corners off the one real 2.44 mm spot, clamps held, no loop
const P3 = path.join(__dirname, "../samples/piping3_practice_asm.stp");
if (!fs.existsSync(P3)) console.log("skip: samples/piping3_practice_asm.stp not found");
else {
  global.ArcRoute = AR;
  const r = S.parse(fs.readFileSync(P3, "utf8")), cad = C.read("", "piping3.stp", { parsed: r }), inst = new Map(cad.solids.map(s => [s.sid, s.inst]));
  for (const pi of [0, 1]) {
    const p = r.pipes[pi], other = r.pipes[1 - pi], cl = r.clampsFor(pi).filter(c => c.use), OD = p.OD, rad = OD / 2, need = 4;
    // the page's survey and bcAvoider (bend-cad.js), for Pipe · Through clamps with the default ticks
    const sv = C.survey(cad, [p.Q[0], ...cl.map(c => c.fix.c), p.Q[p.Q.length - 1]], { d: OD, gap: need, reach: 60, line: p.Q });
    const kept = sv.parts.filter(q => q.role === "obstacle" || (q.role === "pipe" && inst.get(q.sid) !== p.inst));
    const faces = kept.flatMap(q => q.faces.map(f => ({ f, q }))), ix = C.index(faces.map(x => x.f), 50), rr = rad + need + 60;
    const g = (ixx) => q => { const n = ixx.nearest(q, rr); return isFinite(n.d) ? n.d - rad : 1e6; };
    const avoid = { need, rad, step: Math.max(1, Math.min(3, OD / 4)), gap: g(ix),
      local(pts) { const hit = faces.filter(x => pts.some(q => C.boxDist(q, x.f) <= rad + need + 5)); if (!hit.length) return { gap: this.gap, box: null, name: null };
        const box = { min: [0, 1, 2].map(k => Math.min(...hit.map(x => x.f.min[k]))), max: [0, 1, 2].map(k => Math.max(...hit.map(x => x.f.max[k]))) };
        return { gap: this.gap, box, name: [...new Set(hit.map(x => x.q.name.split(" / ").pop()))].join(", ") }; } };
    const opt = { R: p.R, minStraight: 30, margin: 2, dropDetours: true, clamps: cl.map(c => ({ c: c.fix.c, a: c.fix.d, length: c.fix.length, name: c.fix.name })) };
    const base = T.solve(p.Q, opt), cs = T.clashes(base.W, { ...opt, avoid }), B = other.samples.pts;
    const axis = q => Math.min(...B.map(b => len(sub(q, b)))) - other.OD / 2 - rad;
    check(cs.length === 1 && Math.abs(cs[0].g - axis(cs[0].p)) < 0.05, `${p.name.slice(-3)}: one place within 4 mm, ${cs.map(c => `${c.g.toFixed(2)} mm (centrelines: ${axis(c.p).toFixed(2)})`).join(", ")} — the bends of the other pipe no longer read as clashes`);
    const res = T.solve(p.Q, { ...opt, avoid }), moved = Math.max(...res.W.map((q, i) => len(sub(q, base.W[i]))));
    check(res.W.length === base.W.length && res.report.clamps.every(c => c.ok) && moved < 5 && !res.left.length,
      `${p.name.slice(-3)} with Go round: ${res.steps.filter(s => s.avoid).map(s => s.how).join("; ")}; corners moved ≤ ${moved.toFixed(2)} mm, ${res.W.length} points, clamps held`);
    check(minGap(res.W, p.R, avoid.gap) >= need - 0.06 && res.report.bends.filter(b => b > 100).length === base.report.bends.filter(b => b > 100).length,
      `${p.name.slice(-3)}: smallest gap ${minGap(res.W, p.R, avoid.gap).toFixed(2)} mm, no new sharp bend, ${Math.round(res.report.length - base.report.length)} mm longer`);
    // Route through points on the same pipe's ends and clamps (stations): via points only where needed, no sharp bend
    { const at = q => { let bi = 0, bd = 1e9; p.samples.pts.forEach((s, i) => { const d = len(sub(s, q)); if (d < bd) { bd = d; bi = i; } }); return bi; };
      const St = [p.Q[0], ...cl.map(c => c.fix.c).sort((a, b) => at(a) - at(b)), p.Q[p.Q.length - 1]], so = { R: p.R, Rmax: p.R * 1.5, tol: 0.05 };
      const sv2 = C.survey(cad, St, { d: OD, gap: need, reach: 60 }), kept2 = sv2.parts.filter(q => q.role === "obstacle" || (q.role === "pipe" && q.stations.length < 2));
      const f2 = kept2.flatMap(q => q.faces.map(f => ({ f, q }))), ix2 = C.index(f2.map(x => x.f), 50);
      const av2 = { ...avoid, gap: g(ix2), local(pts) { const hit = f2.filter(x => pts.some(q => C.boxDist(q, x.f) <= rad + need + 5)); if (!hit.length) return { gap: this.gap, box: null, name: null };
        return { gap: this.gap, box: { min: [0, 1, 2].map(k => Math.min(...hit.map(x => x.f.min[k]))), max: [0, 1, 2].map(k => Math.max(...hit.map(x => x.f.max[k]))) }, name: [...new Set(hit.map(x => x.q.name.split(" / ").pop()))].join(", ") }; } };
      const v = T.viaRound(St, so, av2), G = AR.build(v.res.W, v.res.R), r0 = AR.solve(St, so);
      check(v.res.ok && !v.left.length && minGap(v.res.W, v.res.R, av2.gap) >= need - 0.06 && G.corners.filter(c => c && c.th * 180 / Math.PI > 100).length === 0 &&
        Math.max(...St.map(q => AR.nearest(G, q, 0, v.res.W.length - 1).d)) <= 0.05,
        `${p.name.slice(-3)} through points (ends + clamps): ${v.steps.map(s => s.how).join("; ") || "nothing near, unchanged"}; gap ${minGap(v.res.W, v.res.R, av2.gap).toFixed(2)} mm (was ${minGap(r0.W, r0.R, av2.gap).toFixed(2)})`); }

  }
}

// 8. Route through points (ArcRoute): via points round a part, every station still on the curve
{ const SS = [[0, 0, 0], [250, 0, 0], [350, 100, 0], [350, 300, 0], [450, 400, 0], [650, 400, 0]], so = { R: 50, Rmax: 75, tol: 0.05 }, av = avoidOf([B1], 12, 4);
  const r0 = AR.solve(SS, so), v = T.viaRound(SS, so, av), G = AR.build(v.res.W, v.res.R);
  check(minGap(r0.W, r0.R, av.gap) < -2.9, `points route: ${minGap(r0.W, r0.R, av.gap).toFixed(1)} mm into BLOCK_1 before`);
  check(v.steps.length === 1 && /BLOCK_1: a via point added between P3 and P4/.test(v.steps[0].how) && minGap(v.res.W, v.res.R, av.gap) >= 4 - 0.06,
    `via: ${v.steps.map(s => s.how).join("; ")}; gap ${minGap(v.res.W, v.res.R, av.gap).toFixed(2)} mm`);
  check(Math.max(...SS.map(q => AR.nearest(G, q, 0, v.res.W.length - 1).d)) <= 0.05 && v.res.R >= 50, `every station on the curve, R ${v.res.R}`);
  const vn = T.viaRound(SS, so, avoidOf([{ min: [1e4, 1e4, 1e4], max: [1e4 + 1, 1e4 + 1, 1e4 + 1] }], 12, 4));
  check(JSON.stringify(vn.res.W) === JSON.stringify(r0.W) && !vn.via.length, "nothing near: the same route, no via"); }
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
