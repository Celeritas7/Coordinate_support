// node tests/stations-ui.js — review findings 7–9 on the real page (samples/piping3_practice_asm.stp, samples/frame_asm.stp):
// a hand-made station order survives a later 3D click and an armed click's Undo; Remove while Change… is still reading
// (sniffing the file, then parsing it) stops that read, removes the assembly on the line and offers Undo.
// Needs Playwright + Chromium (as tests/ui-walk.js).
const fs=require("fs"),path=require("path"),http=require("http");const ROOT=path.join(__dirname,"..");
const missing=["piping3_practice_asm.stp","frame_asm.stp"].filter(f=>!fs.existsSync(path.join(ROOT,"samples",f)));
if(missing.length){console.log(`skip: samples/${missing.join(", samples/")} not found`);process.exit(0);}
let pw;for(const p of["playwright","/opt/node22/lib/node_modules/playwright"]){try{pw=require(p);break;}catch(e){}}
if(!pw){console.log("skip: playwright not installed");process.exit(0);}
const exe=process.env.PLAYWRIGHT_CHROMIUM||(fs.existsSync("/opt/pw-browsers/chromium")?"/opt/pw-browsers/chromium":undefined);
const server=http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{"Content-Type":{".html":"text/html",".js":"text/javascript",".css":"text/css"}[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(s);});
let fail=0;const check=(ok,m)=>{console.log((ok?"ok   ":"FAIL ")+m);if(!ok)fail++;};
(async()=>{await new Promise(r=>server.listen(0,r));const b=await pw.chromium.launch(exe?{executablePath:exe}:{});const pg=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];pg.on("pageerror",e=>errs.push(e.message));
 await pg.goto(`http://127.0.0.1:${server.address().port}/index.html`);await pg.evaluate(()=>localStorage.clear());await pg.reload();await pg.waitForTimeout(800);
 const txt=id=>pg.evaluate(i=>document.getElementById(i).textContent.replace(/\s+/g," ").trim(),id);
 const open=async f=>{await pg.setInputFiles("#shFile",ROOT+"/samples/"+f);for(let i=0;i<120;i++){if(/^Opened in/.test(await txt("shStatus")))break;await pg.waitForTimeout(500);}await pg.waitForTimeout(1500);};
 await open("piping3_practice_asm.stp");await pg.fill("#csD","12");await pg.dispatchEvent("#csD","change");await pg.waitForTimeout(500);
 const names=()=>pg.evaluate(()=>[...document.querySelectorAll("#csList .csrow")].filter(r=>r.querySelector("input:checked")).map(r=>r.querySelector("b").textContent.replace(/^S\d+ · /,"")+"@"+r.querySelector(".cspos").textContent));
 const o0=await names();console.log("     start:",o0.join(" | "));
 // strip.js updates once per frame (finding 10): the Stations card's summary still follows the list
 check(await txt("card2Line")==="S1 → S5 · 5 ticked",`Stations card summary: ${await txt("card2Line")}`);
 await pg.click("#csList input[type=checkbox]:checked");await pg.waitForTimeout(100);
 check(await txt("card2Line")==="S1 → S4 · 4 ticked",`a mouse click right after typing Hose Ø unticks the row (no rebuild on the blur's change); card: ${await txt("card2Line")}`);
 await pg.click('#csList .csrow.off input[type=checkbox]');await pg.waitForTimeout(100);
 // ---- 7: move the 4th row to 2nd with the keyboard
 await pg.focus('[data-grip="3"]');await pg.keyboard.press("ArrowUp");await pg.waitForTimeout(100);await pg.focus('[data-grip="2"]');await pg.keyboard.press("ArrowUp");await pg.waitForTimeout(300);
 const o1=await names();console.log("     hand :",o1.join(" | "));
 const se=await pg.evaluate(()=>[$("csStart").selectedOptions[0].textContent,$("csEnd").selectedOptions[0].textContent]);
 check(/^S1 /.test(se[0])&&/^S5 /.test(se[1]),`after a move, Start / End follow the list: ${se.join(" → ")}`);
 // a click in 3D on another CSYS: not armed, Add as station; the hand order of the others stays
 const picked=await pg.evaluate(()=>{const used=new Set([...document.querySelectorAll("#csList .cspos")].map(e=>e.textContent));const R=ASM.r,ii=R.instances.findIndex(I=>I.bbox&&I.solids&&!R.holes.some(h=>h.inst===R.instances.indexOf(I))&&Math.max(...[0,1,2].map(k=>I.bbox.max[k]-I.bbox.min[k]))<200);if(ii<0)return null;const I=R.instances[ii];asmSetPick({kind:"part",inst:ii,p:I.bbox.min.map((v,k)=>(v+I.bbox.max[k])/2)});return I.name;});
 await pg.waitForTimeout(300);const btns=await pg.evaluate(()=>[...document.querySelectorAll("#avPick button")].map(b=>b.textContent));
 check(!btns.includes("Undo"),`click on ${picked}: not taken as a start or end (buttons: ${btns.filter(t=>/Use as|Add as/.test(t)).join(", ")})`);
 await pg.click('#avPick button:text-is("Add as station")');await pg.waitForTimeout(300);
 const o2=await names();console.log("     added:",o2.join(" | "));
 check(JSON.stringify(o2.filter(x=>o1.includes(x)))===JSON.stringify(o1)&&o2.length===o1.length+1,"Add as station: the hand order of the other rows is kept");
 // Undo of an armed click puts back the hand order exactly
 await pg.selectOption("#csStart","");await pg.waitForTimeout(200);const o3=await names();
 await pg.evaluate(()=>{const R=ASM.r,L=R.instances.map((I,i)=>[I,i]).filter(([I,i])=>I.bbox&&I.solids&&!R.holes.some(h=>h.inst===i)&&Math.max(...[0,1,2].map(k=>I.bbox.max[k]-I.bbox.min[k]))<200),[I,ii]=L[1]||L[0];asmSetPick({kind:"part",inst:ii,p:I.bbox.min.map((v,k)=>(v+I.bbox.max[k])/2)});});await pg.waitForTimeout(300);
 const armedB=await pg.evaluate(()=>[...document.querySelectorAll("#avPick button")].some(b=>b.textContent==="Undo"));check(armedB,"Start emptied: the next click is armed (Undo offered)");
 await pg.click('#avPick button:text-is("Undo")');await pg.waitForTimeout(300);const o4=await names();
 check(JSON.stringify(o4)===JSON.stringify(o3),"Undo of the armed click: the hand order comes back as it was");
 await pg.evaluate(()=>asmSetPick(null));
 await pg.click("#csAuto");await pg.waitForTimeout(200);
 // ---- 8: Change… to the frame and Remove while it reads (the file is still being sniffed)
 await pg.setInputFiles("#shFile",ROOT+"/samples/frame_asm.stp");await pg.waitForTimeout(300);
 const line0=await txt("shAsmTxt");await pg.click("#shRemove");await pg.waitForTimeout(300);
 const st=await txt("shStatus");console.log("     line was: "+line0+" · status: "+st);
 check(/^Removed piping3_practice_asm\.stp \(stopped reading frame_asm\.stp\)\. Undo/.test(st),"Remove during Change…: says what was removed and which read stopped, with Undo");
 await pg.waitForTimeout(6000);check(/No assembly open/.test(await txt("shAsmTxt")),`the stopped read does not open later (${await txt("shAsmTxt")})`);
 // Undo is gone after 10 s; click it now (≈6.6 s)
 await pg.click("#shUndo");await pg.waitForTimeout(1500);
 check(/^piping3_practice_asm\.stp/.test(await txt("shAsmTxt"))&&(await pg.evaluate(()=>document.querySelectorAll("#csList .csrow").length))===5,`Undo: piping3 back with its 5 stations (${await txt("shAsmTxt")})`);
 // the same during the worker's parse (after the file was sniffed): "Reading frame_asm.stp, 20.3 MB: …"
 await pg.setInputFiles("#shFile",ROOT+"/samples/frame_asm.stp");
 for(let i=0;i<100;i++){if(/^Reading frame_asm\.stp, /.test(await txt("shStatus")))break;await pg.waitForTimeout(100);}
 console.log("     at Remove: "+(await txt("shStatus")).slice(0,80));
 await pg.click("#shRemove");await pg.waitForTimeout(300);const st2=await txt("shStatus");
 check(/^Removed piping3_practice_asm\.stp \(stopped reading frame_asm\.stp\)\. Undo/.test(st2),"Remove during the parse: "+st2);
 await pg.waitForTimeout(6000);check(/No assembly open/.test(await txt("shAsmTxt")),"the stopped parse does not open later");
 await pg.click("#shUndo");await pg.waitForTimeout(1500);check(/^piping3_practice_asm\.stp/.test(await txt("shAsmTxt")),"Undo: piping3 back");
 check(!errs.length,"no page errors "+errs.join("; "));
 await b.close();server.close();process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
