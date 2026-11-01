// node tests/version-ui.js — the "newer version" notice (shell.js): hidden while version.json has the page's own build,
// shown with a Reload button when the server has a newer one. Needs Playwright + Chromium (as tests/ui-walk.js).
const fs=require("fs"),path=require("path"),http=require("http");const ROOT=path.join(__dirname,"..");
let pw;for(const p of["playwright","/opt/node22/lib/node_modules/playwright"]){try{pw=require(p);break;}catch(e){}}
if(!pw){console.log("skip: playwright not installed");process.exit(0);}
const exe=process.env.PLAYWRIGHT_CHROMIUM||(fs.existsSync("/opt/pw-browsers/chromium")?"/opt/pw-browsers/chromium":undefined);
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json"};
let fake=null;   // a build version.json answers with instead of the file's
const server=http.createServer((q,s)=>{const u=q.url.split("?")[0],f=path.join(ROOT,decodeURIComponent(u));
  if(u==="/version.json"&&fake){s.writeHead(200,{"Content-Type":"application/json"});return s.end(JSON.stringify({build:fake}));}
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(s);});
let fail=0;const check=(ok,m)=>{console.log((ok?"ok   ":"FAIL ")+m);if(!ok)fail++;};
(async()=>{await new Promise(r=>server.listen(0,r));const b=await pw.chromium.launch(exe?{executablePath:exe}:{});const pg=await b.newPage();const errs=[];pg.on("pageerror",e=>errs.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/index.html`,mine=JSON.parse(fs.readFileSync(path.join(ROOT,"version.json"),"utf8")).build;
 await pg.goto(url);await pg.waitForTimeout(3800);
 check(await pg.evaluate(()=>document.querySelector('meta[name="app-build"]').content)===mine,`the page carries its build (${mine})`);
 check(await pg.isHidden("#shNew"),"same build on the server: no notice");
 fake="0000beef";await pg.reload();await pg.waitForTimeout(3800);
 check(await pg.isVisible("#shNew")&&/A newer version of Route Studio is out/.test(await pg.textContent("#shNew")),"newer build on the server: the notice shows, with Reload");
 fake=null;await pg.click("#shNewGo");await pg.waitForTimeout(3800);
 check(await pg.isHidden("#shNew"),"Reload loads the page again (same build now: no notice)");
 check(!errs.length,"no page errors"+(errs.length?": "+errs.join(" | "):""));
 await b.close();server.close();console.log(fail?`${fail} failed`:"all passed");process.exit(fail?1:0);})().catch(e=>{console.error(e);process.exit(1);});
