// node tests/asm-cloud.test.js — assembly reader (Phase A): placements and the edge cloud, on a small built-in assembly,
// then the acceptance numbers on samples/u107338_fy26_test_frame_asm.stp when that file is present
const fs = require("fs"), path = require("path");
const S = require("../js/step-asm.js");
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const cloudPts = c => { const o = []; for (let i = 0; i < c.length; i += 3) o.push([c[i], c[i + 1], c[i + 2]]); return o; };
const nearestTo = (pts, q) => Math.min(...pts.map(p => dist(p, q)));

// ---- built-in assembly: ASM -> SUB -> PART (placed twice), PART rotated 90° about Z ----
function build() {
  const L = []; let n = 0;
  const e = s => { L.push(`#${++n}=${s};`); return n; };
  const pt = (x, y, z, nm) => e(`CARTESIAN_POINT('${nm || ""}',(${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}))`);
  const dir = (x, y, z) => e(`DIRECTION('',(${x}.,${y}.,${z}.))`);
  const ax = (o, z, x, nm) => e(`AXIS2_PLACEMENT_3D('${nm || ""}',#${pt(...o)},#${dir(...z)},#${dir(...x)})`);
  const ctx = e(`APPLICATION_CONTEXT('')`);
  const product = name => { const p = e(`PRODUCT('${name}','${name}','',(#${ctx}))`), f = e(`PRODUCT_DEFINITION_FORMATION('','',#${p})`);
    return e(`PRODUCT_DEFINITION('design','',#${f},#${ctx})`); };
  const shapeOf = (pd, rep) => e(`SHAPE_DEFINITION_REPRESENTATION(#${e(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`)},#${rep})`);
  const vtx = (x, y, z) => e(`VERTEX_POINT('',#${pt(x, y, z)})`);
  // part: a line, a reversed circle edge (270° arc), a B-spline inside SURFACE_CURVE; the face name quotes a stray edge id
  const line = e(`LINE('',#${pt(0, 0, 0)},#${e(`VECTOR('',#${dir(1, 0, 0)},1.)`)})`);
  const e1 = e(`EDGE_CURVE('',#${vtx(0, 0, 0)},#${vtx(100, 0, 0)},#${line},.T.)`);
  const circ = e(`CIRCLE('',#${ax([0, 0, 0], [0, 0, 1], [1, 0, 0])},10.)`);
  const e2 = e(`EDGE_CURVE('',#${vtx(10, 0, 0)},#${vtx(0, 10, 0)},#${circ},.F.)`);
  const bs = e(`B_SPLINE_CURVE_WITH_KNOTS('',2,(#${pt(0, 0, 50)},#${pt(50, 0, 100)},#${pt(100, 0, 50)}),.UNSPECIFIED.,.F.,.F.,(3,3),(0.,1.),.UNSPECIFIED.)`);
  const sc = e(`SURFACE_CURVE('',#${bs},(),.CURVE_3D.)`);
  const e3 = e(`EDGE_CURVE('',#${vtx(0, 0, 50)},#${vtx(100, 0, 50)},#${sc},.T.)`);
  const strayLine = e(`LINE('',#${pt(5000, 5000, 5000)},#${e(`VECTOR('',#${dir(1, 0, 0)},1.)`)})`);
  const stray = e(`EDGE_CURVE('',#${vtx(5000, 5000, 5000)},#${vtx(5001, 5000, 5000)},#${strayLine},.T.)`);
  const oe = [e1, e2, e3].map(id => e(`ORIENTED_EDGE('',*,*,#${id},.T.)`));
  const loop = e(`EDGE_LOOP('',(${oe.map(i => "#" + i).join(",")}))`);
  const face = e(`ADVANCED_FACE('Face see #${stray}',(#${e(`FACE_OUTER_BOUND('',#${loop},.T.)`)}),#${e(`PLANE('',#${ax([0, 0, 0], [0, 0, 1], [1, 0, 0])})`)},.T.)`);
  const brep = e(`MANIFOLD_SOLID_BREP('Placement #${stray}',#${e(`CLOSED_SHELL('',(#${face}))`)})`);
  const partPD = product("PART_A"), subPD = product("SUB_B"), asmPD = product("ASM_C");
  const partRep = e(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(#${brep},#${ax([0, 0, 0], [0, 0, 1], [1, 0, 0])}),#${ctx})`);
  const subRep = e(`SHAPE_REPRESENTATION('',(#${ax([0, 0, 0], [0, 0, 1], [1, 0, 0])}),#${ctx})`);
  const asmRep = e(`SHAPE_REPRESENTATION('',(#${ax([0, 0, 0], [0, 0, 1], [1, 0, 0])}),#${ctx})`);
  shapeOf(partPD, partRep); shapeOf(subPD, subRep); shapeOf(asmPD, asmRep);
  const use = (parent, pRep, child, cRep, o, z, x, k) => {
    const nauo = e(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${k}','${k}','',#${parent},#${child},$)`);
    const idt = e(`ITEM_DEFINED_TRANSFORMATION('Placement #${stray}','',#${ax([0, 0, 0], [0, 0, 1], [1, 0, 0])},#${ax(o, z, x)})`);
    const rr = e(`(REPRESENTATION_RELATIONSHIP('','',#${cRep},#${pRep})REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#${idt})SHAPE_REPRESENTATION_RELATIONSHIP())`);
    e(`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#${rr},#${e(`PRODUCT_DEFINITION_SHAPE('','',#${nauo})`)})`);
  };
  use(asmPD, asmRep, subPD, subRep, [0, 0, 500], [0, 0, 1], [1, 0, 0], "U1");
  use(subPD, subRep, partPD, partRep, [1000, 2000, 3000], [0, 0, 1], [0, 1, 0], "U2");
  use(asmPD, asmRep, partPD, partRep, [0, 0, 0], [0, 0, 1], [1, 0, 0], "U3");
  return `ISO-10303-21;\nHEADER;\nFILE_NAME('t.stp','',(''),(''),'','','');\nENDSEC;\nDATA;\n${L.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}

const stages = new Set();
const r = S.parse(build(), { progress: s => stages.add(s) });
check(r.summary.parts === 3 && r.summary.instances === 4 && r.summary.placed === 2, `built-in: ${r.summary.parts} products, ${r.summary.instances} instances, ${r.summary.placed} with geometry`);
const placed = r.instances.filter(i => i.cloud);
const deep = placed.find(i => i.depth === 2), flat = placed.find(i => i.depth === 1);
check(deep && flat && deep.edges === 3, `edges per part: ${deep && deep.edges} (the stray edge named in quotes is not walked)`);
const D = cloudPts(deep.cloud), Fp = cloudPts(flat.cloud);
check(dist(deep.bbox.min, [990, 1990, 3500]) < 0.5 && dist(deep.bbox.max, [1010, 2100, 3575]) < 0.5,
  `nested + rotated placement, box ${deep.bbox.min.map(v => v.toFixed(1))} … ${deep.bbox.max.map(v => v.toFixed(1))}`);
check(nearestTo(D, [1000, 2100, 3500]) < 1e-3, "line end (100,0,0) lands at (1000,2100,3500)");
check(nearestTo(Fp, [-10, 0, 0]) < 2 && nearestTo(Fp, [0, -10, 0]) < 2 && nearestTo(Fp, [7.071, 7.071, 0]) > 5, "reversed circle edge covers the 270° arc, not the 90° one");
check(Fp.some(p => Math.abs(p[0] - 48.276) < 1e-2 && Math.abs(p[2] - (50 + 50 * 0.48276 * (1 - 0.48276) * 2)) < 1e-2) && Math.max(...Fp.map(p => p[2])) < 75.001, "B-spline inside SURFACE_CURVE evaluated on the curve (peak z 75)");
check(Math.max(...Fp.map((p, i) => Math.min(...Fp.filter((q, j) => j !== i).map(q => dist(p, q))))) <= 5.01, "every cloud point has a neighbour within 5 mm");
check(stages.has("Placing parts") && stages.has("Done"), "progress reported");
check(typeof r.clampsFor === "function" && typeof S.attach({ csys: [], pipes: [], fixings: [] }).matchFrame === "function", "result methods re-attach to plain data (worker path)");

// ---- the frame sample (Phase A acceptance) ----
const big = path.join(__dirname, "../samples/u107338_fy26_test_frame_asm.stp");
if (!fs.existsSync(big)) {
  console.log("skip samples/u107338_fy26_test_frame_asm.stp not found: acceptance checks not run");
} else {
  const t0 = Date.now(), R = S.parse(fs.readFileSync(big, "utf8"));
  console.log(`     read in ${Date.now() - t0} ms: ${R.entities} entities, ${R.summary.cloudPoints} cloud points`);
  check(R.summary.parts === 50, `${R.summary.parts} products (expect 50)`);
  check(R.summary.placed === 63, `${R.summary.placed} placed part instances (expect 63)`);
  const box = (b, lo, hi, tol) => b && lo.every((v, k) => Math.abs(b.min[k] - v) <= tol) && hi.every((v, k) => Math.abs(b.max[k] - v) <= tol);
  const fmtB = b => b ? `${b.min.map(v => v.toFixed(1))} … ${b.max.map(v => v.toFixed(1))}` : "none";
  const frame = R.instances.find(i => i.cloud && /FY26_TEST_FRAME__2/i.test(i.name));
  check(frame && box(frame.bbox, [-1515, 1000, -10985], [544, 1300, -1710], 2), `FY26_TEST_FRAME__2 box ${fmtB(frame && frame.bbox)}`);
  const bolts = R.instances.filter(i => i.cloud && /991640/.test(i.name));
  const bolt = bolts.find(i => box(i.bbox, [-441.7, 1047.9, -5760.5], [-387.7, 1072.1, -5739.5], 0.15));
  check(!!bolt, `991640 near CS33: ${bolts.map(i => fmtB(i.bbox)).join(" | ") || "no instance"}`);
}
process.exit(fail ? 1 : 0);
