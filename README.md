# Route Studio Design System

Route Studio is a single-page browser tool for mechanical/routing engineers: paste Creo `.pts` datum-point files, check a hose or pipe route's **bend radius** against a minimum, or push a **slave route** out to hold a **clearance** from a master route, then compare several runs in a 3D view, a graph and a table. It runs as one static `index.html` (three.js + IBM Plex from CDN), with two Python CLI twins for batch work. Audience: engineers who will re-check the result in Creo — the tone and the UI are plain, dense and numeric.

## Sources
- Codebase (mounted read-only): `Coordinate_support/` — `index.html` (whole product: CSS, markup, JS), `README.md` (product copy), `tools_hose_route.py`, `tools_route_parallel.py` (CLI help strings). No Figma, no logo files, no image assets exist in the source.
- Fonts: IBM Plex Sans 400/500/600 and IBM Plex Mono 400/500 from Google Fonts (the product's own request). No binaries ship; `fonts/fonts.css` `@import`s the same URL.

## One product, one surface
Route Studio has a single view: sidebar (form + comparison runs) · 3D view (readout, tools, legend, floating tags) · dock (bend-radius graph, clearance graph, compare table, point file). It has a light theme (default) and a dark theme (`prefers-color-scheme` or `[data-theme="dark"]`), and collapses to one column under 860px.

## CONTENT FUNDAMENTALS
- **Voice**: plain engineering English, written by a colleague, not a brand. Second person for instructions ("Paste the target points…", "Tick to show in the 3D view"), no "I/we". Never marketing.
- **Casing**: sentence case everywhere — headings, tabs, buttons, table headers ("Min bend radius, mm"). Setting values are lowercase shorthand as the CLI spells them: `min`, `const`, `xy`, `free`. Legend labels lowercase except "OK".
- **Buttons** are verb-first and say what happens next, comma included: "Check, then add to comparison", "Adjust, then add to comparison", "Zoom to tightest bend", "Download .pts". No trailing periods.
- **Units always stated**, as a muted qualifier after the label ("Min radius mm", "Target points (X Y Z per line)") or after a comma in tables ("Route length, mm"). Numbers use tabular numerals, 1 decimal for mm ("R 41.7 mm"), 2 for ratios ("1.51x").
- **Status lines** are complete sentences, densely factual, comma-separated: "Clearance now 40.0 to 61.8 mm, largest shift 22.4 mm, tightest bend R 88.0 mm." Verdicts: "Passes.", "Passes, but inside the x1.5 safety margin.", "Too tight: 23.3 mm below the 65 mm minimum."
- **Empty states** say what to do: "No runs yet. Run a check to add one." / "Nothing to compare yet." / "Run a check to see it here."
- **Hints** explain consequences in one sentence: "Adds two runs: the spline through your points as entered, and a generated route that holds the radius."
- **Run names** are terse settings summaries: "As entered R65", "Generated R65 x1.5", "Gap 40 min xy".
- No emoji, no exclamation marks, no icons in copy. The only glyph is `×` for remove and `·` as a separator. Spelling is British ("Colour by radius", "optimiser").

## VISUAL FOUNDATIONS
- **Colour**: three cool greys of paper (`--paper` app #E9EDF1, `--panel` #F7F9FB, `--field` #FFFFFF), two inks (`--ink` #1F2A36, `--muted` #5B6878), one rule (`--rule` #C9D2DB) and a floor grid (`--grid`). Colour means status only: `--ok` blue #2B6CB0 (also link and focus), `--warn` amber #D08A1E, `--bad` red #C8323C. Six run colours cycle for comparison lines. No gradients, no brand accent — the primary button is ink on paper. Dark theme remaps the same names.
- **Type**: IBM Plex Sans for UI, IBM Plex Mono for point data. Sizes are exact and un-snapped: 30 (readout), 20 (h1), 15 (body), 14 (tabs/controls), 13.5 (lede/verdict), 13 (buttons, tables, mono inputs), 12.5 (labels, status), 12 (hints, legend, tags), 11.5 (run sub-line). Weights 400/500/600. Body leading 1.45; readout 1.1 with -.02em tracking; h1 -.01em. `font-variant-numeric: tabular-nums` on every number.
- **Spacing**: ad hoc, not a grid — 2–20px values chosen per element (see `tokens/spacing.css`). Sidebar padding 18/18/28, field gap 9, field margin 12, input padding 7 8, table cell 7 12.
- **Backgrounds**: flat panels. Sidebar and dock are `--panel` on a `--paper` app background; the 3D view is bare `--paper` with a `--grid` floor grid. No imagery, no illustration, no texture, no patterns.
- **Borders**: 1px `--rule` on every edge that needs one (inputs, panels, buttons, table rows). Selected tab = 2px ink underline. Inputs and outline buttons share the same border.
- **Radii**: 4px for controls (inputs, buttons, run rows, segmented group), 3px for tags and legend bars, 2px for swatches. Nothing larger; no pills.
- **Shadows**: none. The only "shadow" is `inset 0 0 0 1px var(--rule)` ringing the selected run row.
- **Cards**: there are no cards. Regions are separated by 1px rules and background steps (paper → panel → field).
- **Buttons**: primary = full-width ink block, 11px padding, 600/15px; outline = panel bg + rule border, 500/13px, 6px 11px; small = field bg, 4px 10px; link = underlined `--ok` text with 2px underline offset; icon = bare muted `×`.
- **Hover**: none defined — cursor changes only (`pointer`, `grab`/`grabbing` on the 3D view, `progress` while optimising). Press: none. Disabled: opacity .55.
- **Focus**: 2px `--focus` outline, 1px offset, `:focus-visible` only.
- **Animation**: none. `prefers-reduced-motion` disables transitions anyway. State changes are instant.
- **Selection / pressed states** invert: pressed segment and selected tab are ink; selected run row steps up to `--field` with the inset ring.
- **Transparency & blur**: no blur. Alpha only on placeholder text (.7), disabled controls (.55) and unselected chart lines (.6).
- **Overlays**: floating tags in the 3D view are `--panel` chips with a 1px rule and 3px radius (measurements) or bare muted text (point names). Readout, tools and legend float over the canvas with no backdrop.
- **Layout**: fixed 360px sidebar, fluid view, fixed 230px dock; `100%` height app shell; under 860px stacks to sidebar / 58vh view / 260px dock. Readout top-left, tools top-right, legend bottom-left, help bottom-right.
- **Data viz**: charts are canvas 2D; lines 2px, limit lines dashed 6/4 at 1.5px in status colours, gridlines 1px `--rule`, labels 12px muted. 3D tubes coloured red/amber/blue by radius or by run colour.

## ICONOGRAPHY
There is no icon system. The product uses zero SVG, PNG or icon-font glyphs. The only glyph-like marks are the unicode `×` (remove run, 16px muted), `·` middle-dot separators, and colour swatches (11px squares, 16×5 legend bars). Buttons are text. Emoji never appear. If an icon becomes necessary, set it as plain text or a 1-colour glyph in `--muted`, and note it here as an intentional addition.

**No logo exists.** The name "Route Studio" is set in IBM Plex Sans 600 wherever a mark would go. `assets/` is intentionally empty of logos; do not invent one.

## Components
Built exactly from the CSS classes in `index.html` — no families added.
- `components/actions/` — **Button** (.go / .tools button / .ptshead button / .presets button / .del), **SegmentedControl** (.seg)
- `components/navigation/` — **Tabs** (.tabs sidebar, .docktabs dock)
- `components/forms/` — **Label** (label + .unit), **TextInput**, **Textarea**, **Select** (textarea,input,select), **Checkbox**, **FieldGrid** (.fields .c2/.c3), **Hint** (.hint / .status), **Disclosure** (details/summary), **Presets** (.presets)
- `components/data/` — **Readout** (.readout .big .verdict .facts), **RunItem** + **RunList** (.run / .runs), **Legend** (.legend), **Tag** (.tag), **CompareTable** (table)

Intentional additions: none.

## UI kits
- `ui_kits/route-studio/` — the app: `index.html` (bend check loaded), `dark.html`, `empty.html`, `mobile.html`; `App.jsx`, `Sidebar.jsx`, `View.jsx`, `Dock.jsx`, `geometry.js`. See its README for what is cosmetic.

## Index
- `styles.css` — @imports only → `fonts/fonts.css`, `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/base.css`
- `guidelines/` — foundation cards: colors-* (surfaces, ink, status, runs, dark), type-* (readout, ui, mono, weights), spacing-* (scale, radii, layout), brand-* (wordmark, voice)
- `components/` — see above; each directory has a `*.card.html`, and each component a `.d.ts` and `.prompt.md`
- `ui_kits/route-studio/` — product recreation
- `thumbnail.html` — homepage tile
- `SKILL.md` — agent skill entry point

## Caveats
- Fonts come from Google Fonts, exactly as the product does; no `.woff2` binaries are in the source.
- The product also switches to dark under `@media (prefers-color-scheme: dark)`; the design system ships dark as opt-in `[data-theme="dark"]` only, so previews stay predictable.
- The UI kit's 3D view is a 2D canvas projection, not three.js, and the optimiser is stubbed — numbers are computed, but the "generated" route is a subdivision, not the product's Hermite optimisation.
