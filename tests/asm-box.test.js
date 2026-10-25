// node tests/asm-box.test.js — each placed part's world box (StepAsm instance.bbox) is the box of its placed geometry,
// not the rotated corners of its local box (which grew on rotated parts). Needs samples/frame_asm.stp.
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "../samples/frame_asm.stp");
if (!fs.existsSync(F)) { console.log("skip: samples/frame_asm.stp not found"); process.exit(0); }
global.StepAsm = require("../js/step-asm.js"); const C = require("../js/cad-solids.js");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const text = fs.readFileSync(F, "utf8"), r = StepAsm.parse(text), cad = C.read(text, "frame.stp", { parsed: r });
let n = 0, worst = 0;
r.instances.forEach((I, i) => { const S = cad.solids.filter(s => s.inst === i); if (!I.bbox || !S.length) return; n++;
  worst = Math.max(worst, ...[0, 1, 2].flatMap(k => [Math.abs(I.bbox.min[k] - Math.min(...S.map(s => s.min[k]))), Math.abs(I.bbox.max[k] - Math.max(...S.map(s => s.max[k])))])); });
check(n > 300 && worst < 0.01, `${n} placed parts: box = box of the placed faces (worst ${worst.toFixed(3)} mm)`);
const dims = name => { const I = r.instances.find(x => x.name === name); return I.bbox.max.map((v, k) => v - I.bbox.min[k]); };
const a = dims("980464_AF54");
check(Math.abs(a[0] - 44.8) < 0.2 && Math.abs(a[1] - 57.7) < 0.2 && Math.abs(a[2] - 48.4) < 0.2, `980464_AF54 (rotated): ${a.map(v => v.toFixed(1)).join(" × ")} mm, was 55 × 70 × 77`);
const b = dims("22648999");
check(Math.abs(Math.max(...b) - 156) < 0.5, `bracket 22648999: ${b.map(v => v.toFixed(1)).join(" × ")} mm`);
// each face box holds the face's boundary (StepAsm face.loops, placed). From vertices + whole edge circles alone, a face bounded
// by spline edges got a box that missed it (solid 241, 22399162_2: 12.4 × 0.0 × 36.3 mm, boundary 18 mm outside), and
// index().nearest, which skips a box farther than its best so far, then missed the face
const src = []; r.instances.forEach(I => I.part.solids.forEach(s => s.faces.forEach(f => { if (f.verts.length || f.loops.length || f.edges.length) src.push({ M: I.M, f }); })));
check(src.length === cad.faces.length, `${cad.faces.length} face boxes, one per StepAsm face`);
let out = 0, nEx = 0, far = null;
cad.faces.forEach((b, i) => { if (!b.shape || (b.shape.kind !== "plane" && b.shape.kind !== "cyl")) return; nEx++; const { M, f } = src[i];
  const old = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }, grow = p => [0, 1, 2].forEach(k => { old.min[k] = Math.min(old.min[k], p[k]); old.max[k] = Math.max(old.max[k], p[k]); });
  f.verts.forEach(v => grow(StepAsm.F.pt(M, v)));
  f.edges.forEach(e => { const c = StepAsm.F.pt(M, e.ax.o), n = StepAsm.F.vec(M, e.ax.z); [0, 1, 2].forEach(k => { const s = e.r * Math.sqrt(Math.max(0, 1 - n[k] * n[k])); grow(c.map((v, j) => j === k ? v - s : v)); grow(c.map((v, j) => j === k ? v + s : v)); }); });
  f.loops.forEach(l => l.forEach(q => { const p = StepAsm.F.pt(M, q), d = C.boxDist(p, b), e = C.boxDist(p, old); out = Math.max(out, d); if (!far || e > far.e) far = { e, p, b }; })); });
check(nEx > 10000 && out <= 0.05, `${nEx} exact faces: every boundary sample inside its face box (worst ${out.toFixed(3)} mm outside)`);
// the face whose boundary lay farthest outside the old box, and a decoy box 8.7 mm from a point on it, tested first (one big
// cell, in order): the face is then skipped unless its box reaches the point
{ const { e, p, b } = far, decoy = { min: p.map(v => v + 5), max: p.map(v => v + 6), sid: -1 }, n = C.index([decoy, b], 1e5).nearest(p, 20);
  check(e > 10 && n.box === b && n.d < 0.02, `a point on the face that was ${e.toFixed(1)} mm outside its old box: nearest = that face, ${n.d.toFixed(3)} mm (a decoy 8.7 mm off)`); }
if (fail) { console.log(`${fail} failed`); process.exit(1); }
