# Prep: the Drive files, how the app uses them, and where the UI gets in the way

Prepared 2026-10-18 against `main` @ `c84f55b`. For the discussion on clamp recognition (report issues 2, 3, 4) and ease of use.

## 1. The Drive folder `Coordinate_support/`, file by file

The tests read `samples/<name>`; nothing below is in git yet (`samples/` and `data/` are git-ignored, only the four 343434 files were force-added).

### `samples/`: the test set
| File | What it is | Where the app uses it | Tests that need it |
|---|---|---|---|
| `piping2_practice_asm.stp` (245 KB) | 1 pipe Ø22.5/14.5 R40, 5 bends incl. the 161° hairpin; clamp `990224` (Ø22 × 18, CS0) | Pipe · Check .pts / Through clamps (pipe misses the clamp by 65.5 mm, corner 4 dropped as a detour) | step-asm, through, asm-extras |
| `piping2_practice_1.pts` | Creo .pts for that pipe, MAIN frame: repeat #2, #8 4 mm off and out of order | Pipe · Check .pts against pipe | step-asm, asm-extras |
| `piping3_practice_asm.stp` (1.66 MB, Oct 6 export) | 51 instances, 2 pipes (111: Ø12 R35, 211: Ø15 R40, 21 bends each), twin clips `22402156`, a clamp block with Ø12 bores CS16/CS17 and Ø15 bores CS6/CS7 | Through clamps (pipe 111, 3 clamps); Hose · Stations from clamps (Ø12 → 5 clamps); Keep clear (existing pipes as their own group) | step-asm, asm-extras, through, clamp-stations, cad-pipes |
| `piping3_practice_11.pts` / `_21.pts` | .pts for pipes 111 / 211 (11 listed end to start; 21 misses the start corner) | Pipe · Check .pts | step-asm, asm-extras |
| `piping4_answer_asm.stp` (1.13 MB) | The finished answer: 2 pipes Ø18/16 R40, CS0–CS30 stations incl. `_AIR` / `_CV`, clamps `992328`, fittings `20733297`, `CS30_CV` | Pipe; Hose · Stations from clamps at Ø14 (clamps 60 mm apart, so bends get impossible) | step-asm, clamp-stations |
| `hose_spline_test.stp` / `.pts` | Synthetic Ø16 hose on a B-spline, built by `tests/make-hose-sample.js` | Hose on a spline + .pts compare | asm-extras |
| `343434_asm.stp`, `route_343434_csys.stp`, `route_343434_R65.pts`, `343434.igs` | The hose case: 16 CS stations (+87 RP points), the generated R65 route, an IGES with no datums | Hose · Route through stations, Inspector, Analyse | arcroute (csys) |

**Not on Drive:** `samples/follower.stp`, the input for `tests/offset.test.js`. It is the Oct 15 piping3 export (`U104904_PIPING-3_PRACTICE_ASM`) uploaded in chat; `offset.test.js` passes 10/10 on it. It is a *different export* from `piping3_practice_asm.stp`: put under that name, clamp-stations and cad-pipes fail (no Ø12 bores CS16/CS17 found). Keep both files, under their own names.

### `data/`: working files
| Folder / file | What it is | Notes |
|---|---|---|
| `cable/u107338_fy26_test_frame_asm_111.igs` (23 MB) | The truck frame: 73 solids, 3682 faces, no names, no CSYS | Keep clear of CAD parts; `cad-solids.test.js` reads it from `samples/`, so copy it there (or teach the test to look in `data/cable/`) |
| `cable/1111111.igs` (5 MB) | Solids, 0 datum points | Inspector check only |
| `cable/Generated_R65_x1.5*.stp/.pts` | App outputs from Oct 5 | Not used by tests; history |
| `cable/343434*`, `route_343434*` | Duplicates of the samples | — |
| `new/pasted-1145.pts` | **The piping2 pipe's corner points** in the MAIN frame (856/716/600/484/443.6 along X; repeat #2, last point 4 mm off corner 5 and out of order). It is effectively `piping2_practice_1.pts` | Report §6 calls it "a bad point file: 500 mm X jump, Z reversal". It isn't bad data: **these are pipe corner points (off the pipe at every bend), fed in as hose stations (on the hose).** Corners are 500 mm apart with 121° and 161° turns, so no R65 hose can pass through them. The app should say that, not just fail |
| `new/pasted-1145.stp`, `new/csys.stp` (~220 KB each) | Not opened (too large for the Drive tool) | To check together |
| `pipe/route_studio_design_brief.md`, two `.patch` files | Oct 6 brief and the lines+arcs / Table → .pts patches | Already in the repo |

## 2. How the app decides what a clamp is: three different answers

| Where | Code | Candidates | Filter | Library? | Needs a CSYS on the bore? |
|---|---|---|---|---|---|
| Pipe · Through clamps | `asm-ui.js` `thClamps` | `r.fixings` + `r.holes` of library parts | bore ±1.5 of the pipe OD; not its own end fitting; not holding another pipe | **yes** (bore range = warning) | no (library parts) |
| StepAsm API | `step-asm.js` `clampsFor` | `r.fixings` | same as above, no library | no | yes |
| Hose · Stations from clamps | `clamp-stations.js` `candidates` | `r.fixings` only | **bore size only** (Ø ± fit, symmetric) | **no** | **yes** |

`r.fixings` = every cylindrical hole with a named CSYS origin on its axis, inside the hole (`step-asm.js:401`). That is why bolt holes, plate holes and pipe ends show up in the Hose list (report §6 "too many fixings"), why a library clamp without a CSYS is missing there (issue 4), and why Pipe and Hose list different clamps for the same file.

**Proposal for tomorrow:** one shared `fixingsFor(r, {D, fit, pipe?})` in `step-asm.js` (or `fixlib.js`) used by all three, with:
1. library match first (part name pattern), any hole with a CSYS second, flagged as "not in library";
2. bore fit **asymmetric**: Ø − 0.2 … Ø + fit (issue 3);
3. minimum bore length, default 10 mm (issue 2: plate holes are < 5 mm, clamps ≥ 12 mm);
4. the reason each row is in or out shown in the list ("library clip 22402156", "bolt hole, 4 mm long", "end fitting of pipe 111").

## 3. Where the UI makes the job harder

Job: Hose / Cable · Route through stations, from an assembly with clamps and obstacles (report §4). Today it takes about 12 steps across 4 collapsible sections; the friction points:

| # | Friction | Where | Idea |
|---|---|---|---|
| U1 | **Top Open… sends any assembly to Pipe** (`shell.js` `isAsm` → `go('pipe',…)`); the report says to use the Load button inside the section instead | `shell.js` `open()` | When Hose · Route is the open task, an assembly goes to Stations from clamps **and** Keep clear in one go; or ask once "Pipe or Hose?" |
| U2 | **Same STEP loaded twice**: once under Stations from clamps, once under Keep clear | two loaders, two parses of a 1.6 MB file | One loaded assembly feeds both sections |
| U3 | **Hose Ø typed twice** (Stations from clamps and Keep clear) | `csD` and the Keep clear Ø | One Hose Ø for the task |
| U4 | **Every CSYS hole is a row to untick** (20+ rows = bolt holes) | `csList` | Section 2 filter; non-library rows collapsed under "other holes (n)" |
| U5 | **Disabled buttons don't say why** (Auto order / Use as stations need 2 ticked) | `render()` | Inline hint "tick at least 2 stations" (issue 5) |
| U6 | **The bracket the clamps sit in counts as an obstacle** (`ANSWER_9`); existing pipes have to be unticked by hand | Keep clear list | Auto-untick parts that hold a ticked station's bore; existing pipes unticked by default (already a group) |
| U7 | **Alternatives ignores the bore directions Check holds** | `alt-ui.js` (no `clampStationDirs` call; Check uses it at `route-studio.js:692`) | Same directions in both (issue 1) |
| U8 | **Impossible station sets fail late** (piping4: clamps 60 mm apart, bores held → R 0) | after Check | Warn before solving: "S3–S4 are 60 mm apart, need ≥ 2R = 130 mm with the bores held" (issue 7) |
| U9 | **Pipe corner points accepted as hose stations** (`pasted-1145.pts`) | Target points | Detect corner-style files (few points, long straights, sharp turns, "Single radius" header) and say "these look like pipe corners, not points on the hose" |
| U10 | The order of the sections doesn't follow the job: Target points → Stations from clamps → route settings → Keep clear → end directions → Check → Alternatives | panel layout | A 1-2-3 strip: **1 Load assembly · 2 Pick stations · 3 Route** (settings and Keep clear behind "Advanced") |

## 4. Questions to settle tomorrow
1. Is the Library the source of truth for what a clamp is (non-library holes shown but unticked), or one hint among others?
2. Your clamp / clip / grommet part numbers beyond `990224`, `22402156`, `992328`?
3. Minimum bore length: 10 mm OK? Asymmetric fit: −0.2 / +fit OK?
4. Top Open… on an assembly: follow the open task, or always ask?
5. Should Hose · Route through stations become the 1-2-3 strip (U10), or keep the sections and fix U1–U9 only?
6. `data/new/csys.stp` and `pasted-1145.stp`: what are they meant to test?

## 5. Before the session (on your PC)
```
copy data\cableၳ38_fy26_test_frame_asm_111.igs samples\
copy <follower.stp> samples\follower.stp
git add -f samples/*.stp samples/*.pts samples/*.igs
git commit -m "Add test samples" && git push
```
Then every test runs here on the real files instead of skipping.
