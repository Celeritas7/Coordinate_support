// node tests/ui-walk.js [--shots dir] — click through the main jobs with the real buttons and count the steps.
// Needs Playwright + Chromium (PLAYWRIGHT_CHROMIUM or a normal Playwright install). Flows A / B need samples/piping3_practice_asm.stp,
// flow F samples/frame_asm.stp; each flow is skipped when its file is missing.
// Prints one line per step, the status text the app showed, and a summary to compare phases against.
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, ".."), S = f => path.join(ROOT, "samples", f);
const ASM = S("piping3_practice_asm.stp"), HAVE_ASM = fs.existsSync(ASM);
if (!HAVE_ASM && !fs.existsSync(S("frame_asm.stp"))) { console.log("skip: samples/piping3_practice_asm.stp and samples/frame_asm.stp not found"); process.exit(0); }
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
  if (!HAVE_ASM) console.log("\nA, B  skip: samples/piping3_practice_asm.stp not found");
  else {
  flow("A  Hose · route through the clamps of piping3, clear of the parts");
  await go("hose", "route"); step("Hose / Cable · Route through stations");
  // the page's own way in: top Open… (falls back to the section's Load link if the assembly does not reach the stations list)
  await pg.setInputFiles("#shFile", ASM); flows[cur].loads++;
  await until("shStatus", /^Opened in/, 60); await pg.waitForTimeout(3000); step("Open… piping3_practice_asm.stp", (await text("shStatus")).slice(0, 120));
  if (await expand("csBox")) step("open “Stations from clamps”");
  await pg.fill("#csD", "12"); await pg.dispatchEvent("#csD", "change"); flows[cur].typedD++; await pg.waitForTimeout(300); step("Hose Ø 12");
  if (!(await pg.evaluate(() => document.querySelectorAll("#csList .csrow").length))) {
    await pg.setInputFiles("#csFile", ASM); flows[cur].loads++; await until("statusCs", /station|fixing/, 30); step("Load assembly .stp… (again)"); }
  const cs = await text("statusCs"); console.log("     " + cs.slice(0, 160));
  const rows = await pg.evaluate(() => document.querySelectorAll("#csList .csrow").length);
  const ticked = await pg.evaluate(() => document.querySelectorAll("#csList input[type=checkbox]:checked").length);
  console.log(`     rows: ${rows}, ticked: ${ticked}`); flows[cur].rows = rows; flows[cur].ticked = ticked;
  await shot("A1-stations");
  const pinned = await pg.evaluate(() => document.getElementById("csStart").value !== "" && document.getElementById("csEnd").value !== "");
  if (!pinned) { await pg.click("#csAuto"); step("Auto order"); } else console.log("     (start / end picked from the end fittings, already in order)");
  await pg.click("#csUse"); await pg.waitForTimeout(200); step("Use as stations");
  if (await pg.evaluate(() => !document.getElementById("csAsk").hidden)) { await pg.click("#csYes"); step("Replace the example points"); }
  if (await expand("cdBox")) step("open “Keep clear of CAD parts”");
  const needD = await pg.evaluate(() => { const e = document.getElementById("cdD"); return e && !e.closest("[hidden]") && e.offsetParent !== null; });
  if (needD) { await pg.fill("#cdD", "12"); flows[cur].typedD++; step("Hose Ø 12 again"); }
  const needLoad = await pg.evaluate(() => { const e = document.getElementById("cdLoad"); return e && e.offsetParent !== null; });
  const haveParts = await pg.evaluate(() => typeof bcName === "function" && !!bcName());
  if (needLoad && !haveParts) { await pg.setInputFiles("#cdFile", ASM); flows[cur].loads++; await pg.waitForTimeout(6000); step("Load frame / parts file… (same file)"); }
  else if (haveParts) console.log("     (parts already loaded from the open assembly)");
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
  }

  // ---- F: Frame · pick in 3D, CSYS made here, Suggest extra clamps (samples/frame_asm.stp)
  const FRAME = S("frame_asm.stp");
  if (!fs.existsSync(FRAME)) console.log("\nF  skip: samples/frame_asm.stp not found");
  else {
    flow("F  Frame · pick, CSYS, suggestions");
    await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(800);
    await go("hose", "route"); step("Hose / Cable · Route through stations");
    await pg.setInputFiles("#shFile", FRAME); flows[cur].loads++;
    await until("shStatus", /^Opened in/, 60); await pg.waitForTimeout(3000); step("Open… frame_asm.stp", (await text("shStatus")).slice(0, 120));
    await pg.evaluate(() => { document.querySelectorAll(".taskpane, #panBend").forEach(e => e.scrollTop = 0); window.scrollTo(0, 0); });
    await shot("F1-header");
    // pick: what the 3D click would set, centred like the “show” button of CSYS made here
    const look = o => pg.evaluate(o => { orbit.target.set(...o); orbit.dist = Math.max(diag * 0.08, 150); draw(); }, o);
    const pickMsg = () => pg.evaluate(() => { const e = document.querySelector("#avPick"); return e && !e.hidden ? e.innerText.replace(/\s+/g, " ").trim() : "(no pick panel)"; });
    const act = async label => { await pg.click(`#avPick button:text-is("${label}")`); await pg.waitForTimeout(300); };
    const tidy = t => t.replace(/\s*×\s*/, " ").replace(/\s+/g, " ");
    await pg.click('#avCsys [data-v="fix"]'); step("CSYS = on holes");
    const pickCsys = async () => {
      const c = await pg.evaluate(() => { const c = (AV.shown || []).find(c => c.hole && !c.made); if (c) asmSetPick({ kind: "csys", c, inst: c.inst }); return c ? c.o : null; });
      if (c) await look(c); await pg.waitForTimeout(300); return c; };
    const picked = await pickCsys();
    step("asmSetPick() on a CSYS on a hole", picked ? (await pickMsg()).slice(0, 160) : "no CSYS on a hole");
    await shot("F2-pick-csys");
    if (await pg.evaluate(() => !(typeof bcName === "function" && bcName()))) {
      await pg.setInputFiles("#cdFile", FRAME); flows[cur].loads++; await pg.waitForTimeout(6000); step("Load frame / parts file… (same file)", (await text("statusCad")).slice(0, 120)); }
    else console.log("     (parts already loaded from the open assembly)");
    const part = await pg.evaluate(() => { const cad = bcCad(), r = ASM.r;
      const ii = r.instances.findIndex((I, i) => I.bbox && cad && cad.solids.some(s => s.inst === i));
      if (ii < 0) return null; const I = r.instances[ii], p = I.bbox.min.map((v, k) => (v + I.bbox.max[k]) / 2);
      asmSetPick({ kind: "part", inst: ii, p }); return p; });
    if (part) await look(part); await pg.waitForTimeout(300);
    const pm = await pickMsg();
    step("asmSetPick() on a frame part", part ? pm.slice(0, 200) : "no part with solids");
    console.log(`     Keep clear row: ${/Keep clear/.test(pm) ? "yes" : "no"}, Route passes it row: ${/Route passes it/.test(pm) ? "yes" : "no"}`);
    await shot("F3-pick-part");
    if (part) { await act("New CSYS here"); step("New CSYS here (part)", await pickMsg().then(t => (t.match(/\S+ made \(listed[^)]*\)\.?/) || [t.slice(-120)])[0])); }
    if (await pickCsys()) { await act("New CSYS here"); step("New CSYS here (CSYS on a hole)", await pickMsg().then(t => (t.match(/\S+ made \(listed[^)]*\)\.?/) || [t.slice(-120)])[0])); }
    await pg.click("#dCsys"); await pg.waitForTimeout(200); step("CSYS tab");
    console.log("     " + (await text("mkStatus")) + `  (CSYS made here: ${await text("mkN")}; header: ${await text("shAsm")})`);
    await shot("F4-csys-made");
    await pg.click("#dRad");
    await pg.evaluate(() => asmSetPick(null));
    // stations: tick the first 5 listed
    if (await expand("csBox")) step("open “Stations from clamps”");
    if (!(await pg.evaluate(() => document.querySelectorAll("#csList .csrow").length))) {
      await pg.setInputFiles("#csFile", FRAME); flows[cur].loads++; await until("statusCs", /station|fixing/, 30); step("Load assembly .stp… (again)"); }
    console.log("     " + (await text("statusCs")).slice(0, 160));
    const tk = await pg.evaluate(async () => { const bx = () => [...document.querySelectorAll("#csList .csrow input[type=checkbox]")], n = bx().length;
      for (let i = 0; i < n; i++) { const b = bx()[i]; if (b && b.checked !== i < 5) { b.click(); await new Promise(r => setTimeout(r, 20)); } }
      return [bx().length, document.querySelectorAll("#csList .csrow input[type=checkbox]:checked").length]; });
    flows[cur].rows = tk[0]; flows[cur].ticked = tk[1]; step(`tick ${tk[1]} of ${tk[0]} stations`, (await text("statusCs")).slice(0, 120));
    await pg.click("#csUse"); await pg.waitForTimeout(200); step("Use as stations");
    if (await pg.evaluate(() => !document.getElementById("csAsk").hidden)) { await pg.click("#csYes"); step("Replace the example points"); }
    await pg.click("#runBend"); const fchk = await until("statusBend", /^Added|No |Paste|cannot|can't/i, 90); step("Check, then add to comparison");
    console.log("     " + fchk.slice(0, 220));
    if (await expand("sgBox")) step("open “Suggest extra clamps”");
    await pg.click("#sgRun"); await pg.waitForTimeout(500); step("Suggest for the selected route", (await text("sgStatus")).slice(0, 200));
    console.log(`     suggestions: ${await pg.evaluate(() => document.querySelectorAll("#sgList tr[data-i]").length)}`);
    await pg.evaluate(() => { rebuild(true); document.getElementById("sgBox").scrollIntoView({ block: "start" }); }); await pg.waitForTimeout(500);
    await shot("F5-suggest");
    // a +n dot picked: its own panel
    if (await pg.evaluate(() => document.querySelectorAll("#sgList tr[data-i]").length)) {
      await pg.evaluate(() => asmSetPick({ kind: "suggest", i: 0 })); await pg.waitForTimeout(300); step("asmSetPick() on +1", (await pickMsg()).slice(0, 200));
      await shot("F5b-pick-suggest"); await pg.evaluate(() => asmSetPick(null)); }
    // F2 again, dark
    await pg.click("#shTheme"); await pg.waitForTimeout(300); step("Dark theme", await pg.evaluate(() => document.documentElement.dataset.theme));
    await pg.evaluate(() => { document.querySelectorAll(".taskpane, #panBend").forEach(e => e.scrollTop = 0); window.scrollTo(0, 0); });
    if (await pickCsys()) step("asmSetPick() on a CSYS on a hole", (await pickMsg()).slice(0, 160));
    await shot("F6-pick-dark");
    await pg.click("#shTheme"); await pg.evaluate(() => asmSetPick(null));
    // start and end picked in 3D: only the holes between them stay ticked
    const ends = await pg.evaluate(() => { const names = new Set([...document.querySelectorAll("#csList > .csrow b")].map(b => b.textContent.replace(/^S\d+ · /, "").trim()));
      const H = (AV.shown || []).filter(c => c.hole && !c.made && names.has(c.name)), d = (a, b) => Math.hypot(...[0, 1, 2].map(k => a.o[k] - b.o[k]));
      for (const a of H) { const b = H.find(b => d(a, b) > 500 && d(a, b) < 1500); if (b) return [a.name, b.name, Math.round(d(a, b))]; } return null; });
    if (ends) {
      const pickNamed = n => pg.evaluate(n => { const c = AV.shown.find(c => c.name === n && c.hole); asmSetPick({ kind: "csys", c, inst: c.inst }); }, n);
      await pickNamed(ends[0]); await act("Use as start"); step(`Use as start: ${ends[0]}`, await text("statusCs"));
      await pickNamed(ends[1]); await act("Use as end"); step(`Use as end: ${ends[1]} (${ends[2]} mm away)`, await text("statusCs"));
      const tk2 = await pg.evaluate(() => document.querySelectorAll("#csList .csrow input[type=checkbox]:checked").length);
      console.log(`     ticked now: ${tk2}`);
      await pg.evaluate(() => { asmSetPick(null); document.getElementById("csBox").scrollIntoView({ block: "start" }); });
      await shot("F7-start-end");
      await pg.click("#csPicked"); step("Only picked", await text("statusCs"));
      await pg.click("#csNone"); step("Untick all", await text("statusCs"));
    }
    // F8: the open solid 30 / solid 43 question (handoff/UI_PHASES.md). Solid 30 of the frame IGES is part 22648999 under
    // 23297378_ASM (box within 5 mm), solid 43 is 980464_AF54 (within 0.1 mm): pick each at its box centre and zoom to it
    for (const [name, under, shotName] of [["22648999", "23297378_ASM", "F8-solid30"], ["980464_AF54", "", "F8b-solid43"]]) {
      const got = await pg.evaluate(([name, under]) => { const r = ASM.r, ii = r.instances.findIndex(I => I.name === name && I.solids && (!under || I.label.includes(under)));
        if (ii < 0) return null;
        // box from the drawn outline of this instance (world coordinates, as on screen)
        const G = AV.geo, [k0, n] = G.ranges[ii], A = G.g.getAttribute("position").array, b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        for (let k = k0 * 6; k < (k0 + n) * 6; k++) { const j = k % 3; b.min[j] = Math.min(b.min[j], A[k]); b.max[j] = Math.max(b.max[j], A[k]); }
        const c = [0, 1, 2].map(k => (b.min[k] + b.max[k]) / 2), size = Math.max(...[0, 1, 2].map(k => b.max[k] - b.min[k]));
        AV.parts = true; asmSetPick({ kind: "part", inst: ii, p: c });
        orbit.target.set(...c); orbit.dist = Math.max(size * 4, 400); draw();
        return { label: r.instances[ii].label, c: c.map(v => Math.round(v)), size: Math.round(size) }; }, [name, under]);
      if (!got) { console.log(`     ${name}: not in the file`); continue; }
      await pg.waitForTimeout(400);
      step(`asmSetPick() on ${name} at its centre, zoomed`, `${got.label} · centre ${got.c.join(", ")} · ${(await pickMsg()).slice(0, 140)}`);
      await shot(shotName);
    }
    await pg.evaluate(() => asmSetPick(null));
  }

  console.log("\nSummary");
  for (const [k, f] of Object.entries(flows)) console.log(`  ${k.split(" ")[0]}: ${f.steps} steps, ${f.loads} file load(s), Hose Ø typed ${f.typedD}×, ${f.collapsed} collapsed section(s) opened, ${f.rows} clamp rows (${f.ticked} ticked)` +
    (f.alts != null ? `, route clashes: ${f.clash ? "yes" : "no"}, alternatives: ${f.alts}` : ""));
  if (errs.length) console.log("page errors:", errs);
  await b.close(); server.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
