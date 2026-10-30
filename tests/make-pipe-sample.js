// node tests/make-pipe-sample.js — writes samples/pipe_clear_test.stp (tests/pipe-clear.js makes it when missing)
// A small assembly for Phase 6 (clearance to parts on Pipe routes), all three parts placed at the origin:
//   PIPE_A   Ø12 pipe: straight along +X (0,0,0) → (300,0,0), 90° bend R 50 about Z, straight along +Y (350,50,0) → (350,400,0)
//   CLAMP_1  20 × 30 × 30 block with a Ø12.5 bore along X on the pipe's axis (X 140…160), CSYS CLAMP_1_CS in it
//   BLOCK_1  100 × 60 × 60 block, X 353…453, Y 200…260: the second straight runs 3 mm into it
// Only what the readers use: faces with their surfaces and edge loops (circles, lines), no end caps on the pipe.
(function (root) {
"use strict";
function make() {
  let id = 0; const L = [], E = s => { L.push(`#${++id}=${s};`); return id; };
  const n = v => { const s = (+v).toFixed(6); return s.includes(".") ? s : s + "."; };
  const P = p => E(`CARTESIAN_POINT('',(${p.map(n).join(",")}))`);
  const D = d => E(`DIRECTION('',(${d.map(n).join(",")}))`);
  const AX = (o, z, x, name) => E(`AXIS2_PLACEMENT_3D('${name || ""}',#${P(o)},#${D(z)},#${D(x)})`);
  const V = p => E(`VERTEX_POINT('',#${P(p)})`);
  const add = (a, b) => a.map((v, k) => v + b[k]), mul = (a, s) => a.map(v => v * s);
  // a full circle: one vertex at angle 0 (o + r·x)
  const ring = (o, z, x, r) => { const v = V(add(o, mul(x, r))), c = E(`CIRCLE('',#${AX(o, z, x)},${n(r)})`);
    const ec = E(`EDGE_CURVE('',#${v},#${v},#${c},.T.)`); return E(`EDGE_LOOP('',(#${E(`ORIENTED_EDGE('',*,*,#${ec},.T.)`)}))`); };
  const face = (surf, loops, sense) => E(`ADVANCED_FACE('',(${loops.map((l, i) => "#" + E(`${i ? "FACE_BOUND" : "FACE_OUTER_BOUND"}('',#${l},.T.)`)).join(",")}),#${surf},${sense ? ".T." : ".F."})`);
  // a polygon loop of line edges
  const poly = pts => { const vs = pts.map(V), oes = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], d = q.map((v, k) => v - p[k]), l = Math.hypot(...d);
      const ln = E(`LINE('',#${P(p)},#${E(`VECTOR('',#${D(mul(d, 1 / l))},${n(l)})`)})`);
      return E(`ORIENTED_EDGE('',*,*,#${E(`EDGE_CURVE('',#${vs[i]},#${vs[(i + 1) % pts.length]},#${ln},.T.)`)},.T.)`); });
    return E(`EDGE_LOOP('',(${oes.map(x => "#" + x).join(",")}))`); };
  // six plane faces of a box; holes: extra inner loops per face index (0..5 = -X +X -Y +Y -Z +Z)
  const box = (lo, hi, holes) => { const c = (i, j, k) => [[lo, hi][i][0], [lo, hi][j][1], [lo, hi][k][2]], F = [];
    const quads = [[[0,0,0],[0,1,0],[0,1,1],[0,0,1]], [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], [[0,0,0],[0,0,1],[1,0,1],[1,0,0]],
      [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], [[0,0,1],[0,1,1],[1,1,1],[1,0,1]]];
    const nrm = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]], ux = [[0,1,0],[0,1,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0]];
    quads.forEach((q, f) => { const pts = q.map(t => c(...t)), pl = E(`PLANE('',#${AX(pts[0], nrm[f], ux[f])})`);
      F.push(face(pl, [poly(pts), ...((holes || {})[f] || [])], true)); });
    return F; };
  const ctx = E(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT(())REPRESENTATION_CONTEXT('',''))`);
  const product = (name, items) => { const pr = E(`PRODUCT('${name}','${name}','',())`), form = E(`PRODUCT_DEFINITION_FORMATION('1','',#${pr})`);
    const pd = E(`PRODUCT_DEFINITION('design','',#${form},$)`), pds = E(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
    const rep = E(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${items.map(x => "#" + x).join(",")}),#${ctx})`);
    E(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`); return pd; };
  const solid = (name, faces) => E(`MANIFOLD_SOLID_BREP('${name}',#${E(`CLOSED_SHELL('',(${faces.map(f => "#" + f).join(",")}))`)})`);

  // pipe: cylinder, torus, cylinder; the end rings are shared by the faces that meet there
  const r = 6, R = 50, X = [1,0,0], Y = [0,1,0], Z = [0,0,1];
  const a0 = ring([0,0,0], X, Y, r), a1 = ring([300,0,0], X, Y, r), b0 = ring([350,50,0], Y, [-1,0,0], r), b1 = ring([350,400,0], Y, [-1,0,0], r);
  const pipe = [face(E(`CYLINDRICAL_SURFACE('',#${AX([0,0,0], X, Y)},${n(r)})`), [a0, a1], true),
    face(E(`TOROIDAL_SURFACE('',#${AX([300,50,0], Z, [0,-1,0])},${n(R)},${n(r)})`), [a1, b0], true),
    face(E(`CYLINDRICAL_SURFACE('',#${AX([350,50,0], Y, [-1,0,0])},${n(r)})`), [b0, b1], true)];
  // clamp: block X 140…160, Y −15…15, Z −15…15; bore Ø12.5 along X on the pipe's axis, a hole face (sense .F.)
  const rb = 6.25, c0 = ring([140,0,0], X, Y, rb), c1 = ring([160,0,0], X, Y, rb);
  const clamp = box([140,-15,-15], [160,15,15], { 0: [c0], 1: [c1] }).concat([face(E(`CYLINDRICAL_SURFACE('',#${AX([140,0,0], X, Y)},${n(rb)})`), [c0, c1], false)]);
  const block = box([353,200,-30], [453,260,30]);
  const kids = [product("PIPE_A", [solid("PIPE_A", pipe)]), product("CLAMP_1", [solid("CLAMP_1", clamp), AX([150,0,0], X, Y, "CLAMP_1_CS")]),
    product("BLOCK_1", [solid("BLOCK_1", block)])];
  const top = product("PIPE_CLEAR_TEST_ASM", [AX([0,0,0], Z, X, "ASM_DEF_CSYS")]);
  kids.forEach((k, i) => E(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${i + 1}','${["PIPE_A","CLAMP_1","BLOCK_1"][i]}','',#${top},#${k},$)`));
  return ["ISO-10303-21;", "HEADER;", "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('pipe_clear_test.stp','',(''),(''),'','','');",
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));", "ENDSEC;", "DATA;", ...L, "ENDSEC;", "END-ISO-10303-21;"].join("\n") + "\n";
}
root.makePipeSample = make;
if (typeof require !== "undefined" && require.main === module) {
  const fs = require("fs"), path = require("path"), out = path.join(__dirname, "../samples/pipe_clear_test.stp");
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, make()); console.log("wrote " + out);
}
})(typeof module !== "undefined" ? module.exports : this);
