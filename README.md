# Route Studio

Hose and cable routing checks for Creo: bend radius on one route, clearance between two, bundles of cables through shared clamps, analysis of existing .pts files, local point refinement.

## Files
- index.html - the app (markup only)
- css/route-studio.css - styles, light and dark theme
- js/route-studio.js - geometry, optimiser, 3D view, bend / clearance / bundle tabs
- js/analysis.js - Analyse tab and Issues list
- js/refine.js - Refine tab: re-fit, Fix / Fix all / Step through, delete, drag in 3D
- js/clearance.js - Clearance tab: axis push, fixed start/end, ramp, pass/fail
- js/arcroute.js + js/arc-ui.js - lines + arcs route shape (corner points, single radius)
- js/pts-table.js - Table → .pts tab
- js/step.js, js/iges.js, js/cad-io.js - named datums from STEP / IGES, frames, STEP export
- js/step-asm.js + js/asm-ui.js - assembly STEP: part tree with placements, world CSYS, per-part edge cloud and world box (parsed in a Web Worker), pipe centrelines, clamp bores; route-through-clamps panel
- js/through.js - re-route a pipe straight through clamp bores (ends, radius, min straight kept)
- tests/ - `node tests/arcroute.test.js`, `node tests/step-asm.test.js`, `node tests/through.test.js`, `node tests/asm-cloud.test.js`
- samples/ - test files (see TESTING.md); DESIGN_BRIEF.md - what the app is for
- Launch Route Studio.bat - double-click on Windows; serves the folder on localhost:8765 and opens the browser
- ROADMAP.md - what is built and what is planned

## Run
Double-click `Launch Route Studio.bat`, or serve the folder with any static server (`python -m http.server`). Opening index.html directly from disk also works in most browsers. Needs internet for three.js and the IBM Plex fonts (CDN).
