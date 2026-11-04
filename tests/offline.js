// node tests/offline.js — the offline copy (tools/make-offline.js) on its own: built into an empty folder, opened from disk
// (file://) with every network request blocked. It must load with no errors and no request for any other file, show
// "Offline copy · build …", use the IBM Plex fonts inside it, open an assembly (piping3 if present, else the generated
// pipe sample) and run Pipe · Through clamps to a Clash / Close / Clear line; the Inspector file too. Update check: a
// stand-in for the live site with a newer build → "A newer Route Studio is out … Open the live site"; the same build or no
// network → nothing. Needs Playwright + Chromium (as tests/ui-walk.js).
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pw; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { pw = require(p); break; } catch (e) {} }
if (!pw) { console.log("skip: playwright not installed"); process.exit(0); }
const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rs-offline-")), M = require("../tools/make-offline.js").make(DIR, "2026-01-01");
const P3 = path.join(ROOT, "samples/piping3_practice_asm.stp"), SAMPLE = fs.existsSync(P3) ? P3 : path.join(DIR, "pipe_clear_test.stp");
if (SAMPLE !== P3) fs.writeFileSync(SAMPLE, require("./make-pipe-sample.js").makePipeSample());
// the stand-in live site: version.json with CORS, as GitHub Pages serves it
let liveBuild = "0000beef";
const live = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); s.end(JSON.stringify({ build: liveBuild })); });
let fail = 0; const check = (ok, m) => { console.log((ok ? "ok   " : "FAIL ") + m); if (!ok) fail++; };
(async () => {
  await new Promise(r => live.listen(0, r)); const LIVE = `http://127.0.0.1:${live.address().port}/`;
  console.log(`     built ${fs.readdirSync(DIR).join(", ")} (app ${(M.sizes.app / 1e6).toFixed(2)} MB)`);
  const b = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } }), pg = await ctx.newPage();
  const errs = [], asked = []; let net = false;   // net: let the stand-in live site through
  pg.on("pageerror", e => errs.push(e.message));
  const own = u => u.startsWith("file:") && (u.endsWith("/Route%20Studio.html") || u.endsWith("/Route%20Studio%20Inspector.html"));
  await ctx.route("**/*", r => { const u = r.request().url(); if (u.startsWith("data:") || u.startsWith("blob:") || own(u)) return r.continue();
    if (u.startsWith(LIVE)) return net ? r.continue() : r.abort();   // the update check: the one call out, silent when refused
    asked.push(u); return r.abort(); });

  await pg.addInitScript(l => { window.RS_LIVE = l; }, LIVE);
  const url = "file://" + path.join(DIR, "Route Studio.html").split(path.sep).map(encodeURIComponent).join("/").replace(/^%2F|^\//, "/");
  await pg.goto(url); await pg.waitForTimeout(3800);
  const txt = id => pg.evaluate(i => document.getElementById(i).textContent.replace(/\s+/g, " ").trim(), id);
  check(!errs.length, "opens from disk with no errors" + (errs.length ? ": " + errs.join(" | ") : ""));
  check(/^Offline copy · build [0-9a-f]{8} · 2026-01-01/.test(await txt("shOffline")) && await pg.isVisible("#shOffline"), `header: ${await txt("shOffline")}`);
  check(await pg.isHidden("#shNew"), "no network: no update notice (silent)");
  const fonts = await pg.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === "loaded").map(f => f.family).join(","); });
  check(/IBM Plex Sans/.test(fonts) && /IBM Plex Mono/.test(fonts), `fonts from inside the file (${fonts})`);
  // real work: open an assembly, Pipe · Through clamps, route
  await pg.setInputFiles("#shFile", SAMPLE);
  for (let i = 0; i < 120; i++) { if (/^Opened in|could not/.test(await txt("shStatus"))) break; await pg.waitForTimeout(250); }
  check(/^Opened in/.test(await txt("shStatus")), `${path.basename(SAMPLE)}: ${await txt("shStatus")}`);
  await pg.click('.modsw button[data-mod="pipe"]'); await pg.click('#tasks button[data-task="clamps"]'); await pg.waitForTimeout(300);
  await pg.click("#thRun"); for (let i = 0; i < 80; i++) { if (/^(Clash|Close|Clear):|No route/.test(await txt("statusThrough"))) break; await pg.waitForTimeout(250); }
  check(/^(Clash|Close|Clear):/.test(await txt("statusThrough")), `Through clamps: ${(await txt("statusThrough")).slice(0, 110)}`);
  check(await pg.evaluate(() => document.querySelectorAll("#cdParts .cdrow").length) > 0, "Keep clear list filled (parts read inside the file)");
  // projects work from disk too: opening the assembly started one, saved in the browser for this file
  check(/^Project piping3_practice_asm|^Project pipe_clear_test/.test(await txt("shProj")), `project from disk: ${await txt("shProj")}`);
  await pg.waitForTimeout(3500); const nProj = await pg.evaluate(async () => (await rsProjects.list()).length);
  check(nProj === 1, `saved in the browser (IndexedDB from file://): ${nProj} project`);
  check(!asked.length, asked.length ? `asked for other files / the network: ${[...new Set(asked)].slice(0, 5).join(", ")}` : "no request for any other file or the network");
  check(!errs.length, "no page errors while working" + (errs.length ? ": " + errs.join(" | ") : ""));
  // update check against the stand-in live site
  net = true; await pg.reload(); await pg.waitForTimeout(3800);
  check(await pg.isVisible("#shNew") && /A newer Route Studio is out \(build 0000beef; this offline copy is [0-9a-f]{8}\)/.test(await txt("shNew")) && (await txt("shNewGo")) === "Open the live site",
    `online, newer build live: ${await txt("shNew")}`);
  liveBuild = M.build; await pg.reload(); await pg.waitForTimeout(3800);
  check(await pg.isHidden("#shNew"), "online, same build live: no notice");
  // the Inspector file, also from disk, with no request out
  net = false; asked.length = 0; errs.length = 0;
  await pg.goto(url.replace(/Route%20Studio\.html$/, "Route%20Studio%20Inspector.html")); await pg.waitForTimeout(1500);
  check(!errs.length && !asked.length, `Inspector opens on its own${asked.length ? `; asked for ${asked.join(", ")}` : ""}${errs.length ? `; ${errs.join(" | ")}` : ""}`);
  await b.close(); live.close(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(fail ? `${fail} failed` : "all passed"); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
