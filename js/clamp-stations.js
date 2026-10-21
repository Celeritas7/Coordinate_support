/* clamp-stations.js — Hose / Cable · Route through stations: "Stations from clamps".
 * Reads the fixings of a STEP assembly (hole + CSYS on its axis, StepAsm.parse(...).fixings), keeps those whose
 * bore fits the hose Ø, orders them into a route (nearest neighbour + 2-opt, start / end pinned when picked) and
 * writes them into Target points. The bore axes go into an optional per-station direction list that Check holds
 * as fixed tangents (window.clampStationDirs); with that list empty, Check is unchanged.
 * Logic has no DOM: Node require('./clamp-stations.js'), browser window.ClampStations. The UI block runs only in
 * the page (loaded after route-studio.js and bend-cad.js).
 */
(function (root) {
"use strict";
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1e-12;return[a[0]/l,a[1]/l,a[2]/l];},dist=(a,b)=>len(sub(a,b));

// fixings whose bore fits the hose (Ø − 0.2 … Ø + tol), classified by Fixings.find (js/fixings.js): Library part, end fitting
// of a pipe in the file, clamp not in the Library, or a short bolt / plate hole. Coaxial copies at one spot are one fixing.
// Each entry: {id, name (CSYS), part, label, c, d, D, length, role, use (default tick), reason}. r: StepAsm.parse result.
// opt: {D, tol=1.5, lib: x => Library entry | null}
const FX=root.Fixings||(typeof require!=="undefined"?require("./fixings.js"):null);
function candidates(r,opt){const D=+opt.D,tol=opt.tol==null?1.5:+opt.tol;
  return FX.find(r,{D,fit:tol,lib:opt.lib||null}).map(c=>({id:c.id,name:c.name,part:c.part,label:c.label,c:c.c,d:c.d,D:c.D,length:c.length,
    role:c.role,use:c.use,reason:c.reason}));}

function pathLength(P,ord){let s=0;for(let i=1;i<ord.length;i++)s+=dist(P[ord[i-1]],P[ord[i]]);return s;}

// visiting order through every point P[i]. opt.start / opt.end: index pinned first / last (null = free).
// Nearest neighbour from each allowed start, then 2-opt; the shortest wins
function order(P,opt={}){const n=P.length,S=opt.start==null?null:opt.start,E=opt.end==null||opt.end===S?null:opt.end;
  if(n<2)return P.map((_,i)=>i);
  const d=(i,j)=>dist(P[i],P[j]),starts=S!=null?[S]:P.map((_,i)=>i).filter(i=>i!==E);
  let best=null;
  for(const s of starts){const left=new Set(P.map((_,i)=>i));left.delete(s);if(E!=null)left.delete(E);
    const ord=[s];while(left.size){const a=ord[ord.length-1];let bj=-1,bd=Infinity;for(const j of left){const v=d(a,j);if(v<bd){bd=v;bj=j;}}ord.push(bj);left.delete(bj);}
    if(E!=null)ord.push(E);
    twoOpt(ord,d,E==null);const L=pathLength(P,ord);if(!best||L<best.L-1e-9)best={ord,L};}
  return best.ord;}
// open path, first point fixed; the last too unless freeEnd. Reverses ord[i..j] while that shortens the path
function twoOpt(ord,d,freeEnd){const n=ord.length,jMax=freeEnd?n-1:n-2;let better=true,guard=0;
  while(better&&guard++<100){better=false;
    for(let i=1;i<jMax;i++)for(let j=i+1;j<=jMax;j++){
      const before=d(ord[i-1],ord[i])+(j<n-1?d(ord[j],ord[j+1]):0),after=d(ord[i-1],ord[j])+(j<n-1?d(ord[i],ord[j+1]):0);
      if(after<before-1e-9){for(let a=i,b=j;a<b;a++,b--){const t=ord[a];ord[a]=ord[b];ord[b]=t;}better=true;}}}
  return ord;}

// bore axes turned along the direction of travel (the axis sign in the CAD is arbitrary)
function orient(P,dirs){const n=P.length;
  return dirs.map((v,i)=>{if(!v)return null;const ch=sub(P[Math.min(i+1,n-1)],P[Math.max(i-1,0)]),u=norm(v);return dot(u,ch)<0?u.map(x=>-x):u;});}

const f3=v=>v.toFixed(3).padStart(12),f6=v=>(Math.abs(v)<5e-7?0:v).toFixed(6);
// Target points lines and the matching direction lines. tf(p) / tv(v): optional frame transforms (point, vector)
function stationsText(list,tf){return list.map(s=>(tf?tf(s.c):s.c).map(f3).join(' ')+'   ! '+s.name).join('\n')+'\n';}
function dirsText(list,tv){const P=list.map(s=>s.c),D=orient(P,list.map(s=>s.d));
  return D.map((v,i)=>(v?(tv?tv(v):v).map(f6).join(' '):'-')+'   ! '+list[i].name).join('\n')+'\n';}

// direction lines: "dX dY dZ" (comment after !), or "-" for a station left free. Blank lines are skipped.
// Returns {dirs:[v|null], bad:[line numbers], names:[comment name|'']}
const nameOf=raw=>{const k=raw.indexOf('!');return k<0?'':raw.slice(k+1).trim();};
function parseDirs(text){const dirs=[],bad=[],names=[];
  String(text||'').split(/\r?\n/).forEach((raw,k)=>{const line=raw.split('!')[0].trim();if(!raw.trim())return;names.push(nameOf(raw));
    if(!line||/^(-|free)$/i.test(line))return dirs.push(null);
    const v=line.replace(/,/g,' ').split(/\s+/).map(Number);
    if(v.length===3&&v.every(Number.isFinite)&&len(v)>1e-9)dirs.push(v);else{bad.push(k+1);dirs.push(null);}});
  return{dirs,bad,names};}
// "! name" of each Target points line that holds a point (same lines parsePts reads)
function pointNames(text){return String(text||'').split(/\r?\n/).filter(raw=>{const v=raw.split('!')[0].trim().replace(/,/g,' ').split(/\s+/).map(Number);
  return v.length>=3&&v.slice(0,3).every(Number.isFinite);}).map(nameOf);}

// for Check: null when there is nothing to hold (Check then runs exactly as before). Otherwise {fixDirs(base), note, msg}:
// fixDirs merges the bore directions over the base list (straight runs from bendCad); a bore direction wins at its station.
// Start / End direction typed under "Fix end directions" still win at the two ends (makeRoute applies them last).
// ptsText (optional): the Target points text; where a point line and its direction line both carry a "! name", the
// names must agree, so directions left over from other stations are not held at the wrong points
function forCheck(P,text,ptsText){const t=String(text||'').trim();if(!t)return null;
  const {dirs,bad,names}=parseDirs(t),n=dirs.filter(Boolean).length,skip=msg=>({fixDirs:b=>b,note:'',msg:'Bore directions not used: '+msg});
  if(bad.length)return skip(`line${bad.length>1?'s':''} ${bad.join(', ')} not read as dX dY dZ.`);
  if(dirs.length!==P.length)return skip(`${dirs.length} line${dirs.length===1?'':'s'} for ${P.length} target points.`);
  if(ptsText!=null){const pn=pointNames(ptsText),k=pn.length===names.length?names.findIndex((nm,i)=>nm&&pn[i]&&nm!==pn[i]):-1;
    if(k>=0)return skip(`line ${k+1} is for ${names[k]}, target point ${k+1} is ${pn[k]}. Use as stations again, or clear the list.`);}
  if(!n)return null;
  const D=orient(P,dirs);
  return{fixDirs:base=>P.map((_,i)=>D[i]||(base&&base[i])||null),note:`, bore direction held at ${n} station${n>1?'s':''}`,msg:''};}

// Before solving. Neighbouring stations with both bore directions held need room for two bends between them: closer than
// 2·R (measured across the bores, along the chord) cannot hold R unless the bores line up. P: points, D: held dirs (null = free)
function closePairs(P,D,R){const out=[];
  for(let i=0;i+1<P.length;i++){const a=D&&D[i],b=D&&D[i+1];if(!a||!b)continue;const ch=sub(P[i+1],P[i]),L=len(ch);if(!(L>0))continue;
    const u=norm(ch),line=Math.min(Math.abs(dot(norm(a),u)),Math.abs(dot(norm(b),u)));
    if(L<2*R&&line<0.999)out.push({i,j:i+1,L});}
  return out;}
// Points that read like pipe corner points (Creo Piping, Single radius) rather than points on a hose: few points, and a sharp
// corner (over 90°) between two long legs (each ≥ R). A hose route through such a corner cannot keep R. Returns the corners.
function cornerLike(P,R){const out=[];if(P.length<3||P.length>40)return out;
  for(let i=1;i+1<P.length;i++){const u=sub(P[i],P[i-1]),v=sub(P[i+1],P[i]),a=len(u),b=len(v);if(!(a>0&&b>0))continue;
    const th=Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(a*b))))*180/Math.PI;if(th>90&&a>=R&&b>=R)out.push({i,deg:th});}
  return out;}

const API={candidates,order,pathLength,twoOpt,orient,stationsText,dirsText,parseDirs,pointNames,forCheck,closePairs,cornerLike};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.ClampStations=API;

// ---------------- UI ----------------
if(typeof document==='undefined'||!document.getElementById('csBox'))return;
// extra: stations picked in the 3D view (a connector port, a CSYS with no hole, a point on a part); kept across refreshes
const CS={own:null,list:[],use:new Set(),start:null,end:null,extra:[],next:1e6};
const say=(m,bad)=>{const e=$('statusCs');e.textContent=m;e.style.color=bad?'var(--bad)':'';};
const openAsm=()=>typeof ASM!=='undefined'&&ASM&&ASM.r?ASM:null;
const src=()=>CS.own||openAsm();
const libOf=r=>typeof FixLib==='undefined'?null:x=>{const I=r.instances&&r.instances[x.inst];return FixLib.match(x.name,x.label,I&&I.part&&I.part.name);};
const opt=r=>({D:Math.max(0.1,+$('csD').value||8),tol:Math.max(0,+$('csTol').value||0),lib:r?libOf(r):null});
// Target points carry the frame picked under the points box (cad-io.js): write the stations in that frame too
const frame=()=>typeof CAD!=='undefined'&&CAD.frame?CAD.frame:null;
const tf=p=>frame()?cadToFrame(p):p,tv=v=>frame()?V.sub(cadToFrame(v),cadToFrame([0,0,0])):v;
const ticked=()=>CS.list.filter(s=>CS.use.has(s.id));
const tag=s=>`${s.name} · ${s.part}`;

function refresh(note){const a=src();$('csUseAsm').hidden=!openAsm()||CS.own===null;
  if(!a){CS.list=[];render();return say('Load a STEP assembly (or open one in Pipe · Check .pts against pipe). A fixing is a hole with a coordinate system on its axis, inside the hole.');}
  const o=opt(a.r),keep=[CS.start,CS.end].map(id=>CS.extra.some(s=>s.id===id)?id:null);
  CS.list=candidates(a.r,o).concat(CS.extra);CS.use=new Set(CS.list.filter(s=>s.use).map(s=>s.id));
  const ends=CS.list.filter(s=>s.use&&s.role==='end');CS.start=ends.length===2?ends[0].id:null;CS.end=ends.length===2?ends[1].id:null;
  if(keep[0]!=null)CS.start=keep[0];if(keep[1]!=null)CS.end=keep[1];
  if(CS.list.length)autoOrder();else render();
  const on=CS.use.size,off=CS.list.length-on;
  say(`${note?note+' ':''}${a.name}: ${on} station${on===1?'':'s'} for a Ø${fmt(o.D)} hose (bore Ø${fmt(o.D-0.2)}–${fmt(o.D+o.tol)})`+
    (ends.length===2?', starting and ending at the two end fittings':'')+(off?`; ${off} other hole${off===1?'':'s'} left unticked`:'')+
    (CS.list.length?'. Check the list, then Use as stations.':'. No bore fits: change Hose Ø or the fit.'),!CS.list.length);}

function autoOrder(){const T=ticked();if(T.length<2){render();return;}
  const idx=id=>T.findIndex(s=>s.id===id),si=CS.start==null?null:idx(CS.start),ei=CS.end==null?null:idx(CS.end);
  const ord=order(T.map(s=>s.c),{start:si<0?null:si,end:ei<0?null:ei}).map(i=>T[i]);
  const rest=CS.list.filter(s=>!CS.use.has(s.id));CS.list=ord.concat(rest);render();}

function render(){const box=$('csList'),T=ticked();
  const opts=sel=>`<option value="">auto</option>`+T.map(s=>`<option value="${s.id}" ${sel===s.id?'selected':''}>${esc(tag(s))}</option>`).join('');
  $('csStart').innerHTML=opts(CS.start);$('csEnd').innerHTML=opts(CS.end);
  $('csAuto').disabled=$('csUse').disabled=T.length<2;
  const why=T.length<2?(CS.list.length?'Tick at least 2 stations.':''):'';['csAuto','csUse'].forEach(id=>$(id).title=why);
  if(!CS.list.length){box.innerHTML='';$('csLen').textContent='';return;}
  let k=0;
  const row=(s,i)=>{const on=CS.use.has(s.id),no=on?++k:0;
    return`<div class="csrow${on?'':' off'}" draggable="true" data-i="${i}"><button type="button" class="csgrip" data-grip="${i}" aria-label="Move ${esc(s.name)}: drag, or Up / Down arrow keys" title="Drag to reorder (or focus and press ↑ / ↓)">⠿</button>`+
      `<label class="chk cdp"><input type="checkbox" data-id="${s.id}" ${on?'checked':''}><span><b>${no?'S'+no+' ':''}${esc(s.name)}</b> <span class="unit">${esc(s.part)} · ${s.D?`bore Ø${fmt(s.D,2)} × ${fmt(s.length,1)} mm`:s.d?'direction from its CSYS':'point, direction free'} · ${s.c.map(v=>Math.round(v)).join(', ')}</span>`+(s.role==='picked'?` <button type="button" class="linkish" data-drop="${s.id}">remove</button>`:'')+
      (s.reason?`<span class="csrole csrole-${esc(s.role||'')}">${esc(s.reason)}</span>`:'')+`</span></label></div>`;};
  // short holes nobody ticked go under one fold, so the list shows what the route uses
  const hide=s=>s.role==='hole'&&!CS.use.has(s.id),main=CS.list.map((s,i)=>[s,i]).filter(([s])=>!hide(s)),rest=CS.list.map((s,i)=>[s,i]).filter(([s])=>hide(s));
  box.innerHTML=main.map(([s,i])=>row(s,i)).join('')+(rest.length?`<details class="csmore"${CS.moreOpen?' open':''}><summary>Other holes (${rest.length}): bolt and plate holes, unticked</summary>${rest.map(([s,i])=>row(s,i)).join('')}</details>`:'');
  const more=box.querySelector('.csmore');if(more)more.ontoggle=()=>{CS.moreOpen=more.open;};
  $('csLen').textContent=T.length>1?`${T.length} stations, ${fmt(pathLength(T.map(s=>s.c),T.map((_,i)=>i)),0)} mm straight-line path`:'Tick at least 2 stations to order them.';
  box.querySelectorAll('[data-drop]').forEach(b=>b.onclick=e=>{e.preventDefault();const id=+b.dataset.drop;CS.extra=CS.extra.filter(s=>s.id!==id);
    CS.list=CS.list.filter(s=>s.id!==id);CS.use.delete(id);if(CS.start===id)CS.start=null;if(CS.end===id)CS.end=null;autoOrder();});
  box.querySelectorAll('input[data-id]').forEach(el=>el.onchange=()=>{const id=+el.dataset.id;if(el.checked)CS.use.add(id);else{CS.use.delete(id);if(CS.start===id)CS.start=null;if(CS.end===id)CS.end=null;}render();});
  let drag=-1;
  box.querySelectorAll('.csrow').forEach(row=>{const i=+row.dataset.i;
    row.ondragstart=e=>{drag=i;row.classList.add('drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(i));}catch(x){}};
    row.ondragend=()=>{drag=-1;row.classList.remove('drag');};
    row.ondragover=e=>{if(drag<0)return;e.preventDefault();row.classList.add('over');};
    row.ondragleave=()=>row.classList.remove('over');
    row.ondrop=e=>{e.preventDefault();e.stopPropagation();row.classList.remove('over');if(drag>=0&&drag!==i)move(drag,i);};});
  box.querySelectorAll('[data-grip]').forEach(b=>b.onkeydown=e=>{const i=+b.dataset.grip,j=e.key==='ArrowUp'?i-1:e.key==='ArrowDown'?i+1:-1;
    if(j<0||j>=CS.list.length)return;e.preventDefault();move(i,j);const g=box.querySelector(`[data-grip="${j}"]`);if(g)g.focus();});}
// a hand-made order: start / end pickers go back to auto so they never contradict the list
function move(from,to){const [s]=CS.list.splice(from,1);CS.list.splice(to,0,s);CS.start=CS.end=null;render();}

function useAsStations(){const T=ticked();if(T.length<2)return;
  const write=()=>{$('csAsk').hidden=true;
    $('pts').value=stationsText(T,tf);$('pts').dispatchEvent(new Event('input'));store.set('rs.pts',$('pts').value);
    $('csDirs').value=$('csHold').checked?dirsText(T,tv):'';store.set('rs.csDirs',$('csDirs').value);
    const f=frame(),R=+$('r').value||65,near=$('csHold').checked?closePairs(T.map(s=>s.c),orient(T.map(s=>s.c),T.map(s=>s.d)),R):[];
    const warn=near.length?` Too close for R ${fmt(R)} with the bores held: ${near.map(p=>`S${p.i+1}–S${p.j+1} ${fmt(p.L,0)} mm apart`).join(', ')} (need ${fmt(2*R,0)} mm unless the bores line up). Untick one of each pair, or untick “Hold the bore direction”.`:'';
    say(`${T.length} stations written to Target points${f?` (in the ${f.name} frame)`:''}${$('csHold').checked?', bore directions below':''}.${warn}`,!!near.length);
    if(typeof nextSteps==='function')nextSteps('statusCs',[{label:'Check now',go:()=>$('runBend').click()}].concat(near.length?[{label:'Untick “Hold the bore direction”',go:()=>{$('csHold').checked=false;$('csHold').dispatchEvent(new Event('change'));say('Bore directions off: Check uses the start / end directions only.');}}]:[]));};
  if(!$('pts').value.trim())return write();
  $('csAskTxt').textContent=`Target points already hold ${parsePts($('pts').value).length} point(s). Replace them with the ${T.length} clamp stations?`;
  $('csAsk').hidden=false;$('csYes').onclick=write;$('csNo').onclick=()=>{$('csAsk').hidden=true;say('Target points kept.');};$('csYes').focus();}

// Check (route-studio.js runBend) asks for the held directions; null = none, Check runs as before
root.clampStationDirs=P=>$('csHold').checked?forCheck(P,$('csDirs').value,$('pts').value):null;
$('csClearDirs').onclick=()=>{$('csDirs').value='';store.set('rs.csDirs','');say('Bore directions cleared: Check uses the start / end directions only.');};

function load(file){say(`Reading ${file.name}...`);
  file.text().then(text=>{let r;try{r=StepAsm.parse(text);}catch(e){return say(`${file.name}: ${e.message}`,true);}
    CS.own={name:file.name,r};refresh();});}
$('csLoad').onclick=()=>$('csFile').click();
// Load here = open the assembly for the whole page (shell.js), so Keep clear and Pipe get it too
$('csFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(typeof openAssembly==='function'){CS.own=null;openAssembly(f);}else load(f);};
document.addEventListener('asm:loaded',()=>{if(!CS.own&&!$('csBox').hidden)refresh();});
$('csUseAsm').onclick=()=>{CS.own=null;refresh();};
$('csAuto').onclick=autoOrder;
$('csUse').onclick=useAsStations;
['csStart','csEnd'].forEach(id=>$(id).onchange=()=>{const v=$(id).value===''?null:+$(id).value;if(id==='csStart')CS.start=v;else CS.end=v;autoOrder();});
['csD','csTol'].forEach(id=>$(id).onchange=()=>refresh());
$('csDirs').oninput=()=>store.set('rs.csDirs',$('csDirs').value);
$('csHold').onchange=()=>store.set('rs.csHold',$('csHold').checked?'1':'0');
// opening the section picks up an assembly opened elsewhere since
$('csBox').addEventListener('toggle',()=>{if($('csBox').open&&!CS.own&&openAsm()&&!CS.list.length)refresh();});
// ---- stations from the 3D view (asm-view.js): a CSYS, or a point on a part (snapped to its nearest hole) ----
// as: 'start' | 'end' | 'station'. A hole already in the list is used as it is; anything else becomes a picked station.
function fromPick(p,r){
  if(p.kind==='csys'){const c=p.c,h=c.hole,I=r.instances[h?h.inst:c.inst]||{};
    return{name:c.name,part:I.name||'',label:I.label||'',c:h?h.c:c.o,d:h?h.d:c.z,D:h?h.D:null,length:h?h.length:0};}
  const I=r.instances[p.inst]||{},near=r.holes.filter(h=>h.inst===p.inst).map(h=>({h,e:len(sub(h.c,p.p))})).sort((a,b)=>a.e-b.e)[0];
  if(near&&near.e<=Math.max(30,3*near.h.r)){const h=near.h;return{name:h.csys||`${I.name} Ø${fmt(h.D,1)} hole`,part:I.name||'',label:I.label||'',c:h.c,d:h.d,D:h.D,length:h.length,snapped:true};}
  return{name:`${I.name||'part'} point`,part:I.name||'',label:I.label||'',c:p.p,d:null,D:null,length:0};}
function usePick(p,r,as){
  if(!CS.list.length&&src())refresh();
  const st=fromPick(p,r);let s=CS.list.find(x=>len(sub(x.c,st.c))<0.5);
  if(!s){s={id:CS.next++,...st,role:'picked',use:true,reason:'picked in 3D'};CS.extra.push(s);CS.list.push(s);}
  CS.use.add(s.id);if(as==='start'){CS.start=s.id;if(CS.end===s.id)CS.end=null;}if(as==='end'){CS.end=s.id;if(CS.start===s.id)CS.start=null;}
  $('csBox').open=true;autoOrder();
  const what=as==='station'?'added as a station':`is the ${as}`;
  say(`${s.name} ${what}${st.snapped?' (snapped to the nearest hole of the part you clicked)':''}. ${ticked().length} stations ticked.`);
  return`${s.name} ${what}${st.snapped?', snapped to the part’s nearest hole':''}${s.d?'':' (direction left free)'}.`;}
(root.AV_ACTIONS=root.AV_ACTIONS||[]).push((p,r)=>$('csBox').hidden?[]:[
  {label:'Use as start',go:x=>usePick(x,r,'start'),title:'First station of the hose route (Stations from clamps)',order:1},
  {label:'Use as end',go:x=>usePick(x,r,'end'),title:'Last station of the hose route',order:1},
  {label:'Add as station',go:x=>usePick(x,r,'station'),title:'A station the hose passes through',order:1}]);

// lines + arcs (Pipe · Route through points) holds no tangents at stations: the section is for the spline route only
const dWrap=()=>$('cdD').closest('div');
const sync=()=>{const arc=$('shape').value==='arc';$('csBox').hidden=arc;dWrap().hidden=!arc;if(!arc&&$('cdD').value!==$('csD').value){$('cdD').value=$('csD').value;$('cdD').dispatchEvent(new Event('change'));}};
$('csD').addEventListener('change',()=>{if($('shape').value!=='arc'){$('cdD').value=$('csD').value;$('cdD').dispatchEvent(new Event('change'));}});$('shape').addEventListener('change',sync);sync();
$('csDirs').value=store.get('rs.csDirs')||'';$('csHold').checked=store.get('rs.csHold')!=='0';
render();
})(typeof globalThis!=="undefined"?globalThis:this);
