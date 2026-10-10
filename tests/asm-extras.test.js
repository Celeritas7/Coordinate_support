// node tests/asm-extras.test.js — Phase 12 remaining items: spline hoses, pipe override, .pts compare
const fs = require("fs"), path = require("path");
const S = require("../js/step-asm.js");
global.StepAsm = S;
const C = require("../js/pts-compare.js"), H = require("./make-hose-sample.js");
const read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };

// ---- hose swept along a spline (skin = two rational B-spline half faces) ----
const hs = H.make(), rh = S.parse(hs.stp), h = rh.pipes[0];
check(rh.pipes.length === 1 && h.kind === "hose", "spline sweep read as one hose");
check(Math.abs(h.OD - 16) < 1e-3, `hose OD ${h.OD.toFixed(4)} (true 16)`);
let off = 0; for (let i = 0; i <= 400; i++) off = Math.max(off, S.nearest(h.chain, H.at(i / 400)).d);
check(off < 0.005, `centreline within ${off.toFixed(4)} mm of the true path`);
let L = 0, q0 = H.at(0); for (let i = 1; i <= 4000; i++) { const q = H.at(i / 4000); L += dist(q, q0); q0 = q; }
check(Math.abs(h.length - L) < 0.05, `length ${h.length.toFixed(2)} mm (true ${L.toFixed(2)})`);
check(Math.abs(h.R - 109.95) / 109.95 < 0.01, `smallest bend radius ${h.R.toFixed(1)} mm (true 109.95, within 1 %)`);
check(h.curveAgree != null && h.curveAgree < 0.01, `datum curve agrees with the skin to ${h.curveAgree.toFixed(4)} mm`);
check(dist(h.info.start, [0, 0, 0]) < 0.01 && dist(h.info.end, [80, 60, 300]) < 0.01, "ends at HOSE_START and HOSE_END");

// ---- pipe override ----
const t2 = read("piping2_practice_asm.stp"), r2 = S.parse(t2), pipeName = r2.pipes[0].name;
const fittings = r2.instances.filter(i => i.solids && i.part.name !== pipeName).map(i => i.part.name);
check(r2.instances.every(i => !i.solids || i.part.name === pipeName || i.part.pipeWhy), "every non-pipe part with a solid says why it is not a pipe");
const rNo = S.parse(t2, { pipe: { [pipeName]: false } });
check(rNo.pipes.length === 0 && /not a pipe/.test(rNo.instances.find(i => i.part.name === pipeName).part.pipeWhy), "marking the pipe \u201cnot a pipe\u201d removes it");
const fit = fittings.find(n => r2.instances.find(i => i.part.name === n).part.pipeWhy !== "no cylinder, torus or tube-shaped spline face");
const rYes = S.parse(t2, { pipe: { [fit]: true } });
check(rYes.pipes.length === 2 && rYes.pipes.some(p => p.name === fit && p.forced), `marking ${fit} \u201cpipe\u201d adds it (2 pipes)`);

// ---- .pts compare ----
const cmp = (asm, pts, pi) => C.compare(asm, pi, read(pts));
const c2 = cmp(r2, "piping2_practice_1.pts", 0);
check(c2.frame.frame === "MAIN", "piping2_practice_1.pts: MAIN frame found");
check(c2.dropped.length === 1 && c2.dropped[0].n === 2 && c2.dropped[0].dupOf === 1, "repeated point #2 dropped");
check(c2.missing.length === 1 && c2.missing[0].i === 4, "corner 4 has no point");
const p8 = c2.kept.find(k => k.n === 8);
check(p8.status === "off" && Math.abs(p8.dCorner - 4) < 1e-3 && !p8.inOrder && p8.belongs.after === 5 && p8.belongs.before === 6, "#8 is 4.00 mm from corner 4 and belongs between #5 and #6");
const r3 = S.parse(read("piping3_practice_asm.stp"));
const c11 = cmp(r3, "piping3_practice_11.pts", 0);
check(c11.reversed && c11.missing.length === 0, "piping3_11: listed end \u2192 start, every corner has a point");
check(c11.kept.filter(k => k.status === "past").map(k => k.n).sort((a, b) => a - b).join() === "1,19", "#1 and #19 sit past the pipe ends, on its axis");
check(c11.kept.filter(k => !k.inOrder).map(k => k.n).join() === "20,21,22,23", "tail points #20\u2013#23 out of order");
const c21 = cmp(r3, "piping3_practice_21.pts", 1);
check(c21.missing.length === 1 && c21.missing[0].i === 0 && Math.abs(c21.startGap - 80.4) < 0.1, `piping3_21: no start point, pipe runs ${c21.startGap.toFixed(1)} mm before #1`);
check(c21.kept.filter(k => !k.inOrder).map(k => k.n).join() === "18,19,21,22", "#18, #19, #21, #22 out of order");
check(c21.ordered.map(k => k.n).join() === "1,2,21,18,3,4,5,6,19,7,8,9,10,11,12,22,13,14,15,16,17,20", "reordered .pts puts them back in route order");
const ch = C.compare(rh, 0, hs.pts);
check(ch.frame.frame === "MAIN" && ch.dropped.length === 1 && ch.kept.find(k => k.n === 6).status === "off" && ch.kept.filter(k => !k.inOrder).map(k => k.n).join() === "10",
  "hose .pts: MAIN frame, one repeat, #6 off the hose, #10 out of order");

process.exit(fail ? 1 : 0);
