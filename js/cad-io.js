// ---------------- CAD import / export: IGES + STEP datums <-> points ----------------
// Reads named datum points (IGES 116, STEP CARTESIAN_POINT) and coordinate systems (STEP AXIS2_PLACEMENT_3D),
// splits them by name prefix, writes them into a points textarea as "X Y Z ! name". Exports a run as STEP points.
const CAD={rows:[],csys:[],groups:{},src:'',frame:null};
const CAD_EXT=/\.(igs|iges|stp|step)$/i;

// file order is kept: Creo writes datums in route order, names (CS29, CS46, CS30...) are not
function cadGroupBy(rows){const g={};
  for(const r of rows){const m=/^(.*?)[_-]?(\d+)$/.exec(r.name||'');const k=(m&&m[1])?m[1]:(r.name||'unnamed');(g[k]=g[k]||[]).push(r);}
  return g;}
function cadRead(name,text){
  const isStep=/^\s*ISO-10303/.test(text)||(/\bDATA;/.test(text)&&/AXIS2_PLACEMENT_3D|CARTESIAN_POINT/.test(text));
  if(isStep){const r=STEPReader.parse(text);
    const cs=r.csys.map(c=>({name:c.name,x:c.x,y:c.y,z:c.z,zAxis:c.zAxis,xAxis:c.xAxis,kind:'csys'}));
    const pt=r.points.map(p=>({name:p.name,x:p.x,y:p.y,z:p.z,kind:'point'}));
    return{format:'STEP',rows:cs.concat(pt),csys:cs,entities:r.summary.entities,what:cs.length?`${cs.length} coordinate system${cs.length>1?'s':''}${pt.length?` and ${pt.length} points`:''}`:`${pt.length} points`};}
  const r=IGES.parse(text);
  const pt=r.points.map(p=>({name:p.name||'',x:p.x,y:p.y,z:p.z,kind:'point',level:p.level}));
  return{format:'IGES',rows:pt,csys:[],entities:r.summary.entities,what:`${pt.length} datum point${pt.length===1?'':'s'}`};}

// frame: express world point in a named CSYS (origin + x/z axes), or back
function cadAxes(c){const z=V.norm(c.zAxis||[0,0,1]),x0=c.xAxis||[1,0,0];const x=V.norm(V.sub(x0,V.mul(z,V.dot(x0,z)))),y=V.cross(z,x);return{o:[c.x,c.y,c.z],x,y,z};}
function cadToFrame(p){const f=CAD.frame;if(!f)return p;const a=cadAxes(f),d=V.sub(p,a.o);return[V.dot(d,a.x),V.dot(d,a.y),V.dot(d,a.z)];}
function cadFromFrame(p){const f=CAD.frame;if(!f)return p;const a=cadAxes(f);return V.add(a.o,V.add(V.mul(a.x,p[0]),V.add(V.mul(a.y,p[1]),V.mul(a.z,p[2]))));}
function cadLines(rows){return rows.map(r=>{const q=cadToFrame([r.x,r.y,r.z]);return q.map(v=>v.toFixed(3).padStart(12)).join(' ')+(r.name?'   ! '+r.name:'');}).join('\n')+'\n';}
const CAD_HELP='No named datums in this file. IGES: tick Datums in the export profile, keep the datums displayed on screen, Hidden entities off; coordinate systems never reach IGES, export STEP for those. STEP: name the coordinate systems in the model tree, unnamed placements are skipped.';

// Analyse tab: one "# group" block per name group
function cadBlocks(name,text){
  // always file-origin coordinates here, so CAD files line up with .pts files exported from the same assembly
  const keep=CAD.frame;CAD.frame=null;
  try{const r=cadRead(name,text);if(!r.rows.length){cadSay('statusAnalyse',CAD_HELP,true);return'';}
    cadRemember(name,r);const g=cadGroupBy(r.rows);
    cadSay('statusAnalyse',`${name}: ${r.what}, ${Object.keys(g).length} name group${Object.keys(g).length>1?'s':''}, file-origin coordinates.`);
    return Object.entries(g).map(([k,rows])=>`# ${k}\n${cadLines(rows).trim()}`).join('\n');}
  catch(e){cadSay('statusAnalyse',`${name}: ${e.message}`,true);return'';}
  finally{CAD.frame=keep;}}
function cadRemember(name,r){CAD.src=name;CAD.rows=r.rows;CAD.csys=r.csys;const g=cadGroupBy(r.rows);CAD.groups={};Object.keys(g).sort((a,b)=>g[b].length-g[a].length).forEach(k=>CAD.groups[k]=g[k]);if(CAD.frame&&!r.csys.some(c=>c.name===CAD.frame.name))CAD.frame=null;}
function cadSay(id,msg,bad){const e=$(id);if(!e)return;e.textContent=msg;e.style.color=bad?'var(--bad)':'';}

// Bend / Clearance textareas: pick a name group, optional frame
const CAD_STATUS={pts:'statusBend',mpts:'statusClear',spts:'statusClear'},CAD_LABEL={pts:'',mpts:'Master · ',spts:'Slave · '};
function cadLoadInto(target,file){
  file.text().then(text=>{
    if(!CAD_EXT.test(file.name)){$(target).value=text;cadSay(CAD_STATUS[target],`${file.name} loaded.`);return;}
    let r;try{r=cadRead(file.name,text);}catch(e){return cadSay(CAD_STATUS[target],`${file.name}: ${e.message}`,true);}
    if(!r.rows.length){cadSay(CAD_STATUS[target],CAD_HELP,true);return;}
    cadRemember(file.name,r);
    const keys=Object.keys(CAD.groups);cadPick(target,keys[0]);
    cadSay(CAD_STATUS[target],`${file.name}: ${r.what}${keys.length>1?`, ${keys.length} name groups, pick one below`:''}.`);});}
function cadPick(target,key){
  const box=$('cadpick_'+target);if(!box)return;
  const keys=Object.keys(CAD.groups);box.hidden=false;
  box.innerHTML=`<span class="unit">${CAD_LABEL[target]||''}${esc(CAD.src)}:</span>`+keys.map(k=>`<button type="button" data-g="${esc(k)}" aria-pressed="${k===key}">${esc(k)} <span class="unit">${CAD.groups[k].length}</span></button>`).join('')
    +(CAD.csys.length?`<label class="cadframe">Frame <select><option value="">file origin</option>${CAD.csys.map(c=>`<option value="${esc(c.name)}" ${CAD.frame&&CAD.frame.name===c.name?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:'');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>cadPick(target,b.dataset.g));
  const sel=box.querySelector('select');if(sel)sel.onchange=()=>{CAD.frame=CAD.csys.find(c=>c.name===sel.value)||null;cadPick(target,key);};
  $(target).value=cadLines(CAD.groups[key]);$(target).dispatchEvent(new Event('input'));}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// STEP export of the selected run: named points, plus the coordinate systems that came in with the import
function cadStep(r){
  const E=[];let n=0;const add=s=>{E.push(`#${++n}=${s}`);return n;};
  const num=v=>{const s=v.toExponential(12).toUpperCase();return s;};
  const vec=v=>`(${v.map(num).join(',')})`;
  const shape=[];
  const Qw=r.Q.map(q=>cadFromFrame(q));
  if(CAD.frame)shape.push(add(`AXIS2_PLACEMENT_3D('${CAD.frame.name}',#${add(`CARTESIAN_POINT('',${vec([CAD.frame.x,CAD.frame.y,CAD.frame.z])})`)},#${add(`DIRECTION('',${vec(CAD.frame.zAxis||[0,0,1])})`)},#${add(`DIRECTION('',${vec(CAD.frame.xAxis||[1,0,0])})`)})`));
  Qw.forEach((q,i)=>shape.push(add(`CARTESIAN_POINT('RP${String(i+1).padStart(3,'0')}',${vec(q)})`)));
  const u1=add('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))'),u2=add('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))'),u3=add('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const unc=add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.000000000000E-3),#${u1},'closure','')`);
  const ctx=add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${u1},#${u2},#${u3}))REPRESENTATION_CONTEXT('ID1','3'))`);
  const sr=add(`SHAPE_REPRESENTATION('ROUTE',(${shape.map(i=>'#'+i).join(',')}),#${ctx})`);
  const ac=add(`APPLICATION_CONTEXT('CONFIGURATION CONTROLLED 3D DESIGNS OF MECHANICAL PARTS AND ASSEMBLIES')`);
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,#${ac})`);
  const mc=add(`MECHANICAL_CONTEXT('',#${ac},'mechanical')`),dc=add(`DESIGN_CONTEXT('',#${ac},'design')`);
  const id=r.name.replace(/[^\w.-]+/g,'_').toUpperCase();
  const pr=add(`PRODUCT('${id}','${id}','NOT SPECIFIED',(#${mc}))`);
  const pf=add(`PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('1','LAST_VERSION',#${pr},.MADE.)`);
  const pd=add(`PRODUCT_DEFINITION('design','',#${pf},#${dc})`);
  const ps=add(`PRODUCT_DEFINITION_SHAPE('','SHAPE FOR ${id}.',#${pd})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(#${ps},#${sr})`);
  const date=new Date().toISOString().slice(0,19);
  return`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_NAME('${id.toLowerCase()}','${date}',(''),(''),'Route Studio','Route Studio','');\nFILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));\nENDSEC;\nDATA;\n${E.join(';\n')};\nENDSEC;\nEND-ISO-10303-21;\n`;}
function cadDownload(name,text,mime){const b=new Blob([text],{type:mime||'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}

// ---- wiring ----
{const inp=$('cadfile');let cadTarget='pts';
  document.querySelectorAll('[data-cad]').forEach(b=>b.onclick=()=>{cadTarget=b.dataset.cad;inp.click();});
  inp.onchange=e=>{if(e.target.files[0])cadLoadInto(cadTarget,e.target.files[0]);e.target.value='';};
  ['pts','mpts','spts'].forEach(t=>{const el=$(t);if(!el)return;
    el.addEventListener('dragover',e=>{e.preventDefault();el.dataset.drop=1;});el.addEventListener('dragleave',()=>delete el.dataset.drop);
    el.addEventListener('drop',e=>{e.preventDefault();delete el.dataset.drop;if(e.dataTransfer.files[0])cadLoadInto(t,e.dataTransfer.files[0]);});});
  $('dlstp').onclick=()=>{const r=selected();if(!r)return;cadDownload(r.name.replace(/[^\w.-]+/g,'_')+'.stp',cadStep(r),'application/step');};}
