// node tests/ui-walk.js [--shots dir] — click through the main jobs with the real buttons and count the steps.
// Needs Playwright + Chromium (PLAYWRIGHT_CHROMIUM or a normal Playwright install) and samples/piping3_practice_asm.stp.
// Prints one line per step, the status text the app showed, and a summary to compare phases against.
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, ".."), S = f => path.join(ROOT, "samples", f);
const ASM = S("piping3_practice_asm.stp");
if (!fs.existsSync(ASM)) { console.log("skip: samples/piping3_practice_asm.stp not found"); process.exit(0); }
let pw; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { pw = require(p); break; } catch (e) {} }
if (!pw) { console.log("skip: playwright not installed"); process.exit(0); }
const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const shotsArg = process.argv.indexOf("--shots"), SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((q, s) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const b = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } }), errs = [];
  pg.on("pageerror", e => errs.push(e.message));
  const flows = {}; let cur = null;
  const step = (s, note) => { flows[cur].steps++; console.log(`  ${flows[cur].steps}. ${s}${note ? "  → " + note : ""}`); };
  const flow = name => { cur = name; flows[name] = { steps: 0, loads: 0, typedD: 0, collapsed: 0 }; console.log(`\n${name}`); };
  const text = id => pg.evaluate(i => { const e = document.getElementById(i); return e ? e.textContent.replace(/\s+/g, " ").trim() : ""; }, id);
  const shot = n => SHOTS ? pg.screenshot({ path: path.join(SHOTS, n + ".png") }) : null;
  const go = (m, t) => pg.evaluate(([m, t]) => { document.querySelector(`.modsw button[data-mod="${m}"]`).click(); document.querySelector(`#tasks button[data-task="${t}"]`).click(); }, [m, t]);
  const expand = async id => { const was = await pg.evaluate(i => { const d = document.getElementById(i); if (!d || d.open) return true; d.open = true; return false; }, id); if (!was) flows[cur].collapsed++; return !was; };
  const until = async (id, re, s = 60) => { for (let i = 0; i < s * 2; i++) { const t = await text(id); if (re.test(t)) return t; await pg.waitForTimeout(500); } return text(id); };

  await pg.goto(url); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(800);

  // ---- A: Hose / Cable · route from clamps, keep clear of the parts
  flow("A  Hose · route through the clamps of piping3, clear of the parts");
  await go("hose", "route"); step("Hose / Cable · Route through stations");
  if (await expand("csBox")) step("open “Stations from clamps”");
  await pg.fill("#csD", "12"); await pg.dispatchEvent("#csD", "change"); flows[cur].typedD++; step("Hose Ø 12");
  await pg.setInputFiles("#csFile", ASM); flows[cur].loads++;
  const cs = await until("statusCs", /fixing/, 30); step("Load assembly .stp…", cs.slice(0, 120));
  const rows = await pg.evaluate(() => document.querySelectorAll("#csList .csrow").length);
  const ticked = await pg.evaluate(() => document.querySelectorAll("#csList input[type=checkbox]:checked").length);
  console.log(`     rows: ${rows}, ticked: ${ticked}`); flows[cur].rows = rows; flows[cur].ticked = ticked;
  await shot("A1-stations");
  await pg.click("#csAuto"); step("Auto order");
  await pg.click("#csUse"); await pg.waitForTimeout(200); step("Use as stations");
  if (await pg.evaluate(() => !document.getElementById("csAsk").hidden)) { await pg.click("#csYes"); step("Replace the example points"); }
  if (await expand("cdBox")) step("open “Keep clear of CAD parts”");
  const needD = await pg.evaluate(() => { const e = document.getElementById("cdD"); return e && !e.closest("[hidden]") && e.offsetParent !== null; });
  if (needD) { await pg.fill("#cdD", "12"); flows[cur].typedD++; step("Hose Ø 12 again"); }
  const needLoad = await pg.evaluate(() => { const e = document.getElementById("cdLoad"); return e && e.offsetParent !== null; });
  if (needLoad) { await pg.setInputFiles("#cdFile", ASM); flows[cur].loads++; await pg.waitForTimeout(6000); step("Load frame / parts file… (same file)"); }
  await pg.click("#runBend"); const chk = await until("statusBend", /^Added|No |Paste|cannot|can't/i, 90); step("Check, then add to comparison");
  console.log("     " + chk.slice(0, 220)); flows[cur].clash = /into it|below the .* gap|-\d+(\.\d+)? mm/.test(chk);
  await shot("A2-check");
  await pg.click("#runAlt"); const alt = await until("altList", /distinct|No obstacles|none|Click one|Use this/i, 120); step("Alternatives");
  flows[cur].alts = (alt.match(/A\d+ ·/g) || []).length; flows[cur].cleanAlts = (alt.match(/A\d+ ·[^A]*?(?<!not )clean/g) || []).length;
  console.log("     " + alt.slice(0, 160)); await shot("A3-alternatives");

  // ---- B: Pipe · Through clamps on pipe 111
  flow("B  Pipe · route pipe 111 through its clamps");
  await go("pipe", "clamps"); step("Pipe · Through clamps");
  const open = await pg.evaluate(() => typeof ASM !== "undefined" && ASM && ASM.name);
  if (!open) { await pg.setInputFiles("#asmfile", ASM); flows[cur].loads++; await pg.waitForTimeout(4000); step("Open assembly .stp…"); }
  else console.log(`     (assembly already open: ${open})`);
  const th = await pg.evaluate(() => { const box = document.getElementById("pipeThrough"); return [...box.querySelectorAll("input[type=checkbox]")].filter(i => i.id !== "thDrop").map(i => i.checked); });
  flows[cur].rows = th.length; flows[cur].ticked = th.filter(Boolean).length; console.log(`     clamp rows: ${th.length}, ticked: ${flows[cur].ticked}`);
  await pg.click("#thRun"); await pg.waitForTimeout(2500); step("Route through ticked clamps");
  await shot("B1-through");

  console.log("\nSummary");
  for (const [k, f] of Object.entries(flows)) console.log(`  ${k.split(" ")[0]}: ${f.steps} steps, ${f.loads} file load(s), Hose Ø typed ${f.typedD}×, ${f.collapsed} collapsed section(s) opened, ${f.rows} clamp rows (${f.ticked} ticked)` +
    (f.alts != null ? `, route clashes: ${f.clash ? "yes" : "no"}, alternatives: ${f.alts}` : ""));
  if (errs.length) console.log("page errors:", errs);
  await b.close(); server.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
