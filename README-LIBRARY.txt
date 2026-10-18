Library tab + Pipe offset for Coordinate_support

Copy into Coordinate_support, overwriting when asked (11 files):
  index.html            Library button and page; Pipe offset panel; four new scripts
  css/route-studio.css  4-column module switch, Library cards, offset report
  js/shell.js           Library module; Pipe · Offset from another pipe is now live
  js/asm-ui.js          clamps found by library name (bore range = warning only); hooks for Library and offset
  js/step-asm.js        per-face boundary loops (pictures); holes[] = every hole, with or without a CSYS
  js/fixlib.js          NEW  library data, matching, JSON export/import, shaded part pictures
  js/lib-ui.js          NEW  Library cards and editor
  js/offset.js          NEW  pipe offset solver (no DOM)
  js/offset-ui.js       NEW  Pipe · Offset from another pipe
  tests/fixlib.test.js  NEW  node tests/fixlib.test.js
  tests/offset.test.js  NEW  node tests/offset.test.js (needs samples/follower.stp)

Then reload with Ctrl+F5.

Library: seeded with 990224 (clamp, Ø21–24) and 22402156 (twin clip, Ø12–15). Seeds are written only on first use;
if you opened the Library before, add 22402156 by hand.

Pipe offset rules (as agreed):
  - Fixed pipe and follower: your pick, either way round; swap button; saved per file name.
  - Min gap is surface to surface (both ODs counted), default 30 mm. Only spots closer than that move.
  - At a clip both pipes run through, the clip spacing wins: the follower stays straight through the clip.
  - Ends and end directions fixed; no straight shorter than Min straight (or than it already is).
  - Obstacles (trial): boxes typed by hand in the .pts frame (id Xmin Ymin Zmin Xmax Ymax Zmax), or "Add a test box in the
    follower's way". The follower keeps "Gap to boxes" (surface to box) from each one as well as Min gap from the fixed pipe.
    Real parts from the assembly are not read yet.
On follower.stp: 111 following 211 reaches 30.0 mm everywhere. 211 following 111 gets to 9.2 mm: the close spots sit
right after the clips, where the follower would need an extra bend; they are listed in the report.
