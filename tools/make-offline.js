// node tools/make-offline.js [outDir] — the offline copy: one HTML file with every script, style, font and icon inside, to
// double-click (no server, no internet, nothing to keep together). Writes, in dist/Route Studio Offline/ by default:
//   Route Studio.html             the app (index.html with everything inlined)
//   Route Studio Inspector.html   the Inspector, the same way (its Google Fonts swapped for the local IBM Plex)
//   README-OFFLINE.txt            how to use and update it
// The page carries <meta name="offline-build" content="<build> <date>">: the header says it is an offline copy, and when
// the computer is online it asks the live site (version.json) whether a newer build is out.
// Run it after merging (tools/stamp.js first, so the build matches the site). dist/ is not committed.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = path.resolve(process.argv[2] || path.join(ROOT, "dist", "Route Studio Offline"));
const APP = "Route Studio.html", INSPECTOR = "Route Studio Inspector.html";
const MIME = { ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const read = f => fs.readFileSync(path.join(ROOT, f));
const dataURI = f => `data:${MIME[path.extname(f).toLowerCase()] || "application/octet-stream"};base64,${read(f).toString("base64")}`;
const strip = u => u.replace(/[?#].*$/, "");
// a stylesheet with its url(...) files (fonts, images) as data URIs, relative to the stylesheet
function css(file) {
  const dir = path.dirname(file);
  return read(file).toString("utf8").replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) =>
    /^(data:|https?:|\/\/|#)/.test(u) ? m : `url(${dataURI(path.posix.join(dir, strip(u)))})`);
}
// a script for inside <script>: "</script" cannot appear in it (none does today; escaped in case)
const js = file => read(file).toString("utf8").replace(/<\/script/gi, "<\\/script");
function inline(html, { links = {}, extraHead = "" } = {}) {
  let out = html
    .replace(/<link rel="stylesheet" href="((?!https?:|\/\/)[^"]+)">/g, (m, h) => `<style>/* ${strip(h)} */\n${css(strip(h))}\n</style>`)
    .replace(/<link rel="([^"]*icon[^"]*)"([^>]*?) href="((?!https?:|\/\/|data:)[^"]+)">/g, (m, rel, mid, h) => `<link rel="${rel}"${mid} href="${dataURI(strip(h))}">`)
    .replace(/<script src="((?!https?:|\/\/)[^"]+)"><\/script>/g, (m, s) => `<script>/* ${strip(s)} */\n${js(strip(s))}\n</script>`);
  for (const [from, to] of Object.entries(links)) out = out.split(`href="${from}"`).join(`href="${to}"`);
  if (extraHead) out = out.replace(/<\/head>/i, `${extraHead}\n</head>`);
  const left = [...out.matchAll(/\b(?:src|href)="((?!https?:|\/\/|data:|#|mailto:)[^"]+\.(?:js|css|png|svg|woff2?|ico))"/g)].map(m => m[1]);
  if (left.length) throw new Error(`not inlined: ${left.join(", ")}`);
  return out;
}
function make(outDir = OUT, date = new Date().toISOString().slice(0, 10)) {
  const index = read("index.html").toString("utf8"), build = (index.match(/<meta name="app-build" content="([0-9a-f]+)">/) || [])[1] || "";
  const meta = `<meta name="offline-build" content="${build} ${date}">`;
  const app = inline(index.replace(/(<meta name="app-build"[^>]*>)/, `$1\n${meta}`), { links: { "inspector.html": INSPECTOR } });
  // the Inspector: local fonts instead of Google Fonts (offline), then inlined
  const insp = inline(read("inspector.html").toString("utf8")
    .replace(/<link rel="preconnect"[^>]*>/g, "").replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">')
    , { links: { "index.html": APP } });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, APP), app);
  fs.writeFileSync(path.join(outDir, INSPECTOR), insp);
  fs.writeFileSync(path.join(outDir, "README-OFFLINE.txt"), readme(build, date).replace(/\n/g, "\r\n"));
  return { outDir, build, date, sizes: { app: app.length, inspector: insp.length } };
}
function readme(build, date) {
  return `Route Studio - offline copy
Build ${build}, made ${date} from https://github.com/Celeritas7/Coordinate_support (live: https://celeritas7.github.io/Coordinate_support/)

USE
  Double-click "Route Studio.html". It opens in your browser (Chrome or Edge recommended) and needs no internet,
  no server and no other files: every script, style and font is inside it. Copy it anywhere (PC, USB stick, Drive).
  "Route Studio Inspector.html" is the Inspector (More > Inspector in the app opens it when it sits next to the app).

  Open your Creo .stp / .igs / .pts with Open... or drop them on the page. Files are read on your computer only;
  nothing is uploaded. Settings and the Library are kept by the browser for this file (move or rename the file and
  they start fresh; Library > Export first if you want to keep them).

  Big assemblies: the browser needs memory (about 5 GB for a 650 MB STEP). Close other heavy tabs first.

UPDATING
  The header says "Offline copy - build ${build}". When the computer is online the app checks the live site, and
  shows "A newer Route Studio is out" if this copy is older. Get the new "Route Studio.html" from the Drive folder
  "Route Studio Offline <date>", or ask for a fresh build (node tools/make-offline.js in the repo).
`;
}
module.exports = { make, inline };
if (require.main === module) {
  const r = make();
  console.log(`offline copy (build ${r.build}, ${r.date}) in ${r.outDir}: ${APP} ${(r.sizes.app / 1e6).toFixed(2)} MB, ${INSPECTOR} ${(r.sizes.inspector / 1e6).toFixed(2)} MB`);
}
