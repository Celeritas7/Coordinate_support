# Route Studio — audit of every control, and the split into two modules

Status after Phase 12. Each line: control → what it does → verdict. Verdicts: **keep**, **move**, **merge**, **hide** (advanced, behind a disclosure), **drop** (not needed), **?** (your call).

Two modules, because the two jobs never share an input:
- **Hose / Cable**: flexible, bends anywhere, checked against a minimum bend radius; route is a spline through stations (CSYS). Clamps hold it.
- **Pipe**: rigid, straights + arcs of one bend radius, bender rules (min straight); route is corner points. Clamps are bores it must pass through.

## Top bar
| Control | Does | Verdict |
|---|---|---|
| Title + lede | "Check hose routes…" | keep, but reword: it now also does pipes |
| Tabs: Bend radius · Clearance · Bundle · Analyse · Table → .pts | job switch | **replace** with a module switch (Hose/Cable · Pipe) and a short task list per module (below) |
| Reset view / ⌂ (3D) | | keep in both |
| Theme | | keep |

## Bend radius tab  (today: cable routing)
| Control | Does | Verdict |
|---|---|---|
| Target points textarea (X Y Z) | stations the hose must pass | **Hose**: keep. **Pipe**: not used (pipes come from the assembly or .pts corners) |
| Load: .pts / .stp / .igs | stations from a file | Hose: keep |
| Presets (the sample routes) | demo data | hide behind "Examples" |
| Min bend R, Safety factor | the rule | Hose: keep (R × SF = target) |
| Cable Ø | tube drawn / clearance | Hose: keep |
| Shape method (spline / lines+arcs) | | Hose: spline only. Pipe: lines+arcs only. Drop the selector; the module decides |
| Fewest points + Max shift | thin the output | Hose: keep (default on). Pipe: drop (corners are already the fewest points) |
| Points table (station, R, ok) | | keep in both; Pipe shows corners + bend angle |
| Copy .pts / Download .pts | | keep in both |
| Compare runs list (12 runs, show/hide, colours) | side-by-side | keep in both (it's the "Runs" panel) |
| Clear all | | keep |

## Clearance tab  (cable vs cable, parallel offset)
| Control | Does | Verdict |
|---|---|---|
| Route A / Route B inputs | two cables | Hose: keep |
| Gap (surface to surface), Ø A / Ø B | | Hose: keep |
| Offset axes / normal, fixed ends, ramp | how B moves off A | Hose: keep as "Offset B from A". Pipe (Phase 12c): same panel, fed by "use as master / slave" on pipe runs |
| Pass/fail readout | | keep |
| Stress-test note about CS stations | | drop (sample-specific) |

## Bundle tab  (several cables through shared clamps)
| Control | Does | Verdict |
|---|---|---|
| Cable properties (id d minR gap) | | Hose: keep |
| Default d / Min R / Gap | | Hose: keep |
| Obstacles (id + box) | hand-typed boxes | Hose: keep until Phase 13 (real parts), then **replace** with parts read from the assembly |
| Load obstacles from Bundle tab (Analyse) | cross-tab copy | **drop** once obstacles come from the assembly |
| Earlier version (optional) | diff against last run | keep, but as part of Runs ("compare with run…"), not a textarea |
| Solve / Stop | | keep |

## Analyse tab  (check a file as loaded, no re-routing)
| Control | Does | Verdict |
|---|---|---|
| Cables to check (# name, then X Y Z) | paste several cables | Hose: keep, rename "Check as loaded" |
| Load: .pts / .stp / .igs files | | keep |
| assembly .stp (parts + pipes) | reads the whole assembly | **Pipe**: this is the Pipe module's main Open button. Hose: also needed later (hose on spline, clamps) → move to a **shared Open** at the top of both modules |
| example, 3 edited cables | demo | hide behind "Examples" |
| Parts (N different) · Pipe? auto/pipe/not | override detection | Pipe: keep, as a collapsible "Parts" side list. Hose: same list, later with "clamp / hot / moving" tags (Phase 13) |
| Pipe selector, .pts frame | | Pipe: keep; put the frame next to Copy/Download, not above the compare |
| Compare a .pts with this pipe + report + Copy reordered / Download | | Pipe: keep as task "Check .pts against pipe" |
| Route a pipe through clamps (clamp list, R, Min straight, Margin, Drop detours, Run, old-vs-new table, .pts) | | Pipe: keep as task "Through clamps" |
| Check limits (Analyse button) | runs the radius/clearance check | Hose: keep as "Check" |
| Issues strip under the 3D (bend/clearance plot) | | keep in both |

## Table → .pts tab
| Control | Does | Verdict |
|---|---|---|
| Paste a table (Excel columns) → .pts | format converter | keep as a small utility under Open ("Paste a table…") in both; it doesn't need a tab |

## Inspector page
| Control | Verdict |
|---|---|
| Drop IGES/STEP, datum table, export-settings hints | keep as a separate page (debug tool) |
| Parts and pipes + Pipe? | keep; same list as in the app |

## Proposed layout (Phase 11 shell)
```
Route Studio   [ Hose / Cable | Pipe ]                     Reset view · Theme
Open: drop or choose .stp / .igs / .pts   ·  Paste a table…  ·  Examples ▾
Parts ▸ (collapsed; override pipe / later tag clamps, hot, moving)
──────────────────────────────────────────────────────────────
Hose / Cable tasks            |  Pipe tasks
 1 Route through stations     |   1 Read pipes from assembly (auto on Open)
 2 Check as loaded            |   2 Check .pts against pipe
 3 Offset B from A            |   3 Through clamps
 4 Bundle through clamps      |   4 Offset from another pipe   (12c)
                              |   5 Check bender rules (min straight, one R)  (14)
──────────────────────────────────────────────────────────────
Runs (shared): show/hide, colour, compare with…, Copy .pts, Download, frame ▾
3D view + Issues strip (shared)
```
Rules: one Open for everything; the module decides spline vs lines+arcs; demo data behind Examples; obstacles come from the assembly once Phase 13 lands.

## Open questions for you
1. Should "Check as loaded" (Hose) and "Check .pts against pipe" (Pipe) be one task called **Check**, that works out from the file what it is? (Yes = fewer buttons; the report wording differs anyway.)
2. Bundle today types obstacles as boxes. Keep that as a fallback after Phase 13, or drop it?
3. Keep the **Table → .pts** converter at all? Do you still paste from Excel?
4. Theme toggle: used, or drop?
