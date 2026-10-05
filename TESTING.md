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

## 4. Compare against the .pts

1. Analyse tab: open `route_343434_csys.stp` and `route_343434_R65.pts` together. Analyse always uses file-origin coordinates, whatever Frame is set on the Bend tab, so CAD points line up with .pts files exported from the same assembly.
2. Expect cables `RP`, `CS` and `route_343434_R65`. The .pts has 103 points = 87 RP + 16 CS: the RP numbers skip exactly where a CS station sits (RP009 → CS46). In 3D, RP and CS together lie on the .pts path.

## 5. Clearance tab

Both routes must come from the file; the example pair is only replaced per textarea.

1. **master from file** → `route_343434_csys.stp`. The chip row is labelled `Master · route_343434_csys.stp`; leave `RP` selected.
2. **slave from file** → the same file. A second chip row labelled `Slave · …` appears; pick `CS` there.
3. Adjust runs without error. Clearance will be negative (the CS stations sit on the RP route); this is a stress test, not a real pair.
