// node tests/projects-ui.js — Projects and Home (js/projects.js) in Chromium, on the generated pipe sample (and piping3's
// Hose stations when samples/piping3_practice_asm.stp is there):
//  1. no projects: the app opens straight to work; opening an assembly starts a project named after it
//  2. work (Route through points with a route, a Keep clear choice, fields), reload: Home lists it with a summary
//  3. Open: the fields, task and route come back at once; the CAD file is asked for (no handle in this browser) and, once
//     opened, the Keep clear choice by part name; piping3: an unticked Hose station stays unticked
//  4. Similar job: a new project with the settings and the Keep clear choice, no routes; Export / Import; Delete; ?home=0
// The file picker is taken away (headless): Open… falls back to the file input, as in a browser without it.
const fs=require("fs"),path=require("path"),http=require("http"),os=require("os");const ROOT=path.join(__dirname,"..");
let pw;for(const p of["playwright","/opt/node22/lib/node_modules/playwright"]){try{pw=require(p);break;}catch(e){}}
if(!pw){console.log("skip: playwright not installed");process.exit(0);}
const exe=process.env.PLAYWRIGHT_CHROMIUM||(fs.existsSync("/opt/pw-browsers/chromium")?"/opt/pw-browsers/chromium":undefined);
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),"rs-proj-")),SAMPLE=path.join(TMP,"pipe_clear_test.stp");fs.writeFileSync(SAMPLE,require("./make-pipe-sample.js").makePipeSample());
const P3=path.join(ROOT,"samples/piping3_practice_asm.stp");
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".woff2":"font/woff2"};
const server=http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(s);});
let fail=0;const check=(ok,m)=>{console.log((ok?"ok   ":"FAIL ")+m);if(!ok)fail++;};
(async()=>{await new Promise(r=>server.listen(0,r));const URL=`http://127.0.0.1:${server.address().port}/index.html`;
 const b=await pw.chromium.launch(exe?{executablePath:exe}:{});const ctx=await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true}),pg=await ctx.newPage();
 const errs=[];pg.on("pageerror",e=>errs.push(e.message));pg.on("dialog",d=>d.accept(d.type()==="prompt"?"Renamed job":undefined));
 await ctx.addInitScript(()=>{delete window.showOpenFilePicker;});
 const txt=id=>pg.evaluate(i=>document.getElementById(i).textContent.replace(/\s+/g," ").trim(),id);
 const task=async(m,t)=>{await pg.click(`.modsw button[data-mod="${m}"]`);await pg.click(`#tasks button[data-task="${t}"]`);await pg.waitForTimeout(300);};
 const openFile=async f=>{await pg.setInputFiles("#shFile",f);for(let i=0;i<80;i++){if(/Opened in|back:|could not/.test(await txt("shStatus")))break;await pg.waitForTimeout(250);}await pg.waitForTimeout(600);};
 const listed=()=>pg.evaluate(()=>[...document.querySelectorAll("#cdParts .cdrow")].map(r=>(r.querySelector("input").checked?"[x] ":"[ ] ")+r.querySelector("b").textContent));
 const cards=()=>pg.evaluate(()=>[...document.querySelectorAll("#hmList .hmcard")].map(c=>c.textContent.replace(/\s+/g," ").trim()));
 await pg.goto(URL);await pg.waitForTimeout(900);
 check(await pg.isHidden("#home"),"no projects yet: straight to work, no Home");
 // ---- 1 + 2: an assembly opened starts a project; some work
 await openFile(SAMPLE);await task("pipe","route");
 check(/^Project pipe_clear_test/.test(await txt("shProj")),`a project named after the file: ${await txt("shProj")}`);
 await pg.evaluate(()=>{$("cdBox").open=true;});await pg.click("#advTog");await pg.fill("#r","50");await pg.dispatchEvent("#r","change");await pg.fill("#cdD","12");await pg.dispatchEvent("#cdD","change");
 await pg.fill("#pts","0 0 0\n250 0 0\n350 100 0\n350 300 0\n450 400 0\n650 400 0");await pg.dispatchEvent("#pts","change");await pg.waitForTimeout(300);
 await pg.evaluate(()=>{$("cdBox").open=true;});
 await pg.evaluate(()=>{const i=[...document.querySelectorAll("#cdParts .cdrow")].find(r=>/BLOCK_1/.test(r.textContent)).querySelector("input");i.click();});
 await pg.click("#runBend");for(let i=0;i<40;i++){if(/^(Clear|Close|Clash):/.test(await txt("statusBend")))break;await pg.waitForTimeout(250);}
 check(/^Clear:/.test(await txt("statusBend")),`BLOCK_1 unticked by hand, Solve: ${(await txt("statusBend")).slice(0,60)}`);
 await pg.waitForTimeout(3600);   // autosave
 // ---- reload: Home with the project
 await pg.reload();await pg.waitForTimeout(1200);
 let C=await cards();console.log("     home: "+C.join(" | "));
 check(await pg.isVisible("#home")&&C.length===1&&/pipe_clear_test/.test(C[0])&&/pipe_clear_test\.stp/.test(C[0])&&/1 route/.test(C[0])&&/R 50/.test(C[0])&&/Keep clear choice/.test(C[0]),"reload: Home lists the project (file, 1 route, R 50, a Keep clear choice)");
 // ---- 3: Open
 await pg.click('#hmList .hmcard button[data-a="open"]');await pg.waitForTimeout(500);
 check(await pg.isHidden("#home"),"Open: back to work");
 check(await pg.evaluate(()=>$("r").value)==="50"&&await pg.evaluate(()=>$("shape").value)==="arc",`fields and task back (Min R ${await pg.evaluate(()=>$("r").value)}, Pipe · Route through points)`);
 check(await pg.evaluate(()=>runs.some(r=>/\(saved\)$/.test(r.name)&&r.kind==="arc")),`the route back: ${await pg.evaluate(()=>runs.map(r=>r.name).join(", "))}`);
 check(/open pipe_clear_test\.stp/.test(await txt("shStatus")),`asks for the CAD file: ${await txt("shStatus")}`);
 await openFile(SAMPLE);
 check(/^Project “pipe_clear_test” back: 1 route/.test(await txt("shStatus")),`file opened: ${await txt("shStatus")}`);
 await pg.evaluate(()=>{$("cdBox").open=true;});let L=await listed();
 check(L.includes("[ ] BLOCK_1")&&L.includes("[x] PIPE_B"),`Keep clear choice back by part name: ${L.join(", ")}`);
 if(fs.existsSync(P3)){   // Hose stations of piping3: untick one, come back to it
   await task("hose","route");await openFile(P3);await pg.fill("#csD","12");await pg.dispatchEvent("#csD","change");await pg.waitForTimeout(800);
   const before=await pg.evaluate(()=>[...document.querySelectorAll("#csList .csrow")].length);
   await pg.click("#csList .csrow:nth-child(3) input[type=checkbox]");await pg.waitForTimeout(300);
   const want=await pg.evaluate(()=>[...document.querySelectorAll("#csList .csrow")].map(r=>r.querySelector("input").checked));
   await pg.waitForTimeout(3600);await pg.reload();await pg.waitForTimeout(1200);
   const c3=(await cards()).findIndex(c=>/piping3_practice_asm/.test(c));check(c3>=0,"piping3 is its own project (another assembly: a new job)");
   await pg.click(`#hmList .hmcard:nth-child(${c3+1}) button[data-a="open"]`);await pg.waitForTimeout(400);await openFile(P3);await pg.waitForTimeout(1200);
   const got=await pg.evaluate(()=>[...document.querySelectorAll("#csList .csrow")].map(r=>r.querySelector("input").checked));
   check(before>=5&&JSON.stringify(got)===JSON.stringify(want),`Hose stations back as left (${got.map(x=>x?"x":"-").join("")}), Hose Ø ${await pg.evaluate(()=>$("csD").value)}`);
 }
 // ---- 4: Similar job, Export / Import, Rename, Delete
 await pg.click("#shHome");await pg.waitForTimeout(500);C=await cards();const n0=C.length;
 const ci=C.findIndex(c=>/pipe_clear_test/.test(c));
 await pg.click(`#hmList .hmcard:nth-child(${ci+1}) button[data-a="similar"]`);for(let i=0;i<40&&!/^Similar job/.test(await txt("shStatus"));i++)await pg.waitForTimeout(100);
 check(/Similar job “pipe_clear_test \(similar\)”: settings and Keep clear choices taken from “pipe_clear_test”/.test(await txt("shStatus"))&&!(await pg.evaluate(()=>runs.some(r=>r.saved))),`Similar job: ${await txt("shStatus")}; routes on screen: ${await pg.evaluate(()=>runs.map(r=>r.name+(r.saved?"*":"")).join(", "))}`);
 await openFile(SAMPLE);await task("pipe","route");await pg.evaluate(()=>{$("cdBox").open=true;});
 await pg.fill("#pts","0 0 0\n250 0 0\n350 100 0\n350 300 0\n450 400 0\n650 400 0");await pg.dispatchEvent("#pts","change");await pg.waitForTimeout(300);L=await listed();
 check(await pg.evaluate(()=>$("r").value)==="50"&&L.includes("[ ] BLOCK_1"),`the new assembly gets the settings (R ${await pg.evaluate(()=>$("r").value)}) and Keep clear (${L.join(", ")})`);
 await pg.waitForTimeout(3600);await pg.click("#shHome");await pg.waitForTimeout(500);C=await cards();
 check(C.length===n0+1,`Home: ${C.length} projects (one more)`);
 const [dl]=await Promise.all([pg.waitForEvent("download"),pg.click('#hmList .hmcard:nth-child(1) button[data-a="export"]')]);
 const fp=path.join(TMP,"exported.json");await dl.saveAs(fp);const J=JSON.parse(fs.readFileSync(fp,"utf8"));
 check(J.format==="route-studio-project"&&J.project&&J.project.fields&&!("handle" in J.project),`Export: ${dl.suggestedFilename()} (${fs.statSync(fp).size} bytes, no file handle)`);
 await pg.setInputFiles("#hmFile",fp);await pg.waitForTimeout(600);C=await cards();
 check(C.length===n0+2&&/Imported/.test(await txt("hmStatus")),`Import: ${await txt("hmStatus")}`);
 await pg.click('#hmList .hmcard:nth-child(1) button[data-a="rename"]');await pg.waitForTimeout(400);
 check((await cards())[0].startsWith("Renamed job"),"Rename");
 await pg.click('#hmList .hmcard:nth-child(1) button[data-a="delete"]');await pg.waitForTimeout(400);
 check((await cards()).length===n0+1&&/Deleted/.test(await txt("hmStatus")),`Delete: ${await txt("hmStatus")}`);
 await pg.goto(URL+"?home=0");await pg.waitForTimeout(900);check(await pg.isHidden("#home"),"?home=0: no Home on start");
 check(!errs.length,"no page errors"+(errs.length?": "+errs.join(" | "):""));
 await b.close();server.close();fs.rmSync(TMP,{recursive:true,force:true});console.log(fail?`${fail} failed`:"all passed");process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
