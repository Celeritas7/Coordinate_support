// node tests/big-asm.js [copies=8] — Q4 outline budget on a big assembly: frame_asm.stp copied N times into one STEP (ids
// renumbered, copy k moved +3 m in X per copy; copy 0 stays where route_343434's stations are), written to the OS temp
// folder and opened in Chromium. Past the budget only the parts near the route get full outlines, the rest their box;
// Alternatives on P1–P6 still gives the clean 679 mm route. Needs Playwright + Chromium, samples/frame_asm.stp and
// samples/route_343434_R65.pts. About 2 minutes with 8 copies (164 MB).
const fs=require("fs"),os=require("os"),path=require("path"),http=require("http");
const ROOT=path.join(__dirname,".."),S=f=>path.join(ROOT,"samples",f);
const missing=["frame_asm.stp","route_343434_R65.pts"].filter(f=>!fs.existsSync(S(f)));
if(missing.length){console.log(`skip: samples/${missing.join(", samples/")} not found`);process.exit(0);}
let pw;for(const p of["playwright","/opt/node22/lib/node_modules/playwright"]){try{pw=require(p);break;}catch(e){}}
if(!pw){console.log("skip: playwright not installed");process.exit(0);}
const exe=process.env.PLAYWRIGHT_CHROMIUM||(fs.existsSync("/opt/pw-browsers/chromium")?"/opt/pw-browsers/chromium":undefined);
const N=+process.argv[2]||8,BIG=path.join(os.tmpdir(),`frame_x${N}.stp`);
let fail=0;const check=(ok,m)=>{console.log((ok?"ok   ":"FAIL ")+m);if(!ok)fail++;};
// N copies, streamed: the whole text never sits in memory N times
if(!fs.existsSync(BIG)){const t=fs.readFileSync(S("frame_asm.stp"),"latin1"),i=t.indexOf("DATA;")+5,j=t.lastIndexOf("ENDSEC;"),head=t.slice(0,i),data=t.slice(i,j);
  let M=0;for(const m of data.matchAll(/^#(\d+)=/gm))M=Math.max(M,+m[1]);M++;
  const fd=fs.openSync(BIG,"w");fs.writeSync(fd,head);
  for(let k=0;k<N;k++)fs.writeSync(fd,k?data.replace(/#(\d+)/g,(_,n)=>"#"+(+n+k*M)).replace(/(CARTESIAN_POINT\('[^']*',\()([^,]+)/g,(_,a,x)=>a+(parseFloat(x)+k*3000)):data);
  fs.writeSync(fd,"ENDSEC;\nEND-ISO-10303-21;\n");fs.closeSync(fd);}
const rows=fs.readFileSync(S("route_343434_R65.pts"),"utf8").split("\n").filter(l=>/^\s*-?\d/.test(l)).map(l=>l.trim().split(/\s+/).map(Number));
const P=[1,9,15,20,23,26].map(r=>rows[r-1]);
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"};
const server=http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(s);});
(async()=>{await new Promise(r=>server.listen(0,r));
  const b=await pw.chromium.launch(exe?{executablePath:exe}:{}),pg=await b.newPage({viewport:{width:1600,height:1000}}),errs=[];pg.setDefaultTimeout(600000);
  pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto(`http://127.0.0.1:${server.address().port}/index.html`);await pg.evaluate(()=>localStorage.clear());await pg.reload();await pg.waitForTimeout(800);
  const text=id=>pg.evaluate(i=>document.getElementById(i).textContent.replace(/\s+/g," ").trim(),id);
  const until=async(id,re,s)=>{for(let i=0;i<s*4;i++){const t=await text(id);if(re.test(t))return t;await pg.waitForTimeout(250);}return text(id);};
  await pg.evaluate(()=>{window.__gap=0;let t=performance.now();const tick=()=>{const n=performance.now();if(n-t>window.__gap)window.__gap=n-t;t=n;setTimeout(tick,20);};tick();});
  const t0=Date.now();await pg.setInputFiles("#shFile",BIG);const st=await until("shStatus",/^Opened in|could not/,900);await pg.waitForTimeout(4000);
  console.log(`     ${path.basename(BIG)} ${(fs.statSync(BIG).size/1e6).toFixed(0)} MB: ${st.slice(0,140)} (${((Date.now()-t0)/1000).toFixed(0)} s)`);
  check(/Big assembly: full outlines for the \d+ parts? near the route, boxes for the other \d+/.test(st),"the status line says the outlines are budgeted");
  // the route: route_343434 P1–P6 typed (the station list is unticked by typing)
  await pg.evaluate(t=>{$("ptsBox").open=true;const p=$("pts");p.value=t;p.dispatchEvent(new Event("input",{bubbles:true}));},P.map(p=>p.join(" ")).join("\n"));
  await pg.waitForTimeout(3000);
  const g=await pg.evaluate(P=>{const G=AV.geo,r=ASM.r,near=(b,d)=>P.some(p=>[0,1,2].every(k=>p[k]>=b.min[k]-d&&p[k]<=b.max[k]+d));
    const full=r.instances.map((I,ii)=>G.ranges[ii]&&G.ranges[ii][1]>12);
    const at=r.instances.map((I,ii)=>[I,ii]).filter(([I])=>I.bbox&&I.solids&&near(I.bbox,0));
    const far=r.instances.map((I,ii)=>[I,ii]).filter(([I])=>I.bbox&&I.solids&&!near(I.bbox,3000));
    return{n:G.n,full:G.full,atFull:at.filter(([,ii])=>full[ii]).length,at:at.length,farBox:far.filter(([,ii])=>G.ranges[ii][1]===12).length,far:far.length};},P);
  console.log(`     ${g.n} outline segments; ${g.full} parts in full; at the stations ${g.atFull} of ${g.at} in full; far away ${g.farBox} of ${g.far} as boxes`);
  check(g.n<=4e6+12*20000,"outlines within the budget (4 M segments, plus 12 per boxed part)");
  check(g.at>0&&g.atFull===g.at,"every part at the stations is drawn in full");
  check(g.far>0&&g.farBox===g.far,"every part 3 m or more from the route is drawn as its box");
  await pg.click("#runAlt");await until("statusAlt",/distinct|No clean|Forced|No obstacles|No route/,600);
  const c=await pg.evaluate(()=>[...document.querySelectorAll("#altList .altrow")].map(c=>c.innerText.replace(/\s+/g," ")));
  check(c.length===1&&/^direct 679 mm · min R 97 · gap 12\.0 mm/.test(c[0]),`Alternatives P1–P6 on copy 0: ${c.join(" | ")}`);
  const gap=await pg.evaluate(()=>window.__gap);console.log(`     longest freeze ${(gap/1000).toFixed(1)} s`);
  check(gap<30000,"no freeze of 30 s or more");
  check(!errs.length,`no page errors${errs.length?": "+errs.join("; "):""}`);
  await b.close();server.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
