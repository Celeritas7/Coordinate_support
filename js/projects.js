// ---------------- Projects and Home ----------------
// Loaded last. A project is what the user decided, not the CAD file: settings (the fields of the Route and Pipe panels),
// module and task, station points, the Hose station list (names and places), Keep clear choices by part name, the picked
// pipe, the routes, and the name (and, in Chrome / Edge, a remembered handle) of the CAD file. Kept in this browser
// (IndexedDB, as the user works: a snapshot every few seconds when something changed) and exported / imported as a small
// .json file. Home lists them: Open (settings and routes back, the CAD file opened again, then stations, Keep clear and the
// pipe), Similar job (a new project with the settings and Keep clear choices only, for a new assembly), Export, Rename,
// Delete. Opening an assembly with no project open starts one named after the file. Home shows on start when there are
// projects (?home=0 skips it).
{
const DBN='route-studio',ST='projects',FMT='route-studio-project',SAVE_MS=3000;
const PJ={cur:null,list:[],last:'',restoring:false,handles:new Map(),pending:null};
const fmtDate=t=>{const d=new Date(t);return d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});};
const base=n=>String(n||'').replace(/\.[^.]+$/,'');
// ---- storage: IndexedDB, or localStorage where it is not available
let dbP=null;
const db=()=>dbP||(dbP=new Promise((ok,bad)=>{if(!window.indexedDB)return bad(new Error('no IndexedDB'));const q=indexedDB.open(DBN,1);
  q.onupgradeneeded=()=>q.result.createObjectStore(ST,{keyPath:'id'});q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error);}));
const tx=(mode,fn)=>db().then(d=>new Promise((ok,bad)=>{const t=d.transaction(ST,mode),s=t.objectStore(ST),r=fn(s);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>bad(t.error);}));
const LS='rs.projects',lsAll=()=>{try{return JSON.parse(localStorage.getItem(LS)||'[]');}catch(e){return[];}},lsPut=a=>{try{localStorage.setItem(LS,JSON.stringify(a));}catch(e){}};
const all=()=>tx('readonly',s=>s.getAll()).catch(()=>lsAll());
const put=p=>tx('readwrite',s=>s.put(p)).catch(()=>{const a=lsAll().filter(x=>x.id!==p.id);const{handle,...rest}=p;a.push(rest);lsPut(a);});
const del=id=>tx('readwrite',s=>s.delete(id)).catch(()=>lsPut(lsAll().filter(x=>x.id!==id)));
// ---- what a project holds
const SKIP=new Set(['csStart','csEnd','thPipe','thFrame','ofFixed','ofFollow','shape']);
function fields(){const o={};document.querySelectorAll('#panBend input,#panBend select,#panPipe input,#panPipe select,#panClear input').forEach(el=>{
  if(!el.id||SKIP.has(el.id)||el.type==='file'||el.type==='button')return;o[el.id]=el.type==='checkbox'?el.checked:el.value;});return o;}
function setFields(o){Object.entries(o||{}).forEach(([id,v])=>{const el=document.getElementById(id);if(!el||SKIP.has(id))return;
  if(el.type==='checkbox'){if(el.checked!==!!v){el.checked=!!v;el.dispatchEvent(new Event('change'));}}
  else if(el.value!==String(v)){el.value=v;el.dispatchEvent(new Event('change'));}});}
const shellState=()=>{try{return JSON.parse(store.get('rs.shell')||'null')||{};}catch(e){return{};}};
// routes worth keeping: not the ones an assembly brings itself (its pipes, as read)
const keepRun=r=>r.Q&&r.Q.length>1&&!(r.asm&&!r.through&&!r.cmp&&!r.offset);
const runOut=r=>({name:r.name,kind:r.kind,kindLabel:r.kindLabel,through:!!r.through,Q:r.Q.map(q=>q.map(v=>Math.round(v*1000)/1000)),params:r.params||{},text:r.text||'',settings:r.settings||'',tidx:r.tidx||null});
function snapshot(){const sh=shellState(),pi=ASM&&ASM.r?+$('thPipe').value||0:null;
  return{fields:fields(),mod:sh.mod||'hose',task:sh.task||{},pts:$('pts').value,csDirs:$('csDirs').value,keep:typeof bcKeepState==='function'?bcKeepState():{},
    stations:typeof csState==='function'?csState():null,pipe:pi!=null&&ASM.r.pipes[pi]?ASM.r.pipes[pi].name:null,runs:runs.filter(keepRun).map(runOut)};}
// a saved route back as a run: lines + arcs (single radius) for pipe routes, the spline through its points otherwise
function runIn(s){const arc=s.kind==='arc'||s.kind==='pipe'||s.through,R=+(s.params&&s.params.R)||0;let A;
  if(arc&&R>0){const G=ArcRoute.build(s.Q,R),d=ArcRoute.sample(G,5);let wi=0;d.k.forEach((k,i)=>{if(k>d.k[wi])wi=i;});A={Q:s.Q,d,wi,minR:R,len:d.s[d.s.length-1]};}
  else A=analyse(s.Q);
  return Object.assign(A,{name:/\(saved\)$/.test(s.name)?s.name:`${s.name} (saved)`,kind:s.kind||'bend',kindLabel:s.kindLabel||'saved route',params:s.params||{},text:s.text||'',
    settings:s.settings||'',tidx:s.tidx||[],saved:true});}
// ---- the current project
const curP=()=>PJ.list.find(p=>p.id===PJ.cur)||null;
function header(){const p=curP();$('shProj').hidden=!p;if(!p)return;$('shProjName').textContent=p.name;$('shProjSaved').textContent=`· saved ${fmtDate(p.updated)}`;}
async function save(force){const p=curP();if(!p||PJ.restoring)return;const s=snapshot(),j=JSON.stringify(s);if(!force&&j===PJ.last)return;
  PJ.last=j;Object.assign(p,s,{updated:Date.now()});await put(p);header();}
setInterval(()=>save(false),SAVE_MS);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save(false);});
const newId=()=>'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
async function create(o){const p=Object.assign({id:newId(),name:'New project',auto:true,created:Date.now(),updated:Date.now(),file:null},o);PJ.list.push(p);PJ.cur=p.id;PJ.last='';
  await put(p);header();return p;}
// an assembly (or other CAD file) opened: it belongs to the current project, or starts one named after it
document.addEventListener('asm:loaded',async e=>{const a=e.detail;if(!a||!a.name)return;let p=curP();
  const file={name:a.name,size:a.size||null};
  // another assembly: a new job (the old one is saved; its routes and Keep clear choices go with it, not into this one)
  if(p&&p.file&&p.file.name!==a.name&&!PJ.pending){await save(true);clearWork();p=null;}
  if(!p)p=await create({name:base(a.name),file});
  else{p.file=Object.assign({},p.file||{},file);if(p.auto&&!PJ.pending)p.name=base(a.name);}
  const h=PJ.handles.get(a.name);if(h)p.handle=h;await put(p);header();
  if(PJ.pending&&PJ.pending.file===a.name)finishOpen(PJ.pending.p);});
// ---- open a project: settings and routes now, the CAD file, then what needs it (stations, Keep clear, pipe)
async function openProject(p,template){PJ.restoring=true;PJ.cur=p.id;closeHome();
  if(typeof bcKeepRestore==='function')bcKeepRestore(p.keep||{});setFields(p.fields);
  if(template){PJ.restoring=false;PJ.last='';header();$('shStatus').textContent=`Similar job “${p.name}”: settings and Keep clear choices taken from “${template}”. Open the new assembly (Open… or drop it).`;return;}
  if(p.mod&&typeof goTask==='function')goTask(p.mod,(p.task||{})[p.mod]);
  if(p.pts!=null){$('pts').value=p.pts;$('pts').dispatchEvent(new Event('change'));}
  if(p.csDirs!=null)$('csDirs').value=p.csDirs;
  (p.runs||[]).forEach(s=>{try{addRun(runIn(s));}catch(err){}});if((p.runs||[]).length){renderRuns();rebuild(true);}
  header();
  if(!p.file){PJ.restoring=false;PJ.last=JSON.stringify(snapshot());$('shStatus').textContent=`Project “${p.name}” opened.`;return;}
  if(ASM&&ASM.name===p.file.name){finishOpen(p);return;}
  PJ.pending={p,file:p.file.name};
  let f=null;if(p.handle&&p.handle.getFile){try{let ok=await p.handle.queryPermission({mode:'read'});if(ok!=='granted')ok=await p.handle.requestPermission({mode:'read'});if(ok==='granted')f=await p.handle.getFile();}catch(err){f=null;}}
  if(f){$('shStatus').textContent=`Opening ${f.name} for “${p.name}”…`;PJ.handles.set(f.name,p.handle);window.rsOpenFiles([f]);return;}
  $('shStatus').innerHTML=`Project “${esc(p.name)}”: open <b>${esc(p.file.name)}</b> to bring back its stations and Keep clear choices. <button type="button" class="linkish" id="pjPick">Open it…</button>`;
  const b=$('pjPick');if(b)b.onclick=()=>pick();}
function finishOpen(p){PJ.pending=null;
  // opening an assembly moves to a task of its own (Pipe · Check .pts …): back to the project's task
  if(p.mod&&typeof goTask==='function')goTask(p.mod,(p.task||{})[p.mod]);
  // the pipe picked in Pipe tasks, by name; the station list once the clamp list is built (it is built just after the open)
  if(p.pipe&&ASM&&ASM.r){const i=ASM.r.pipes.findIndex(x=>x.name===p.pipe);if(i>=0&&$('thPipe').value!==String(i)){$('thPipe').value=String(i);$('thPipe').dispatchEvent(new Event('change'));}}
  let tries=0;const st=()=>{const n=p.stations&&typeof csRestore==='function'?csRestore(p.stations):0;
    if(p.stations&&!n&&++tries<20)return setTimeout(st,150);
    if(typeof bcResurvey==='function')bcResurvey();PJ.restoring=false;PJ.last='';save(true);
    const k=Object.keys(p.keep||{}).length,r=(p.runs||[]).length;
    $('shStatus').textContent=`Project “${p.name}” back: ${r} route${r===1?'':'s'}${n?`, ${n} stations`:''}${k?`, ${k} Keep clear choice${k===1?'':'s'}`:''}.`;};
  setTimeout(st,0);}
// Open… : Chrome / Edge give a handle the project can keep (reopened with one permission click); else the file input
async function pick(){if(!window.showOpenFilePicker)return $('shFile').click();
  let hs;try{hs=await window.showOpenFilePicker({multiple:true,types:[{description:'Creo exports and point files',accept:{'application/octet-stream':['.stp','.step','.igs','.iges','.pts','.txt','.csv','.ibl']}}]});}
  catch(err){if(err&&err.name==='AbortError')return;return $('shFile').click();}
  const files=await Promise.all(hs.map(h=>h.getFile()));hs.forEach((h,i)=>PJ.handles.set(files[i].name,h));window.rsOpenFiles(files);}
$('shOpen').onclick=()=>pick();
// ---- Home
const summary=p=>{const n=(p.runs||[]).length,k=Object.keys(p.keep||{}).length,f=p.fields||{},mod={hose:'Hose / Cable',pipe:'Pipe',bundle:'Bundle',library:'Library'}[p.mod]||'';
  return[mod,n?`${n} route${n===1?'':'s'}`:'',p.mod==='pipe'?(f.cdD?`pipe Ø${f.cdD}`:''):f.csD?`Ø${f.csD}`:'',f.r?`R ${f.r}`:'',k?`${k} Keep clear choice${k===1?'':'s'}`:''].filter(Boolean).join(' · ');};
async function renderHome(){PJ.list=(await all()).sort((a,b)=>b.updated-a.updated);const box=$('hmList');
  box.innerHTML=PJ.list.length?PJ.list.map(p=>`<div class="hmcard${p.id===PJ.cur?' cur':''}" data-id="${p.id}"><h2>${esc(p.name)}</h2>
    <span class="unit">${p.file?esc(p.file.name):'no CAD file yet'} · ${fmtDate(p.updated)}</span><span class="unit">${esc(summary(p))||'nothing done yet'}</span>
    <div class="hmbtns"><button type="button" class="shbtn primary" data-a="open">Open</button><button type="button" class="shbtn" data-a="similar" title="A new project with these settings and Keep clear choices, for another assembly">Similar job</button>
    <button type="button" class="shbtn" data-a="export">Export</button><button type="button" class="shbtn" data-a="rename">Rename</button><button type="button" class="shbtn" data-a="delete">Delete</button></div></div>`).join('')
    :`<p class="hmempty">No projects yet. Press New project, or Back to work and open a Creo file: a project is started for it and saved as you go.</p>`;
  box.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a,PJ.list.find(p=>p.id===b.closest('.hmcard').dataset.id)));}
const say=m=>{$('hmStatus').textContent=m;};
async function act(a,p){if(!p)return;
  if(a==='open'){await save(true);if(PJ.cur!==p.id&&curP())clearWork();openProject(p);}
  else if(a==='similar'){await save(true);clearWork();const q=await create({name:`${p.name} (similar)`,fields:p.fields,keep:p.keep,mod:p.mod,task:p.task,from:p.id});openProject(q,p.name);}
  else if(a==='export'){const{handle,...rest}=p;cadDownload(`${p.name.replace(/[^\w.-]+/g,'_')}.route-studio.json`,JSON.stringify({format:FMT,version:1,project:rest},null,1),'application/json');say(`Exported “${p.name}”.`);}
  else if(a==='rename'){const n=prompt('Project name',p.name);if(n&&n.trim()){p.name=n.trim();p.auto=false;await put(p);renderHome();header();}}
  else if(a==='delete'){if(!confirm(`Delete project “${p.name}”? Its CAD file is not touched.`))return;await del(p.id);if(PJ.cur===p.id){PJ.cur=null;header();}renderHome();say(`Deleted “${p.name}”.`);}}
// a new job: the runs of the old one go (they are saved with it), the open assembly stays until another is opened
function clearWork(){runs.filter(r=>r.saved||r.fromCheck).map(r=>r.id).forEach(id=>{const i=runs.findIndex(r=>r.id===id);if(i>=0)runs.splice(i,1);});renderRuns();rebuild(true);
  if(typeof bcKeepRestore==='function')bcKeepRestore({});}
function showHome(){$('home').hidden=false;renderHome();$('hmNew').focus();}
function closeHome(){$('home').hidden=true;}
$('shHome').onclick=async()=>{await save(true);showHome();};$('hmClose').onclick=closeHome;
$('hmNew').onclick=async()=>{await save(true);clearWork();await create({});closeHome();$('shStatus').textContent='New project: open a Creo file (Open… or drop it); the project takes its name.';};
$('hmImport').onclick=()=>$('hmFile').click();
$('hmFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const j=JSON.parse(await f.text());if(j.format!==FMT||!j.project)throw new Error('not a Route Studio project file');
    const p=Object.assign({},j.project,{id:newId(),updated:Date.now()});await put(p);await renderHome();say(`Imported “${p.name}”. Press Open to work on it.`);}
  catch(err){say(`${f.name}: ${err.message}`);}};
$('shProjName').onclick=()=>{const p=curP();if(p)act('rename',p);};
// dropping or opening a file on Home goes straight to work
['dragover','drop'].forEach(t=>$('home').addEventListener(t,()=>{if(t==='drop')closeHome();},true));
window.rsProjects={save:()=>save(true),list:()=>all(),cur:()=>curP(),show:showHome};
// start: Home when there are projects (not with ?home=0, or when the page was opened to work at once)
all().then(L=>{PJ.list=L;if(L.length&&!/[?&]home=0\b/.test(location.search))showHome();});
}
