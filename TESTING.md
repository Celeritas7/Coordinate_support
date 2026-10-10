# Testing with the sample files

Files are in `samples/`. Start the app with `Launch Route Studio.bat`.

Layout (Phase 11): pick **Hose / Cable · Pipe · Bundle** at the top, then a task on the left. Old tab names map as: Bend radius → Hose · Route through stations (spline) or Pipe · Route through points (lines + arcs); Clearance → Hose · Offset B from A; Analyse → Hose · Check as loaded; assembly panel → Pipe · Check .pts against pipe / Through clamps; Table → .pts → Pipe · Table → .pts; Bundle → Bundle. “assembly .stp” is now just **Open…** (or drop the file anywhere). Examples are in the **Examples** menu.

## 0. Shell

1. Reload: the app opens on the module and task you used last.
2. Drop `piping3_practice_asm.stp` anywhere: the switch jumps to **Pipe**, task **Check .pts against pipe**; the status line under the switch says “assembly → Pipe · Check .pts against pipe”.
3. Drop `piping3_practice_21.pts`: stays in Pipe, compare report for PRACTICE_211. Drop `route_343434_R65.pts`: goes to **Hose / Cable · Route through stations**, points in the box.
4. Hose · Check as loaded, drop two .pts files: both land in the cables box.
5. Pipe · Route through points: the run button says “Solve lines + arcs”; Hose · Route through stations says “Check, then add” (spline). No Route shape selector anywhere.
6. Click an older run in the run list: the module and task follow it (a pipe run opens Pipe).
7. Examples ▾ → each entry fills its task and switches to it. Dark / Light switches the theme, 3D included, and is remembered.
8. Obstacle boxes (Check as loaded, Bundle) are under “Advanced: obstacle boxes typed by hand”.

## 1. File Inspector (header link “Inspector”)

| File | Expect |
| --- | --- |
| `343434_asm.stp` | STEP, 17 coordinate systems, 0 named points. Groups CS 16, MAIN 1. Names check amber (Creo default names). |
| `route_343434_csys.stp` | "16 coordinate systems and 87 named points found". Groups RP 87, CS 16. |
| `343434.igs` | IGES, 0 datums. Red "No named datums" with the export checklist. Coordinate systems amber (IGES cannot carry them). |
| `1111111.igs` (5 MB, not in samples) | Solids present (amber), 0 datum points. |

## 2. Bend tab import

1. Load `route_343434_csys.stp` from "Load: .pts / .stp / .igs file".
2. Expect chips `RP 87` (selected) and `CS 16`, and a Frame select.
3. Target points fill with 87 lines ending `! RP002`, `! RP003`…
4. Check: the button turns into **Stop** while the curve is shaped (87 points take 10–30 s; press Stop to give up). Two runs are added, no error.
5. Pick chip `CS`: 16 lines in file order (CS29, CS46, CS30, CS45…), the clamp stations along the route. Check again for a coarse route through the brackets.

## 3. Frame round trip

1. Load `343434_asm.stp`, choose chip `CS`, Frame `CS29`.
2. First line should read `0.000 0.000 0.000 ! CS29` (the first station is the frame origin).
3. Run a check, open Points, Download .stp.
4. Load that .stp back with Frame "file origin": RP001 should equal CS29's world position (−993.999, 876.125, −5465.100).

## 3b. Lines + arcs

1. Load `route_343434_csys.stp`, chip `CS`. Route shape **Lines + arcs**, Min radius 65, Safety factor 1.5.
2. Solve: about 1–3 s. Expect run "Lines + arcs R79.5", 11 points, every station within 0.001 mm.
3. 3D: dashed corner polyline, stations tagged CS29…CS41 on the tube. Points table names the station each corner's arc passes through.
4. In Creo: import the .pts, Curve through points, Single radius 79.5. The curve should pass through all 16 CS origins.
5. `node tests/arcroute.test.js` prints only `ok` lines.

## 4. Compare against the .pts

1. Analyse tab: open `route_343434_csys.stp` and `route_343434_R65.pts` together. Analyse always uses file-origin coordinates, whatever Frame is set on the Bend tab, so CAD points line up with .pts files exported from the same assembly.
2. Expect cables `RP`, `CS` and `route_343434_R65`. The .pts has 103 points = 87 RP + 16 CS: the RP numbers skip exactly where a CS station sits (RP009 → CS46). In 3D, RP and CS together lie on the .pts path.

## 5. Clearance tab

Both routes must come from the file; the example pair is only replaced per textarea.

1. **master from file** → `route_343434_csys.stp`. The chip row is labelled `Master · route_343434_csys.stp`; leave `RP` selected.
2. **slave from file** → the same file. A second chip row labelled `Slave · …` appears; pick `CS` there.
3. Adjust runs without error. Clearance will be negative (the CS stations sit on the RP route); this is a stress test, not a real pair.

## 6. Assembly STEP (pipes)

1. Analyse tab → **assembly .stp (parts + pipes)** → `piping2_practice_asm.stp`. Status: 3 parts (3 solids), 7 coordinate systems; 1 pipe `U104904_PIPING-2_PRACTICE_1` Ø22.5 R 40, 5 bends, 1032 mm.
2. A run "… · pipe" is added: tube at the true diameter, dashed corner polyline, 7 points, stations CS0 / ACS0 / ACS1 tagged where they sit on the pipe, the two fittings as grey boxes. Points table: bend angle per corner (44.6°, 121.6°, 161.4°, 56.5°, 42.3°). Readout R 40.
3. Points pane: the .pts header names OD/ID, single radius 40, bend angles and straights. Coordinates are file-origin; the practice .pts is in the MAIN frame (see test).
4. `piping3_practice_asm.stp`: 50 parts, 2 pipes (Ø12 R 35 and Ø15 R 40, 21 bends each), 3 levels of sub-assembly. `piping4_answer_asm.stp`: 2 pipes Ø18/16 R 40; corners of pipe 12 sit on CS13, CS14…
5. `node tests/step-asm.test.js` prints only `ok` lines (16 checks: tree, radii, bend counts, merged torus faces, .pts frame, corners vs .pts).

## 7. Pipe through a clamp

1. Analyse tab → **assembly .stp (parts + pipes)** → `piping2_practice_asm.stp`. The panel **Route a pipe through clamps** appears under the Load line.
2. Clamps list: one entry, `U104904_990224` · CS0 · bore Ø22.00 × 18.0 · pipe misses it by 65.5 mm, ticked. In 3D (pipe run selected) the bore shows as two red rings with its axis, tagged "(pipe misses it)".
3. Leave Bend R 40, Min straight 30, Margin 2, .pts frame MAIN, “Drop detour corners” ticked. Press **Route through ticked clamps** (well under a second).
4. Expect a new run "… · through U104904_990224", 7 points. Status: corner 5 already on the bore axis, one corner added; corner 4 (167° bend) dropped as a detour, route 913 → 655 mm. Table (#, was, moved, bend °, note; hover a row for its X Y Z): point 4 "new corner, on bore axis", point 5 "unchanged, on bore axis", every other row moved 0.000; “Dropped as detours: #4”. Clamp line in blue: 0.000 mm off its axis. Ends moved 0.000 mm, direction 0.000°. Shortest straight 43.4 mm. In 3D the rings turn blue, the tube runs through them and the 500 mm hairpin is gone. Untick “Drop detour corners” and route again: 8 points, hairpin kept.
5. Copy .pts / Download .pts: header names the clamp, single radius 40, frame MAIN.
6. `piping3_practice_asm.stp`, pipe 111: three clamps listed, all "pipe passes through it"; routing keeps 23 points and re-centres the pipe in the 22402156 clamps (moves ≤ 0.17 mm).
7. `node tests/through.test.js` prints only `ok` lines (21 checks).

## 8. Parts tree, hose on a spline, .pts compare

1. Analyse → assembly .stp → `piping2_practice_asm.stp`. Status: 3 parts with solids, 1 pipe. Open **Parts (3)**: the pipe row is tinted, "pipe Ø22.5/14.5 · R 40 · 5 bends · 1032 mm" under its name with the Pipe? dropdown; the clamp row says "clamp bore Ø22 (CS0)"; the fitting says why it is not a pipe. Nothing needs sideways scrolling.
2. Set the pipe to **not a pipe**: status says no pipe found, the pipe run disappears. Set it back to **auto**: the run returns. Reload the page and load the file again: the choice is remembered.
3. **Compare a .pts** → `piping2_practice_1.pts`. Expect: repeat #2 dropped; MAIN frame; corner 4 (56.5°) has no point, at 3168.200 −484.000 1485.000; #8 4.00 mm from corner 4, out of order, between #5 and #6. A thin run "piping2_practice_1.pts vs …" shows the zig-zag Creo would build. Copy reordered .pts puts #8 between #5 and #6.
4. `piping3_practice_asm.stp`: Parts shows each part once (e.g. `975841 ×6` on one row). The Pipe box shows `PRACTICE_111 · …` / `PRACTICE_211 · …`. Pick PRACTICE_211, compare `piping3_practice_21.pts`: start corner missing (pipe runs 80.4 mm before #1); #20 3.31 mm past the end; #18 #19 #21 #22 out of order. With PRACTICE_111 selected, comparing `piping3_practice_21.pts` switches to PRACTICE_211 by itself and says so. A .pts from another assembly (e.g. `piping2_practice_1.pts` here) gives one red line: does not fit any pipe.
5. `hose_spline_test.stp`: one hose Ø16, min R ≈ 110, 331 mm; Points pane: spline points along it. Compare `hose_spline_test.pts`: repeat #3, #6 2.64 mm off the hose, #10 out of order.
6. Inspector: drop `piping3_practice_asm.stp`. **Parts and pipes**: 50 instances, 2 pipes, clamp bores. Change a part's Pipe? there; Route Studio uses the same choice for that file name.
7. `node tests/asm-extras.test.js` prints only `ok` lines (21 checks). `node tests/make-hose-sample.js` rewrites the hose sample.

## 8. Straight runs and frame parts (Route through stations)

1. Hose / Cable · Route through stations. Open `route_343434_csys.stp`, click **CS 16** under the box (16 stations). Max shift 3.
2. Leave **Straight where 3 or more stations line up** ticked. Open **Keep clear of CAD parts** → **Load frame / parts file…** → `u107338_fy26_test_frame_asm_111.igs`. Status: 73 solids, 3682 faces (IGES).
3. The list shows about 38 parts within 60 mm: clips at P1, P5, P6, P8–P12, P14, P16 and small parts on the station line unticked; solid 1 (frame) and the rest ticked.
4. Press Check. Expect about 30 points, R about 66, "Straight P8–P12", and the smallest gap to the ticked parts with the part name. Select the run: the ticked parts' face boxes show in grey.
5. Untick Straight and run again: P8–P12 wave as before (about 32 points, R 72).
6. Flat faces with holes: status after loading the IGES adds “2901 flat or cylindrical, gap exact”. Press **Frame only**, tick Straight again, Check. The −4.0 mm (solid 1) near point 24 is gone. The message lists each plate crossing, e.g. “P6–P7: past the edge of the 7 mm plate at Y 1000 / 1007 of solid 1, … mm clear”, also P12–P13 and P14–P15 (as-entered spline: 5.7, 61.6 and 13.0 mm; the generated route differs by a few mm). The smallest gap is now at the P6–P7 edge pass, not −4.0.
6b. Below the crossings: “Unticked parts within the gap, away from any station” lists solid 49 at P8–P9 (the screw, about 0 mm clear on the straight run) plus small parts near P1–P4. Tick solid 49, press Check: it moves to the checked parts and the straight P8–P12 is either dropped (“left free to bend round it”) or the gap shows below 4 mm.
7. Select the run: grey boxes of the plate are now as wide as the plate (116 / 71 mm), not 2 m.
8. `node tests/cad-solids.test.js` prints only `ok` lines (16 checks).
