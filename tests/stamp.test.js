// node tests/stamp.test.js — version tags are current (tools/stamp.js): every local script and stylesheet of index.html and
// inspector.html carries ?v=<hash of its content>, index.html's app-build matches version.json. Fails after a js / css change
// that was not stamped: run `node tools/stamp.js` and commit what it changes.
const fs = require("fs"), path = require("path"), S = require("../tools/stamp.js");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const r = S.run(true);
check(!r.stale.length, r.stale.length ? `stale tags in ${r.stale.join(", ")}: run node tools/stamp.js and commit` : `tags current (build ${r.build})`);
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const refs = [...html.matchAll(/\b(?:src|href)="((?!https?:|\/\/)[^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m => m[1]);
check(refs.length > 30 && refs.every(u => /\?v=[0-9a-f]{8}$/.test(u)), `every local script / stylesheet tagged (${refs.length})`);
const bad = refs.filter(u => { const [f, v] = u.split("?v="); return S.sha(fs.readFileSync(path.join(__dirname, "..", f))) !== v; });
check(!bad.length, bad.length ? `tag does not match the file: ${bad.join(", ")}` : "each tag is the hash of its file");
const meta = (html.match(/<meta name="app-build" content="([0-9a-f]+)">/) || [])[1], vj = JSON.parse(fs.readFileSync(path.join(__dirname, "../version.json"), "utf8"));
check(meta && meta === vj.build && meta === S.build(html), `app-build ${meta} = version.json ${vj.build}`);
// the same tags with Windows line endings (git core.autocrlf): a CRLF copy of a file hashes as the LF one
const js = fs.readFileSync(path.join(__dirname, "../js/next.js"), "utf8").replace(/\r\n/g, "\n");
check(S.sha(Buffer.from(js.replace(/\n/g, "\r\n"))) === S.sha(Buffer.from(js)) && S.build(fs.readFileSync(path.join(__dirname, "../index.html"), "utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")) === meta,
  "CRLF copies (git on Windows) give the same tags and build");
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
