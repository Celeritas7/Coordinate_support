# Route Studio: design brief

## What it is
A browser app for a Creo design engineer working on truck chassis parts. It checks hose, cable and pipe routes before or after they are built in Creo, finds problems, and gives fixes the engineer applies by hand in Creo. It runs locally as a static page. It does not replace Creo, and it never changes the model itself.

## Who uses it, and how
- One engineer (the developer) for now, possibly a team later.
- Typical job: **check and fix a route that already exists in an assembly**, often modelled by someone else. Creating a route from scratch is rarer.
- Inputs come from Creo exports (STEP) or are typed or pasted from drawing tables.
- Outputs go back into Creo: a short list of points (.pts) and instructions such as "move clip CS31/32 −10 mm in Y".

## The real problem (from a worked example, 2026-10-06)
Test assembly: truck frame with one Ø12 mm hose (`U107338_22986967_NEW_100`) routed through 15 coordinate-system stations (CS29 … CS41), held by clips and clamps bolted to the frame. Minimum bend radius 65 mm. The analysis found:
- **3 bends below the limit:** R 59.8 after CS32, R 60.4 at CS33, R 61.3 after CS38.
- **2 clashes with real parts:** a bolt (`991640`) cuts 2 mm into the hose between CS33 and CS34. A bracket (`22648999`) sits 0.8 mm from it between CS32 and CS33.
- **Station order error:** CS39 comes after CS38 in the file but before it along the route.
- **Fixes found:**
  - Move the CS31/CS32 clip −10 mm in Y.
  - Re-route CS32→CS33 and CS38→CS40 with 3 corner points each, at single radius 66.
  - Step the hose 12 mm around the bolt with 4 corner points, keeping its clamps fixed.
  - 10 points in total.
- **Lessons:**
  - Clamps and clips are fixed to the frame, so suggested moves must respect what can actually move.
  - A spline through a few points does *not* hold the bend radius. Corner points plus Creo's *Single radius* curve do.
  - The app has to see the real parts. Hand-typed obstacle boxes are not usable.

## Modules (new structure)

### 1. Cable / Hose: main module, highest priority
Input: **Creo STEP**. Route stations are named datum coordinate systems. The assembly STEP also holds the hose itself and all surrounding parts.
Flow:
1. **Load:** a station-only STEP, or the whole assembly. The app finds the hose, its stations, the fixings (clamps and clips) and the obstacles.
2. **Check:** bend radius along the route, clearance to real parts, station order, contact with fixings (allowed) vs other parts (problem).
3. **Issues list:** every problem point with location, value vs limit, and the part involved. Click to zoom in 3D.
4. **Fix:** suggested actions (move a station or clip by a given amount and direction, step around a part, re-route a section), then re-check.
5. **Output:** corner points as .pts for Creo, with the single radius to use. Copy or download. Plus a problem report.

Built from today's tabs: **Analyse**, **Refine** and **CAD import / file inspector**, all marked important.

### 2. Pipe: second module
Input: **.pts files**, and a quick paste of drawing-table data.
- **Table → .pts** (built 2026-10-06): paste X, Y and Z columns as scanned from a drawing table, get a .pts file to copy or download. It shows the bend angle at each point and the largest bend radius each corner allows, and flags a given pipe bend R where it doesn't fit.
- **Route generation** (today's Bend tab, lines + arcs mode) and **parallel pipes at a set gap** (today's Clearance tab).
- Later: the same STEP obstacles and clamps as module 1, so pipes are routed against real geometry, not in free space.

### 3. Bundle: low priority
Several cables through shared clamps. Not used in practice yet. Keep it, but don't feature it.

## Design requirements
- **Cable/hose and pipe are separate areas** with different inputs (coordinate systems vs .pts). Don't mix them in one tab row.
- **Fastest possible input:** drag-and-drop STEP and .pts, and a paste box that accepts column blocks (X / Y / Z headings) or rows from Excel.
- **Outputs always offer Copy and Download.**
- **3D view** of the route, stations by name, parts near the route, and problem points coloured. Click an issue to zoom to it.
- **Issues read like a checklist:** where, what, by how much, which part, suggested fix.
- **Engineering units and precision:** mm, 3 decimals in files, coordinates in the assembly frame.
- **Light and dark themes.** Desktop first, as it's used next to Creo on a work PC.

## Open questions for the engineer
1. Clearance rules: minimum gap to parts, and to moving or hot parts?
2. Bend radius: measured to the centreline or the inside of the bend?
3. How to recognise fixings: part-number patterns for clamps and clips?
4. How the hose is modelled in Creo (sweep, Cabling or Piping). This decides the output format.

## Current state of the code (repo Celeritas7/Coordinate_support)
Plain HTML + JS, three.js. Tabs today: Bend radius, Clearance, Bundle, Analyse, Table → .pts, plus a Refine dock and the file inspector. Two local commits are not pushed yet: the lines + arcs solver, and the Table → .pts tab. The assembly reading (hose centreline, parts, placements) exists only as a Python prototype so far.
