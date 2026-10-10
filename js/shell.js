// ---------------- Shell: modules (Hose / Cable · Pipe · Bundle), tasks, one Open, drop anywhere ----------------
// Loaded last. Every panel is reused as it is; the shell only decides which panel shows, which route shape the
// Bend panel uses (the module decides: Hose = spline, Pipe = lines + arcs) and where an opened or dropped file goes.
{
const TASKS={
  hose:[{id:'route',label:'Route through stations',panel:'bend',shape:'spline'},{id:'check',label:'Check as loaded',panel:'analyse'},{id:'offset',label:'Offset B from A',panel:'clear'}],
  pipe:[{id:'route',label:'Route through points',panel:'bend',shape:'arc'},{id:'asm',label:'Check .pts against pipe',panel:'pipe',sub:'cmp'},{id:'clamps',label:'Through clamps',panel:'pipe',sub:'through'},
        {id:'table',label:'Table → .pts',panel:'table'},{id:'offset',label:'Offset from another pipe',soon:'coming (12c)'}],
  bundle:[{id:'bundle',label:'Route bundle',panel:'bundle'}]};
const NAMES={hose:'Hose / Cable',pipe:'Pipe',bundle:'Bundle'};
const PANELS={bend:'panBend',clear:'panClear',bundle:'panBundle',analyse:'panAnalyse',table:'panTable',pipe:'panPipe'};
let st={mod:'hose',task:{hose:'route',pipe:'asm',bundle:'bundle'}};
try{const s=JSON.parse(store.get('rs.shell')||'null');if(s&&TASKS[s.mod])st={mod:s.mod,task:Object.assign(st.task,s.task||{})};}catch(e){}
const save=()=>store.set('rs.shell',JSON.stringify(st));
const T=(m,t)=>TASKS[m].find(x=>x.id===t&&!x.soon)||TASKS[m][0];
const label=(m,t)=>`${NAMES[m]} · ${T(m,t).label}`;
let syncing=false;

function nav(){
  document.querySelectorAll('.modsw button').forEach(b=>b.setAttribute('aria-selected',b.dataset.mod===st.mod));
  $('tasks').innerHTML=TASKS[st.mod].map(t=>`<button type="button" data-task="${t.id}"${t.soon?' disabled':''} aria-current="${!t.soon&&t.id===st.task[st.mod]}">${t.label}${t.soon?`<small>${t.soon}</small>`:''}</button>`).join('');
  $('tasks').querySelectorAll('button[data-task]').forEach(b=>b.onclick=()=>go(st.mod,b.dataset.task));
}
const panels=which=>Object.entries(PANELS).forEach(([k,id])=>{$(id).hidden=k!==which;});
const sub=which=>{$('pipeCmp').hidden=which!=='cmp';$('pipeThrough').hidden=which!=='through';};
function go(mod,task){
  const t=T(mod,task);st.mod=mod;st.task[mod]=t.id;save();
  if(t.shape&&$('shape').value!==t.shape){$('shape').value=t.shape;syncing=true;$('shape').dispatchEvent(new Event('change'));syncing=false;}
  if(t.sub)sub(t.sub);panels(t.panel);nav();
}
// everything else (run list, Table → route, Analyse) calls showPanel: follow it with the module and task
showPanel=function(which){
  panels(which);
  const hit=which==='bend'?($('shape').value==='arc'?['pipe','route']:['hose','route'])
    :which==='pipe'?['pipe',st.task.pipe==='clamps'?'clamps':'asm']
    :which==='analyse'?['hose','check']:which==='clear'?['hose','offset']:which==='table'?['pipe','table']:['bundle','bundle'];
  st.mod=hit[0];st.task[hit[0]]=hit[1];if(which==='pipe')sub(T('pipe',hit[1]).sub);save();nav();
};
$('shape').addEventListener('change',()=>{if(!syncing&&!$('panBend').hidden)showPanel('bend');});
document.querySelectorAll('.modsw button').forEach(b=>b.onclick=()=>go(b.dataset.mod,st.task[b.dataset.mod]));
$('tToBend').addEventListener('click',()=>go('pipe','route'));

// ---- examples menu, theme ----
const ex=$('shEx');
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{const [m,t]=b.dataset.goto.split(':');go(m,t);ex.open=false;}));
document.addEventListener('click',e=>{if(ex.open&&!ex.contains(e.target))ex.open=false;});
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
  const files=[...list];if(!files.length)return;
  const texts=await Promise.all(files.map(f=>f.text()));
  // assembly (product tree + solids) → Pipe
  const ai=files.findIndex((f,i)=>/\.(stp|step)$/i.test(f.name)&&isAsm(texts[i]));
  if(ai>=0){const f=files[ai],rest=files.length-1;go('pipe',st.task.pipe==='clamps'?'clamps':'asm');asmLoad(f);
    return say(`${f.name}: assembly → ${label('pipe',st.task.pipe)}.${rest?` ${rest} other file${rest>1?'s were':' was'} not opened; open ${rest>1?'them':'it'} once the assembly has loaded.`:''}`);}
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
$('shOpen').onclick=()=>$('shFile').click();
$('shFile').onchange=e=>{open(e.target.files);e.target.value='';};
$('shTable').onclick=()=>{go('pipe','table');$('tin').focus();};
let depth=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
addEventListener('dragenter',e=>{if(hasFiles(e)){depth++;document.body.classList.add('dropping');}});
addEventListener('dragleave',()=>{if(--depth<=0){depth=0;document.body.classList.remove('dropping');}});
addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault();});
addEventListener('drop',e=>{depth=0;document.body.classList.remove('dropping');if(e.defaultPrevented||!hasFiles(e))return;e.preventDefault();open(e.dataTransfer.files);});

go(st.mod,st.task[st.mod]);
}
