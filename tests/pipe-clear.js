// node tests/pipe-clear.js — Phase 6: clearance to parts on Pipe · Route through points and Pipe · Through clamps, on the
// real page with samples/pipe_clear_test.stp (made by tests/make-pipe-sample.js when missing): the Keep clear list moves into
// the task on show, both pipe routes report Clash into BLOCK_1 (3 mm), the clamp counts as a clamp (not kept clear),
// unticking BLOCK_1 gives Clear, and the Clearance tab lists the places. Needs Playwright + Chromium (as tests/ui-walk.js).
const fs=require("fs"),path=require("path"),http=require("http");const ROOT=path.join(__dirname,"..");
const SAMPLE=path.join(ROOT,"samples/pipe_clear_test.stp");
if(!fs.existsSync(SAMPLE)){fs.mkdirSync(path.dirname(SAMPLE),{recursive:true});fs.writeFileSync(SAMPLE,require("./make-pipe-sample.js").makePipeSample());}
let pw;for(const p of["playwright","/opt/node22/lib/node_modules/playwright"]){try{pw=require(p);break;}catch(e){}}
if(!pw){console.log("skip: playwright not installed");process.exit(0);}
const exe=process.env.PLAYWRIGHT_CHROMIUM||(fs.existsSync("/opt/pw-browsers/chromium")?"/opt/pw-browsers/chromium":undefined);
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".stp":"text/plain"};
const server=http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(s);});
let fail=0;const check=(ok,m)=>{console.log((ok?"ok   ":"FAIL ")+m);if(!ok)fail++;};
(async()=>{await new Promise(r=>server.listen(0,r));const b=await pw.chromium.launch(exe?{executablePath:exe}:{});const pg=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
 await pg.goto(`http://127.0.0.1:${server.address().port}/index.html`);await pg.evaluate(()=>localStorage.clear());await pg.reload();await pg.waitForTimeout(800);
 const txt=id=>pg.evaluate(i=>document.getElementById(i).textContent.replace(/\s+/g," ").trim(),id);
 const task=async(mod,t)=>{await pg.click(`.modsw button[data-mod="${mod}"]`);await pg.click(`#tasks button[data-task="${t}"]`);await pg.waitForTimeout(300);};
 const host=()=>pg.evaluate(()=>$("cdBox").parentNode.id);
 const rows=()=>pg.evaluate(()=>{dock="clr";showPane();return[...document.querySelectorAll("#clrList tbody tr")].map(r=>[r.className,...[...r.cells].map(c=>c.textContent.replace(/\s+/g," ").trim())]);});
 const listed=()=>pg.evaluate(()=>[...document.querySelectorAll("#cdParts .cdrow")].map(r=>(r.querySelector("input").checked?"[x] ":"[ ] ")+r.textContent.replace(/\s+/g," ").trim()));
 await pg.setInputFiles("#shFile",SAMPLE);for(let i=0;i<60;i++){if(/^Opened in/.test(await txt("shStatus")))break;await pg.waitForTimeout(250);}await pg.waitForTimeout(800);
 check(await host()==="cdHome","Hose · Route through stations: the Keep clear list is in the Load card");

 // ---- Pipe · Route through points: lines + arcs through 4 stations along the pipe; the second straight runs into BLOCK_1
 await task("pipe","route");
 check(await host()==="arcKeep"&&await pg.isVisible("#cdBox"),"Route through points: the list is shown above Solve");
 await pg.evaluate(()=>{$("cdBox").open=true;});
 check(await pg.isVisible("#cdD")&&/^Pipe OD/.test(await txt("cdDLbl")),`Pipe OD field shown (${await txt("cdDLbl")})`);
 await pg.fill("#cdD","12");await pg.dispatchEvent("#cdD","change");await pg.click("#advTog");check(await pg.isVisible("#cdGap"),"Gap shown for the pipe (Advanced)");await pg.fill("#r","50");await pg.dispatchEvent("#r","change");
 await pg.fill("#pts","0 0 0\n250 0 0\n350 100 0\n350 400 0");await pg.dispatchEvent("#pts","change");await pg.waitForTimeout(300);
;let L;
 L=await listed();console.log("     list: "+L.join("\n           "));
 check(L.some(x=>/^\[x\] BLOCK_1/.test(x))&&L.some(x=>/^\[ \] PIPE_A .*existing pipe/.test(x))&&L.some(x=>/^\[ \] CLAMP_1/.test(x)),"BLOCK_1 kept clear; the existing pipe and the clamp are not");
 await pg.click("#runBend");for(let i=0;i<40;i++){if(/Clash:|Clear:|Close:|No lines/.test(await txt("statusBend")))break;await pg.waitForTimeout(250);}
 let st=await txt("statusBend");console.log("     "+st.slice(0,260));
 check(/^Clash: pipe 3\.0 mm into BLOCK_1 between P3 and P4/.test(st),"Route through points: Clash, 3.0 mm into BLOCK_1 between P3 and P4");
 let R=await rows();console.log("     rows: "+R.map(r=>r.join(" | ")).join("\n           "));
 check(R.some(r=>r[0]==="bad"&&r[2]==="BLOCK_1"&&r[3]==="−3.0 mm"),"Clearance tab: BLOCK_1 −3.0 mm, red");
 check(R.some(r=>r[0]===""&&r[2]==="CLAMP_1"&&/not counted/.test(r[4])),"Clearance tab: CLAMP_1 listed, not counted (unticked)");
 check(/^Clearance \(1\)$/.test(await txt("dClr")),`tab label: ${await txt("dClr")}`);
 check(/Clash: 3\.0 mm into BLOCK_1/.test(await txt("readout")),`3D readout: ${(await txt("readout")).slice(0,90)}`);

 // ---- Pipe · Through clamps: the clamp on the pipe ticked, route; the route keeps the second straight
 await task("pipe","clamps");
 check(await host()==="thKeep","Through clamps: the list moves under the clamp settings");
 // the clamp with a CSYS comes ticked; tick it if not
 if(!(await pg.isChecked('#thClamps input[type=checkbox]'))){await pg.click('#thClamps input[type=checkbox]');await pg.waitForTimeout(300);}
 L=await listed();console.log("     list: "+L.join("\n           "));
 check(L.some(x=>/^\[ \] CLAMP_1 .*clip at CLAMP_1/.test(x)),"the ticked clamp is a station of the survey (clip at CLAMP_1, not kept clear)");
 check(L.some(x=>/^\[x\] BLOCK_1/.test(x)),"BLOCK_1 kept clear here too (same ticks)");
 await pg.click("#thRun");for(let i=0;i<40;i++){if(/Clash:|Clear:|Close:|No route/.test(await txt("statusThrough")))break;await pg.waitForTimeout(250);}
 st=await txt("statusThrough");console.log("     "+st.slice(0,300));
 check(/^Clash: pipe 3\.0 mm into BLOCK_1/.test(st)&&/now runs straight through 1 clamp/.test(st),"Through clamps: routed through the clamp, Clash 3.0 mm into BLOCK_1");
 R=await rows();console.log("     rows: "+R.map(r=>r.join(" | ")).join("\n           "));
 check(R.some(r=>r[0]==="bad"&&r[2]==="BLOCK_1")&&!R.some(r=>r[2]==="CLAMP_1"&&r[0]),"Clearance tab: BLOCK_1 red; the clamp it runs through is not a clash");
 const th=await txt("thOut");check(/Clearance: gap 4(\.0)? mm to 1 kept-clear part, smallest gap −3\.0 mm/.test(th),"the Through report says what was checked: "+(th.match(/Clearance:[^.]*/)||[""])[0]);
 // untick BLOCK_1 and route again: Clear
 await pg.evaluate(()=>{const i=[...document.querySelectorAll("#cdParts .cdrow")].find(r=>/BLOCK_1/.test(r.textContent)).querySelector("input");i.click();});
 await pg.click("#thRun");await pg.waitForTimeout(800);st=await txt("statusThrough");console.log("     "+st.slice(0,200));
 check(/^Clear: no part kept clear of/.test(st),"BLOCK_1 unticked: Clear");

 // ---- back to Hose: the list goes home, Hose Ø hidden again; Check on the same stations still reports in hose words
 await pg.evaluate(()=>{const i=[...document.querySelectorAll("#cdParts .cdrow")].find(r=>/BLOCK_1/.test(r.textContent)).querySelector("input");i.click();});
 await task("hose","route");
 check(await host()==="cdHome"&&!(await pg.isVisible("#cdD")),"Hose: the list is back in the Load card, Pipe OD hidden");
 await pg.evaluate(()=>{$("pts").value="0 0 0\n250 0 0\n350 100 0\n350 400 0";$("pts").dispatchEvent(new Event("change"));});await pg.waitForTimeout(200);
 await pg.click("#runBend");for(let i=0;i<120;i++){if(/Clash:|Clear:|Close:|Too tight:/.test(await txt("statusBend")))break;await pg.waitForTimeout(250);}
 st=await txt("statusBend");console.log("     "+st.slice(0,200));
 check(/BLOCK_1/.test(st)&&/^(Clash|Close|Too tight):/.test(st)&&!/\bpipe \d/.test(st),"Hose Check: BLOCK_1 reported, hose wording");
 L=await listed();check(L.length&&/Gap = hose surface/.test(await txt("cdParts")),"Hose list says hose surface");
 check(!errs.length,"no page errors"+(errs.length?": "+errs.join(" | "):""));
 await b.close();server.close();console.log(fail?`${fail} failed`:"all passed");process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
