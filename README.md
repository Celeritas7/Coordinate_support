# Route Studio

Hose and cable routing checks for Creo: bend radius on one route, clearance between two, bundles of cables through shared clamps, analysis of existing .pts files, local point refinement.

## Files
- index.html - the app (markup only)
- css/route-studio.css - styles, light and dark theme
  - `--axis-x` / `--axis-y` / `--axis-z` (#E03131 / #2F9E44 / #1971C2, same in both themes) are an intentional addition to the palette: the CSYS X / Y / Z arrows in 3D and the axis letters in the pick panel. Picked parts and the picked CSYS ring use `--ink`, so they never read as Alternative A1 (`--alt1`).
- js/route-studio.js - geometry, optimiser, 3D view, bend / clearance / bundle tabs
- js/analysis.js - Analyse tab and Issues list
- js/refine.js - Refine tab: re-fit, Fix / Fix all / Step through, delete, drag in 3D
- js/clearance.js - Clearance tab: axis push, fixed start/end, ramp, pass/fail
- js/arcroute.js + js/arc-ui.js - lines + arcs route shape (corner points, single radius)
- js/pts-table.js - Table → .pts tab
- js/step.js, js/iges.js, js/cad-io.js - named datums from STEP / IGES, frames, STEP export
- js/step-asm.js + js/asm-ui.js - assembly STEP: part tree with placements, world CSYS, pipe centrelines, clamp bores; route-through-clamps panel
- js/next.js - "Next:" buttons under a result line (nextSteps)
- js/fixings.js - one clamp finder for Hose and Pipe: Library part, end fitting, clamp not in the Library, holds another pipe, short bolt / plate hole; reason per row
- js/through.js - re-route a pipe straight through clamp bores (ends, radius, min straight kept)
- js/asm-tree.js - part tree with the per-part pipe override (Route Studio + Inspector)
- js/pts-compare.js - compare a .pts with a pipe / hose from the assembly
- js/shell.js - header (Open, Examples, More: Paste table / Inspector / How it works, theme), the assembly line (Change… / Remove with Undo), module switch Hose / Cable · Pipe · Bundle · Library, task tabs, drop-anywhere routing
- js/strip.js - Hose / Cable · Route through stations as 1 Load · 2 Stations · 3 Route: current card, summary lines, Advanced toggle
- js/dock-tables.js - dock tabs Clearance (table / chart) and Clamps to add, counts on the tab labels
- UI_AUDIT.md - every control, which module it belongs to, and why
- tests/ - `node tests/arcroute.test.js`, `node tests/step-asm.test.js`, `node tests/through.test.js`, `node tests/asm-extras.test.js`, `node tests/cad-pipes.test.js`; `tests/make-hose-sample.js` builds the spline hose sample
- samples/ - test files (see TESTING.md); DESIGN_BRIEF.md - what the app is for
- Launch Route Studio.bat - double-click on Windows; serves the folder on localhost:8765 and opens the browser
- ROADMAP.md - what is built and what is planned

## Run
Double-click `Launch Route Studio.bat`, or serve the folder with any static server (`python -m http.server`). Opening index.html directly from disk also works in most browsers. Needs internet for three.js and the IBM Plex fonts (CDN).

## How it works
The longer explanations that used to sit under each section of Hose / Cable · Route through stations.

### Stations (card 2)
A fixing is a hole with a coordinate system on its axis, inside the hole; it is listed when its bore is within Hose Ø −0.2 … +fit
(Advanced: Bore fit). Auto order finds the shortest path (nearest neighbour, then 2-opt) from Start to End; drag rows (or focus a
grip and press ↑ / ↓, Home / End) to change it. With Start and End both set, only the holes within 150 mm of the straight line
between them stay ticked; a row ticked or unticked by hand keeps its tick. An empty Start or End is filled by the next click on a
part or CSYS in the 3D view, with Undo in the pick panel.

Check route writes the ticked stations into Points as text, and their bore axes into Bore directions (Advanced), then runs the
hose along each bore. With the list empty (or after typing or dropping points into Points as text, which unticks the list),
Check uses the points as typed and only the start / end directions.

### Keep clear of the parts near the route (card 1)
Flat and cylindrical faces are read with their real outline and holes, so the gap to them is exact (a hose through a hole or past
a plate edge sees that edge); other faces count as a box. Small parts (80 mm or less in every direction) at a station or on the
station line are taken as clips and clamps and left unticked: the hose may touch them. A bracket up to 300 mm that the clip at a
station is fixed to is that clip's mount and left unticked too (a hose in the clip always reaches it). Larger parts are frame, even
at a station. In a STEP assembly, parts read as pipes (or marked pipe in the part tree) are listed as existing pipes, unticked. Tick
or untick any part; a ticked part is always checked. The parts come from the open assembly (one per session, top Open… or a drop).

### Check route (card 3)
Each Check replaces the last generated run (and its "as entered" run) unless that run is pinned in Runs in 3D. The result line
names the worst problem first (Clash, Too tight, Close, Clear) with up to three Next buttons. Fewest points (Advanced): after
routing, every point the curve doesn't need is dropped; the radius still holds and the curve moves at most Max shift; the station
points are always kept. A 4th value on a point line raises the min radius near that point for a smoother loop there.

### Alternatives (Tools)
Other ways round the kept-clear parts: each part the straight line between two stations comes too close to can be passed on up to
four sides (a side that would be a long detour, such as along a frame rail, is not tried); every mix of sides is shaped like the
generated route, and the best 3 distinct ones are drawn in 3D. Obstacles are the ticked parts (hose Ø / 2 + gap is the cable
radius; flat, round and swept faces measured exactly) and any boxes typed under Advanced. Left and right are judged along each leg,
start to end; over / under follow the Up axis in the section's header. A route is clean when it holds R and the measured gap.

### Suggest extra clamps (Tools)
Along the selected route, held at its stations: a clamp before and after each bend, then enough in every span to keep it under the
max spacing. Each one says what it mounts on and which existing clamp it should be like (same mounting part, else the nearest).
Settings are in card 3, Advanced.

### Lines + arcs (Pipe · Route through points)
The .pts file holds only the corner points of a polyline. In Creo, build the curve with Curve through points, Single radius, and
type the radius from the file header. The corners are moved until every arc and straight passes through your points; the radius
is pushed from Min radius up toward Min radius × Safety factor.
