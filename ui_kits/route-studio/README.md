# Route Studio UI kit

Recreation of the single-page tool in `Coordinate_support/index.html`. One product, one view: a 360px sidebar (form + comparison runs), a 3D route view with readout/tools/legend, and a 230px dock (charts, compare table, point file).

Files
- `index.html` — light theme, seeded with a bend-radius run (typical view). Tagged @startingPoint.
- `dark.html` — same, `data-theme="dark"`.
- `empty.html` — first-visit state, no runs.
- `mobile.html` — under 860px, single column.
- `App.jsx` — state: tabs, form, runs (max 6), selection, colour mode, dock pane.
- `Sidebar.jsx` / `View.jsx` / `Dock.jsx` — the three regions, composed from the design-system components.
- `geometry.js` — trimmed copy of the product's spline + clearance maths so numbers are real.

Cut corners (cosmetic recreation): the 3D view is a 2D canvas projection (drag to rotate) instead of three.js; the bend-radius optimiser is replaced by corner-cutting subdivision; clearance ignores plane/smooth/blend/locks. Download .pts is inert.
