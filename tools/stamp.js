// node tools/stamp.js [--check] — version tags so a browser never runs an old copy (GitHub Pages lets it keep every file 10 min)
// Every local script and stylesheet in index.html / inspector.html gets ?v=<first 8 hex of the SHA-1 of its content>: a changed
// file has a new address, so a reload fetches it. index.html also carries <meta name="app-build"> (a hash of the page with its
// tags), and version.json the same build: shell.js fetches version.json past the cache and offers a reload when they differ.
// Run it before committing a change to any js / css file (tests/stamp.test.js fails when a tag is stale). --check: report only.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), PAGES = ["index.html", "inspector.html"];
// line endings normalised to LF first: git on Windows checks text out with CRLF (core.autocrlf), the repo and Pages have LF,
// and the tag must be the same on every machine (binary files, e.g. fonts, are taken as they are)
const lf = b => Buffer.isBuffer(b) && b.includes(0) ? b : Buffer.from(String(b).replace(/\r\n/g, "\n"));
const sha = b => crypto.createHash("sha1").update(lf(b)).digest("hex").slice(0, 8);
// src="js/x.js" or src="js/x.js?v=…", href="css/x.css…": local files only (no http, no //)
const TAG = /(\b(?:src|href)=")((?!https?:|\/\/)[^"?#]+\.(?:js|css))(?:\?v=[0-9a-f]*)?(")/g;
function stamp(html) { return html.replace(TAG, (m, a, f, z) => { const p = path.join(ROOT, f); return fs.existsSync(p) ? `${a}${f}?v=${sha(fs.readFileSync(p))}${z}` : m; }); }
const BUILD = /<meta name="app-build" content="[0-9a-f]*">/;
function build(html) { return sha(html.replace(BUILD, "")); }
function run(check) {
  const out = {}, stale = [];
  for (const page of PAGES) {
    const file = path.join(ROOT, page), was = fs.readFileSync(file, "utf8");
    let now = stamp(was);
    if (page === "index.html") {
      if (!BUILD.test(now)) now = now.replace(/<meta charset="[^"]*">/i, m => `${m}\n<meta name="app-build" content="">`);
      const b = build(now); now = now.replace(BUILD, `<meta name="app-build" content="${b}">`); out.build = b;
    }
    if (now !== was) { stale.push(page); if (!check) fs.writeFileSync(file, now); }
  }
  const vj = path.join(ROOT, "version.json"), want = JSON.stringify({ build: out.build }) + "\n";
  if (!fs.existsSync(vj) || fs.readFileSync(vj, "utf8").replace(/\r\n/g, "\n") !== want) { stale.push("version.json"); if (!check) fs.writeFileSync(vj, want); }
  return { build: out.build, stale };
}
module.exports = { run, stamp, build, sha };
if (require.main === module) {
  const check = process.argv.includes("--check"), r = run(check);
  console.log(r.stale.length ? `${check ? "stale" : "stamped"}: ${r.stale.join(", ")} (build ${r.build})` : `up to date (build ${r.build})`);
  process.exit(check && r.stale.length ? 1 : 0);
}
