// node tests/clamp-stations.test.js — Stations from clamps: fixings that fit the hose, route order, bore directions for Check
const fs = require("fs"), path = require("path"), vm = require("vm");
const S = require("../js/step-asm.js");
const C = require("../js/clamp-stations.js");
const read = f => fs.readFileSync(path.join(__dirname, "../samples", f), "utf8");
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };

// ---- fixings whose bore fits the hose (piping3: hose / pipe Ø12) ----
const p3 = path.join(__dirname, "../samples/piping3_practice_asm.stp");
if (fs.existsSync(p3)) {
  const r3 = S.parse(read("piping3_practice_asm.stp"));
  const c12 = C.candidates(r3, { D: 12, tol: 1.5 }), names = c12.map(c => c.name);
  check(c12.length > 0 && c12.every(c => Math.abs(c.D - 12) <= 1.5), `Ø12 ± 1.5: ${c12.length} fixings, every bore within the fit`);
  check(names.includes("CS17") && names.includes("CS16"), "the two Ø12 bores of the clamp block (CS17, CS16) are listed");
  check(!names.includes("CS7") && !names.includes("CS6"), "the Ø15 bores of the same block are not");
  check(c12.every((a, i) => c12.every((b, j) => i === j || dist(a.c, b.c) > 0.5)), "no fixing listed twice at the same spot");
  check(C.candidates(r3, { D: 15, tol: 0.1 }).map(c => c.name).sort().join() === "CS6,CS7", "Ø15 ± 0.1: just CS6 and CS7");
  check(C.candidates(r3, { D: 50, tol: 1.5 }).length === 0, "Ø50: nothing fits");
  const cs17 = c12.find(c => c.name === "CS17");
  check(Math.abs(Math.abs(cs17.d[0]) - 1) < 1e-6, "bore direction from the hole faces (CS17 bore runs along X)");
} else console.log("skip: samples/piping3_practice_asm.stp not found");

// coaxial copies (two clamp halves, split bore faces) are one fixing; a parallel bore 20 mm away is another
const fx = (c, d, D, csys) => ({ c, d, D, r: D / 2, length: 10, csys, name: "CLAMP", label: "CLAMP" });
const dup = C.candidates({ fixings: [fx([0, 0, 0], [0, 0, 1], 8, "CS0"), fx([0, 0, 0.2], [0, 0, -1], 8, "CS0"), fx([20, 0, 0], [0, 0, 1], 8, "CS1"), fx([0, 0, 0], [1, 0, 0], 8, "CS2")] }, { D: 8 });
check(dup.length === 3 && dup.map(c => c.name).join() === "CS0,CS1,CS2", `coaxial copy merged, other bores kept (${dup.map(c => c.name).join()})`);
check(C.candidates({ fixings: [fx([0, 0, 0], [0, 0, 1], 9.5, "A"), fx([9, 0, 0], [0, 0, 1], 9.6, "B")] }, { D: 8 }).map(c => c.name).join() === "A", "fit is inclusive: Ø9.5 fits 8 ± 1.5, Ø9.6 does not");
check(C.candidates(null, { D: 8 }).length === 0, "no assembly: empty list");

// ---- order: nearest neighbour + 2-opt, start / end pinned ----
const line = [[300, 0, 0], [0, 0, 0], [500, 0, 0], [100, 0, 0], [400, 0, 0], [200, 0, 0]];
const xs = o => o.map(i => line[i][0]).join();
check(xs(C.order(line, { start: 1 })) === "0,100,200,300,400,500", "start pinned at x=0: walks the line");
check(xs(C.order(line, { end: 1 })) === "500,400,300,200,100,0", "end pinned at x=0: walks it the other way");
const free = xs(C.order(line));
check(free === "0,100,200,300,400,500" || free === "500,400,300,200,100,0", `nothing pinned: starts at an end of the line (${free})`);
check(xs(C.order(line, { start: 3, end: 4 })).split(",")[0] === "100" && xs(C.order(line, { start: 3, end: 4 })).split(",").pop() === "400", "start and end both pinned are kept first and last");
check(C.order([[1, 2, 3]]).join() === "0" && C.order([]).length === 0, "one point / no points");
// a crossing that nearest neighbour makes and 2-opt removes
const zig = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [-1, 5, 0]];
const ordered = C.order(zig, { start: 0 }), L = C.pathLength(zig, ordered);
const all = [];
(function perm(a, rest) { if (!rest.length) return all.push(a); rest.forEach((x, i) => perm(a.concat(x), rest.filter((_, j) => j !== i))); })([0], [1, 2, 3, 4]);
const best = Math.min(...all.map(o => C.pathLength(zig, o)));
check(Math.abs(L - best) < 1e-9, `small set: order is the shortest of all ${all.length} (${L.toFixed(2)} mm)`);
const twisted = [0, 2, 1, 3]; C.twoOpt(twisted, (i, j) => dist(zig[i], zig[j]), false);
check(twisted.join() === "0,1,2,3", "2-opt uncrosses 0-2-1-3 into 0-1-2-3, ends kept");
// random cloud: every point once, never longer than plain file order
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const cloud = Array.from({ length: 40 }, () => [rnd() * 1000, rnd() * 1000, rnd() * 200]);
const oc = C.order(cloud, { start: 0, end: 39 });
check(oc.length === 40 && new Set(oc).size === 40 && oc[0] === 0 && oc[39] === 39, "40 points: each once, start 0 and end 39 kept");
check(C.pathLength(cloud, oc) < C.pathLength(cloud, cloud.map((_, i) => i)), "shorter than the file order");

// ---- text out, directions in ----
const st = [{ c: [0, 0, 0], d: [0, 0, 1], name: "CS1" }, { c: [0, 0, 100], d: [0, 0, -1], name: "CS2" }, { c: [100, 0, 200], d: [-1, 0, 0], name: "CS3" }];
const txt = C.stationsText(st), dtx = C.dirsText(st);
check(txt.trim().split("\n").length === 3 && /! CS2$/.test(txt.trim().split("\n")[1]), "Target points: one X Y Z ! name line per station");
const pd = C.parseDirs(dtx);
check(pd.bad.length === 0 && pd.dirs.length === 3 && pd.names.join() === "CS1,CS2,CS3", "directions read back with their names");
check(dot(pd.dirs[1], [0, 0, 1]) > 0.999 && dot(pd.dirs[2], [1, 0, 0]) > 0.999, "bore axes turned along the direction of travel");
check(C.stationsText(st, p => p.map(v => v + 1)).trim().split("\n")[0].trim().startsWith("1.000"), "frame transform applied to the points");
const pp = C.parseDirs("0 0 1 ! A\n-  ! B\n\n1,0,0\nfree\nnope");
check(pp.dirs.length === 5 && pp.dirs[1] === null && pp.dirs[3] === null && pp.bad.join() === "6", "\"-\" and \"free\" leave a station free, blank lines skipped, bad line reported");
check(C.pointNames("! header\n1 2 3 ! A\n\n4 5 6\n7,8,9 ! C").join("|") === "A||C", "names of the Target points lines");

// ---- for Check ----
const P = [[0, 0, 0], [0, 0, 100], [100, 0, 200]];
check(C.forCheck(P, "") === null && C.forCheck(P, "  \n ") === null, "empty list: null (Check runs as before)");
check(C.forCheck(P, "-\n-\n-") === null, "every station free: null");
const few = C.forCheck(P, "0 0 1\n0 0 1");
check(few.fixDirs(undefined) === undefined && /2 lines for 3/.test(few.msg) && few.note === "", "wrong count: not used, base kept as it is, says why");
const badl = C.forCheck(P, "0 0 1\nx y z\n1 0 0");
check(badl.fixDirs(null) === null && /line 2/.test(badl.msg), "unreadable line: not used, says which");
const other = C.forCheck(P, dtx, "0 0 0 ! CS1\n0 0 100 ! CS9\n100 0 200 ! CS3");
check(other.fixDirs(null) === null && /CS2.*CS9/.test(other.msg), "names disagree with Target points: not used");
const ok = C.forCheck(P, dtx, txt);
check(ok.msg === "" && / at 3 stations/.test(ok.note), "matching names: used");
const base = [null, [9, 9, 9], null];
const m = ok.fixDirs(base);
check(m.length === 3 && dot(m[0], [0, 0, 1]) > 0.999 && dot(m[1], [0, 0, 1]) > 0.999 && dot(m[2], [1, 0, 0]) > 0.999, "bore direction wins over a straight-run direction at its station");
const part = C.forCheck(P, "-\n-\n-1 0 0").fixDirs([[0, 1, 0], null, null]);
check(dot(part[0], [0, 1, 0]) > 0.999 && part[1] === null && dot(part[2], [1, 0, 0]) > 0.999, "free stations keep the base direction; flipped bore oriented to travel");
check(C.forCheck(P, "0 0 1\n0 0 1\n1 0 0", "a b c\n").msg === "", "Target points without names: count decides");

// ---- Check path: makeRoute + optimiser (unchanged) with and without bore directions ----
const src = fs.readFileSync(path.join(__dirname, "../js/route-studio.js"), "utf8");
const core = src.slice(0, src.indexOf("// ---------- clearance between two routes"));
const ctx = { Math, Infinity, Number, Array, Map, Set }; vm.createContext(ctx); vm.runInContext(core, ctx);
const { makeRoute, optimiser } = ctx;
check(/const SD=typeof clampStationDirs==='function'\?clampStationDirs\(P\):null;/.test(src) && /fixDirs:SD\?SD\.fixDirs\(X&&X\.fixDirs\):X&&X\.fixDirs/.test(src), "runBend asks for bore directions and falls back to the straight-run directions");
const Pc = [[0, 0, 0], [200, 0, 0], [300, 150, 0], [300, 350, 50]];
const run = (fixDirs, startDir) => { const r = makeRoute(Pc, { startDir, fixDirs }), o = optimiser(r, 97.5); let s; do s = o.step(50); while (!s.done); return { r, x: s.x }; };
const SDnone = null, X = null;
const a = run(SDnone ? SDnone.fixDirs(X && X.fixDirs) : X && X.fixDirs), b = run(null);
check(JSON.stringify(a.x) === JSON.stringify(b.x), "no bore directions: same result as before, bit for bit");
const borePts = "0 0 0 ! A\n200 0 0 ! B\n300 150 0 ! C\n300 350 50 ! D", boreDirs = "-\n1 0 0 ! B\n0 -1 0 ! C\n-";
const SD = C.forCheck(Pc, boreDirs, borePts), w = run(SD.fixDirs(null), [1, 0, 0]);
const tan = (res, i) => { const s = res.r.segs(res.x), sg = i < s.length ? s[i] : s[i - 1], t = i < s.length ? sg[2] : sg[3], l = Math.hypot(...t); return t.map(v => v / l); };
check(dot(tan(w, 1), [1, 0, 0]) > 0.9999 && dot(tan(w, 2), [0, 1, 0]) > 0.9999, "bore directions held at B and C (C's axis turned along travel)");
check(dot(tan(w, 0), [1, 0, 0]) > 0.9999, "start direction still applied at the first station");
check(!(dot(tan(b, 2), [0, 1, 0]) > 0.9999), "without them the route crosses C at its own angle");

process.exit(fail ? 1 : 0);
