# UI phases: Claude Code builds, Claude Design reviews

Written 2026-10-19 from a scripted walk-through of `main` @ `c84f55b` on `samples/piping3_practice_asm.stp`
(see `handoff/PREP_files_and_ui.md` for the file inventory and the U1–U10 friction list).

Baseline measured: Hose · route from clamps = **13 steps, 3 collapsed sections, the assembly loaded twice, Hose Ø typed twice,
result clashes 6 mm into a part, Alternatives gives 1 "not clean" route**. Pipe · Through clamps = 3 steps, 7 rows for 2 real clamps.

Every phase has the same loop:
1. **Claude Design**: mockup / wording / acceptance checklist (before code).
2. **Claude Code**: build on a branch, run `node tests/*.test.js` and the walk-through script (`tests/ui-walk.js`, phase 0), push.
3. **Claude Design**: review screenshots + click count against the checklist; list changes.
4. **Claude Code**: fix, re-run, merge.

Phases are ordered so each one is useful on its own and none needs a later one.

---

## Phase 0 — Measure (Claude Code only, half a day) — DONE 2026-10-19
- `tests/ui-walk.js`: the Playwright walk-through used for the rating, made repeatable: loads the samples through the real
  buttons, counts steps, captures status text and screenshots into `handoff/shots/`. Runs locally with
  `node tests/ui-walk.js` (needs Chromium).
- ~~Force-add the samples to git~~: **not done, the repo is public** and the samples carry real part numbers. They stay local; every test skips cleanly without them (`asm-extras`, `cad-solids`, `step-asm`, `through` crashed
  instead until 2026-10-21; they now print `skip:` and `asm-extras` still runs its synthetic spline-hose part).
- **Done when:** the script prints the baseline numbers above.

## Phase 1 — One clamp finder (Claude Code, 1–2 days; Claude Design reviews the row wording) — BUILT 2026-10-19, awaiting design review
Root cause of report issues 2, 3, 4 and of the 26-row list.
- `StepAsm.fixingsFor(r, {D, fit, pipe?})` used by Hose · Stations from clamps, Pipe · Through clamps and `clampsFor`:
  library match first → any hole with a CSYS → flagged "not in library"; bore fit **−0.2 … +fit**; **min bore length 10 mm**;
  the pipe's own end fittings and holes of another pipe marked as such; coaxial duplicates merged (the two identical `CS1` rows).
- Every row carries a one-line **reason**: "library clip 22402156", "bolt hole, 3.0 mm long", "end fitting of pipe 12",
  "holds pipe 211", "not in library — Add to library".
- Rows the finder would untick are collapsed under "Other holes (n)".
- **Design review:** the row layout and the reason wording (one line, no run-together text), the "Other holes" collapse.
- **Done when:** piping3 at Ø12 lists 3 ticked rows (CS16, CS17, 25375330) + "Other holes (2)"; Pipe · Through clamps shows the same
  3 for pipe 111; all tests green; `clamp-stations.test.js` extended for the reasons.
- **Built (differs from the plan where the files said otherwise):**
  - The two "other holes" at Ø12 are the **end fittings of pipe 111**: in Hose they are ticked and become Start / End (the report's
    workflow ticks them by hand); in Pipe they are listed and off ("end fitting of this pipe").
  - The −0.2 rule is **Hose only**. piping2's clamp has a Ø22.0 bore on a Ø22.5 pipe, so Pipe keeps ± 1.5 mm.
  - A Library match counts only for bores inside the entry's range: the twin clip's Ø9 × 3 mounting holes are not "clip" bores.
  - Results: Hose Ø8 on piping3 1 ticked (was 26); Ø12 5 (2 ends + 3 clamps); Pipe 111 3 ticked incl. 25375330 (was 2, it was
    unticked as "not in the Library"); 7 rows → 5. `tests/fixings.test.js` 20 checks; all other tests unchanged and green.
  - Also done: report issue 5 (the line under Auto order / Use as stations says "Tick at least 2 stations" when they are grey).
- **For the design review:** row = **name · part · bore · position**, then one coloured reason line (blue = end fitting, amber =
  not in the Library, grey = Library part); "Other holes (n)" fold; Pipe rows keep their existing one-line layout plus
  "Add to library". Screenshots: `handoff/shots/P1-*.png`.

## Phase 2 — Load once (Claude Code, 1 day; Claude Design reviews the header) — BUILT 2026-10-19, awaiting design review
- One assembly per session, loaded from the top **Open…** or dropped anywhere. A header line shows what is loaded
  ("piping3_practice_asm.stp · 2 pipes · 3 clamps for Ø12 · 51 parts") with **Change** / **Remove**.
- Hose · Stations from clamps and Keep clear both read from it; their own Load links go. Hose Ø becomes **one field** per task.
- Top Open… with an assembly follows the **open task** (Hose → stations + parts; Pipe → pipes). No more "assembly → Pipe" surprise.
- **Design review:** the header block, what Change / Remove do, where Hose Ø lives.
- **Done when:** the walk-through loads the file **once** and types Ø **once**; step count ≤ 9.
- **Built:** `openAssembly()` in `shell.js` is the one way in (top Open…, drop, the section's Load link). Hose · Route → stations +
  parts (parts reuse the parse via `CadSolids.read(…,{parsed})`, 0.0 s instead of ~6 s); any other task → Pipe. `asm:loaded` event
  tells the panels. Header line "Assembly: name · pipes · parts · holes with a CSYS · [pipes]". Keep clear's Hose Ø follows the stations
  field and is hidden while it is shown. Walk-through: **A 12 → 7 steps, 2 → 1 loads, Ø 2× → 1×; B 3 → 2.** Screenshot `shots/P2-header.png`.
- **For the design review:** the header line (wording, where it sits, whether it needs Change / Remove), the status sentence after
  Open… (long), and whether "holes with a coordinate system" should read "clamps for Ø…" once Hose Ø is known.

## Phase 3 — Next-step guidance (Claude Design leads, Claude Code builds; 1–2 days) — BUILT 2026-10-20, wording provisional until the design pass
- After every action the status line offers the **next button**:
  - Use as stations → "[Check now]"
  - Check with a clash → "Route is 6.0 mm into 95651236 — [Push the route away] [Alternatives]"
  - Check clean → "[Download .pts] [Alternatives]"
  - Route through clamps → "[Download .pts] [Compare with your .pts]"
- Disabled buttons say why ("tick at least 2 stations") — report issue 5.
- Pre-checks before solving (report issue 7): stations closer than 2 × R with bores held → warning with the pair and distance;
  Target points that look like **pipe corners** (few points, long straights, sharp turns) → "these are corner points, not points on
  the hose" (the `pasted-1145.pts` case).
- **Design review:** the wording and placement of each next-step line (UX-copy pass), warning vs error colours.
- **Done when:** the walk-through reaches a downloadable, clash-free route with no step that requires opening a collapsed section.
- **Built:** both pre-checks (`ClampStations.closePairs`, `cornerLike`; messages after Use as stations and after Check); the
  "tick Push the route away" hint now appears only when the route is too close, as a "Next: …" line; disabled buttons say why.
  **Root cause of the piping3 clash found and fixed:** the parts it ran "6 mm into" are the brackets the clips are bolted to
  (`95651236`, `22577598`). New survey role **mount** (≤ 300 mm, touching the clip at a station; unticked, with a reason). The
  walk-through's route is now clash-free (smallest gap 10.3 mm) without Push.
- **Built 2026-10-20:** real buttons under each result line (`js/next.js`, `nextSteps(statusId, items)`; the next status write
  removes them). Use as stations → Check now (+ Untick “Hold the bore direction” when stations are too close); Check clear → Download
  .pts · Alternatives; Check too close → Push the route away and check again · Alternatives; below min R → Refine the tightest bend;
  corner points → Route it as a pipe instead; Through clamps → Download .pts · Copy .pts · Compare with your .pts. Screenshots
  `shots/P3-*.png`. TESTING.md §12.
- **For Claude Design:** the button labels (long: "Push the route away and check again"), their order and which one is primary
  (first = bold today), the three message texts (corner points, stations too close, mount row), and whether Next should also
  appear after Alternatives ("Use this" is already a button there).

## Phase 4 — Alternatives that explain themselves (Claude Code, 1–2 days; Claude Design reviews the cards) — BUILT 2026-10-24, awaiting design review
- Apply the held bore directions in Alternatives as Check does (report issue 1). **Done.**
- Group obstacle faces **per part** before enumerating sides, so one bracket is one obstacle, not 40 faces. **Already in `multiroute.js` (`cluster()` merges touching face boxes).**
- When no clean candidate exists: say which part blocks every side and offer "[Push the route away] [Tick fewer parts]".
- Cards: length / min R / clearance in a fixed order, the losing numbers in red, "Use this" only on clean ones.
- **Done when:** piping3 gives ≥ 2 distinct candidates or an explained "none clean"; `multiroute.test.js` extended.
- **Built 2026-10-24:** when no route is clean the result names the part in the way on every side tried (or every route, or
  "n of m routes"), with the best gap per side and whether the radius failed too, or "every way round needs a bend tighter than
  R"; shown in red with Next **Push the route away and check again** and **Stop keeping clear of <part>** (unticks it, runs
  Alternatives again). Cards: failing min R / clearance in red, **Use anyway** on routes that are not clean, parts named by the
  last step of their path. Frame run (6 stations): "FY26_TEST_FRAME_1 is in the way on every route tried (all passed it left):
  left −8.5 mm …; 12 also need a bend tighter than R 65". Screenshot `shots/P4-none-clean.png`. `multiroute.test.js` +6 checks.
- **Limit seen on the frame** (fixed 2026-10-24, ROADMAP Phase 13): Alternatives went round whole clusters of face boxes, so a
  9 m frame rail was one obstacle and the candidates looped 12 m round it. Now exact faces, local obstacles and cleared vias:
  route_343434 P5–P10 on the frame STEP gives one clean 933 mm route in 5.8 s (was 3.0–4.9 m, none clean, 34 s).
  Screenshot `shots/P13-alternatives-exact.png`.

## Phase 4b — Pick the side: "pass this part from above" (Claude Code builds the logic first; Claude Design owns the picker; 2 days)
Agreed 2026-10-20. Today the solver decides which side of a part the route passes and the user cannot say otherwise; the only
workarounds are Alternatives (top 3 only, labelled "B47+Y") or typing an extra point by hand. The enumeration in
`multiroute.js` already tries every side of every blocking part, so a preference is a filter on what it already does.

What it does
- Each part that blocks the route gets a side choice: **Any · Above · Below · Left · Right** (and Front / Back when the leg
  runs along the up axis). Set it in the Keep clear parts list, or by clicking the part in 3D.
- **Up axis** is a per-file setting ("Up = +Y / +Z / −Z …", default guessed from the file: the axis the frame is tallest along is
  not up; the axis clips open toward is), saved like the pipe overrides. "Left / Right" are taken looking along the route.
- Alternatives (and Check with "Push the route away") only keep topologies that respect every choice; the cards read in plain
  words: "over 95651236, left of 22577598", never "B47+Y".
- When a chosen side cannot hold the rules, the app says which rule and by how much ("over 95651236: needs R 41, limit R 65;
  or gap 1.2 mm of 4") and shows the best route that side anyway, marked not clean, so the user can still take it or change the choice.
- The choice is kept per part across Checks and saved per file name.

Build order
1. `multiroute.js`: `opts.prefer` = {partName → side}, mapped to ±axis with the up axis; combos that break a preference are skipped
   before polishing (no cost); a "forced" flag when the best candidate on the chosen side fails a rule. Node tests: one box
   between two stations with Above / Below / Any → 1 / 1 / ≥ 2 candidates; a chosen side that cannot hold R → `forced` with the reason.
2. Plain-word labels: side names from the up axis + direction of travel, part names from the survey (not box ids).
3. UI (after the design pass): side picker per part row + 3D click; Up-axis selector in Keep clear; "forced" cards in amber.
- **Built 2026-10-21 (steps 1–2, no picker yet):** `MultiRoute.start(…, {prefer: {part → 'above'|'below'|'left'|'right'|'+X'…|'any'},
  up: '+Z'})`. A preference cuts the sides before polishing (Above on one box: 1 topology, not 4). Left / right are looking along
  the leg (travelling +X with +Z up, left = +Y). On a leg along the up axis the words do not apply: any side kept, `result.notes`
  says so (axis names still work there). If the optimiser slides off the chosen side the topology is re-polished once with that
  via pinned. `result.forced` = `{what, why, text}`, e.g. "above 22577598: needs R 49, limit R 50; 0.04 mm into the keep-clear
  gap"; the best route that side is still returned, each candidate marked `forced`. Labels are words from the part names
  ("over 95651236, left of 22577598"; boxes without a part stay "B3"); `bendCadBoxes()` now tags each face with its part, typed
  boxes use their id. Also fixed: the side a route passes was read at its closest sample, which on a tall part is the climb
  beside it; now read over the samples level with the part. Alternatives' status line shows `forced` and the notes.
  `tests/multiroute.test.js` +11 checks. **Up axis is a parameter only (default +Z); guessing it from the file is open.**
- **Design review:** where the picker lives (row vs 3D vs both), the six side words and what "Left" means on a route that turns
  back, how a forced choice is shown, the Up selector's wording. Design produces the mockup before step 3 is built.
- **Done when:** on piping3, choosing Above for the first bracket gives a route over it or an explained failure; the walk-through
  gains at most 1 step for a side choice; tests green.

## Phase 5 — Layout: 1-2-3 strip (Claude Design leads; Claude Code builds; 2 days)
Only after 1–4, because they decide what the strip needs to hold.
- Hose · Route through stations becomes **1 Load · 2 Stations · 3 Route**, each a card in order; settings (radius, spacing,
  fewest points, end directions) behind one "Advanced" toggle; Keep clear folded into card 1 (parts list) and card 3 (push tick).
- Pipe tasks get an empty-state line each ("Through clamps: re-route the open pipe so it runs straight through its clamps").
- **Design review:** the full mockup first (design-critique pass), then the built page (accessibility pass: keyboard order,
  contrast, focus states on the drag handles).
- **Done when:** walk-through ≤ 7 steps; no collapsed section on the main path; design sign-off.

## Phase 6 — Pipe module parity (Claude Code, later)
- Clearance to parts for pipe runs and obstacle-aware Through clamps (ROADMAP Phase 12d steps 2–3) so Pipe gets the same
  "clash → fix" loop as Hose. Not a UI phase as such; listed so Design knows Pipe will need the Phase 3 next-step lines too.

---

## What Claude Design needs from you before Phase 1
1. Your clamp / clip / grommet part numbers (for the library seed) and whether the Library is the source of truth.
2. Min bore length 10 mm and fit −0.2/+fit: OK?
3. The assembly convention: one assembly per job, or do you switch between several in one session?

## What to hand each session
- **Claude Design:** this file, `handoff/PREP_files_and_ui.md`, the screenshots in `handoff/shots/`, the phase's acceptance list.
- **Claude Code:** this file, the phase number, the design's mockup / checklist, and the sample set in `samples/`.

---

## Phases from the user's questions (2026-10-21)
The user's job: **no route yet, only the clamps that exist** (clamp type mostly fixed by location); route through them, see where
more clamps are needed, pick things in 3D, make CSYS for Creo, and keep big STEP files workable offline.
Status: **DONE** = in `main` or on `claude/coordinate-support-memory-5m5bwf`; **BRANCH** = built but only on another branch;
**PARTLY** / **NOT STARTED** as written.

| # | Phase | Status |
|---|-------|--------|
| Q1 | Route through the clamps you have, no route in the file | **DONE** |
| Q2 | Start / end when the file has no hint | **DONE** (pick in 3D) |
| Q3 | Pick parts in 3D (Library, start / end, station, side) | **DONE** |
| Q4 | Big STEP files offline | **DONE** for reading (worker + memory); solvers still on the page |
| Q5 | Show CSYS in 3D | **DONE** |
| Q6 | Make new CSYS in the app, export to Creo | **DONE** (Creo import still to try) |
| Q7 | Suggest where to add clamps | **BUILT** (spacing and type rule assumed, to confirm) |

### Q1 — Route through existing clamps (DONE)
- Hose · Stations from clamps lists every bore that fits the hose Ø (−0.2 / +1.5) with a CSYS or a Library match, orders them
  (nearest neighbour + 2-opt), Check routes through them keeping clear of the ticked parts. Phases 1–3 above.
- Pipe · Through clamps does the same for an existing pipe.
- Not checked in this session: the samples are local only.

### Q3 — Pick in 3D (DONE 2026-10-21) and Q2 — start / end with no hint (DONE)
Click a part or a CSYS in the 3D view (Q5); the panel offers what fits the open task:
- **Use as start · Use as end · Add as station** (Hose · Stations from clamps). A hole already in the list is used as it is.
  A CSYS with no hole (a connector port such as `A_T_F_PORT2`) becomes a station with its Z axis as the hose direction.
  A click on a part snaps to that part's nearest hole (within 30 mm or 3 × its radius), else the clicked point with the
  direction left free. Picked stations are marked "picked in 3D", have a **remove** link, and survive a change of Hose Ø.
- **Add to library** (or "In the Library (clamp)" when it already matches): the picked part, or the part a picked CSYS's hole is in.
- **Keep clear: yes / no** for the picked part (Hose · Keep clear of CAD parts loaded).
- **Route passes it: any · over · under · left · right**: Phase 4b step 3. Saved per file; Alternatives keep only routes on
  that side and say when it cannot hold R or the gap. **Up is +Z / −Z / ±Y / ±X** under Alternatives, saved per file.
- Tested on the 20 MB frame (`A_T_F_PORT2` as start, part 991063 → its Ø15.5 hole as end, over 991063, added to the Library).
- Design pass still owed: panel wording, button order, whether the side row belongs in the panel or the parts list.

### Q4 — Big STEP files, offline (DONE for reading)
- Done: everything runs on the user's computer; nothing is uploaded. The assembly is read once per session (Phase 2).
- **On branch `claude/app-function-visibility-llqw97` (2026-10-08), not merged:** STEP parse in a **Web Worker** with a progress
  bar (page stays responsive), per-part edge cloud and exact world boxes, `tests/asm-cloud.test.js`. It branched from main
  before Phases 12–13 and 0–3 changed `js/step-asm.js` a lot, so it needs a careful merge, not a straight one.
- **Built 2026-10-21**, measured on the user's 20 MB Creo frame assembly (312 000 entities, 338 solids, 769 CSYS):
  - memory kept after reading **239 → 76 MB**; peak while reading **~250 → ~120 MB** (about 6× the file). The result's methods
    used to keep the whole entity table alive; entities are now indexed without decoding and decoded per part.
  - **read in a Web Worker** (`StepAsm.parseAsync`, built from `step-asm.js` as a Blob, so it works from `file://`), progress in
    the status line ("reading parts 59 %"). Longest page freeze **2.0 s → 0.4 s** (the 0.4 s is unpacking the result on the
    page); total 2.2 → 4.2 s. Falls back to the page when Workers are missing. Output fingerprinted identical before / after.
  - Rough limits now: a browser tab holds ~4 GB, so files up to ~500 MB should read; past that the next step is reading
    only the parts near the route.
  - The old branch's edge cloud is not ported (nothing uses it yet); its worker idea is.
- **Solvers, 2026-10-24 (measured, not moved):** on the frame Check blocks the page ~1 s in total and Alternatives ~1 s over
  its whole run: both already run in short slices. Profiling showed 22 of Alternatives' 38 s in the obstacle penalty; testing
  only the boxes a segment's samples reach, with an early-exit depth test, gives **38 s → 16 s** with identical results. The
  remaining 0.6–0.7 s stalls are drawing ~800 000 outline lines in the headless test browser's software renderer (0.23 s with
  outlines hidden); a real graphics card draws them at once. A Web Worker for the solvers is not worth its complexity now.
- Not done: reading only the parts near the route.

### Q5 — Show CSYS (DONE 2026-10-21, `js/asm-view.js`)
- The open assembly is drawn in 3D even with no route: every part as its edge outline (the face loops StepAsm reads, one
  LineSegments for the whole file: 797 000 segments on the 20 MB frame), dim; Fit frames it when no route is shown.
- CSYS as **X / Y / Z arrows** (red / green / blue). Header switch **CSYS: none · on holes · all** (frame: 284 on holes, 769 all);
  names shown when ≤ 60 are on screen. **parts in 3D** switch hides the outlines.
- **Click** a CSYS (within 10 px of its origin) or a part line → panel: name, the part it is in, origin and axes (3 decimals),
  "on a Ø11.0 × 12.0 mm hole"; a part: name, path, size, where it was clicked; picked part in orange. Esc / Close clears.
  The click costs 1–25 ms on the frame (only parts whose box the ray passes are tested).
- Other modules add buttons to the panel with `avPickActions(fn)`: that is how Q3 / Q2 / Q6 hang their actions on it.

### Q6 — Make CSYS in the app, export for Creo (DONE 2026-10-21, `js/csys-make.js`)
- **New CSYS here** in the pick panel: on a part → at its nearest hole's centre, Z along the bore (else the clicked point, Z up);
  on a CSYS → at its hole (or a copy of it). Also **New at X Y Z** typed. Names `<part>_CS1`, `<csys>_RS1`, `RS_CS1`, never one
  the file already has.
- **CSYS made here (n)** under the assembly line: rename, origin and Z typed, **flip Z**, **X +90°**, show, delete; saved per file.
  Drawn in 3D with amber names, pickable (Flip Z · X +90° · Delete, and Use as start / end / station).
- **Download .stp for Creo**: AP203, mm, assembly coordinates, each CSYS a named `AXIS2_PLACEMENT_3D`; assemble it at the
  default placement. **Copy table** gives name, origin, Z, X as text. `tests/csys-make.test.js`: frames orthonormal, flip / turn,
  the file read back by both STEP readers to 1e-9.
- Not checked: the import in Creo itself (no Creo here) — first thing to try with the user.

### Q7 — Suggest extra clamps (BUILT 2026-10-21 with assumed rules, `js/clamp-suggest.js`)
- Hose · Route through stations → **Suggest extra clamps** (fold under Alternatives), on the selected route, held at its stations:
  1. near each bend (tighter than 4 × R): a clamp within **Near a bend** (60 mm) before it starts and after it ends, unless one is there;
  2. then every span still over **Max spacing** (300 mm) is filled evenly.
- Each suggestion: position along the route, why ("span of 669 mm between S2 and a new clamp", "after the bend at 256–362 mm"),
  **mounts on** the nearest part within **Mount reach** (60 mm; existing pipes left out) or "needs a bracket", and **like** the
  existing clamp on the same mounting part (nearest along the route), else the nearest along the route.
- **Make CSYS** each / for all (Z along the route, into "CSYS made here" → Download .stp for Creo), **Add them as stations**
  (into Stations from clamps, then Check again). Amber +n dots in 3D. `tests/clamp-suggest.test.js` (11 checks).
- **Assumed until the user says otherwise:** max spacing 300 mm (ROADMAP Phase 18's hose figure), clamps either side of a bend,
  and "type follows location" read as "copy the clamp already on that mounting part". Mount distance uses face boxes, so it
  is generous near round parts.
- Needs from the user: their max spacing (hose / cable / pipe), and the real clamp-type-by-location rule if it is not
  "same as the clamp already on that part".

### Next
- Try the exported CSYS .stp in Creo (Q6); give the spacing and clamp-type rule (Q7); Claude Design pass on the pick panel,
  "CSYS made here" and "Suggest extra clamps" wording.
- Big files: Check / Alternatives / clearance still run on the page (in chunks); reading only the parts near the route.

## Open question (2026-10-20): solid 30 / 50 / 43 in the frame IGES
`tests/cad-solids.test.js` fails on "exact: … to solid 1": the nearest kept part is **solid 30** (99 × 156 × 45 mm, centre
X −379 Y 1062 Z −5450, station line through it at P5/P6), −3.9 mm. Its twin **solid 50** sits at Z −7100; **solid 43** shows −4.0 mm at P3.
Cause: commit `c84f55b` (Oct 19) made parts over 80 mm frame even at a station; before, any part at a station was its clip.
The mount rule (≤ 300 mm, touching a clip at the station) does not catch them: no smaller clip touches them in this IGES.
**Answered 2026-10-24: yes, a bracket.** Solid 30 = `22648999` (`23297378_ASM`), bolted to the frame plate through two coaxial
Ø15.5 holes, carrying clips `980464_AF52` / `AF53` (solids 31 / 32, each screwed on with 4 × Ø2); solid 50 is the same part at P14.
The mount rule missed it because it wanted the bracket and its clip at the same station: clip 31 is at P5, the bracket at P6, clip
32 only on the line. **Rule now:** a part ≤ 300 mm at a station that touches any clip (at any station, or on the line) is a mount;
a clip at the same station is still preferred. Test: solid 1 at the plate edge again (−0.4 mm), solids 30 / 50 mounts.
Solid 43 = `980464_AF54`, a strap clamp on the tank port: already a clip, never checked, no change. Walk step F8 shows both.
Was: **Waiting on the user:** is the part at X −379 Y 1062 Z −5450 the bracket the hose clips at P5/P6 are mounted on?
- Yes → rule: a part ≤ 300 mm that the station line runs through at a station is that station's fixing (role station/mount),
  even over 80 mm; frame rails (> 300 mm) stay obstacles. Test expects solid 1 at the plate edge again; check solid 43 the same way.
- No → the −3.9 mm is a real clash; update the test's expectation, rule unchanged.
