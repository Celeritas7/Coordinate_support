# Testing with the sample files

Files are in `samples/`. Start the app with `Launch Route Studio.bat`.

## 1. File Inspector (link "check a CAD file" on the Bend tab)

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
3. Leave Bend R 40, Min straight 30, Margin 2, .pts frame MAIN. Press **Route through ticked clamps** (well under a second).
4. Expect a new run "… · through U104904_990224", 8 points. Table (#, was, moved, bend °, note; hover a row for its X Y Z): point 5 "new corner, on bore axis", point 6 "unchanged, on bore axis", every other row moved 0.000. Clamp line in blue: 0.000 mm off its axis, straight from −11.0 to +51.5 mm. Ends moved 0.000 mm, direction 0.000°. Shortest straight 43.4 mm. In 3D the rings turn blue and the tube runs through them.
5. Copy .pts / Download .pts: header names the clamp, single radius 40, frame MAIN.
6. `piping3_practice_asm.stp`, pipe 111: three clamps listed, all "pipe passes through it"; routing keeps 23 points and re-centres the pipe in the 22402156 clamps (moves ≤ 0.17 mm).
7. `node tests/through.test.js` prints only `ok` lines (18 checks).
