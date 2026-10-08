# Route Studio — development phases

## Phase 1 — Single route (done)
- Spline through target points, min bend radius check, .pts export
- Per-point local min radius (4th value on a target line)
- Closer points in tight bends
- Points table linked to 3D (hover marks, click zooms)
- Clearance run with true normal (parallel) offset

## Phase 2 — Bundle routing (done)
- Bundle tab: cables (id d R gap), routes (start end clamps), clamps (xyz + axis), obstacle boxes
- Shared trunk through clamps, fixed angular slot per cable (no crossing)
- Breakout legs avoid obstacles and already-placed cables
- Cable-to-cable clearance table, bend radius per cable, .pts per cable + zip
- Nudge-a-clamp suggestion on bend failure
- Clear all runs
- Open: re-verify C3–C4 gap after the +1 mm margin

## Phase 3 — Wire analysis tab (done)
Purpose: check cables edited by someone else, quickly, without re-routing them.

Input
- Load one or more existing .pts files (or paste), as-is — no smoothing or re-solve
- Optional: min bend radius, diameter, gap per cable; obstacle boxes; a reference version to compare against

Checks (per point)
- Bend radius below min R
- Kinks: angle between adjacent segments above a limit
- Spacing: duplicate points, gaps much larger/smaller than neighbours
- Clearance to obstacles and to other loaded cables
- Self-intersection / loop-back
- Against reference: points moved more than X mm, length change

Output
- Issue list sorted by severity: cable, point #, check, value vs limit
- Click an issue → 3D zooms to it, point highlighted, row selected in Points table
- 3D colouring along the cable: pass / warn / fail
- Filter by cable and by check; summary count per cable
- Export issue report (.csv)

## Phase 4 — Local point refinement (done)
Refine tab in the dock. Pick a point (field, Points table row, or an issue), set span ± N points.
- Re-fit span: interior points re-solved for the local min R; ends keep position and direction
- Add K points: span re-seeded evenly by arc length before the fit
- Move X/Y/Z: shifts the picked point, span re-fits around it (moved point stays put)
- Keep clear of other visible cables and of obstacles (bundle or Analyse tab)
- Before/after: old span shown dashed, span start/end tagged; Undo per run
- Works on imported cables from Phase 3; issues re-checked after every change

## Phase 5 — Fix issues, drag, delete (done)
- Re-fit kept when the span clears bend, clearance and kink checks, or leaves fewer failures
- Fix button per issue; Fix all / Step through (accept, skip, stop) with widen → add points → give up; summary; one Undo per batch
- Delete point from an issue row or Refine (never start/end)
- Add points by count or by spacing (mm)
- Drag a point in 3D along X / Y / Z, in a plane, or in the screen plane; optional re-fit of neighbours on release
- Point # follows renumbering; a fresh Analyse replaces earlier runs of the same cables

## Phase 6 — Clearance with fixed ends (done)
- Slave start / end inputs (fixed points)
- Push along any combination of X / Y / Z, or Normal (parallel); gap is the true 3D distance
- Ramp length: fixed in mm, or auto (shortest that passes the bend check)
- Pass/fail on bend, ramp bend, unreachable gap (P-numbers listed), exact-gap deviation; length change vs original
- Locked points by P-number; mode "exact" replaces "const"

## Phase 7 — CAD import (done)
- STEP / IGES readers: named datum points and coordinate systems, file order kept
- Name-group chips, Frame select, STEP export of any run in the same frame
- File inspector (inspector.html)
- Solver: per-segment gradient (~40x faster), Stop button

## Phase 8 — Fewest points (done)
- Bend tab option, on by default: after shaping, drop points the curve doesn't need
- Kept: target stations and endpoints; thinned spline meets min R and stays within 3% of the full route's R
- Max shift (mm, default 1): thinned route passes within this distance of every dropped point
- Four passes catch cascading removals; solver runs in chunks so the page stays responsive
- Untick for the old dense output
- Tested on route_343434_csys.stp: 188 → 42 points (shift 1) → 32 (shift 3)

## Phase 9 — Lines + arcs route (done)
- Bend tab "Route shape": Spline (many points) or Lines + arcs (corner points only)
- Output is the polyline corners; Creo builds the curve with Curve through points, Single radius (radius in the .pts header)
- Corners are moved (least squares) until every arc and straight passes through each station within the station tolerance
- Radius raised from Min radius toward Min radius × Safety factor, rounded down to 0.5 mm and re-fitted, so the typed radius is exact
- Corners the route doesn't need are dropped; a corner that can't reach is split into two
- Start / end direction honoured; stations tagged by name in 3D; Refine is off for these runs (re-solve instead)
- Test: `node tests/arcroute.test.js` (343434: R 79.5, 11 points, vs spline R 76.8, 103 points)
- Open: confirm Creo's Single radius curve reproduces it (shortest straight between arcs can be ~0.1 mm)

## Phase 10 — Table → .pts (done)
- Tab for pipe points scanned from a drawing table: paste X / Y / Z blocks, or X Y Z rows (Excel, optional point number)
- Copy .pts / Download .pts, file name and decimals; send the points to the Bend tab
- Check: bend angle per point, largest bend radius each corner leaves room for, optional pipe bend R flagged per corner

---

# Next: the brief (DESIGN_BRIEF.md)

Sample set for every phase below, in `samples/`: `piping2_practice_asm.stp` + `piping2_practice_1.pts` (one pipe, two fittings), `piping3_practice_asm.stp` + `piping3_practice_11/21.pts` (two pipes, 21 solids), `piping4_answer_asm.stp` (CS0–CS30 stations incl. `_AIR` / `_CV` groups, 18 solids, the finished answer), plus the hose case `343434_asm.stp` / `route_343434_csys.stp`. Each phase ships with its TESTING.md section and a `node tests/*.test.js` file; a phase is done only when every sample passes.

## Phase 11 — Two areas, one shell
- Top-level switch **Cable / Hose · Pipe · Bundle**. Cable/Hose holds Analyse, Refine, CAD import. Pipe holds Table → .pts, Route generation (Bend tab, lines + arcs default) and Parallel pipes (Clearance). Bundle unchanged, not featured
- Drag-and-drop STEP / .pts onto any input; the paste box takes column blocks or Excel rows everywhere points are typed
- Copy + Download on every output (.pts, .stp, report)
- 3D legend, light/dark, desktop-first layout kept

## Phase 12 — Assembly STEP reader (see progress below)
Port of the Python prototype to `js/step-asm.js`, no DOM, tested in Node.
- Product tree: PRODUCT, NEXT_ASSEMBLY_USAGE_OCCURRENCE, ITEM_DEFINED_TRANSFORMATION → every part instance with its world placement (nested sub-assemblies, repeated parts)
- Datum CSYS / points per instance, in world coordinates (today's reader only handles the top level)
- Solids per part: ADVANCED_FACE list with surface type (plane, cylinder, cone, torus, B-spline), face bounds, edges
- **Centreline recovery** for swept pipes/hoses: cylinder axes + torus centre circles chained end to end → straights, arcs and the **exact bend radius** (torus major R) and OD/ID (minor r). Verified on piping2 (R 40, Ø22.5/Ø14.5) and piping3
- Inspector shows the tree: name, instance count, placement, solid / datum summary, which part looks like a pipe

## Phase 12 — Assembly STEP reader (in progress)
Done (`js/step-asm.js`, no DOM, `node tests/step-asm.test.js`):
- Product tree: PRODUCT, NEXT_ASSEMBLY_USAGE_OCCURRENCE, ITEM_DEFINED_TRANSFORMATION → every part instance with its world placement (nested sub-assemblies, repeated parts; piping3: 51 instances, 3 levels)
- Named CSYS and datum points per instance, in world coordinates
- Solids per part: face list with surface type, radii, edge circles and vertices; world bounding box per instance
- **Centreline recovery**: cylinder axes + torus centre circles of the radius that carries most length, split faces merged, chained end to end → straights, arcs, exact bend radius (torus major R), OD / ID, bend angles, straight lengths, shortest straight. Near-U bends (>170°) get two corner points
- Pipe detection: the solid with the longest recoverable centreline (≥ 100 mm, ≥ 8 diameters; cones/splines allowed only on long or bent ones). Verified: piping2 Ø22.5/14.5 R40 5 bends; piping3 Ø12 R35 and Ø15 R40, 21 bends each; piping4 two Ø18/16 R40 pipes whose corners sit on CS13/CS14…
- `.pts` frame detection: the named CSYS that lands a .pts file's points on the pipe (MAIN for all three practice files)
- Analyse tab → **assembly .stp (parts + pipes)**: one run per pipe with the corner-point .pts (single radius in the header), stations on the pipe tagged by CSYS name, other parts as boxes
Next:
- Inspector page: the tree (name, instance count, placement, solids, datums, which part looks like a pipe) and a "this is the pipe" tick when detection picks wrong
- Hose case: sweep along a spline (B-spline surface skins) — recover the trajectory from the datum curve or the skin
- .pts loaded with the assembly: frame detected, repeated points dropped and noted, out-of-order tail points reported, corners compared (piping2: one corner 4 mm off; piping3_21: pipe runs 89 mm past the first point)

## Hose module, Phase A — assembly reader: parts and edge cloud (done, acceptance pending the sample)
Brief: `claude_code_prompt.md` (2026-10-08), Python prototype `step_assembly.py` / `part_edge_cloud.py`. Built on the Phase 12 reader.
- Product tree and placements as in Phase 12; quoted strings are skipped when collecting `#123` references (names like `'Placement #0'`)
- Per part: every EDGE_CURVE of its solids and surface models sampled about every 5 mm: lines, trimmed circles and ellipses (edge sense respected), B-spline curves (rational too, SURFACE_CURVE / SEAM_CURVE unwrapped). Shared edges sampled once
- Per placed instance: the cloud in assembly coordinates (Float32) and a world box taken from it (exact for the edges; the old box of the rotated local box was too big on rotated parts). Faces are not triangulated yet
- Parsing in a Web Worker with a progress bar (reading, decoding, placing parts). The worker is built from `js/step-asm.js` itself as a Blob, so it also runs from `file://`; without Worker support it parses on the page
- Analyse tab → assembly .stp: products, placed instances, edge points, read time; a **Parts** list (name, edges, points, world box per instance)
- Test: `node tests/asm-cloud.test.js` (built-in nested/rotated assembly, then the acceptance checks when `samples/u107338_fy26_test_frame_asm.stp` is present)
- Acceptance (to run on the sample): 50 products, 63 placed instances; `FY26_TEST_FRAME__2` box ≈ X −1515…544, Y 1000…1300, Z −10985…−1710; `991640` near CS33 box X −441.7…−387.7, Y 1047.9…1072.1, Z −5760.5…−5739.5
- Speed: a synthetic 50 000-entity file with 12.5 M edge points reads in about 1.8 s

## Phase 12b — Pipe through a clamp (done)
- Clamps found automatically (`StepAsm`): a hole (cylinder face facing its axis) with a named CSYS origin on the axis, inside the hole. Bore Ø, axis and length from the hole faces; coaxial faces merged; the CSYS axes are not used (piping2 `990224`: CS0 Z along X, bore along Y)
- Per pipe the list shows only bores of its size (±1.5 mm); bolt holes, its own end fittings and clamps holding another pipe are left out. Pre-ticked; the pipe's status per clamp: passes / misses by N mm
- `js/through.js`: corners re-fitted (least squares, penalty continuation) with ends and end directions fixed, single radius, min straight between bends, and for each ticked clamp a straight on the bore axis covering the bore + margin. Tries: corner(s) moved onto the axis, or corners added; picks the least change (an added corner counts as a 25 mm move). Clamps already passed through are kept, the pipe re-centred in them
- Analyse tab panel: pipe, .pts frame (MAIN by default), clamps, R / min straight / margin → new run; table of old vs new corners (was #, moved mm, bend °), clamp check, ends check; .pts with Copy / Download
- 3D: clamp bores as rings + axis, blue = pipe passes, red = ticked but missed
- piping2 result: 8 points (one added on the bore axis), no other corner moved, centreline 0.000 mm off the axis over the whole bore, ends and directions exact, shortest straight 43.4 mm. `node tests/through.test.js` (18 checks)
- Open: clearance to other parts (Phase 13); pick clamps by clicking in 3D

## Phase 12c — Offset a pipe from another
- "Use as master" / "Use as slave" on any pipe run sends the true centreline (not the corner points) to the Clearance tab
- Offset at a set gap (surface to surface, so both ODs are counted), along chosen axes or normal; both ends fixed, ramps where needed
- Output re-fitted as corner points at the slave's single radius, so it goes straight back to Creo; gap checked along the whole length against the real centrelines
- Test: piping3, pipe 211 offset from pipe 111 at a set gap; minimum surface gap reported equal to the gap ±0.1 mm

## Phase 13 — Parts in 3D and clearance to real parts
- Face tessellation (planes, cylinders, cones, tori exact; B-spline surfaces sampled) → one mesh per part instance, shown dim in 3D, hidden/pinned per part
- Route-to-part distance: point-to-triangle with a BVH per part; chunked so the page stays responsive
- Contact rule: hose touching a **fixing** is allowed, touching anything else is a clash; penetration depth and gap reported with the part name
- Clearance rule and fixing recognition come from the engineer's answers (see Open questions)
- Triggers the Vite move (Web Worker for the distance pass and the solvers)

## Phase 14 — Check an existing route
- Load the assembly: the app finds the hose/pipe solid, its stations (CS order along the centreline, so a mis-numbered station is reported), fixings and obstacles
- Checks: bend radius along the centreline (exact from the tori, or sampled on splines) vs min R; clearance per part; station order; station off-centreline; contact with non-fixings
- Issues list reads as a checklist: where (station span), what, value vs limit, which part. Click → 3D zoom, point coloured
- Problem report: Copy / Download (.md and .csv)

## Clamp placement on a mounting plate (requirement, 2026-10-08)
From the engineer: a clamp is not free in space. The **mounting plate** offers a set of possible positions (holes, slots, mounting options), and the hose / pipe can be held at different points along its route.
- A fix that moves a clamp picks one of the plate's **allowed positions**, never an arbitrary offset
- The clamp body must not interfere with the plate, the frame or other parts, and must sit properly on the hose (straight lead-in / lead-out, hose centred in the bore)
- **Ease of clamping counts**: the fitter must be able to reach the clamp and the bolt with hand and tool (access zone free, sensible bolt direction, not hidden behind the frame or another part). A position that only passes geometry but is hard to fit ranks lower
- Ranking of candidate positions: hose checks pass (bend R, gap) → no interference → access / comfort score → least change
- Feeds Phase C (clip moves become a search over allowed positions) and Phase D (shared bracket, rules file)

## Phase 15 — Fixes
- Suggested actions per issue: move a station or clip by Δ along an axis (only what can move — clamps and clips are frame-fixed unless the user frees them), step the route around a part with corner points, re-route a span with lines + arcs at single radius
- Apply → re-check → accept or undo; fixes listed in the report as Creo instructions ("move clip CS31/32 −10 mm in Y")
- Output: corner points .pts with the single radius in the header, 3 decimals, assembly frame

## Phase 16 — Pipe against real geometry
- Route generation and Parallel pipes use the Phase 12/13 parts as obstacles and the clamps as stations
- Parallel pipes at a set gap checked against each other and against parts

## Phase 17 — Point reduction follow-ups
- Max points cap: hard upper limit on output points; the pass widens Max shift step by step until the route fits, and reports the shift it ended at
- Same pass on Analyse / Refine for imported .pts files: thin a loaded cable without re-routing it, same radius and station rules; issues re-checked afterwards

## Move to Vite (during Phase 13)
ES modules, no monkey-patching; users still get a static folder from `dist/`.
- Solvers, point-removal pass and the distance pass in a Web Worker (Stop button stays; UI never blocks)
- Regression tests for STEP/IGES readers, both solvers and the assembly reader run in CI

## Open questions (decide before Phase 13)
1. Clearance rules: minimum gap to parts; to moving or hot parts?
2. Bend radius: centreline or inside of the bend?
3. Fixings: part-number patterns or names that mean clamp / clip
4. How the hose is modelled in Creo (sweep, Cabling, Piping) — decides the output format

## Open
- Re-fits take 10–60 s on long spans; speed up the span optimiser
- Multi-cable routing portal: per-cable start/end, constraint waypoints, radius + bend + no-tangle

Previous plan:
Not in the current build. Today the 4th-value radius and "closer points" both re-solve the whole path.

Behaviour
- Select a point (Points table or 3D)
- Set span: ± N points or ± mm along the cable
- Actions on that span only:
  - Insert K points (evenly by arc length)
  - Re-fit the span to a new local min radius
  - Move / drag one point, span re-fits around it
- Everything outside the span is locked; position and tangent match at both span ends
- Before/after overlay, bend + clearance re-checked for the span, undo
- Works on imported cables from Phase 3, so a flagged issue can be fixed in place
