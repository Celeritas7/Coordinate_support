// node tests/fixings.test.js — one clamp finder for Hose and Pipe (js/fixings.js): roles, default ticks, reasons, bore fit
const fs = require("fs"), path = require("path");
const S = require("../js/step-asm.js"), F = require("../js/fixings.js");
const has = f => fs.existsSync(path.join(__dirname, "../samples", f)), read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
// the Library seed (js/fixlib.js)
const LIB = [{ pattern: "990224", type: "clamp", boreMin: 21, boreMax: 24 }, { pattern: "22402156", type: "clip", boreMin: 12, boreMax: 15 }];
const lib = x => LIB.find(e => String(x.name).includes(e.pattern)) || null;
const ticked = C => C.filter(c => c.use);

// ---- synthetic: no samples needed ----
const hole = (c, D, length, csys, name = "P") => ({ c, d: [0, 0, 1], D, r: D / 2, length, csys, name, label: name });
{
  const r = { holes: [hole([0, 0, 0], 12, 20, "CS1"), hole([100, 0, 0], 12, 4, "CS2"), hole([200, 0, 0], 11.7, 20, "CS3"), hole([300, 0, 0], 12, 20, null),
    hole([400, 0, 0], 13.5, 20, "CS5"), hole([500, 0, 0], 13.6, 20, "CS6")], pipes: [] };
  const C = F.find(r, { D: 12 }), by = n => C.find(c => c.name === n);
  check(by("CS1") && by("CS1").use && by("CS1").role === "fixing", "CSYS, 20 mm long, not in the Library: ticked as a fixing");
  check(by("CS2") && !by("CS2").use && by("CS2").role === "hole" && /4\.0 mm long/.test(by("CS2").reason), "4 mm long: unticked hole, reason says how long");
  check(!by("CS3"), "Hose: a Ø11.7 bore is too small for a Ø12 hose (fit is −0.2 / +1.5)");
  check(!C.some(c => c.c[0] === 300), "no CSYS and not in the Library: not a candidate");
  check(by("CS5") && !by("CS6"), "Ø13.5 fits (+1.5 inclusive), Ø13.6 does not");
  check(C.findIndex(c => !c.use) > C.findIndex(c => c.use), "ticked rows come first");
  check(F.find(null, { D: 12 }).length === 0 && F.find(r, { D: 0 }).length === 0, "no assembly / no Ø: empty");
  const L = F.find({ holes: [hole([0, 0, 0], 9, 3, "CS1", "22402156"), hole([50, 0, 0], 12, 25, "CS16", "22402156")], pipes: [] }, { D: 9, fit: 4, lib });
  check(L.find(c => c.name === "CS1").role === "hole" && /outside its Ø12\.0–15\.0/.test(L.find(c => c.name === "CS1").reason), "a Library part's mounting hole (outside its bore range) is not a clip");
  check(L.find(c => c.name === "CS16").role === "clip" && L.find(c => c.name === "CS16").use, "its Ø12 bore is a Library clip, ticked");
}

// ---- piping3: hose Ø12 from scratch, and pipe 111 ----
if (has("piping3_practice_asm.stp")) {
  const r = S.parse(read("piping3_practice_asm.stp"));
  const H = F.find(r, { D: 12, lib }), T = ticked(H);
  check(T.length === 5 && H.length === 5, `Hose Ø12: 5 stations, nothing else listed (${H.map(c => c.name + "/" + c.role).join(", ")})`);
  check(T.filter(c => c.role === "end").length === 2 && T[0].role === "end" && T[1].role === "end", "the two end fittings of pipe 111 come first (start / end)");
  check(["CS16", "CS17"].every(n => T.some(c => c.name === n && c.role === "clip")), "CS16 and CS17 are the Library twin clip");
  check(T.some(c => c.part === "25375330" && c.role === "fixing" && /not in the Library/.test(c.reason)), "25375330 is a clamp, flagged not in the Library");
  const H8 = F.find(r, { D: 8, lib });
  check(ticked(H8).length === 1 && ticked(H8)[0].length > 70, `Hose Ø8: 1 ticked (the 78.5 mm sleeve), ${H8.length - 1} short holes unticked (was 26 ticked)`);
  check(H8.filter(c => c.role === "hole").every(c => c.length < 10), "every unticked hole is under 10 mm long");
  const pi = r.pipes.findIndex(p => /111$/.test(p.name)), P = F.find(r, { D: r.pipes[pi].OD, pipe: pi, lib });
  check(ticked(P).length === 3 && ticked(P).every(c => c.passes), `Pipe 111: 3 clamps ticked, the pipe passes all (${ticked(P).map(c => c.name).join(", ")})`);
  check(P.filter(c => c.role === "end").length === 2 && P.filter(c => c.role === "end").every(c => !c.use && /this pipe/.test(c.reason)), "its own end fittings: listed, off");
  const pj = r.pipes.findIndex(p => /211$/.test(p.name)), Q = F.find(r, { D: r.pipes[pj].OD, pipe: pj, lib });
  check(ticked(Q).length === 2 && ticked(Q).every(c => ["CS6", "CS7"].includes(c.name)), `Pipe 211: its two Ø15 clip bores (${ticked(Q).map(c => c.name).join(", ")})`);
} else console.log("skip: samples/piping3_practice_asm.stp not found");

// ---- piping2: Ø22 clamp on a Ø22.5 pipe ----
if (has("piping2_practice_asm.stp")) {
  const r = S.parse(read("piping2_practice_asm.stp")), P = F.find(r, { D: r.pipes[0].OD, pipe: 0, lib });
  check(P.length === 1 && P[0].role === "clamp" && P[0].use && Math.abs(P[0].dist - 65.5) < 0.1, `Pipe: clamp 990224 (bore Ø22.0 on a Ø22.5 pipe) found, misses by ${P[0] && P[0].dist.toFixed(1)} mm`);
  check(F.find(r, { D: 22.5, lib }).length === 0, "Hose Ø22.5: the Ø22 bore is too small for a hose");
} else console.log("skip: samples/piping2_practice_asm.stp not found");

process.exit(fail ? 1 : 0);
