// node tests/make-surface-sample.js — writes samples/vendor_surfaces_asm.stp and samples/vendor_surfaces.igs
// (tests/surface-parts.test.js makes them in memory). Three 100 mm cubes side by side along X:
//   SOLID_PART      X 0…100    a solid (MANIFOLD_SOLID_BREP / IGES 186)
//   VENDOR_CLOSED   X 200…300  the same cube as six separate surfaces that close it off (STEP: SHELL_BASED_SURFACE_MODEL
//                              with an OPEN_SHELL, every face with its own copy of its edges; IGES: six 144 trimmed surfaces)
//   VENDOR_OPEN     X 400…500  five surfaces: the top (+Z) one is missing, so the 4 edges round it bound one face only
// That is how a vendor part arrives when its surfaces were never merged into a solid.
(function (root) {
"use strict";
const CUBES = [{ name: "SOLID_PART", x: 0, solid: true }, { name: "VENDOR_CLOSED", x: 200 }, { name: "VENDOR_OPEN", x: 400, skip: 5 }];
// the six faces of a cube from lo to hi: corner indices and normals (0..5 = -X +X -Y +Y -Z +Z)
const QUADS = [[[0,0,0],[0,1,0],[0,1,1],[0,0,1]], [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], [[0,0,0],[0,0,1],[1,0,1],[1,0,0]],
  [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], [[0,0,1],[0,1,1],[1,1,1],[1,0,1]]];
const NRM = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]], UX = [[0,1,0],[0,1,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0]];
const quads = (lo, hi, skip) => QUADS.map((q, f) => f === skip ? null : { f, pts: q.map(([i, j, k]) => [[lo, hi][i][0], [lo, hi][j][1], [lo, hi][k][2]]) }).filter(Boolean);

function step() {
  let id = 0; const L = [], E = s => { L.push(`#${++id}=${s};`); return id; };
  const n = v => { const s = (+v).toFixed(6); return s.includes(".") ? s : s + "."; };
  const P = p => E(`CARTESIAN_POINT('',(${p.map(n).join(",")}))`), D = d => E(`DIRECTION('',(${d.map(n).join(",")}))`);
  const AX = (o, z, x, name) => E(`AXIS2_PLACEMENT_3D('${name || ""}',#${P(o)},#${D(z)},#${D(x)})`), V = p => E(`VERTEX_POINT('',#${P(p)})`);
  const poly = pts => { const vs = pts.map(V), oes = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], d = q.map((v, k) => v - p[k]), l = Math.hypot(...d);
      const ln = E(`LINE('',#${P(p)},#${E(`VECTOR('',#${D(d.map(v => v / l))},${n(l)})`)})`);
      return E(`ORIENTED_EDGE('',*,*,#${E(`EDGE_CURVE('',#${vs[i]},#${vs[(i + 1) % pts.length]},#${ln},.T.)`)},.T.)`); });
    return E(`EDGE_LOOP('',(${oes.map(x => "#" + x).join(",")}))`); };
  const faces = (lo, hi, skip) => quads(lo, hi, skip).map(({ f, pts }) =>
    E(`ADVANCED_FACE('',(#${E(`FACE_OUTER_BOUND('',#${poly(pts)},.T.)`)}),#${E(`PLANE('',#${AX(pts[0], NRM[f], UX[f])})`)},.T.)`));
  const ctx = E(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT(())REPRESENTATION_CONTEXT('',''))`);
  const product = (name, rep, items) => { const pr = E(`PRODUCT('${name}','${name}','',())`), form = E(`PRODUCT_DEFINITION_FORMATION('1','',#${pr})`);
    const pd = E(`PRODUCT_DEFINITION('design','',#${form},$)`), pds = E(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
    E(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${E(`${rep}('',(${items.map(x => "#" + x).join(",")}),#${ctx})`)})`); return pd; };
  const kids = CUBES.map(c => { const F = faces([c.x, 0, 0], [c.x + 100, 100, 100], c.skip);
    return c.solid ? product(c.name, "ADVANCED_BREP_SHAPE_REPRESENTATION", [E(`MANIFOLD_SOLID_BREP('${c.name}',#${E(`CLOSED_SHELL('',(${F.map(f => "#" + f).join(",")}))`)})`)])
      : product(c.name, "MANIFOLD_SURFACE_SHAPE_REPRESENTATION", [E(`SHELL_BASED_SURFACE_MODEL('${c.name}',(#${E(`OPEN_SHELL('',(${F.map(f => "#" + f).join(",")}))`)}))`)]); });
  const top = product("VENDOR_SURFACES_ASM", "SHAPE_REPRESENTATION", [AX([0, 0, 0], [0, 0, 1], [1, 0, 0], "ASM_DEF_CSYS")]);
  kids.forEach((k, i) => E(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${i + 1}','${CUBES[i].name}','',#${top},#${k},$)`));
  return ["ISO-10303-21;", "HEADER;", "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('vendor_surfaces_asm.stp','',(''),(''),'','','');",
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));", "ENDSEC;", "DATA;", ...L, "ENDSEC;", "END-ISO-10303-21;"].join("\n") + "\n";
}

// IGES: the solid as 186 → 514 → 510 → 508 → 504 / 502 with 190 planes; the surface cubes as 144 trimmed surfaces on
// 128 bilinear planes, each bounded by a 142 whose model-space curve is a 102 composite of four 110 lines
function iges() {
  const ents = [];   // {type, params:[...], form}
  const E = (type, params, form) => { ents.push({ type, params, form: form || 0 }); return 2 * ents.length - 1; };   // DE pointer
  const f = v => { const s = (+v).toFixed(4); return s.includes(".") ? s : s + "."; };
  const pt = p => E(116, p);   // unused helper kept simple
  void pt;
  for (const c of CUBES) {
    const lo = [c.x, 0, 0], hi = [c.x + 100, 100, 100], Q = quads(lo, hi, c.skip);
    if (c.solid) {
      const corners = []; for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) corners.push([[lo, hi][i][0], [lo, hi][j][1], [lo, hi][k][2]]);
      const vix = p => corners.findIndex(q => q.every((v, k) => v === p[k])) + 1;
      const vl = E(502, [8, ...corners.flat()]);
      // one 504 edge list with every face's 4 edges (lines 110)
      const lines = [], el = []; Q.forEach(({ pts }) => pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; lines.push([p, q]); }));
      const lineDE = lines.map(([p, q]) => E(110, [...p, ...q]));
      lines.forEach(([p, q], i) => el.push(lineDE[i], vl, vix(p), vl, vix(q)));
      const edl = E(504, [lines.length, ...el]);
      const faceDE = Q.map(({ f: fi, pts }, qi) => { const loop = E(508, [4, ...[0, 1, 2, 3].flatMap(i => [0, edl, 4 * qi + i + 1, 1, 0])]);
        const pl = E(190, [], 0), o = E(116, pts[0]), nr = E(123, NRM[fi]); ents[(pl - 1) / 2].params = [o, nr]; ents[(pl - 1) / 2].form = 0;
        return E(510, [pl, 1, 1, loop]); });
      const sh = E(514, [faceDE.length, ...faceDE.flatMap(d => [d, 1])], 1);
      E(186, [sh, 1, 0]);
    } else {
      for (const { pts } of Q) {
        const [a, b, , d] = pts, bl = E(128, [1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1,
          ...a, ...b, ...d, ...b.map((v, k) => v + d[k] - a[k]), 0, 1, 0, 1]);
        const L = pts.map((p, i) => E(110, [...p, ...pts[(i + 1) % 4]])), comp = E(102, [4, ...L]);
        const b142 = E(142, [0, bl, 0, comp, 2]);
        E(144, [bl, 1, 0, b142]);
      }
    }
  }
  const pad = (s, w) => String(s).padStart(w), Dl = [], Pl = [];
  ents.forEach((e, i) => { const de = 2 * i + 1, body = e.type + "," + e.params.map(v => typeof v === "number" && !Number.isInteger(v) ? f(v) : String(v)).join(",") + ";";
    const start = Pl.length + 1; for (let k = 0; k < body.length || k === 0; k += 64) Pl.push(body.slice(k, k + 64).padEnd(64) + pad(de, 8) + "P" + pad(Pl.length + 1, 7));
    Dl.push(pad(e.type, 8) + pad(start, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad(0, 8) + pad("00000000", 8) + "D" + pad(de, 7));
    Dl.push(pad(e.type, 8) + pad(0, 8) + pad(0, 8) + pad(Pl.length - start + 1, 8) + pad(e.form, 8) + "".padEnd(24) + pad(0, 8) + "D" + pad(de + 1, 7)); });
  const S = ["Route Studio test: vendor surfaces".padEnd(72) + "S      1"], G = [",,;".padEnd(72) + "G      1"];
  const T = "S      1G      1D" + pad(Dl.length, 7) + "P" + pad(Pl.length, 7);
  return [...S, ...G, ...Dl, ...Pl, T.padEnd(72) + "T      1"].join("\n") + "\n";
}
root.makeSurfaceSample = { step, iges };
if (typeof require !== "undefined" && require.main === module) {
  const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "../samples");
  fs.writeFileSync(path.join(dir, "vendor_surfaces_asm.stp"), step()); fs.writeFileSync(path.join(dir, "vendor_surfaces.igs"), iges());
  console.log("wrote samples/vendor_surfaces_asm.stp, samples/vendor_surfaces.igs");
}
})(typeof module !== "undefined" ? module.exports : this);
