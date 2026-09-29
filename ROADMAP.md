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

## Phase 4 — Local point refinement (built, in review)
Refine tab in the dock. Pick a point (field, Points table row, or an issue), set span ± N points.
- Re-fit span: interior points re-solved for the local min R; ends keep position and direction
- Add K points: span re-seeded evenly by arc length before the fit
- Move X/Y/Z: shifts the picked point, span re-fits around it (moved point stays put)
- Keep clear of other visible cables and of obstacles (bundle or Analyse tab)
- Before/after: old span shown dashed, span start/end tagged; Undo per run
- Works on imported cables from Phase 3; re-run Analyse to re-check

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
