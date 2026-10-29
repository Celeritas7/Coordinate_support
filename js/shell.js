// ---------------- Shell: modules (Hose / Cable · Pipe · Bundle), tasks, one Open, drop anywhere ----------------
// Loaded last. Every panel is reused as it is; the shell only decides which panel shows, which route shape the
// Bend panel uses (the module decides: Hose = spline, Pipe = lines + arcs) and where an opened or dropped file goes.
{
const TASKS={
  hose:[{id:'route',label:'Route through stations',panel:'bend',shape:'spline'},{id:'check',label:'Check as loaded',panel:'analyse'},{id:'offset',label:'Offset B from A',panel:'clear'}],
  pipe:[{id:'route',label:'Route through points',panel:'bend',shape:'arc'},{id:'asm',label:'Check .pts against pipe',panel:'pipe',sub:'cmp'},{id:'clamps',label:'Through clamps',panel:'pipe',sub:'through'},
        {id:'table',label:'Table → .pts',panel:'table'},{id:'offset',label:'Offset from another pipe',panel:'pipe',sub:'offset'}],
  bundle:[{id:'bundle',label:'Route bundle',panel:'bundle'}],
  library:[{id:'fix',label:'Clamps, clips, grommets',panel:'lib'}]};
const NAMES={hose:'Hose / Cable',pipe:'Pipe',bundle:'Bundle',library:'Library'};
const PANELS={bend:'panBend',clear:'panClear',bundle:'panBundle',analyse:'panAnalyse',table:'panTable',pipe:'panPipe',lib:'panLib'};
let st={mod:'hose',task:{hose:'route',pipe:'asm',bundle:'bundle',library:'fix'}};
try{const s=JSON.parse(store.get('rs.shell')||'null');if(s&&TASKS[s.mod])st={mod:s.mod,task:Object.assign(st.task,s.task||{})};}catch(e){}
const save=()=>store.set('rs.shell',JSON.stringify(st));
const T=(m,t)=>TASKS[m].find(x=>x.id===t&&!x.soon)||TASKS[m][0];
const label=(m,t)=>`${NAMES[m]} · ${T(m,t).label}`;
let syncing=false;

function nav(){
  document.querySelectorAll('.modsw button').forEach(b=>b.setAttribute('aria-selected',b.dataset.mod===st.mod));
  $('tasks').innerHTML=TASKS[st.mod].map(t=>{const on=!t.soon&&t.id===st.task[st.mod];
    return`<button type="button" role="tab" data-task="${t.id}"${t.soon?' disabled':''} aria-selected="${on}" tabindex="${on?0:-1}">${t.label}${t.soon?`<small>${t.soon}</small>`:''}</button>`;}).join('');
  $('tasks').querySelectorAll('button[data-task]').forEach(b=>b.onclick=()=>go(st.mod,b.dataset.task));
  document.querySelectorAll('.modsw button').forEach(b=>b.tabIndex=b.dataset.mod===st.mod?0:-1);
}
// module switch and task tabs: one tab stop each, ← / → move between them (and open the one reached)
const arrows=(box,sel,pick)=>box.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;
  const B=[...box.querySelectorAll(sel)].filter(b=>!b.disabled),i=B.indexOf(document.activeElement);if(i<0)return;e.preventDefault();
  const n=B[(i+d+B.length)%B.length];pick(n);const f=box.querySelector(`${sel}[tabindex="0"]`)||n;f.focus();});
arrows($('tasks'),'button[data-task]',b=>go(st.mod,b.dataset.task));
arrows(document.querySelector('.modsw'),'button[data-mod]',b=>go(b.dataset.mod,st.task[b.dataset.mod]));
const panels=which=>{Object.entries(PANELS).forEach(([k,id])=>{$(id).hidden=k!==which;});if(which==='lib'&&typeof libRender==='function')libRender();};
// each Pipe task says what it does in one line until it has input; Open assembly… beside it while none is open
const EMPTY={cmp:'Check .pts against pipe: compare your .pts with a pipe in the open assembly, point by point.',
  through:'Through clamps: re-route the open pipe so it runs straight through its clamps.',
  offset:'Offset from another pipe: route a new pipe alongside one in the assembly, at the distance you set.'};
let pipeSub='cmp';
const emptyLines=()=>{const open=typeof ASM!=='undefined'&&!!ASM&&!!ASM.r;$('pipeEmptyTxt').textContent=EMPTY[pipeSub]||'';$('pipeEmptyBtn').hidden=open;
  $('tableEmpty').hidden=!!$('tin').value.trim();
  $('arcEmpty').hidden=!($('shape').value==='arc'&&!$('pts').value.trim());};
const sub=which=>{pipeSub=which;$('pipeCmp').hidden=which!=='cmp';$('pipeThrough').hidden=which!=='through';$('pipeOffset').hidden=which!=='offset';emptyLines();};
$('pipeEmptyBtn').onclick=()=>$('shFile').click();
['asm:loaded','asm:removed'].forEach(t=>document.addEventListener(t,()=>setTimeout(emptyLines,0)));
['tin','pts'].forEach(id=>$(id).addEventListener('input',emptyLines));$('shape').addEventListener('change',emptyLines);
function go(mod,task){
  const t=T(mod,task);st.mod=mod;st.task[mod]=t.id;save();
  if(t.shape&&$('shape').value!==t.shape){$('shape').value=t.shape;syncing=true;$('shape').dispatchEvent(new Event('change'));syncing=false;}
  if(t.sub)sub(t.sub);panels(t.panel);nav();emptyLines();
}
// everything else (run list, Table → route, Analyse) calls showPanel: follow it with the module and task
showPanel=function(which){
  panels(which);
  const hit=which==='bend'?($('shape').value==='arc'?['pipe','route']:['hose','route'])
    :which==='pipe'?['pipe',st.task.pipe==='clamps'||st.task.pipe==='offset'?st.task.pipe:'asm']
    :which==='analyse'?['hose','check']:which==='clear'?['hose','offset']:which==='table'?['pipe','table']:which==='lib'?['library','fix']:['bundle','bundle'];
  st.mod=hit[0];st.task[hit[0]]=hit[1];if(which==='pipe')sub(T('pipe',hit[1]).sub);save();nav();
};
$('shape').addEventListener('change',()=>{if(!syncing&&!$('panBend').hidden)showPanel('bend');});
document.querySelectorAll('.modsw button').forEach(b=>b.onclick=()=>go(b.dataset.mod,st.task[b.dataset.mod]));
$('tToBend').addEventListener('click',()=>go('pipe','route'));

// ---- examples menu, theme ----
// Examples ▾ and More ▾: a choice closes the menu, so does a click elsewhere or Esc
const menus=[$('shEx'),$('shMore')];
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{const [m,t]=b.dataset.goto.split(':');go(m,t);}));
menus.forEach(m=>m.querySelector('.menu').addEventListener('click',e=>{if(e.target.closest('button,a'))m.open=false;}));
document.addEventListener('click',e=>menus.forEach(m=>{if(m.open&&!m.contains(e.target))m.open=false;}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')menus.forEach(m=>{if(m.open){m.open=false;m.querySelector('summary').focus();}});});
const dark=()=>(document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))==='dark';
const themeBtn=()=>{$('shTheme').textContent=dark()?'Light':'Dark';};
{const t=store.get('rs.theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;themeBtn();}
$('shTheme').onclick=()=>{const t=dark()?'light':'dark';document.documentElement.dataset.theme=t;store.set('rs.theme',t);themeBtn();
  rebuild(false);renderRuns();renderPts();if(typeof showPane==='function')showPane();};

// ---- one Open, drop anywhere: the file decides where it goes ----
const say=m=>{const e=$('shStatus');e.textContent=m;e.classList.add('on');};
const isAsm=t=>/PRODUCT_DEFINITION\s*\(/.test(t)&&/MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS/.test(t);
let masterSet=false;
async function open(list){
  const files=[...list];if(!files.length)return;say(`Reading ${files.length>1?`${files.length} files`:files[0].name}…`);
  // what each file is, from its text; a big STEP is only sampled (first and last 8 MB): reading it whole would fail past the
  // 537 M-character string limit, and the assembly reader reads it in pieces anyway
  const BIG=64e6,sniff=f=>f.size>BIG&&/\.(stp|step)$/i.test(f.name)?Promise.all([f.slice(0,8e6).text(),f.slice(Math.max(0,f.size-8e6)).text()]).then(a=>({big:true,t:a.join('\n')})):f.text().then(t=>({big:false,t}));
  const got=await Promise.all(files.map(sniff)),texts=got.map(g=>g.t);
  // assembly (product tree + solids): opened once, for every panel (see openAssembly)
  const ai=files.findIndex((f,i)=>/\.(stp|step)$/i.test(f.name)&&(isAsm(texts[i])||got[i].big&&/PRODUCT_DEFINITION\s*\(/.test(texts[i])));
  // the others are named in the final "Opened in …" line (the reading progress overwrites anything said before it)
  if(ai>=0){const f=files[ai],rest=files.filter((_,i)=>i!==ai).map(x=>x.name);openAssembly(f,rest);return;}
  // a .pts whose points land on a pipe of the open assembly → Pipe · Check .pts
  if(files.length===1&&typeof ASM!=='undefined'&&ASM&&ASM.r&&ASM.r.pipes.length&&/\.(pts|txt|csv)$/i.test(files[0].name)){
    let fits=false;try{ASM.r.pipes.forEach((p,i)=>{const r=PtsCompare.compare(ASM.r,i,texts[0]);if(r.frame.err<=Math.max(r.tol,p.OD||0))fits=true;});}catch(e){}
    if(fits){go('pipe','asm');cmpLoad(files[0]);return say(`${files[0].name}: fits a pipe in ${ASM.name} → ${label('pipe','asm')}.`);}}
  // stations / points: Pipe · Route through points keeps them, anything else goes to Hose / Cable
  // a solid-model IGES (B-rep, entity 186) is a frame / parts file: load it as parts, keep the stations
  if(files.length===1&&/\.(igs|iges)$/i.test(files[0].name)&&/^ {5}186 /m.test(texts[0])&&typeof bcLoad==='function'){
    go('hose','route');bcLoad(files[0]);return say(`${files[0].name}: solid model → parts to keep clear of (Hose / Cable · Route through stations). Stations unchanged.`);}
  if(files.length===1&&st.mod==='pipe'&&st.task.pipe==='route'){cadLoadInto('pts',files[0]);return say(`${files[0].name} → ${label('pipe','route')}.`);}
  const cur=st.mod==='hose'?st.task.hose:'route';
  if(files.length>1||cur==='check'){go('hose','check');waLoadFiles(files,'acab');
    return say(`${files.length} file${files.length>1?'s':''} → ${label('hose','check')}. Press Analyse.`);}
  if(cur==='offset'){const t=masterSet?'spts':'mpts';masterSet=!masterSet;go('hose','offset');cadLoadInto(t,files[0]);
    return say(`${files[0].name} → ${label('hose','offset')}, as the ${t==='mpts'?'master (next file: slave)':'slave'} route.`);}
  go('hose','route');cadLoadInto('pts',files[0]);say(`${files[0].name} → ${label('hose','route')}.`);
}
// One assembly per session, read once. In Hose / Cable · Route through stations it feeds Stations from clamps and
// Keep clear of CAD parts; anywhere else it opens in Pipe. Both see the same parse, so switching task needs no reload.
// rest: names of files dropped with it and not opened
let asmPend=null;
function openAssembly(f,rest){const n=rest?rest.length:0,also=n?` ${n} other file${n>1?'s were':' was'} not opened (${rest.join(', ')}); open ${n>1?'them':'it'} now the assembly has loaded.`:'';
  const hose=st.mod==='hose'&&st.task.hose==='route'&&$('shape').value!=='arc';
  if(!hose)go('pipe',st.task.pipe==='clamps'||st.task.pipe==='offset'?st.task.pipe:'asm');
  const where=hose?`Stations and parts to keep clear of are in ${label('hose','route')}; also open in Pipe.`:`Open in ${label('pipe',st.task.pipe)}.`;
  // one of the two answers this open: the other listener goes with it (a failed read must not leave one armed for a later
  // open), and so do both when another assembly is opened before this one has loaded
  if(asmPend)asmPend();
  const done=()=>{document.removeEventListener('asm:loaded',ok);document.removeEventListener('asm:failed',bad);$('shStatus').title='';asmPend=null;};
  asmPend=done;
  const ok=e=>{const a=e.detail;if(!a||a.name!==f.name)return;done();
    if(hose&&typeof bcFromAsm==='function')bcFromAsm(a);
    say(`Opened in ${(a.secs||0).toFixed(1)} s.${also}`);$('shStatus').title=where;
    showAsm(a);};
  const bad=e=>{const x=e.detail;if(!x||x.name!==f.name)return;done();say(`${x.name} could not be read: ${x.message}`);};
  document.addEventListener('asm:loaded',ok);document.addEventListener('asm:failed',bad);
  // while reading, the header shows asm-ui's progress line ("Reading <file>, 20.3 MB: parts 59 %"); the others in its tooltip
  $('shStatus').title=n?`Not opened: ${rest.join(', ')} (one assembly at a time; open ${n>1?'them':'it'} once this one has loaded)`:'';asmLoad(f);}
window.openAssembly=openAssembly;window.goTask=go;
// name · parts · pipes · holes with a CSYS; once Hose / Cable has its clamp list, the clamps that fit its Ø instead
function asmLine(a){const r=a.r;if(!r)return esc(a.name);const parts=r.instances.filter(i=>i.solids).length,np=r.pipes.length,
    holes=r.holes.filter(h=>h.csys).length,cs=typeof csCount==='function'?csCount():null;
  return`<span class="mono">${esc(a.name)}</span> · ${parts} part${parts===1?'':'s'}${np?` · ${np} pipe${np===1?'':'s'}`:''} · `+
    (cs&&cs.n?`${cs.n} clamp${cs.n===1?'':'s'} for Ø${+cs.D}`:`${holes} hole${holes===1?'':'s'} with a CSYS`);}
document.addEventListener('cs:changed',()=>{if(typeof ASM!=='undefined'&&ASM&&ASM.r)$('shAsmTxt').innerHTML=asmLine(ASM);});
// the assembly line: one file per session, in every module. Change… opens another in its place (Hose Ø, the Library and the
// per-file choices stay; stations and parts of the old file go; runs stay). Remove unloads it at once with Undo for 10 s,
// which puts back the same parse (no second read)
function showAsm(a){const on=!!(a&&a.r);$('shAsmTxt').classList.toggle('unit',!on);$('shAsmTxt').innerHTML=on?asmLine(a):'No assembly open.';$('shAsmAct').hidden=!on;}
let undoT=0;
$('shChange').onclick=()=>$('shFile').click();
$('shRemove').onclick=()=>{const parts=typeof bcName==='function'&&typeof ASM!=='undefined'&&ASM&&bcName()===ASM.name,a=typeof asmRemove==='function'?asmRemove():null;if(!a)return;showAsm(null);clearTimeout(undoT);
  const el=$('shStatus');el.classList.add('on');el.innerHTML=`Removed ${esc(a.name)}. <button type="button" class="linkish" id="shUndo">Undo</button>`;$('shUndo').focus();
  $('shUndo').onclick=()=>{clearTimeout(undoT);if(typeof ASM!=='undefined'&&ASM)return say('Another assembly is open; nothing to undo.');
    document.addEventListener('asm:loaded',e=>{if(e.detail&&e.detail.name===a.name&&typeof bcFromAsm==='function'&&parts)bcFromAsm(e.detail);showAsm(e.detail);},{once:true});
    asmRestore(a);say(`${a.name} is back.`);$('shChange').focus();};
  undoT=setTimeout(()=>{const u=$('shUndo');if(u)u.replaceWith(document.createTextNode(''));},10000);};
document.addEventListener('asm:removed',()=>showAsm(null));
$('shOpen').onclick=()=>$('shFile').click();
$('shFile').onchange=e=>{open(e.target.files);e.target.value='';};
$('shTable').onclick=()=>{go('pipe','table');$('tin').focus();};
$('arcEmptyBtn').onclick=()=>$('shTable').click();
let depth=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
addEventListener('dragenter',e=>{if(hasFiles(e)){depth++;document.body.classList.add('dropping');}});
addEventListener('dragleave',()=>{if(--depth<=0){depth=0;document.body.classList.remove('dropping');}});
addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault();});
addEventListener('drop',e=>{depth=0;document.body.classList.remove('dropping');if(e.defaultPrevented||!hasFiles(e))return;e.preventDefault();open(e.dataTransfer.files);});

go(st.mod,st.task[st.mod]);
}
