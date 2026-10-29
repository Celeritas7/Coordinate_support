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
    role:c.role,use:c.use,reason:c.reason,inst:c.inst,lib:c.lib}));}

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
    if(k>=0)return skip(`line ${k+1} is for ${names[k]}, target point ${k+1} is ${pn[k]}. Check route rewrites them from the station list; or clear the directions.`);}
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
// picked: ids of the stations picked in the 3D view (a hole already in the list keeps its id)
// from: name of the assembly the extras were picked in (their points mean nothing in another file)
const CS={own:null,list:[],use:new Set(),start:null,end:null,extra:[],from:null,next:1e6,near:new Map(),picked:new Set(),free:new Set(),hand:new Map(),srcName:null,armed:null};
// a start and an end both set: tick only the holes within BETWEEN mm of the straight line from start to end (start, end and
// stations picked in 3D stay ticked); the rest stay listed, unticked. A tick set by hand stays as the user set it (CS.hand:
// id → ticked), so picking the end does not wipe the rows ticked or unticked in the list
const BETWEEN=150;
function between(){const a=CS.list.find(s=>s.id===CS.start),b=CS.list.find(s=>s.id===CS.end);if(!a||!b)return'';
  const ab=sub(b.c,a.c),L2=dot(ab,ab)||1e-12,off=c=>{const t=Math.max(0,Math.min(1,dot(sub(c,a.c),ab)/L2));return dist(c,[0,1,2].map(k=>a.c[k]+ab[k]*t));};
  const pool=CS.list.filter(s=>CS.hand.has(s.id)?CS.hand.get(s.id):s.use||CS.picked.has(s.id));CS.near.clear();
  CS.use=new Set(pool.filter(s=>s.id===a.id||s.id===b.id||CS.picked.has(s.id)||CS.hand.get(s.id)||off(s.c)<=BETWEEN).map(s=>s.id));
  autoOrder();return`${CS.use.size} of ${pool.length} holes ticked, the ones between start and end. Tick more in the list.`;}
const say=(m,bad)=>{const e=$('statusCs');e.textContent=m;e.style.color=bad?'var(--bad)':'';if(typeof nextClear==='function')nextClear('statusCs');};
const openAsm=()=>typeof ASM!=='undefined'&&ASM&&ASM.r?ASM:null;
const src=()=>CS.own||openAsm();
const libOf=r=>typeof FixLib==='undefined'?null:x=>{const I=r.instances&&r.instances[x.inst];return FixLib.match(x.name,x.label,I&&I.part&&I.part.name);};
const opt=r=>({D:Math.max(0.1,+$('csD').value||8),tol:Math.max(0,+$('csTol').value||0),lib:r?libOf(r):null});
// Target points carry the frame picked under the points box (cad-io.js): write the stations in that frame too
const frame=()=>typeof CAD!=='undefined'&&CAD.frame?CAD.frame:null;
const tf=p=>frame()?cadToFrame(p):p,tv=v=>frame()?V.sub(cadToFrame(v),cadToFrame([0,0,0])):v;
const ticked=()=>CS.list.filter(s=>CS.use.has(s.id));
const tag=s=>`${s.name} · ${s.part}`;
const addExtra=s=>{if(!CS.extra.length)CS.from=openAsm()?openAsm().name:null;CS.extra.push(s);CS.list.push(s);};
// another file opened: its stations picked in 3D (and Start / End on them) go; the same file re-read (pipe marks changed) keeps them
function dropExtra(name){if(!CS.extra.length||CS.from===name)return;const gone=new Set(CS.extra.map(s=>s.id));CS.extra=[];CS.from=null;
  CS.list=CS.list.filter(s=>!gone.has(s.id));gone.forEach(id=>{CS.use.delete(id);CS.picked.delete(id);CS.near.delete(id);});
  if(gone.has(CS.start))CS.start=null;if(gone.has(CS.end))CS.end=null;}

// a refresh (Hose Ø or the fit changed, the file re-read) rebuilds the list with new ids: holes of the same file that were
// picked in 3D stay picked and ticked (found again by position), and Start / End on them stay
const atKey=c=>c.map(v=>v.toFixed(1)).join(' ');
function refresh(note){const a=src();
  const same=a&&CS.srcName===a.name,was=same?CS.list.filter(s=>CS.picked.has(s.id)&&!CS.extra.includes(s)):[],wasKey=new Set(was.map(s=>atKey(s.c))),
    endKey=[CS.start,CS.end].map(id=>{const s=was.find(x=>x.id===id);return s?atKey(s.c):null;}),
    handKey=new Map(same?CS.list.filter(s=>CS.hand.has(s.id)).map(s=>[atKey(s.c),CS.hand.get(s.id)]):[]);
  CS.near=new Map();CS.free=new Set();CS.hand=new Map();CS.picked=new Set(CS.extra.map(s=>s.id));CS.srcName=a?a.name:null;$('csUseAsm').hidden=!openAsm()||CS.own===null;
  if(!a){CS.list=[];render();return say('Load a STEP assembly (or open one in Pipe · Check .pts against pipe). A fixing is a hole with a coordinate system on its axis, inside the hole.');}
  const o=opt(a.r),keep=[CS.start,CS.end].map(id=>CS.extra.some(s=>s.id===id)?id:null);
  CS.list=candidates(a.r,o).concat(CS.extra);CS.use=new Set(CS.list.filter(s=>s.use).map(s=>s.id));
  const ends=CS.list.filter(s=>s.use&&s.role==='end');CS.start=ends.length===2?ends[0].id:null;CS.end=ends.length===2?ends[1].id:null;
  if(keep[0]!=null)CS.start=keep[0];if(keep[1]!=null)CS.end=keep[1];
  CS.list.forEach(s=>{const k=atKey(s.c);if(handKey.has(k)){CS.hand.set(s.id,handKey.get(k));if(handKey.get(k))CS.use.add(s.id);else CS.use.delete(s.id);}
    if(!wasKey.has(k))return;CS.picked.add(s.id);CS.use.add(s.id);if(k===endKey[0])CS.start=s.id;if(k===endKey[1])CS.end=s.id;});
  // Start and End picked in 3D kept: the holes between them are ticked again, as when they were picked
  if(CS.list.length&&endKey[0]&&endKey[1]&&CS.start!=null&&CS.end!=null)between();else if(CS.list.length)autoOrder();else render();
  const on=CS.use.size,off=CS.list.length-on;
  say(`${note?note+' ':''}${a.name}: ${on} station${on===1?'':'s'} for a Ø${fmt(o.D)} hose (bore Ø${fmt(o.D-0.2)}–${fmt(o.D+o.tol)})`+
    (ends.length===2?', starting and ending at the two end fittings':'')+(off?`; ${off} other hole${off===1?'':'s'} left unticked`:'')+
    (CS.list.length?'. Check route uses the ticked ones.':'. No bore fits: change Hose Ø or the fit.'),!CS.list.length);}

function autoOrder(){const T=ticked();if(T.length<2){render();return;}
  const idx=id=>T.findIndex(s=>s.id===id),si=CS.start==null?null:idx(CS.start),ei=CS.end==null?null:idx(CS.end);
  const ord=order(T.map(s=>s.c),{start:si<0?null:si,end:ei<0?null:ei}).map(i=>T[i]);
  const rest=CS.list.filter(s=>!CS.use.has(s.id));CS.list=ord.concat(rest);render();}

// clamps the hose's ticked stations use (end fittings and points picked in 3D not counted), for the assembly line
const CLAMP=new Set(['fixing','clip','clamp','grommet']);
root.csCount=()=>CS.list.length&&openAsm()&&!CS.own?{n:ticked().filter(s=>CLAMP.has(s.role)||s.lib).length,D:+$('csD').value||8}:null;
function render(){document.dispatchEvent(new Event('cs:changed'));const box=$('csList'),T=ticked();
  // the name only (the select is narrow); the part in the tooltip
  const opts=sel=>`<option value="">auto</option>`+T.map(s=>`<option value="${s.id}" title="${esc(tag(s))}" ${sel===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
  $('csStart').innerHTML=opts(CS.start);$('csEnd').innerHTML=opts(CS.end);
  $('csAuto').disabled=T.length<2;$('csNone').disabled=!T.length;$('csPicked').disabled=!CS.list.some(s=>CS.picked.has(s.id));
  const why=T.length<2?(CS.list.length?'Tick at least 2 stations.':''):'';$('csAuto').title=why;
  // Check route reads this list once it is built: say why it will not run
  $('runBend').title=CS.list.length&&!$('csBox').hidden&&T.length<2?'Tick at least 2 stations.':'';
  if(!CS.list.length){box.innerHTML='';$('csLen').textContent='';return;}
  let k=0;
  // two lines: S2 · name · part … bore | reason (marker + words) … position. The reason is its own element.
  const T1=ticked(),first=T1[0],last=T1[T1.length-1],pos=c=>c.map(v=>Math.round(v)).join(' ').replace(/-/g,'−');
  const lib=typeof FixLib!=='undefined'&&openAsm();
  const row=(s,i)=>{const on=CS.use.has(s.id),no=on?++k:0;
    const nr=on&&CS.near.get(s.id),picked=s.role==='picked'||CS.picked.has(s.id),end=s.role==='end'&&on?(s===first?' · start':s===last?' · end':''):'';
    const bore=s.D?`Ø${fmt(s.D,1)} × ${+fmt(s.length,1)}`:s.d?'CSYS direction':'direction free';
    const add=s.role==='fixing'&&lib&&s.inst!=null?` · <button type="button" class="linkish" data-addlib="${s.inst}" title="Add ${esc(s.part)} to the Library">Add…</button>`:'';
    const rm=picked&&CS.extra.some(x=>x.id===s.id)?` · <button type="button" class="linkish" data-drop="${s.id}">remove</button>`:'';
    const kind=s.role==='end'?'end':s.role==='fixing'?'fixing':s.lib||s.role==='clip'||s.role==='clamp'||s.role==='grommet'?'lib':'other';
    return`<div class="csrow${on?'':' off'}${nr?' near':''}" draggable="true" data-i="${i}"><button type="button" class="csgrip" data-grip="${i}" aria-label="Move ${esc(s.name)}: drag, or Up / Down arrow keys" title="Drag to reorder (or focus and press ↑ / ↓)">⠿</button>`+
      `<label class="chk cdp"><input type="checkbox" data-id="${s.id}" ${on?'checked':''}><span class="cstxt"><span class="cs1"><b>${no?'S'+no+' · ':''}${esc(s.name)}</b>${picked?'<span class="cs3d" title="Picked in 3D">3D</span>':''}`+
      `<span class="cspart" title="${esc(s.label||s.part||'')}">${esc(s.part||'')}</span><span class="csbore">${bore}</span></span>`+
      `<span class="cs2"><span class="csrole csrole-${kind}"${s.lib?` title="${esc(s.lib.pattern)}"`:''}><i class="csmk" aria-hidden="true"></i>${esc(s.reason||'')}${end}${add}${rm}</span><span class="cspos">${pos(s.c)}</span></span>`+
      (nr?`<span class="csnear">${nr.map(x=>`too close to ${x.to}: ${fmt(x.L,0)} mm, needs ${fmt(x.need,0)}`).join('; ')}</span>`:'')+`</span></label></div>`;};
  // short holes nobody ticked go under one fold, so the list shows what the route uses
  const hide=s=>s.role==='hole'&&!CS.use.has(s.id),main=CS.list.map((s,i)=>[s,i]).filter(([s])=>!hide(s)),rest=CS.list.map((s,i)=>[s,i]).filter(([s])=>hide(s));
  box.innerHTML=main.map(([s,i])=>row(s,i)).join('')+(rest.length?`<details class="csmore"${CS.moreOpen?' open':''}><summary>Other holes that fit Ø${+$('csD').value||8} (${rest.length})</summary>${rest.map(([s,i])=>row(s,i)).join('')}</details>`:'');
  const more=box.querySelector('.csmore');if(more)more.ontoggle=()=>{CS.moreOpen=more.open;};
  $('csLen').textContent=T.length>1?`${T.length} stations, ${fmt(pathLength(T.map(s=>s.c),T.map((_,i)=>i)),0)} mm straight-line path`:'Tick at least 2 stations to order them.';
  box.querySelectorAll('[data-addlib]').forEach(b=>b.onclick=e=>{e.preventDefault();const a=openAsm();if(!a)return;const x=FixLib.addFromPart(a.r,+b.dataset.addlib);
    if(!x)return say('Not added.',true);
    // the rows of that part become Library rows; ticks and order stay as they are
    const fresh=candidates(a.r,opt(a.r));CS.list.forEach(s=>{const f=fresh.find(q=>len(sub(q.c,s.c))<0.5&&q.inst===s.inst);if(f&&s.role!=='picked')Object.assign(s,{role:f.role,reason:f.reason,lib:f.lib});});
    render();say(`${x.pattern} added to the Library as a ${x.type} (bore Ø${fmt(x.boreMin,1)}–${fmt(x.boreMax,1)}). Edit it under Library.`);});
  box.querySelectorAll('[data-drop]').forEach(b=>b.onclick=e=>{e.preventDefault();const id=+b.dataset.drop;CS.extra=CS.extra.filter(s=>s.id!==id);
    CS.list=CS.list.filter(s=>s.id!==id);CS.use.delete(id);if(CS.start===id)CS.start=null;if(CS.end===id)CS.end=null;autoOrder();});
  box.querySelectorAll('input[data-id]').forEach(el=>el.onchange=()=>{const id=+el.dataset.id;CS.near.clear();CS.hand.set(id,el.checked);if(el.checked)CS.use.add(id);else{CS.use.delete(id);if(CS.start===id)CS.start=null;if(CS.end===id)CS.end=null;}render();});
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
function move(from,to){CS.near.clear();const [s]=CS.list.splice(from,1);CS.list.splice(to,0,s);CS.start=CS.end=null;render();}

// Check route and Alternatives read the ticked rows (no Use as stations step): just before they run, the ticked stations
// and their held bore axes are written into Target points and Bore directions, so those always show what was routed.
// A station freed after a too-close warning stays free (CS.free) until the list is rebuilt. Returns null when the list is not
// in use (empty, or the section hidden: Pipe), {n, short:true} with fewer than 2 ticked, else {n, near:[{i, j, L, a, b}], R}.
function syncStations(){if($('csBox').hidden||!CS.list.length)return null;const T=ticked();if(T.length<2)return{n:T.length,short:true};
  const hold=$('csHold').checked,TD=T.map(s=>CS.free.has(s.id)?{...s,d:null}:s);
  $('pts').value=stationsText(T,tf);store.set('rs.pts',$('pts').value);
  $('csDirs').value=hold?dirsText(TD,tv):'';store.set('rs.csDirs',$('csDirs').value);
  const R=+$('r').value||65,near=hold?closePairs(T.map(s=>s.c),orient(T.map(s=>s.c),TD.map(s=>s.d)),R):[];
  // each pair in amber in the list, with its gap
  CS.near=new Map();near.forEach(p=>[[p.i,p.j],[p.j,p.i]].forEach(([a,b])=>{const id=T[a].id;if(!CS.near.has(id))CS.near.set(id,[]);CS.near.get(id).push({to:`S${b+1}`,L:p.L,need:2*R});}));
  render();return{n:T.length,R,near:near.map(p=>({...p,a:T[p.i],b:T[p.j]}))};}
root.csSync=syncStations;
// free the bore direction of these stations (the too-close pre-check's Next)
root.csFree=ids=>{ids.forEach(id=>CS.free.add(id));CS.near.clear();render();};

// Check (route-studio.js runBend) asks for the held directions; null = none, Check runs as before
root.clampStationDirs=P=>$('csHold').checked?forCheck(P,$('csDirs').value,$('pts').value):null;
$('csClearDirs').onclick=()=>{$('csDirs').value='';store.set('rs.csDirs','');say('Bore directions cleared: Check uses the start / end directions only.');};

function load(file){say(`Reading ${file.name}...`);
  file.text().then(text=>{let r;try{r=StepAsm.parse(text);}catch(e){return say(`${file.name}: ${e.message}`,true);}
    CS.own={name:file.name,r};refresh();});}
$('csLoad').onclick=()=>$('csFile').click();
// Load here = open the assembly for the whole page (shell.js), so Keep clear and Pipe get it too
$('csFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(typeof openAssembly==='function'){CS.own=null;openAssembly(f);}else load(f);};
document.addEventListener('asm:loaded',e=>{dropExtra(e.detail&&e.detail.name);if(!CS.own&&!$('csBox').hidden)refresh();else render();});
$('csUseAsm').onclick=()=>{CS.own=null;refresh();};
$('csAuto').onclick=autoOrder;
$('csNone').onclick=()=>{CS.use.clear();CS.near.clear();CS.hand=new Map(CS.list.map(s=>[s.id,false]));CS.start=CS.end=null;render();say(`All ${CS.list.length} unticked. Tick stations in the list, or pick them in 3D.`);};
$('csPicked').onclick=()=>{CS.use=new Set(CS.list.filter(s=>CS.picked.has(s.id)).map(s=>s.id));CS.near.clear();CS.hand=new Map();
  if(!CS.use.has(CS.start))CS.start=null;if(!CS.use.has(CS.end))CS.end=null;autoOrder();say(`${CS.use.size} station${CS.use.size===1?'':'s'} picked in 3D ticked; the rest unticked.`);};
['csStart','csEnd'].forEach(id=>$(id).onchange=()=>{const v=$(id).value===''?null:+$(id).value;if(id==='csStart')CS.start=v;else CS.end=v;
  const bt=CS.start!=null&&CS.end!=null?between():'';if(bt)say(bt);else autoOrder();});
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
  if(near&&near.e<=Math.max(30,3*near.h.r)){const h=near.h;return{name:h.csys||`${I.name} Ø${fmt(h.D,1)} hole`,part:I.name||'',label:I.label||'',c:h.c,d:h.d,D:h.D,length:h.length,snapped:near.e};}
  return{name:`${I.name||'part'} point`,part:I.name||'',label:I.label||'',c:p.p,d:null,D:null,length:0};}
function usePick(p,r,as){
  if(!CS.list.length&&src())refresh();
  const st=fromPick(p,r);let s=CS.list.find(x=>len(sub(x.c,st.c))<0.5);
  if(!s){s={id:CS.next++,...st,role:'picked',use:true,reason:'Picked in 3D'};addExtra(s);}
  CS.use.add(s.id);CS.picked.add(s.id);if(as==='start'){CS.start=s.id;if(CS.end===s.id)CS.end=null;}if(as==='end'){CS.end=s.id;if(CS.start===s.id)CS.start=null;}
  $('csBox').open=true;const bt=as!=='station'&&CS.start!=null&&CS.end!=null?between():'';if(!bt)autoOrder();
  const verb=as==='station'?'Station added':as==='start'?'Start set':'End set',on=st.part?` on ${st.part}`:'';
  const m=st.snapped!=null?`${verb} to the Ø${fmt(st.D,1)} hole${on}, ${fmt(st.snapped,0)} mm from where you clicked.`
    :p.kind==='csys'?(st.D?`${verb} to ${st.name} (Ø${fmt(st.D,1)} hole${on}).`:`${verb} to ${st.name}. No hole there: its Z axis is the hose direction.`)
    :`${verb} to the clicked point${on}; direction free.`;
  say(bt?`${m} ${bt}`:`${m} ${ticked().length} stations ticked.`);return bt?`${m} ${bt}`:m;}
// an empty Start or End is filled by the next click on a part or CSYS in 3D (Hose · Route through stations, an assembly open).
// The pick panel says so and offers Undo (focused) and Make it the end / start; CS.armed holds what Undo puts back.
const snap=()=>({list:CS.list.slice(),extra:CS.extra.slice(),from:CS.from,use:new Set(CS.use),picked:new Set(CS.picked),hand:new Map(CS.hand),start:CS.start,end:CS.end,
  near:new Map(CS.near),next:CS.next});
const armed=()=>!$('csBox').hidden&&$('shape').value!=='arc'&&!!openAsm()&&!CS.own&&(CS.start==null||CS.end==null);
document.addEventListener('asm:pick',e=>{const p=e.detail;CS.armed=null;if(!p||(p.kind!=='csys'&&p.kind!=='part')||(p.kind==='csys'&&p.c.made)||!armed())return;
  const as=CS.start==null?'start':'end',before=snap(),m=usePick(p,openAsm().r,as);
  CS.armed={p,as,before,id:as==='start'?CS.start:CS.end};
  if(typeof asmSay==='function')asmSay(m,'Undo');});
function undoArmed(){const a=CS.armed;if(!a)return'';Object.assign(CS,a.before);CS.armed=null;autoOrder();
  const t=`${a.as==='start'?'Start':'End'} cleared.`;say(t);return t;}
function swapArmed(){const a=CS.armed;if(!a)return'';const id=a.id;
  if(a.as==='start'){CS.start=a.before.start;CS.end=id;a.as='end';}else{CS.end=a.before.end;CS.start=id;a.as='start';}
  const bt=CS.start!=null&&CS.end!=null?between():'';if(!bt)autoOrder();const s=CS.list.find(x=>x.id===id),t=`${a.as==='start'?'Start':'End'} set to ${s?s.name:'it'} instead.${bt?' '+bt:''}`;say(t);return t;}
// for Suggest extra clamps (clamp-suggest.js): what is ticked, and adding its suggestions as stations
root.clampStationsTicked=()=>ticked();
root.csAddStations=L=>{if(!CS.list.length&&src())refresh();
  L.forEach(st=>{if(CS.list.some(x=>len(sub(x.c,st.c))<0.5))return;const s={id:CS.next++,label:'',D:null,length:0,...st,role:'picked',use:true,reason:'Suggested clamp'};
    addExtra(s);CS.use.add(s.id);});
  $('csBox').open=true;autoOrder();say(`${L.length} suggested clamps added; ${ticked().length} stations ticked. Check route again.`);};
// the Route group: start → end → station, the first one still needed is the primary button. Right after an armed click:
// Undo · Make it the end (or start) instead
(root.AV_ACTIONS=root.AV_ACTIONS||[]).push((p,r)=>{if($('csBox').hidden||(p.kind!=='csys'&&p.kind!=='part'))return[];
  if(CS.armed&&CS.armed.p===p){const other=CS.armed.as==='start'?'end':'start';
    return[{group:'Route',label:'Undo',go:()=>undoArmed(),title:`Clear the ${CS.armed.as} again`,order:1,primary:true},
      {group:'Route',label:`Make it the ${other}`,go:()=>swapArmed(),order:2}];}
  const need=CS.start==null?'start':CS.end==null?'end':'station';
  return[{group:'Route',label:'Use as start',go:x=>usePick(x,r,'start'),title:'First station of the hose route',order:1,primary:need==='start'},
    {group:'Route',label:'Use as end',go:x=>usePick(x,r,'end'),title:'Last station of the hose route',order:2,primary:need==='end'},
    {group:'Route',label:'Add as station',go:x=>usePick(x,r,'station'),title:'A station the hose passes through (Stations from clamps)',order:3,primary:need==='station'}];});

// lines + arcs (Pipe · Route through points) holds no tangents at stations: the section is for the spline route only
const dWrap=()=>$('cdD').closest('div');
const sync=()=>{const arc=$('shape').value==='arc';$('csBox').hidden=arc;dWrap().hidden=!arc;if(!arc&&$('cdD').value!==$('csD').value){$('cdD').value=$('csD').value;$('cdD').dispatchEvent(new Event('change'));}};
$('csD').addEventListener('change',()=>{if($('shape').value!=='arc'){$('cdD').value=$('csD').value;$('cdD').dispatchEvent(new Event('change'));}});$('shape').addEventListener('change',sync);sync();
$('csDirs').value=store.get('rs.csDirs')||'';$('csHold').checked=store.get('rs.csHold')!=='0';
render();
})(typeof globalThis!=="undefined"?globalThis:this);
