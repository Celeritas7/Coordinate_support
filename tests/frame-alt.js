// node tests/frame-alt.js — the frame check on the real page: route_343434's stations typed as points on samples/frame_asm.stp,
// Check route then Alternatives on P1–P6, P5–P10, P11–P16. Each must give a clean route of about 679 / 931 / 1145 mm, and
// Check's verdict and the Clearance tab count the same parts Alternatives does (kept clear): an unticked part is listed,
// not counted. P1 sits in the long bore of fitting 991980: that part must not be listed at all (the station zone).
// Needs Playwright + Chromium (as tests/ui-walk.js) and samples/frame_asm.stp, samples/route_343434_R65.pts.
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, ".."), S = f => path.join(ROOT, "samples", f);
const missing = ["frame_asm.stp", "route_343434_R65.pts"].filter(f => !fs.existsSync(S(f)));
if (missing.length) { console.log(`skip: samples/${missing.join(", samples/")} not found`); process.exit(0); }
let pw; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { pw = require(p); break; } catch (e) {} }
if (!pw) { console.log("skip: playwright not installed"); process.exit(0); }
const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
// the 16 stations are rows of the generated route (its header lists them: CS29=1, CS46=9, …, CS41=103)
const rows = fs.readFileSync(S("route_343434_R65.pts"), "utf8").split("\n").filter(l => /^\s*-?\d/.test(l)).map(l => l.trim().split(/\s+/).map(Number));
const P = [1, 9, 15, 20, 23, 26, 32, 36, 45, 56, 67, 78, 91, 96, 99, 103].map(r => rows[r - 1]);
const CASES = [[1, 6, 679], [5, 10, 931], [11, 16, 1145]];
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((q, s) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s);
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const b = await pw.chromium.launch(exe ? { executablePath: exe } : {}), pg = await b.newPage({ viewport: { width: 1600, height: 1000 } }), errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  await pg.goto(`http://127.0.0.1:${server.address().port}/index.html`); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(800);
  const text = id => pg.evaluate(i => document.getElementById(i).textContent.replace(/\s+/g, " ").trim(), id);
  const until = async (id, re, s) => { for (let i = 0; i < s * 2; i++) { const t = await text(id); if (re.test(t)) return t; await pg.waitForTimeout(500); } return text(id); };
  const clr = () => pg.evaluate(() => [...document.querySelectorAll("#clrList tbody tr")].map(r => ({ cls: r.className, text: r.innerText.replace(/\s+/g, " ") })));
  await pg.setInputFiles("#shFile", S("frame_asm.stp")); await until("shStatus", /^Opened in/, 120); await pg.waitForTimeout(3000);
  for (const [a, z, want] of CASES) {
    const tag = `P${a}–P${z}`;
    await pg.evaluate(t => { $("ptsBox").open = true; const p = $("pts"); p.value = t; p.dispatchEvent(new Event("input", { bubbles: true })); }, P.slice(a - 1, z).map(p => p.join(" ")).join("\n"));
    await pg.click("#runBend"); const v = await until("statusBend", /^(Clash|Too tight|Close|Clear):/, 120);
    await pg.click("#dClr"); await pg.waitForTimeout(300);
    const R = await clr(), into = /^Clash: [\d.]+ mm into (\S+)/.exec(v);
    console.log(`     ${tag} Check: ${v.slice(0, 120)}`);
    check(!R.some(r => /not counted/.test(r.text) && /bad|warn/.test(r.cls)), `${tag} Check: unticked parts listed muted, not as failing rows`);
    check(!into || R.some(r => r.cls === "bad" && r.text.includes(into[1])), `${tag} Check: a Clash names a kept-clear part with a red row`);
    if (a === 1) check(!R.some(r => /991980/.test(r.text)), "P1 in the bore of 991980: the fitting is not listed (station zone)");
    const t0 = Date.now(); await pg.click("#runAlt"); const s = await until("statusAlt", /distinct|No clean|Forced|No obstacles|No route/, 300);
    const C = await pg.evaluate(() => [...document.querySelectorAll("#altList .altrow")].map(c => ({ clean: !!c.querySelector("button.pri"), text: c.innerText.replace(/\s+/g, " ") })));
    const best = C.find(c => c.clean), L = best ? +/(\d+) mm/.exec(best.text)[1] : NaN;
    console.log(`     ${tag} Alternatives (${((Date.now() - t0) / 1000).toFixed(1)} s): ${s.slice(0, 90)} · ${best ? best.text : "none clean"}`);
    check(!!best && Math.abs(L - want) <= want * 0.02, `${tag}: a clean route of about ${want} mm (${best ? L + " mm" : "none clean"})`);
    if (best) { await pg.click("#altList .altrow button.pri"); await pg.waitForTimeout(1500); await pg.click("#dRad"); await pg.click("#dClr"); await pg.waitForTimeout(300);
      const R2 = await clr();
      check(!R2.some(r => /bad|warn/.test(r.cls)), `${tag}: the clean alternative, taken as a run, has no failing row in the Clearance tab`);
      check(!(await text("statusBend")), `${tag}: Check's old verdict is cleared once the alternative is the selected run`); }
  }
  check(!errs.length, `no page errors${errs.length ? ": " + errs.join("; ") : ""}`);
  await b.close(); server.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
