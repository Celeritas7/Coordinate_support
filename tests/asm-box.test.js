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
if (fail) { console.log(`${fail} failed`); process.exit(1); }
