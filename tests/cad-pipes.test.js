// node tests/cad-pipes.test.js — Keep clear of CAD parts, STEP: existing pipes get their own role; parts over 80 mm are frame even at a station
const fs = require("fs"), path = require("path");
const S = require("../js/step-asm.js"), C = require("../js/cad-solids.js"), K = require("../js/clamp-stations.js");
const read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const big = p => Math.max(...p.dims) > 80;
// stations: the fixings that fit the hose, in route order (as Stations from clamps gives them)
const stationsOf = (r, D) => { const c = K.candidates(r, { D, tol: 1.5 }).map(x => x.c); return K.order(c).map(i => c[i]); };

for (const [file, D, pipeNames] of [
  ["piping3_practice_asm.stp", 12, ["U104904_PIPING-3_PRACTICE_111", "U104904_PIPING-3_PRACTICE_211"]],
  ["piping4_answer_asm.stp", 18, ["PIPING-4_ANSWER_12", "PIPING-4_ANSWER_62"]]]) {
  if (!fs.existsSync(path.join(__dirname, "../samples", file))) { console.log(`skip: samples/${file} not found`); continue; }
  console.log(`-- ${file}`);
  const text = read(file), r = S.parse(text), cad = C.read(text, file);
  check(r.pipes.map(p => p.name).sort().join() === pipeNames.join(), `StepAsm finds the pipes ${pipeNames.join(", ")}`);
  const tagged = cad.solids.filter(s => s.pipe);
  check(pipeNames.every(n => tagged.some(s => s.pipe.name === n)), `every pipe has its solid tagged (${tagged.length} solids)`);
  check(tagged.every(s => { const p = r.pipes.find(q => q.name === s.pipe.name); return p && s.pipe.OD === p.OD && s.pipe.kind === p.kind; }), "tag carries the pipe name, Ø and kind from StepAsm");
  check(tagged.every(s => s.name.endsWith(s.pipe.name)), "tagged solids belong to the pipe's own instance");

  const P = stationsOf(r, D), sv = C.survey(cad, P, { d: D, gap: 4, reach: 60 });
  check(P.length >= 4, `${P.length} stations from the Ø${D} clamps`);
  const pipes = sv.parts.filter(p => p.role === "pipe");
  check(pipes.length === 2 && pipes.every(p => p.pipe && pipeNames.includes(p.pipe.name)), `both existing pipes near the line have role pipe (${pipes.map(p => p.pipe.name + " Ø" + p.pipe.OD).join(", ")})`);
  check(pipes.some(p => p.stations.length), "an existing pipe touching a station is still a pipe, not a clip");
  check(sv.parts.filter(p => p.role !== "pipe").every(p => !p.pipe), "no other part is a pipe");
  check(sv.parts.filter(p => p.role === "station" || p.role === "clip").every(p => !big(p)), "every clip (at a station or on the line) is 80 mm or less in every direction");
  const frameAtStation = sv.parts.filter(p => p.role === "obstacle" && p.stations.length);
  check(frameAtStation.every(big), `parts over 80 mm touching a station (and not a clip's mount) are frame / part (${frameAtStation.map(p => p.name.split(" / ").pop() + " " + p.dims.map(Math.round).join("x")).join(", ")})`);
  check(sv.parts.filter(p => p.role === "station").length > 0, "small parts at stations are still clips");
  const mounts = sv.parts.filter(p => p.role === "mount");
  check(mounts.every(p => p.size <= 300 && p.mountOf.length && sv.parts.some(c => c.role === "station" && c.name === p.clip)), `mounts are bracket-sized and touch a clip at their station (${mounts.map(p => p.name.split(" / ").pop() + "@P" + p.mountOf.map(i => i + 1).join(",")).join(", ") || "none"})`);
}

// overrides saved for the file name: a part marked "not a pipe" is frame again
if (fs.existsSync(path.join(__dirname, "../samples/piping4_answer_asm.stp"))) {
  const text = read("piping4_answer_asm.stp"), ov = { "PIPING-4_ANSWER_12": false };
  const cad = C.read(text, "piping4_answer_asm.stp", { pipe: ov });
  check(cad.solids.filter(s => s.pipe).map(s => s.pipe.name).join() === "PIPING-4_ANSWER_62", "override: PIPING-4_ANSWER_12 marked not a pipe, only _62 is tagged");
  const P = stationsOf(S.parse(text, { pipe: ov }), 18), sv = C.survey(cad, P, { d: 18, gap: 4, reach: 60 });
  const p12 = sv.parts.find(p => p.name.endsWith("PIPING-4_ANSWER_12"));
  check(p12 && p12.role === "obstacle", `…and in the survey it is frame / part (${p12 && p12.role})`);
}

// clipSize rule on a hand-made model: two parts at one station, 60 mm and 120 mm across
const box = (sid, min, max) => ({ sid, min, max });
const cad = { solids: [{ sid: 1, name: "small", ...box(1, [-30, -30, -5], [30, 30, 5]) }, { sid: 2, name: "large", ...box(2, [-60, 8, -5], [60, 20, 5]) },
  { sid: 3, name: "pipe", pipe: { name: "P", OD: 10, kind: "pipe" }, ...box(3, [-5, -5, -100], [5, 5, 100]) }],
  faces: [box(1, [-30, -30, -5], [30, 30, 5]), box(2, [-60, 8, -5], [60, 20, 5]), box(3, [-5, -5, -100], [5, 5, 100])] };
const sv = C.survey(cad, [[0, 0, 0], [0, 0, 200]], { d: 8, gap: 4, reach: 60 }), role = n => sv.parts.find(p => p.name === n).role;
check(role("small") === "station" && role("large") === "mount" && role("pipe") === "pipe", `60 mm part at the station: clip; 120 mm touching it: its mount; tagged pipe: pipe (${role("small")}, ${role("large")}, ${role("pipe")})`);
// the same 120 mm part away from the clip (not touching it) is frame; a 400 mm rail touching the clip stays frame
const cad2 = { solids: [cad.solids[0], { sid: 2, name: "large", ...box(2, [-60, 40, -5], [60, 52, 5]) }, { sid: 4, name: "rail", ...box(4, [-200, -40, -5], [200, -30, 5]) }],
  faces: [cad.faces[0], box(2, [-60, 40, -5], [60, 52, 5]), box(4, [-200, -40, -5], [200, -30, 5])] };
const sv2 = C.survey(cad2, [[0, 0, 0], [0, 0, 200]], { d: 8, gap: 4, reach: 60 }), role2 = n => (sv2.parts.find(p => p.name === n) || {}).role;
check(role2("rail") === "obstacle", `a 400 mm rail the clip touches stays frame (${role2("rail")})`);
process.exit(fail ? 1 : 0);
