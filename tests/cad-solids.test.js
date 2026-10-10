// node tests/cad-solids.test.js — Phase 13: flat faces with holes, cylinders, plates; exact gap vs face boxes
const fs = require("fs"), path = require("path");
const C = require("../js/cad-solids.js"), ST = require("../js/step.js");
const read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const t0 = Date.now(), cad = C.read(read("u107338_fy26_test_frame_asm_111.igs"), "frame.igs");
check(cad.solids.length === 73 && cad.faces.length === 3682, `frame: ${cad.solids.length} solids, ${cad.faces.length} faces (${Date.now() - t0} ms)`);
const kinds = {}; cad.faces.forEach(f => { const k = f.shape ? f.shape.kind : "box"; kinds[k] = (kinds[k] || 0) + 1; });
check(kinds.plane > 1000 && kinds.cyl > 1000, `exact faces: ${kinds.plane} flat, ${kinds.cyl} cylinders, ${kinds.box} boxes`);
const s1 = cad.faces.filter(f => f.sid === 1 && f.shape && f.shape.kind === "plane");
const y1000 = s1.find(f => C.planeName(f.shape) === "Y 1000");
check(!!y1000, "solid 1 has its flat face at Y 1000");
check(y1000.shape.plate && Math.abs(y1000.shape.plate.t - 7) < 1e-6 && C.planeName(y1000.shape.plate.other.shape) === "Y 1007", "Y 1000 is one side of a 7 mm plate (other side Y 1007)");
check(y1000.max[0] - y1000.min[0] < 120, `its box is ${(y1000.max[0] - y1000.min[0]).toFixed(0)} mm across in X (outline -451…-335), not the 2040 mm of whole arc circles`);
const holes = y1000.shape.loops.filter(L => !L.outer);
check(holes.length === 10 && holes.every(L => L.round && Math.abs(2 * L.round.r - 15.5) < 0.1), `10 Ø15.5 holes in it`);
const sh = y1000.shape, at = (u, v, h) => [0, 1, 2].map(k => sh.o[k] + sh.eu[k] * u + sh.ev[k] * v + sh.n[k] * h);
const hc = holes[0].round.c;
check(Math.abs(C.shapeDist(sh, at(hc[0], hc[1], 0)) - 7.75) < 0.05, `hole centre, in the plane: ${C.shapeDist(sh, at(hc[0], hc[1], 0)).toFixed(2)} mm to the hole edge`);
check(Math.abs(C.shapeDist(sh, at(hc[0], hc[1], 3)) - Math.hypot(3, 7.75)) < 0.05, "3 mm off the plane over the hole: to the hole edge, not 3 mm");
check(Math.abs(C.shapeDist(sh, [-380, 990, -6000]) - 10) < 1e-6, "10 mm off the plate over its material: 10 mm");
check(Math.abs(C.shapeDist(sh, [-330, 1000, -6000]) - 5) < 1e-6, "5 mm beyond its edge X -335, in the plane: 5 mm");
// hole wall: a cylinder of solid 1 round one of those holes
const wall = cad.faces.find(f => f.sid === 1 && f.shape && f.shape.kind === "cyl" && Math.abs(f.shape.R - 7.75) < 0.05 && Math.abs(Math.abs(f.shape.z[1]) - 1) < 1e-6);
const mid = wall && wall.shape.a.map((v, k) => v + wall.shape.z[k] * (wall.shape.t0 + wall.shape.t1) / 2);
check(!!wall && Math.abs(C.shapeDist(wall.shape, mid) - 7.75) < 0.05, `hole wall: cylinder R 7.75 along Y${wall ? `, ${C.shapeDist(wall.shape, mid).toFixed(2)} mm from its axis` : " not found"}`);
// route_343434: stations, a smooth path through them, Frame-only parts
const csys = ST.parse(read("route_343434_csys.stp")).csys.filter(c => /^CS\d+$/.test(c.name)), P = csys.map(c => [c.x, c.y, c.z]);
check(P.length === 16, "route_343434: 16 CS stations");
const pts = []; for (let i = 0; i + 1 < P.length; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
  for (let k = i ? 1 : 0; k <= 60; k++) { const t = k / 60; pts.push([0, 1, 2].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t))); } }
const sv = C.survey(cad, P, { d: 8, gap: 4, reach: 60 }), kept = sv.parts.filter(p => p.role === "obstacle").flatMap(p => p.faces);
const exact = C.clearance(pts, C.index(kept, 50), 8, 48), boxes = C.clearance(pts, C.index(kept.map(f => ({ min: f.min, max: f.max, sid: f.sid })), 50), 8, 48);
check(boxes.gap < -3, `face boxes only: ${boxes.gap.toFixed(1)} mm (the old false alarm)`);
check(exact.gap > boxes.gap + 3 && exact.box.sid === 1, `exact: ${exact.gap.toFixed(1)} mm to solid 1, at the plate edge near P6`);
const op = C.openings(pts, kept, 100).filter(o => o.face.sid === 1 && /^Y 100[07]$/.test(C.planeName(o.face.shape)));
const near = (o, a, b) => { const z = o.x[2]; return z <= Math.max(P[a][2], P[b][2]) && z >= Math.min(P[a][2], P[b][2]); };
check(op.some(o => near(o, 5, 6)) && op.some(o => near(o, 13, 14)), `plate Y 1000 / 1007 crossed beside its edge at P6–P7 and P14–P15 (${op.length} crossings)`);
check(op.every(o => o.loop.outer), "no hole in the plate on the route: every crossing is past the plate edge");
process.exit(fail ? 1 : 0);
