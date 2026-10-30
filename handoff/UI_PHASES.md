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

### Phase 5-A — wording, `--warn-ink`, small Phase 1–4b fixes (BUILT 2026-10-29, branch `claude/p5a-wording`)
From `handoff/Phase 5 Review.html` (wording table, contrast table, the Phase 1–4b change lists). Only what fits today's layout;
the strip, cuts, dock tables and armed Start / End are P5-B…D.
- **Token:** `--warn-ink #8F5A0A` (light; dark = `--warn`). Every amber *text* uses it (tags, "Close:", forced, margin numbers,
  chart margin label); amber fills, borders and markers keep `--warn`.
- **Clamp rows (Hose):** two lines: `S2 · name` · part (muted, ellipsis, full path in title) · `Ø12.0 × 25` | marker + reason ·
  position `−175 1282 −1663`. Reasons: `End fitting of pipe 111 · start / · end`, `Library: clip` (pattern in title),
  `Not in the Library · Add…` (adds to the Library in place, ticks and order kept), `Bolt hole, 3.0 mm long (under 10)`,
  `Holds pipe 211`, `Picked in 3D · remove`, a small `3D` tag. Fold: `Other holes that fit Ø12 (n)`. Pipe rows: same words.
- **Assembly line:** `name · 41 parts · 2 pipes · 40 holes with a CSYS`, `3 clamps for Ø12` once the Hose list is built
  (updates live); the `pipes` link is gone. Status after Open: `Opened in 0.2 s.` (where it opened is in the tooltip).
- **Labels:** Bore fit +, Start / End, Hold the bore direction at each station, Push the route away from kept-clear parts,
  Trial note, Check route, Up (for over / under), Default · Frame only · All · None, Runs in 3D (n), ×1.5 in run names.
- **Check verdict:** one line, worst first: `Clash:` / `Too tight: R 45 at P2, below the 65 mm minimum.` (red), `Close:` (amber),
  `Clear: R 87 over 20 points; smallest gap 10.3 mm, to … near P16.` (blue); details muted under it. The 3D readout leads with
  Clash too. Corner points: `Corner points? …`. Stations too close: `S2 and S3 are 38 mm apart. Holding both bore directions
  needs at least 130 mm (2 × R 65).` (amber, a warning) → **Free S2 and S3 directions** (writes `-` for those two only) · Check anyway.
- **Next rows:** at most 3, first is `.btn.pri` (ink fill); labels per the table (Push away and check again, Refine tightest bend,
  Route as a pipe (arcs), Download .pts · Suggest extra clamps · Alternatives; Copy .pts left to the Points tab).
- **Alternatives cards:** plain label (600) · `forced side` tag · mono facts `1035 mm · min R 97 · gap 7.9 mm`, failing facts red
  with the limit (`min R 49 < 65`, `gap 0.8 < 4`, gap from the hose surface); **Use this** primary on clean cards, **Use anyway**.
  `No clean route: every route tried passes B1 on the left, at best 8.5 mm into it.` → Push away and check again · Try it on
  the right · Stop checking B1. A forced side is amber (`Forced side: Over B1 cannot hold R 65; best that side is R 58.`) →
  Clear the side choice, and wins over the red line.
- **Pick panel:** `Route passes it · looking P3 → P4 · up +Z`; on a leg along up the choice is by axis (any · +X · −X · +Y · −Y).
- Not done here (later phases or waiting on answers): Change… / Remove + Undo (2b), the cuts (2a), "(guessed)" up axis,
  "With any side: n clean routes" (needs a second run), S-names in Check (it reads Target points, P1…), Points as text (5).
- Checked: unit tests green; page smoke in Chromium (Check clear / too tight, Alternatives cards, no-clean, forced, light and
  dark, no page errors). **Not checked:** the clamp rows and the walk-through on piping3 / the frame (samples not in the cloud).

### Phase 5-B — Check reads the ticked rows, armed Start / End (BUILT 2026-10-29)
- **Use as stations is gone.** Check route and Alternatives write the ticked rows (points, held bore axes) into Target points
  and Bore directions just before they run (`csSync`), so those always show what was routed. The Replace / Keep question and
  the stale-directions greying go with it (old finding 14). With the list in use and fewer than 2 ticked, Check says
  "Tick at least 2 stations." (also its tooltip); with the list empty, Check uses Target points as typed.
- **Stations too close** is a pre-check on Check: amber line in the result, the pair marked in the list → **Free S1 and S2
  directions** (those stations' bores free until the list is rebuilt, then checks) · **Check anyway**.
- **Armed Start / End:** with an assembly open and Start or End empty, the next click on a part or CSYS in 3D fills it. The pick
  panel says "Start set to A_T_F_PORT2. No hole there: its Z axis is the hose direction." with **Undo** (primary, focused) ·
  **Make it the end**. Undo puts the list back as it was.
- **Pick panel Route group:** Use as start → Use as end → Add as station; the primary is the first one still needed.
- **Old finding 10:** setting Start and End no longer wipes ticks set by hand (kept per row). **Old finding 15:** a Hose Ø or fit
  change keeps holes picked in 3D (3D tag, ticked) and Start / End on them, found again by position; hand ticks too.
- Checked in Chromium on a synthetic assembly (armed start, Undo, end with a hand untick kept, both set → Add as station
  primary, Ø change, Check → pre-check → Free → verdict, none ticked). Walk-through updated (no Use as stations step; armed
  clicks), **not run** here (samples).

### Phase 5-C — Layout: 1 Load · 2 Stations · 3 Route (BUILT 2026-10-29)
**Decided by the user (2026-10-29):** 2a: they never load a separate parts file, so the section Load links go (top Open… or a
drop is the only way in; the parts always come from the open assembly); the "Check the gap" tick goes; the big Alternatives
button and its paragraph go; Inspector and Paste table move into More ▾; the long hints move to the README (How it works).
2b: Remove unloads at once with a 10 s Undo. 2c: Check replaces the last generated run unless it is pinned.
- **Top bar:** Open… (primary) · Examples ▾ · More ▾ (Paste table…, Inspector, How it works) · Dark. Esc or a click elsewhere
  closes a menu.
- **Assembly line:** a boxed row under the top bar, above the module switch, in every module: "No assembly open." or
  `name · parts · pipes · holes with a CSYS / n clamps for Ø12` · CSYS made here · **Change…** · **Remove**. Remove keeps the parse:
  "Removed name. Undo" for 10 s; Undo sends the same assembly back (`asmRemove` / `asmRestore`, events `asm:removed` /
  `asm:loaded`), no re-read.
- **Task tabs:** a row under the module switch at every width; module switch and task tabs are one tab stop each, ← / →.
- **Route through stations:** an **Advanced** toggle (saved) with the values line `R 65 · margin ×1.5 · gap 4 mm · fit +1.5`;
  three cards (`js/strip.js`), the current one with the filled number, later ones dashed with what they wait for, a summary on
  each heading (`Ø12 · 8 parts kept clear`, `S1 → S5 · 5 ticked`, the selected run). Below 900 px of height the cards before
  the current one fold to their heading (a button with aria-expanded).
  - Card 1: Open assembly… (when none), Hose Ø, the station count line, **Keep clear of n parts near the route · m within 60 mm**
    (fold, closed). Advanced: Bore fit, Look within.
  - Card 2: Start / End ("Or click a part or CSYS in 3D."), Auto order · Untick all · Only picked, the rows, Other holes, Hold the
    bore direction, **Points as text (n)** (fold). Typing, pasting or dropping points there unticks the list and says so; Check
    then uses them as typed. Advanced: start / end directions, bore directions.
  - Card 3: Push tick, **Check route** (disabled with "Tick at least 2 stations." while the list is in use with fewer), the
    verdict and Next, **Tools: Alternatives · Suggest extra clamps**, the Alternatives section (opens from Tools or Next; Up in its
    header), Suggest's results. Advanced: Min R, margin, gap, spacing, Fewest points + Max shift, closer points in bends, straight
    runs, Suggest's settings, obstacle boxes typed by hand.
  - Pipe · Route through points uses the same panel without the card chrome (points open, settings under Advanced).
- **Runs in 3D:** Check (and lines + arcs) replaces the runs the last Check made unless pinned (`pin` / `pinned` per row).
- **Pipe empty states:** one line per task (exact wording from the review), Open assembly… beside it while none is open; Table →
  .pts shows its line until the table has input. The old "Open or drop a Creo assembly…" paragraph and Pipe's own Open link go.
- **Keyboard:** station grips are 24 × 28 buttons, `aria-label="Move S2 CS16, position 2 of 5"`, described by "Arrow keys move
  it"; ↑ / ↓ / Home / End move the row, focus stays on its grip, a polite live region announces the move. Esc closes the pick
  panel and focuses the 3D view. Dock 190 px tall under 820 px of height.
- Checked in Chromium at 1600 × 1000 and 1366 × 768, light and dark: S0 (Load current, others waiting), Open → Remove → Undo,
  a synthetic clamp list (assembly line "4 clamps for Ø12", cards' summaries), Check twice with a pin, grip End, Pipe empty
  lines, Check disabled with none ticked and enabled again in Pipe / after typing points, no sideways scroll, no page errors.
  `tests/ui-walk.js` updated for the cuts (no section Load links, Alternatives from Tools); **not run** (samples), so the step
  counts (target A 5, F 7) and the `handoff/shots/P5-*.png` set are still to do on the real files.

### Phase 5-D — Clearance, Clamps to add and CSYS in the dock (BUILT 2026-10-29, `js/dock-tables.js`)
- **Clearance (n):** the selected run's gaps as a table, **Where · Part · Gap · Note**: one row per place below the gap
  ("into the part over 96 mm" / "inside the 4 mm gap", red / amber), per plate crossing, and the smallest gap that passes; the part's
  role, size and "kept clear / unticked" under the note. Header: run name · "gap 4 mm to 8 kept-clear parts · clips at stations not
  counted". **Table · Chart** in the tab bar (Chart is the old gap-along-the-route chart). n counts the rows below the gap. The rows
  come from Check's report (`bend-cad.js` → `run.clearRows`, also for a route taken from Alternatives).
- **Sidebar after Check:** the verdict line, the straight-run / unticked-part notes only, and a link "2 places in the Clearance tab";
  the long "Too close — … • P2–P3: …" text is gone.
- **Clamps to add (n · k need a bracket):** Suggest's rows move to the dock: **Where** (+n chip, mm along) · **Why** · **Mounts on**
  (needs a bracket = amber outlined tag, "no part within 60 mm" under it) · **Like** (+ Make CSYS), one group per span
  ("S1 → S2 · 600 mm · 2 clamps"). Header: "On <run> · max spacing · near a bend · mount reach" · Make CSYS for all · Add all as
  stations. Suggest opens the tab; the sidebar keeps its one line and Next. The +n chip is ink #1F2A36 on --warn.
- **CSYS (n):** the existing tab, with its count.
- Checked in Chromium (1600 × 1000, light and dark): Suggest → tab with groups, Make CSYS per row and for all (CSYS (7)), a run with
  clearance rows → Clearance (2) table, Table / Chart switch both ways, other tabs hide both panes, no page errors. The rows from a
  real parts file are **not** checked here (no samples).

### Phase 5-E — first run on the real assemblies (2026-10-29)
piping3_practice_asm.stp, frame_asm.stp and u107338_fy26_test_frame_asm_111.igs in `samples/`: unit tests green (the sample
tests no longer skip); `node tests/ui-walk.js` A **5 steps**, F **7 steps**, no fold opened on either, at 1600 × 1000 and
1366 × 768, light and dark (`--size`, `--dark`, `--main`); shots `handoff/shots/P5-{A,F}*-{1600,1366}-{light,dark}.png`.
F is now the main path on the frame (Open, click CS29 = P1 in the bore of 991980, click CS41, Check, Alternatives, Use this);
the old F (pick panel, CSYS made here, Suggest, dark, solid 30 / 43) is G, not counted against the target.
`node tests/frame-alt.js` (new): route_343434 typed on frame_asm.stp, Alternatives clean at 679 / 931 / 1141 mm (P1–P6,
P5–P10, P11–P16); fitting 991980 is not listed at P1 (the end faces of its bore are not clashes).
What the run turned up, fixed:
- **Check and Alternatives counted different parts.** Alternatives steers round the kept-clear (ticked) parts and called
  P1–P6 clean; Check said "Clash: 4.0 mm into 992026" and **Use this** put 5 red / amber rows in the Clearance tab, all
  unticked parts ("clip, or screw?"). Now only kept-clear parts count, in the verdict, the 3D readout, the Clearance count
  and the chart bands; an unticked part within the gap stays listed, muted, "not counted: tick it in Keep clear if it is a
  screw, bolt or bracket", grey in 3D, and the verdict's detail names it. P1–P6 and P5–P10 now read Clear on Check.
- **Use this** clears Check's old verdict (it was for the generated run, now not the selected one).
- **Start / End selects** read `S1 · CS0` (piping3 has three CS0 rows; the select showed "CS0" for each).
- **Start and End set → the holes between:** a hole closer than 2 × R to the start or end that Check's pre-check would flag
  with it is left unticked (on the frame, tank port 991084 is 22 mm from CS29 and P3_CS1 33 mm from CS41; Check stopped on
  "S1 and S2 are 22 mm apart" and no alternative was clean). Hand ticks and 3D picks still win.
- **Check with 2 stations** said "Paste at least three points." although the list and its tooltip ask for 2; the solver
  takes 2 (Alternatives' direct route does): Check now needs 2.
- **Below 900 px of height** the folded Load card hid Hose Ø, so flow A needed a fold click to set Ø12; a folded Load card
  keeps Hose Ø.
Review findings 7–10 (from the review of #11–#15), same PR; `node tests/stations-ui.js` (new) checks 7–9 in Chromium:
- **7 Hand order kept:** a drag or ↑ / ↓ on a grip sets Start / End to the first and last ticked rows (it used to clear them,
  so the next 3D click was taken as a new start and re-sorted the list) and marks the order as made by hand: until Auto
  order or a rebuilt list, a station added later (3D click, Suggest's Add all) goes where it lengthens the path least, Start /
  End move to the ends, nothing else moves. Undo of an armed click puts the list back exactly (no Auto order after it).
- **8 Remove during Change…:** while the new file is read (sniffed, then parsed), Remove stops that read and removes the
  assembly still on the line: "Removed piping3_practice_asm.stp (stopped reading frame_asm.stp). Undo"; Undo puts it back.
- **9 Armed-click Undo:** the list is built before the snapshot, so Undo goes back to that list, not to an empty one.
- **10 strip.js:** one `update()` per frame (requestAnimationFrame) for all the events of one render; the points are parsed
  once per update.
- Found on the way (also on main): typing Hose Ø and then clicking a station's tick did nothing: the blur sent a second
  change with the same Ø, the list was rebuilt under the pointer and the click lost. The same Ø and fit no longer rebuild.
Seen, not changed: the 3D readout says "Passes, but inside the ×1.5 safety margin" (amber) while Check's line says
"Clear: R 87" (blue) for the same piping3 run: the Phase 5-A table has Clear there; say if the margin should make it Close.

## Phase 6 — Pipe module parity (Claude Code, later)
- Clearance to parts for pipe runs and obstacle-aware Through clamps (ROADMAP Phase 12d steps 2–3) so Pipe gets the same
  "clash → fix" loop as Hose. Not a UI phase as such; listed so Design knows Pipe will need the Phase 3 next-step lines too.
- **Step 2 done (2026-10-30):** Pipe · Route through points and Pipe · Through clamps check the route against the kept-clear
  parts. For Design: the Keep clear list is one element that moves into the task on show (Hose: Load card; Route through
  points: above Solve, with Pipe OD; Through clamps: under the clamp settings, with "Gap to parts"). The result is the Hose
  verdict line (Clash / Close / Clear) over the solver's own line, and a link to the Clearance tab, whose rows, muted
  "not counted" rows and tab count are the Hose ones. Not yet: Next-step buttons for a pipe clash (nothing to offer until
  step 3, avoidance), and Alternatives / Push for pipes.

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
- **Alternatives on the frame, 2026-10-30 (profiled in Chromium, `frame_asm.stp`):** with exact face shapes the time was the
  exact gap, not the solver's own sums: on CS29 → CS41 (16 ways round) 77 % in `CadSolids.shapeNear`, called for every face
  near a segment at every sample. Three changes, results identical (the chosen route's .pts byte for byte, all four cases):
  the solver asks the exact gap only where the sample is within rad + 1 mm of the face box; `shapeNear` answers "lim or
  more" for spheres, tori, cones and cylinders from squared distances and the face box (no `Math.hypot`); the boxes a
  segment reaches are filtered again per run of 6 samples. **CS29 → CS41 160 s → 26 s, P1–P6 5.4 → 2.5 s, P5–P10
  8.7 → 4.9 s, P11–P16 3.9 → 1.6 s.** What is left is spread over the exact gaps, the box tests and the curve samples;
  going further means fewer solver steps or analytic gradients, which change the routes. `Math.sqrt` for `Math.hypot` in
  the solver's `V.len` still saves ~9 % but changes which routes come out: not done.
- **Big files, 2026-10-30 (outline budget):** no 633 MB file in the cloud, so `tests/big-asm.js` builds one: frame_asm.stp copied
  N times into one STEP (ids renumbered, each copy 3 m further along X; copy 0 where route_343434's stations are). 32 copies =
  663 MB, 11 424 instances, 25.5 M outline segments. On main it reached "Opened" after 197 s and then froze **780 s** (13 min),
  page heap 3.1 GB, 7.0 GB over all the browser's processes. Where the time went (8 copies, profiled): the worker's result
  copied to the page (8.6 s), **Auto order** of the 320 ticked holes (8.4 s; at 1 280 holes the n³ order search was most of
  the 780 s), the keep-clear parts of the whole assembly (3.5 s); drawing is cheap. Memory (8 copies, live): parse result
  309 MB, keep-clear parts 104 MB, outline buffers 179 MB.
  - **Outline budget:** up to 4 M segments every part is drawn in full (the 20 MB frame has 0.8 M: unchanged). Past it, parts
    near the route (the ticked stations or the points as text, and the selected run, within 500 mm) are drawn in full, nearest
    first, until the budget is spent; every other part as its box (12 edges). Redrawn when the route changes the set; the
    status after Open says so ("Big assembly: full outlines for the 450 parts near the route, boxes for the other 9 246.").
  - **Auto order:** the distances worked out once (same orders: 400 random lists of 2–64 holes compared with main); past 64
    holes only the extreme holes (lowest / highest in X, Y, Z) are tried as starts. 1 280 holes: 1.3 s.
  - 663 MB after: usable after **192 s** (was 970 s), longest freeze **31 s** (was 780 s), page heap 2.8 GB, 6.2 GB all
    processes, 4.1 M segments; Alternatives P1–P6 3.9 s (was 34.9 s), the same 679 mm route.
  - Left: the 31 s freeze and most of the 2.8 GB are the parse result copied from the worker (face loops as millions of
    small [x, y, z] arrays) and the keep-clear parts built for the whole assembly. Next: loops as packed Float64Arrays in
    the reader (a fast copy, about a third of the memory), keep-clear parts built only near the route.
  - **Packed faces (reader), 2026-10-30:** at the end of `StepAsm.parse` each face's loops and vertices become Float64Arrays
    (x, y, z, …) and its circular edges 7 numbers each (centre, axis, radius), all of a part in one buffer (views into it);
    the worker hands those buffers over instead of copying them. The B-spline surface entity kept for the pipe search is
    dropped (nothing after the parse reads it). Readers changed: `asm-view.js` (outlines), `cad-solids.js` (face boxes,
    swept extent), `fixlib.js` (thumbnails), `tests/asm-box.test.js`. Checked equal to main on frame_asm.stp and piping3:
    every loop point, vertex and circle to the bit, the keep-clear faces and solids, the rest of the parse result, and the
    outline buffer byte for byte. 663 MB: page heap **1.83 GB** (was 2.8), 4.85 GB all processes (was 6.2), the copy from
    the worker 6 s (was ~20), usable after 179 s; parse result alive on the page, 164 MB file: 58 MB (was 309).
    Left: the 28 s freeze after Open is the `asm:loaded` listeners in one task, mostly the keep-clear parts of all 9 696
    solids. Next: keep-clear parts built only near the route.
  - **Keep-clear parts near the route, 2026-10-30 (`bend-cad.js`):** an assembly with more than 100 000 faces placed (the
    20 MB frame has 22 000: unchanged) is not read into keep-clear parts at Open. Parts are read a part at a time when
    something needs them: the survey (every part whose box is within the survey's reach + 1 mm of the station line, the
    survey's own test), a part picked in 3D (its Keep clear row), Suggest extra clamps (parts within its mount reach of the
    run, + half a sample step or 5 mm, + 1 mm). `CadSolids.step` takes `only` (instances) and numbers solids as a full read
    does; built parts are kept per instance, in instance order. Checked on 8 copies (`tests/big-asm.js`): the survey of
    route_343434 P1–P6 equals a full read's (parts, roles, gaps, faces), Check and Alternatives give the frame's results,
    Suggest (max spacing 60 mm, 9 rows with mounts) equals a full read's, a far part picked in 3D offers Keep clear; 52 of
    2 704 solids read. 663 MB: longest freeze after Open **14 s** (was 28.5), page heap **0.66 GB** (was 1.83); the
    4.75 GB peak is now the worker while it reads.
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
