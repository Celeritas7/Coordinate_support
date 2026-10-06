// node tests/step-asm.test.js — assembly reader on the piping samples
const fs = require("fs"), path = require("path");
const S = require("../js/step-asm.js");
const read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
const pts = t => t.split(/\r?\n/).map(l => l.trim()).filter(l => l && l[0] !== "!").map(l => l.split(/\s+/).map(Number)).filter(v => v.length === 3);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };

// piping2: one pipe, two fittings
const r2 = S.parse(read("piping2_practice_asm.stp"));
check(r2.summary.instances === 4 && r2.summary.solids === 3, `piping2: ${r2.summary.instances} instances, ${r2.summary.solids} solids`);
check(r2.pipes.length === 1, `piping2: ${r2.pipes.length} pipe`);
const p2 = r2.pipes[0];
check(Math.abs(p2.OD - 22.5) < 1e-6 && Math.abs(p2.ID - 14.5) < 1e-6, `pipe OD ${p2.OD} / ID ${p2.ID}`);
check(p2.R === 40 && p2.bends.length === 5, `bend R ${p2.R}, ${p2.bends.length} bends`);
check(Math.abs(p2.bends[2].deg - 161.4) < 0.2, `split torus faces merged: third bend ${p2.bends[2].deg.toFixed(1)}°`);
check(dist(p2.info.start, [856, 1604, -3055.5]) < 1e-3, "pipe starts at CS0 of the pipe part");
const m2 = r2.matchFrame(pts(read("piping2_practice_1.pts")), p2);
check(m2.frame === "MAIN", `.pts is written in the ${m2.frame} frame`);
const P2 = pts(read("piping2_practice_1.pts")).map(p => S.F.pt(m2.M, p));
const offQ = p2.Q.map(q => Math.min(...P2.map(p => dist(p, q))));
check(offQ.filter(d => d < 1e-3).length === 6 && Math.abs(offQ[4] - 4) < 1e-3, `corners vs .pts: six exact, one 4 mm off (${offQ.map(d => d.toFixed(2)).join(" ")})`);
check(r2.csys.some(c => c.name === "ACS0") && r2.csys.filter(c => c.name === "CS0").length === 3, "assembly and part coordinate systems in world coordinates");

// piping3: two pipes among 50 instances, nested sub-assemblies
const r3 = S.parse(read("piping3_practice_asm.stp"));
check(r3.summary.instances === 51 && r3.pipes.length === 2, `piping3: ${r3.summary.instances} instances, ${r3.pipes.length} pipes`);
const p11 = r3.pipes.find(p => /111$/.test(p.name)), p21 = r3.pipes.find(p => /211$/.test(p.name));
check(p11 && p11.R === 35 && p11.bends.length === 21 && Math.abs(p11.OD - 12) < 1e-6, `pipe 111: Ø${p11 && p11.OD} R ${p11 && p11.R}, ${p11 && p11.bends.length} bends`);
check(p21 && p21.R === 40 && p21.bends.length === 21 && Math.abs(p21.OD - 15) < 1e-6, `pipe 211: Ø${p21 && p21.OD} R ${p21 && p21.R}, ${p21 && p21.bends.length} bends`);
check(r3.instances.some(i => i.depth === 3), "three levels of sub-assembly placed");
const m11 = r3.matchFrame(pts(read("piping3_practice_11.pts")), p11);
const P11 = pts(read("piping3_practice_11.pts")).map(p => S.F.pt(m11.M, p));
const inner11 = p11.Q.slice(1, -1).map(q => Math.min(...P11.map(p => dist(p, q))));
check(m11.frame === "MAIN" && inner11.every(d => d < 1e-3), `pipe 111 corners all on the .pts points (${m11.frame} frame)`);

// piping4: the finished answer, stations at the corners
const r4 = S.parse(read("piping4_answer_asm.stp"));
check(r4.pipes.length === 2 && r4.pipes.every(p => p.R === 40 && p.OD === 18 && p.ID === 16), `piping4: ${r4.pipes.length} pipes Ø18/16 R 40`);
const p12 = r4.pipes.find(p => /_12$/.test(p.name));
const cs = n => r4.csys.find(c => c.name === n).o;
check(dist(p12.info.start, cs("CS17")) < 1e-3 && dist(p12.Q[2], cs("CS14")) < 1e-3 && dist(p12.Q[3], cs("CS13")) < 1e-3, "pipe 12 starts at CS17, corners on CS14 and CS13");

process.exit(fail ? 1 : 0);
