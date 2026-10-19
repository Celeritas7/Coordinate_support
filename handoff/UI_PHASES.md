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
- ~~Force-add the samples to git~~: **not done, the repo is public** and the samples carry real part numbers. They stay local; every test skips cleanly without them.
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

## Phase 3 — Next-step guidance (Claude Design leads, Claude Code builds; 1–2 days) — LOGIC BUILT 2026-10-19 with provisional wording; buttons-in-status and copy await design
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
- **For Claude Design:** the wording of the three new messages (corner points, stations too close, Next), whether "Next" should
  be real buttons in the status line, and how a mount row should read in the Keep clear list.

## Phase 4 — Alternatives that explain themselves (Claude Code, 1–2 days; Claude Design reviews the cards) — PARTLY BUILT
- Apply the held bore directions in Alternatives as Check does (report issue 1). **Done.**
- Group obstacle faces **per part** before enumerating sides, so one bracket is one obstacle, not 40 faces. **Already in `multiroute.js` (`cluster()` merges touching face boxes).**
- When no clean candidate exists: say which part blocks every side and offer "[Push the route away] [Tick fewer parts]".
- Cards: length / min R / clearance in a fixed order, the losing numbers in red, "Use this" only on clean ones.
- **Done when:** piping3 gives ≥ 2 distinct candidates or an explained "none clean"; `multiroute.test.js` extended.

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
