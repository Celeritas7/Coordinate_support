// node tests/csys-make.test.js — Q6: coordinate systems made in the app, written as STEP and read back
const M = require("../js/csys-make.js"), ST = require("../js/step.js"), SA = require("../js/step-asm.js");
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const near = (a, b, t = 1e-9) => a.every((v, k) => Math.abs(v - b[k]) < t);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const orthonormal = c => [c.x, c.y, c.z].every(v => Math.abs(len(v) - 1) < 1e-12) && Math.abs(dot(c.x, c.y)) < 1e-12 && Math.abs(dot(c.x, c.z)) < 1e-12 && near(cross(c.x, c.y), c.z, 1e-12);

const a = M.frame([10, 20, 30], [0, 0, 5], [1, 1, 0]);
check(orthonormal(a) && near(a.z, [0, 0, 1]) && near(a.x, [Math.SQRT1_2, Math.SQRT1_2, 0], 1e-12), "frame: Z along the axis given, X as close to the hint as Z allows, right-handed");
const b = M.frame([0, 0, 0], [0.3, -0.2, 0.93]);
check(orthonormal(b), "no X hint: picks one, still orthonormal");
const c = M.frame([0, 0, 0], [1, 0, 0], [1, 0, 0]);
check(orthonormal(c) && Math.abs(dot(c.x, [1, 0, 0])) < 1e-12, "X hint along Z: ignored, a perpendicular X instead");
const f = M.flip(a);
check(orthonormal(f) && near(f.z, [0, 0, -1]) && near(f.x, a.x, 1e-12), "flip Z keeps X, Y follows");
const t = M.turn(a, 90);
check(orthonormal(t) && near(t.x, a.y, 1e-12) && near(t.z, a.z, 1e-12), "X +90° about Z: new X is the old Y");
check(M.freeName("RS_CS", ["RS_CS1", "RS_CS2", "CS0"]) === "RS_CS3" && M.stepName("CS 12/a") === "CS_12_a", "names: next free, STEP-safe");

// write, then read back with both readers the app uses
const list = [{ name: "RS_CS1", ...a }, { name: "PORT_IN", ...M.frame([-668.25, 864, -5439.125], [0.2, 0.9, -0.1]) }];
const text = M.stepText("frame_asm_csys", list);
check(/^ISO-10303-21;/.test(text) && /END-ISO-10303-21;\s*$/.test(text), "a complete STEP file");
const r1 = ST.parse(text), byName = n => r1.csys.find(x => x.name === n);
check(r1.csys.length === 2 && list.every(c => { const x = byName(c.name); return x && near([x.x, x.y, x.z], c.o, 1e-9) && near(x.zAxis, c.z, 1e-9) && near(x.xAxis, c.x, 1e-9); }),
  "step.js reads both back: names, origins and axes to 1e-9");
const r2 = SA.parse(text);
check(r2.csys.length === 2 && list.every(c => { const x = r2.csys.find(y => y.name === c.name); return x && near(x.o, c.o, 1e-9) && near(x.z, c.z, 1e-9) && near(x.x, c.x, 1e-9); }),
  "StepAsm (assembly reader) reads them back too, in place");
if (fail) { console.log(`${fail} failed`); process.exit(1); }
