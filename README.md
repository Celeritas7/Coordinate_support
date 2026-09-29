# Route Studio

Hose and cable routing checks for Creo: bend radius on one route, clearance between two, bundles of cables through shared clamps, analysis of existing .pts files, local point refinement.

## Files
- index.html - the app (markup only)
- css/route-studio.css - styles, light and dark theme
- js/route-studio.js - geometry, optimiser, 3D view, bend / clearance / bundle tabs
- js/analysis.js - Analyse tab and Issues list
- js/refine.js - Refine tab
- Launch Route Studio.bat - double-click on Windows; serves the folder on localhost:8765 and opens the browser
- ROADMAP.md - what is built and what is planned

## Run
Double-click `Launch Route Studio.bat`, or serve the folder with any static server (`python -m http.server`). Opening index.html directly from disk also works in most browsers. Needs internet for three.js and the IBM Plex fonts (CDN).
