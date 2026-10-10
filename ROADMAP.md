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

## Phase 11 — Two areas, one shell (done)
- Header: **Open…** (or drop files anywhere), **Paste table…**, **Examples ▾** (all five example sets in one menu), Inspector link, light / dark switch (saved)
- Module switch **Hose / Cable · Pipe · Bundle**; last module and task remembered
- Task strip per module. Hose / Cable: Route through stations (spline), Check as loaded, Offset B from A. Pipe: Route through points (lines + arcs), Check .pts against pipe, Through clamps, Table → .pts, Offset from another pipe (12c, greyed). Bundle: Route bundle
- The module decides the route shape; the Route shape selector is gone
- Where a file goes: assembly .stp → Pipe; a .pts that fits a pipe of the open assembly → Pipe · Check .pts; several files → Hose · Check as loaded; one station file → the open Hose task (Offset: first file master, next slave), or Pipe · Route through points when that is open. The status line under the switch says where it went
- Typed obstacle boxes (Analyse, Bundle) under “Advanced”, kept as the fallback until Phase 13
- Runs list, 3D view and all seven dock tabs unchanged; same files, same element ids
- Audit of every control: `UI_AUDIT.md`

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
- (done, see below) Inspector tree with "this is the pipe"; hose on a spline; .pts compared with the assembly

### Phase 12 remaining items (done)
- **Parts tree** (`js/asm-tree.js`, shared): every instance indented under its sub-assembly, ×count for repeated parts, solids, face types, CSYS names, placement (hover). Pipe? column: auto / pipe / not a pipe per part, with the status (Ø, R, bends, length) or the reason it is not a pipe (too short, too thin, only part of a tube, fitting-like, no tube faces). Saved per file name in the browser; Route Studio (Analyse → Parts) and the Inspector (Parts and pipes) read the same choice
- **Hose on a spline**: B-spline curves and surfaces (plain and rational) evaluated; a spline face whose one parameter runs round a constant-radius circle is a tube; centres of those circles = the centreline, chained with cylinders / tori of the same radius. Datum curves (B-spline, composite, trimmed) read and cross-checked. Smallest bend radius from the centreline (4 mm chord). Coverage check: a tube must be round all the way (edge rounds are not pipes). Hose runs give a spline .pts (points where the chord would stray > 0.2 mm). Test sample `samples/hose_spline_test.stp` (+ `.pts`) built by `tests/make-hose-sample.js` with a known path: centreline 0.001 mm, length 0.01 mm, min R within 1 %
- **.pts compared with the pipe** (`js/pts-compare.js`, Analyse → Compare a .pts): frame found, repeated points dropped, each point classed (on a corner / on a straight / on a bend arc / off by N mm / past the pipe end on its axis), corners with no point (with the coordinates they should have), points out of route order (and where they belong), how far the pipe runs past the first / last point. Reordered .pts (Copy / Download); a thin run in 3D shows what Creo builds from the file in its own order
- Verified: piping2_1 → repeat #2, corner 4 missing, #8 4.00 mm off and out of order (between #5 and #6). piping3_11 → listed end to start, #1 and #19 3.41 mm past the ends, #20–#23 out of order. piping3_21 → no start point (pipe runs 80.4 mm before #1), #18 #19 #21 #22 out of order. `node tests/asm-extras.test.js` (21 checks)
- Open: a real Creo hose export to confirm the spline reader on Creo's own surfaces (only the generated sample so far)

## Phase 12b — Pipe through a clamp (done)
- Clamps found automatically (`StepAsm`): a hole (cylinder face facing its axis) with a named CSYS origin on the axis, inside the hole. Bore Ø, axis and length from the hole faces; coaxial faces merged; the CSYS axes are not used (piping2 `990224`: CS0 Z along X, bore along Y)
- Per pipe the list shows only bores of its size (±1.5 mm); bolt holes, its own end fittings and clamps holding another pipe are left out. Pre-ticked; the pipe's status per clamp: passes / misses by N mm
- `js/through.js`: corners re-fitted (least squares, penalty continuation) with ends and end directions fixed, single radius, min straight between bends, and for each ticked clamp a straight on the bore axis covering the bore + margin. Tries: corner(s) moved onto the axis, or corners added; picks the least change (an added corner counts as a 25 mm move). Clamps already passed through are kept, the pipe re-centred in them
- Analyse tab panel: pipe, .pts frame (MAIN by default), clamps, R / min straight / margin → new run; table of old vs new corners (was #, moved mm, bend °), clamp check, ends check; .pts with Copy / Download
- 3D: clamp bores as rings + axis, blue = pipe passes, red = ticked but missed
- **Drop detour corners** (on by default): a bend over 120°, or a corner whose removal shortens the route by 15 % or more, is dropped when every rule still holds. Gentler corners stay — the parts a pipe bends around are not read yet (Phase 13)
- piping2 result: 7 points — the 167° hairpin (old #4, 500 mm out and back) dropped, one corner added on the bore axis, no other corner moved; route 1032 → 655 mm; centreline 0.000 mm off the axis over the whole bore, ends and directions exact, shortest straight 43.4 mm. `node tests/through.test.js` (21 checks)
- Open: clearance to other parts (Phase 13); pick clamps by clicking in 3D

## Phase 12c — Offset a pipe from another
- "Use as master" / "Use as slave" on any pipe run sends the true centreline (not the corner points) to the Clearance tab
- Offset at a set gap (surface to surface, so both ODs are counted), along chosen axes or normal; both ends fixed, ramps where needed
- Output re-fitted as corner points at the slave's single radius, so it goes straight back to Creo; gap checked along the whole length against the real centrelines
- Test: piping3, pipe 211 offset from pipe 111 at a set gap; minimum surface gap reported equal to the gap ±0.1 mm

## Phase 13 — Parts in 3D and clearance to real parts
First step (done, Route through stations):
- `js/cad-solids.js`: IGES B-rep solids (186/514/510/508/504/502, arcs 100 with their 124 transform, B-splines 126) and STEP solids (via StepAsm) → one box per face. `u107338_fy26_test_frame_asm_111.igs`: 73 solids, 3682 faces, read in about 0.5 s in the browser
- Survey per route: parts at a station = its clip (unticked), small parts (≤ 80 mm) on the station line = clips without a CSYS (unticked), the rest = frame / obstacles (ticked); user can change every tick
- Gap check to the ticked parts on every generated route (smallest gap, part, nearest point); face boxes drawn in 3D on the selected run
- “Push the route away”: opt-in trial. Face boxes are generous on curved / slanted faces of the welded frame (solid 1) and force tight bends when on (R 20.8 on route_343434); needs real face shapes (below)
- **Straight where 3+ stations line up** (≤ 1 mm): fixed tangents along the line, so the spline is straight there. route_343434: P8–P12 straight, 30 points, R 66.3
- Parts list: ticked parts first (“Gap checked”), then clips; buttons Default ticks / Frame only / Tick all / Untick all. Opening or dropping a solid-model IGES loads it as parts and keeps the stations
Flat faces with holes (done):
- `js/cad-solids.js`: flat faces (128 bilinear or any planar 128, 190, 108) and cylinders (120 with a line parallel to its axis) are read with their loops — lines, arcs 100 + 124 (every 5°), B-splines 126 (evaluated), composites 102. Flat face = outline + holes as polygons in the face plane; cylinder = axis, R, axial and angle range. Frame IGES: 1429 flat, 1472 cylinders, 781 left as boxes (cones, tori, free-form); still read in about 0.5 s
- Gap to those faces is exact: in the plane over material → height; over a hole or beyond the edge → distance to the nearest edge. Box test stays as the quick lower bound. Their boxes now come from the sampled outline, not whole arc circles (solid 1's Y 1000 face: 116 mm across instead of 2040)
- Plates: a flat face with an opposite face of the same solid ≤ 25 mm behind it, outlines overlapping. Solid 1: Y 1000 / 1007 (7 mm), X −425 / −418 (7 mm), …
- Review notes: plate pairing ignores the sign of the face normal (128 normals are arbitrary in sign); hole rings are chained from their edges before drawing; arcs are chords every 5° (error ≤ 0.001 × R, under 0.5 mm on the frame); a hole through a block thicker than 25 mm is not reported as a hole (the gap is still exact)
- Report: every place the route crosses a plate off its material, with the station span — “through a Ø… hole in the 7 mm plate at Y 1000 / 1007 of solid 1, … mm clear all round”, or “past the edge of …, … mm clear” (edge passes for parts over 300 mm only). Holes the route goes through are drawn in 3D on the selected run (green, red when below the gap)
- Finding on route_343434: the plate Y 1000 / 1007 has no openings where the hose crosses — only ten Ø15.5 holes elsewhere. From Z −3429 on it is 71 mm wide (X −406 … −335); the hose crosses its plane **beside its edges**: P6–P7 just past X −335, P12–P13 further out, P14–P15 past X −406. The −4.0 mm near point 24 was the box of that face (2040 mm wide from whole arc circles). As-entered spline: P6–P7 5.7 mm clear (the new smallest gap), P12–P13 61.6, P14–P15 13.0. The P6–P7 edge pass is the one to watch. Solids 30 / 50 are still to confirm in Creo
- Unticked parts away from stations are still checked: any within the gap is listed (“P8–P9: solid 49 (54×24×21 mm) — 0.2 mm clear”) and marked red in 3D, with a prompt to tick it if it is a screw or bracket. Found by the user: solid 49 between P8 and P9 is a screw on the straight P8–P12, taken as a clip until now. Parts list: each row has “show” (amber face boxes + name in 3D, view centred on it) and the part's centre X, Y, Z, so the user can find it in Creo. Creo IGES carries no part names on solids (186 label MSBR, no 406 name) — hence “solid 49”; a STEP export of the frame would carry real names (StepAsm reads them), but STEP faces are still boxes only. Open: tell a screw from a clip automatically (cylinder R + head, thread length) instead of by size
- Test: `node tests/cad-solids.test.js` (16 checks). STEP solids still give boxes only (StepAsm has no face surfaces yet)
Next (start here in a new chat):
- “Push the route away” on real faces (push off the exact flat / cylinder distance instead of boxes); check it no longer forces tight bends (was R 20.8 with boxes). Solid 1 still has 12 box faces (tori), so push stays generous there until tessellation
- Same exact faces for STEP solids (planes / cylinders from StepAsm)
After that:
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

## Phase 15 — Fixes
- Suggested actions per issue: move a station or clip by Δ along an axis (only what can move — clamps and clips are frame-fixed unless the user frees them), step the route around a part with corner points, re-route a span with lines + arcs at single radius
- Apply → re-check → accept or undo; fixes listed in the report as Creo instructions ("move clip CS31/32 −10 mm in Y")
- Output: corner points .pts with the single radius in the header, 3 decimals, assembly frame

## Phase 16 — Pipe against real geometry
- Route generation and Parallel pipes use the Phase 12/13 parts as obstacles and the clamps as stations
- Parallel pipes at a set gap checked against each other and against parts

## Phase 18 — Common support plate: concept generator (after Phase 13)
Goal: one sheet-metal bracket that serves every assembly variant. The app proposes ranked concepts (bracket shape, position, hole pattern, clamps per hose per variant) from a bounded search, not one answer.

Input
- One STEP per variant, all exported in the same frame so the plate area overlaps
- Plate = the part whose name contains `_PLATE`. Focus area = its envelope + a margin set in the app; the solver works only inside it (routes outside are read, not changed)
- Plate travel: a CSYS on the plate + travel in mm along its axes (slot or range)

Bracket and sheet-metal rules (editable in the app, saved with the project)
- Shape: bent bracket L or Z; holes placed on each flange. Flange lengths / bend position are search variables
- Rules: thickness, material, inside bend radius, hole Ø per clamp, min edge distance, min hole-to-bend distance, min hole pitch, hole snap pitch (default 5 mm), max outline

Clamps (version 1)
- P-clip / cushion clamp (one hole) and cable-tie mount (one hole), fixed by push-in plastic clip / fir-tree, no tool
- Sizes: typical DIN 3015 / P-clip table by hose OD (user-editable); open side of each clamp is modelled for lift-out
- One hole may take a P-clip in one variant and a tie mount in another when both fit its Ø; flagged in the report
- Spacing along a hose: cable 150 mm, hose 300 mm, pipe from an OD table (editable); plus clamps where the route needs them (ends of the focus area, either side of a bend)

Search
- Variables: plate position on its travel, flange lengths, clamp positions along each route (snapped to pitch), clamp side
- Two concept families, labelled: **routes fixed** (clamps placed on existing routes) and **re-routed** (routes inside the focus area moved to share holes; ends at the focus boundary kept; bend radius, min straight and Phase 12b through-clamp solver reused)
- Hard rules: no interference with parts (Phase 13 meshes), hose clearance, bend radius, sheet-metal rules
- Ease of fitting / removal (all hard rules, gaps editable): free space at each clamp's open side for lift-out; no other clamp, hose or part within a set gap; clamp not covered by another hose seen from the reach side; hand / finger envelope reaches it. Reach side: whichever plate side is more open
- Ranking, in order: fewest unique holes across all variants → clearance → access → route length → plate size → clamp count. Pareto set kept, so near-ties on the first criterion still show variety
- Spare holes: option, off by default (count per hose when on)

Output
- Gallery of concept cards sorted by score, plus a sortable table (one row per concept); click either to open the concept in 3D, step through variants
- Per concept: plate hole pattern as CSYS in a STEP (back to Creo), flat plate DXF with holes and bend lines, routed .pts per hose per variant, report (scores, clearances, access per clamp, shared-hole flags)
- As many concepts as make the choice easy: default 10, user can raise it

Tests (with the user's STEP set when it arrives)
- Every concept: zero interference, all access checks pass, every hose clamped within spacing in every variant
- Fixed-route concepts leave routes unchanged to 0.001 mm; re-routed ones keep ends and bend radius
- DXF hole positions match the STEP CSYS to 0.01 mm after unfolding

Needs: Phase 13 (part meshes for interference), Vite + Web Worker (the search runs long)

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
