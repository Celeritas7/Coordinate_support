// node tests/surface-parts.test.js — vendor parts that come as surfaces (never merged into a solid) are read as solids:
// STEP SHELL_BASED_SURFACE_MODEL / OPEN_SHELL and IGES loose 144 trimmed surfaces. Samples from tests/make-surface-sample.js
const { makeSurfaceSample: M } = require("./make-surface-sample.js");
global.StepAsm = require("../js/step-asm.js"); const C = require("../js/cad-solids.js");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const box = (s, lo, hi) => [0, 1, 2].every(k => Math.abs(s.min[k] - lo[k]) < 0.05 && Math.abs(s.max[k] - hi[k]) < 0.05);

// STEP
const text = M.step(), r = StepAsm.parse(text), by = n => r.instances.find(i => i.name === n);
check(r.summary.solids === 3 && r.summary.surfaces === 2, `STEP: ${r.summary.solids} bodies, ${r.summary.surfaces} of them from surfaces`);
check(by("SOLID_PART").solids === 1 && !by("SOLID_PART").part.solids[0].surface, "SOLID_PART: a solid, as before");
const vc = by("VENDOR_CLOSED").part.solids[0], vo = by("VENDOR_OPEN").part.solids[0];
check(vc && vc.surface && vc.faces.length === 6 && vc.open === 0, `VENDOR_CLOSED: 6 surfaces, closed (open edges ${vc && vc.open}), though every face has its own copy of its edges`);
check(vo && vo.surface && vo.faces.length === 5 && vo.open === 4, `VENDOR_OPEN: 5 surfaces, 4 open edges round the missing top (${vo && vo.open})`);
check(box(by("VENDOR_CLOSED").bbox, [200, 0, 0], [300, 100, 100]), "VENDOR_CLOSED has its world box (X 200…300)");
const cad = C.read(text, "v.stp", { parsed: r });
check(cad.solids.length === 3 && cad.faces.length === 17, `obstacles: ${cad.solids.length} bodies, ${cad.faces.length} faces (6 + 6 + 5)`);
const sc = cad.solids.find(s => s.name === "VENDOR_CLOSED");
check(sc && sc.surface && sc.open === 0 && box(sc, [200, 0, 0], [300, 100, 100]), "VENDOR_CLOSED is an obstacle body, marked surface");
const f = cad.faces.filter(x => x.sid === sc.sid && x.shape && x.shape.kind === "plane");
check(f.length === 6, `its 6 faces are flat with exact outlines (${f.length})`);
// a point 10 mm above the closed vendor cube: 10 mm to its top face
const top = f.find(x => Math.abs(x.shape.n[2]) > 0.99 && x.min[2] > 99);
check(top && Math.abs(C.shapeDist(top.shape, [250, 50, 110]) - 10) < 1e-6, "10 mm over VENDOR_CLOSED: 10 mm to its top surface");

// IGES
const g = C.read(M.iges(), "v.igs");
check(g.solids.length === 3, `IGES: ${g.solids.length} bodies (1 solid + 2 from loose trimmed surfaces)`);
const gs = g.solids.filter(s => s.surface).sort((a, b) => a.min[0] - b.min[0]);
check(gs.length === 2 && gs[0].faces === 6 && gs[0].open === 0 && box(gs[0], [200, 0, 0], [300, 100, 100]), "IGES: X 200…300, 6 trimmed surfaces grouped into one body, closed");
check(gs[1] && gs[1].faces === 5 && gs[1].open === 4 && box(gs[1], [400, 0, 0], [500, 100, 100]), `IGES: X 400…500, 5 surfaces, 4 open edges (${gs[1] && gs[1].open})`);
check(g.faces.filter(x => x.shape && x.shape.kind === "plane").length === 17, "IGES: every face flat with its exact outline");
if (fail) { console.log(`${fail} failed`); process.exit(1); }
