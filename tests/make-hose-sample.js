// node tests/make-hose-sample.js — writes samples/hose_spline_test.stp + .pts
// A hose swept along a cubic spline, exported the way Creo writes a spline sweep: the skin is two rational
// B-spline faces (half circles round, cubic along), plus the trajectory as a datum curve and three CSYS.
// The path is known exactly, so the reader's recovered centreline can be checked against it.
(function (root) {
"use strict";
const PATH = [[0,0,0],[0,0,60],[40,0,120],[80,30,160],[80,60,220],[80,60,300]], KN = [0,1/3,2/3,1], KM = [4,1,1,4];
const R = 8, MAIN = [-200, 0, 0];

function make() {
  let id = 0; const L = [], E = s => { L.push(`#${++id}=${s};`); return id; };
  const n = v => { const s = (+v).toFixed(6); return s.includes(".") ? s : s + "."; };
  const P = p => E(`CARTESIAN_POINT('',(${p.map(n).join(",")}))`);
  const D = d => E(`DIRECTION('',(${d.map(n).join(",")}))`);
  const AX = (name, o, z, x) => E(`AXIS2_PLACEMENT_3D('${name}',#${P(o)},#${D(z)},#${D(x)})`);
  const w = Math.SQRT1_2;
  const halves = [[[R,0,1],[R,R,w],[0,R,1],[-R,R,w],[-R,0,1]], [[-R,0,1],[-R,-R,w],[0,-R,1],[R,-R,w],[R,0,1]]];
  const faces = halves.map(h => {
    const rows = h.map(([x, y]) => "(" + PATH.map(c => "#" + P([c[0] + x, c[1] + y, c[2]])).join(",") + ")");
    const wts = h.map(([, , wt]) => "(" + PATH.map(() => n(wt)).join(",") + ")");
    const S = E(`(BOUNDED_SURFACE()B_SPLINE_SURFACE(2,3,(${rows.join(",")}),.UNSPECIFIED.,.F.,.F.,.F.)B_SPLINE_SURFACE_WITH_KNOTS((3,2,3),(${KM.join(",")}),(0.,0.5,1.),(${KN.map(n).join(",")}),.UNSPECIFIED.)GEOMETRIC_REPRESENTATION_ITEM()RATIONAL_B_SPLINE_SURFACE((${wts.join(",")}))REPRESENTATION_ITEM('')SURFACE())`);
    return E(`ADVANCED_FACE('',(),#${S},.T.)`);
  });
  const shell = E(`CLOSED_SHELL('',(${faces.map(f => "#" + f).join(",")}))`), brep = E(`MANIFOLD_SOLID_BREP('HOSE',#${shell})`);
  const cs = [AX("MAIN", MAIN, [0,0,1], [1,0,0]), AX("HOSE_START", PATH[0], [0,0,1], [1,0,0]), AX("HOSE_END", PATH[5], [0,0,1], [1,0,0])];
  const curve = E(`B_SPLINE_CURVE_WITH_KNOTS('HOSE_PATH',3,(${PATH.map(p => "#" + P(p)).join(",")}),.UNSPECIFIED.,.F.,.F.,(${KM.join(",")}),(${KN.map(n).join(",")}),.UNSPECIFIED.)`);
  const set = E(`GEOMETRIC_CURVE_SET('',(#${curve}))`);
  const ctx = E(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT(())REPRESENTATION_CONTEXT('',''))`);
  const prod = E(`PRODUCT('HOSE_SPLINE_TEST','HOSE_SPLINE_TEST','',())`), form = E(`PRODUCT_DEFINITION_FORMATION('1','',#${prod})`);
  const pd = E(`PRODUCT_DEFINITION('design','',#${form},$)`), pds = E(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
  const rep = E(`ADVANCED_BREP_SHAPE_REPRESENTATION('HOSE_SPLINE_TEST',(#${brep},${cs.map(c => "#" + c).join(",")}),#${ctx})`);
  const wire = E(`GEOMETRICALLY_BOUNDED_WIREFRAME_SHAPE_REPRESENTATION('',(#${set}),#${ctx})`);
  E(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);
  E(`SHAPE_REPRESENTATION_RELATIONSHIP('','',#${rep},#${wire})`);
  const stp = ["ISO-10303-21;", "HEADER;", "FILE_DESCRIPTION(('Route Studio test: hose swept along a spline'),'2;1');",
    "FILE_NAME('HOSE_SPLINE_TEST','2026-10-08T00:00:00',(''),(''),'Route Studio','Route Studio','');",
    "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));", "ENDSEC;", "DATA;", ...L, "ENDSEC;", "END-ISO-10303-21;", ""].join("\n");
  return { stp, pts: ptsFile(), path: PATH, knots: KN, mults: KM, R, main: MAIN };
}

// exact path point at parameter t (cubic, clamped, knots 0 1/3 2/3 1)
function at(t) {
  const U = [0,0,0,0,1/3,2/3,1,1,1,1], p = 3, nP = PATH.length - 1;
  let k = p; while (k < nP && t >= U[k + 1]) k++;
  const d = []; for (let j = 0; j <= p; j++) d.push(PATH[k - p + j].slice());
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) { const i = k - p + j, a = (t - U[i]) / (U[i + p - r + 1] - U[i]);
    for (let c = 0; c < 3; c++) d[j][c] = (1 - a) * d[j - 1][c] + a * d[j][c]; }
  return d[p];
}
// .pts in the MAIN frame (world minus MAIN origin): 9 points on the path, with a repeat (line 3),
// one point 3 mm off the path (5th), and a point appended at the end that belongs between the 2nd and 3rd
function ptsFile() {
  const loc = q => [q[0] - MAIN[0], q[1] - MAIN[1], q[2] - MAIN[2]], f = v => v.toFixed(3).padStart(15);
  const ts = [0, 0.1, 0.32, 0.45, 0.6, 0.75, 0.9, 1], P = ts.map(at);
  P[4] = [P[4][0], P[4][1] + 3, P[4][2]];
  const rows = [P[0], P[1], P[1], P[2], P[3], P[4], P[5], P[6], P[7], at(0.2)].map(loc);
  return ["!", "!       DATUM POINT ARRAY DATA FILE", "!", "! Route Studio test points for hose_spline_test.stp (MAIN frame).", "!",
    "!CARTESIAN coordinates:", "!        X                Y                Z", "!", ...rows.map(q => f(q[0]) + " " + f(q[1]) + " " + f(q[2]))].join("\n") + "\n";
}

const API = { make, at };
if (typeof module !== "undefined" && module.exports) {
  module.exports = API;
  if (require.main === module) { const fs = require("fs"), path = require("path"), o = make();
    fs.writeFileSync(path.join(__dirname, "../samples/hose_spline_test.stp"), o.stp);
    fs.writeFileSync(path.join(__dirname, "../samples/hose_spline_test.pts"), o.pts);
    console.log("wrote samples/hose_spline_test.stp and .pts"); }
}
root.HoseSample = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
