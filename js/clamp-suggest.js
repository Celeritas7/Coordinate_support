/* clamp-suggest.js — where to add clamps on a route (Q7).
 * A route held by the clamps it passes is supported at those stations (and its two ends). Extra clamps are suggested:
 *  - near each bend: one within `nearBend` mm before the bend starts and one after it ends, unless a support is already there
 *    (a bend is where the route is tighter than 4 × R: straights and gentle sweeps are not bends);
 *  - along every span still longer than `maxSpan`, evenly, so no span is over it.
 * Each suggestion gets the part it can be mounted on (the nearest solid within `reach` mm, existing pipes left out) and the
 * clamp it should be like: an existing station on the same mounting part (nearest along the route), else the nearest
 * station along the route. That is the rule "clamp type follows the location" until the user gives a rule table.
 * No DOM in the logic: Node require('./clamp-suggest.js'). The UI block runs only in the page (after csys-make.js).
 */
(function (root) {
"use strict";
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
function boxDist(p,b){let s=0;for(let k=0;k<3;k++){const d=Math.max(b.min[k]-p[k],0,p[k]-b.max[k]);s+=d*d;}return Math.sqrt(s);}

// route: {pts, s (arc length per point), k (curvature per point)}; stations: [{name, c, part}];
// solids: [{name, faces:[{min,max}], pipe?}]. Returns {L, supports, list:[{s, p, t, why, mount, like}], spans}
function suggest(route,stations,opts={}){
  const P=route.pts,S=route.s,K=route.k||P.map(()=>0),n=P.length,L=S[n-1];
  const maxSpan=+opts.maxSpan||300,nearBend=opts.nearBend==null?60:+opts.nearBend,R=+opts.R||65,reach=opts.reach==null?60:+opts.reach,
    bends=opts.bends!==false,minGap=Math.max(1,opts.minGap==null?Math.min(maxSpan,nearBend*2)/2:+opts.minGap),solids=(opts.solids||[]).filter(x=>!x.pipe);
  const at=s=>{let i=0;while(i<n-1&&S[i+1]<s)i++;const t=S[i+1]>S[i]?(s-S[i])/(S[i+1]-S[i]):0;
    return{p:[0,1,2].map(k=>P[i][k]+(P[Math.min(i+1,n-1)][k]-P[i][k])*t),t:norm(sub(P[Math.min(i+1,n-1)],P[i]))};};
  const onRoute=c=>{let bi=0,bd=Infinity;for(let i=0;i<n;i++){const d=len(sub(P[i],c));if(d<bd){bd=d;bi=i;}}return{s:S[bi],d:bd};};
  // supports: the stations the route passes (within 5 mm), and the two ends
  const sup=stations.map(st=>({...st,...onRoute(st.c)})).filter(x=>x.d<=5).map(x=>({s:x.s,name:x.name,part:x.part||'',c:x.c,i:x.i}));
  if(!sup.some(x=>x.s<minGap))sup.push({s:0,name:'route start',end:true});
  if(!sup.some(x=>x.s>L-minGap))sup.push({s:L,name:'route end',end:true});
  sup.sort((a,b)=>a.s-b.s);
  const all=sup.slice(),out=[],free=s=>!all.some(x=>Math.abs(x.s-s)<minGap);
  const put=(s,why)=>{s=Math.max(0,Math.min(L,s));if(!free(s))return;const q={s,why,new:true};all.push(q);all.sort((a,b)=>a.s-b.s);out.push(q);};
  // bends: runs of points tighter than 4R
  if(bends){const kb=1/(4*R);let i=0;
    while(i<n){if(K[i]<=kb){i++;continue;}let j=i;while(j+1<n&&K[j+1]>kb)j++;
      const a=S[i],b=S[j],tight=1/Math.max(...K.slice(i,j+1));
      if(!all.some(x=>x.s<=a&&x.s>=a-nearBend))put(a-nearBend/2,`before the bend at ${Math.round(a)}–${Math.round(b)} mm (R ${Math.round(tight)})`);
      if(!all.some(x=>x.s>=b&&x.s<=b+nearBend))put(b+nearBend/2,`after the bend at ${Math.round(a)}–${Math.round(b)} mm (R ${Math.round(tight)})`);
      i=j+1;}}
  // spans still over maxSpan: fill evenly
  const spans=[];
  for(let pass=0;pass<2;pass++){const cur=all.slice().sort((a,b)=>a.s-b.s);
    for(let k=0;k+1<cur.length;k++){const a=cur[k],b=cur[k+1],gap=b.s-a.s;if(pass===0)spans.push({from:a.name||'new clamp',to:b.name||'new clamp',len:gap});
      if(gap<=maxSpan+1e-6)continue;const m=Math.ceil(gap/maxSpan)-1;
      for(let q=1;q<=m;q++)put(a.s+gap*q/(m+1),`span of ${Math.round(gap)} mm between ${a.new?'a new clamp':a.name} and ${b.new?'a new clamp':b.name} (max ${Math.round(maxSpan)})`);}}
  // mount part and "like" clamp
  const mountOf=(p,skip)=>{let best=null;for(const so of solids){if(skip&&skip(so))continue;
    for(const f of so.faces){const d=boxDist(p,f);if(d<=reach&&(!best||d<best.gap))best={name:so.name,gap:d};}}return best;};
  const own=part=>so=>!!part&&(so.name===part||so.name.endsWith(' / '+part));
  const known=sup.filter(x=>!x.end).map(x=>({...x,mount:mountOf(x.c,own(x.part))}));
  out.sort((a,b)=>a.s-b.s).forEach(q=>{const g=at(q.s);q.p=g.p;q.t=g.t;q.mount=mountOf(q.p);
    const same=q.mount?known.filter(x=>x.mount&&x.mount.name===q.mount.name):[],pool=same.length?same:known;
    const like=pool.slice().sort((a,b)=>Math.abs(a.s-q.s)-Math.abs(b.s-q.s))[0];
    q.like=like?{name:like.name,part:like.part,why:same.length?'same mounting part':'nearest along the route',ds:Math.abs(like.s-q.s)}:null;});
  return{L,supports:sup,list:out,spans};
}

const API={suggest};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.ClampSuggest=API;

// ---------------- UI ----------------
if(typeof document==='undefined'||!document.getElementById('sgBox'))return;
const SG={res:null,run:null,on:-1};
const say=(m,bad)=>{const e=$('sgStatus');e.textContent=m;e.style.color=bad?'var(--bad)':'';};
const f0=v=>Math.round(v),last=n=>String(n||'').split(' / ').pop();
const runName=()=>{const r=selected();return r&&r.d?r.name:'the selected route';};
function run(){
  const r=selected();if(!r||!r.d)return say('Check a route first: suggestions are made along the selected route.',true);
  const P=parsePts($('pts').value),names=typeof ClampStations!=='undefined'?ClampStations.pointNames($('pts').value):[];
  const T=typeof clampStationsTicked==='function'?clampStationsTicked():[];
  const stations=P.map((c,i)=>{const x=T.find(s=>len(sub(s.c,c))<0.5);return{name:names[i]||`P${i+1}`,c:[c[0],c[1],c[2]],part:x?x.part:'',i};});
  const cad=typeof bcCad==='function'?bcCad():null;
  const solids=cad?cad.solids.map(so=>({name:so.name,pipe:so.pipe,faces:[]})):[];
  if(cad){const by=new Map(cad.solids.map((so,i)=>[so.sid,solids[i]]));cad.faces.forEach(f=>{const so=by.get(f.sid);if(so)so.faces.push(f);});}
  const o={maxSpan:+$('sgSpan').value||300,nearBend:+$('sgNear').value||60,bends:$('sgBends').checked,R:r.params&&r.params.R||+$('r').value||65,reach:+$('sgReach').value||60,solids};
  store.set('rs.sg',JSON.stringify({span:o.maxSpan,near:o.nearBend,bends:o.bends,reach:o.reach}));
  SG.res=suggest({pts:r.d.pts,s:r.d.s,k:r.d.k},stations,o);SG.res.reach=o.reach;SG.run=r.id;SG.on=-1;render();rebuild(false);
  const n=SG.res.list.length,brk=SG.res.list.filter(q=>!q.mount).length,R=r.params&&r.params.R;
  // a route that fails the radius will change: say so first
  const lead=R&&r.minR<R?`${r.name} fails the radius (R ${fmt(r.minR)}, needs ${R}). Suggestions may move once it passes. `:'';
  const many=n>12?` That is one every ${f0(SG.res.L/n)} mm; check Max spacing and the route before making CSYS.`:'';
  say(lead+(n?`${n} clamp${n>1?'s':''} to add on ${r.name}${brk?`; ${brk} need${brk>1?'':'s'} a bracket`:''}.${many}${cad?'':' Load the parts (Keep clear of CAD parts) to see what each one mounts on.'}`
    :`No clamp to add: ${r.name} is held within ${f0(o.maxSpan)} mm everywhere${o.bends?' and next to every bend':''}.`));
  if(n&&typeof nextSteps==='function')nextSteps('sgStatus',[{label:'Make CSYS for all',go:makeAll},{label:'Add all as stations',go:addAll}]);}
// support names as the station list shows them: S1, S2 … (route start / end at the ends)
const supName=x=>x.i!=null?`S${x.i+1}`:x.name==='route start'?'start':x.name==='route end'?'end':x.name;
// "on <part>, 3.2 mm" / "on the surface of <part>" / bracket
const mountTxt=q=>q.mount?(q.mount.gap<0.5?`on the surface of ${last(q.mount.name)}`:`on ${last(q.mount.name)}, ${q.mount.gap.toFixed(1)} mm`):'';
const likeTxt=q=>q.like?`like ${q.like.name}${q.like.part?` (${last(q.like.part)})`:''}, ${q.like.why}`:'';
function groups(R){const S=R.supports.slice().sort((a,b)=>a.s-b.s),G=[];
  R.list.forEach((q,i)=>{let k=0;while(k<S.length-2&&S[k+1].s<=q.s)k++;const a=S[k],b=S[Math.min(k+1,S.length-1)];
    let g=G.find(g=>g.a===a);if(!g)G.push(g={a,b,rows:[]});g.rows.push(i);});return G;}
function render(){const box=$('sgList'),R=SG.res;if(!R){box.innerHTML='';return;}
  const G=groups(R),fold=R.list.length>12;
  const row=i=>{const q=R.list[i],m=mountTxt(q),lk=likeTxt(q);
    return`<tr data-i="${i}"${SG.on===i?' class="on"':''}><td class="n"><span class="sgchip">+${i+1}</span></td><td class="n">${f0(q.s)}</td>
      <td>${esc(q.why)}<div class="unit">${m?esc(m):`<span class="sgtag">needs a bracket</span>no part within ${f0(R.reach)} mm`}${lk?' · '+esc(lk):''}</div></td></tr>`;};
  box.innerHTML=G.map(g=>`<details class="sggrp"${fold?'':' open'}><summary>${esc(supName(g.a))} → ${esc(supName(g.b))} · ${f0(g.b.s-g.a.s)} mm · ${g.rows.length} clamp${g.rows.length>1?'s':''}</summary>
    <table><thead><tr><th></th><th>along, mm</th><th>why <span class="unit">· click a row for Make CSYS</span></th></tr></thead><tbody>${g.rows.map(row).join('')}</tbody></table></details>`).join('')+
    (R.spans.length?`<details class="sgspans"><summary>Spans before (${R.spans.length})</summary>${R.spans.map(s=>`<div class="unit">${esc(s.from)} → ${esc(s.to)}: ${f0(s.len)} mm</div>`).join('')}</details>`:'');
  // row hover ↔ the dot in 3D (as the Points table); click picks it
  box.querySelectorAll('tr[data-i]').forEach(tr=>{const i=+tr.dataset.i,q=R.list[i];
    tr.onpointerenter=()=>{if(marker){marker.position.set(...q.p);marker.visible=true;draw();}};
    tr.onpointerleave=()=>{if(marker){marker.visible=false;draw();}};
    tr.onclick=()=>{if(typeof asmSetPick==='function')asmSetPick({kind:'suggest',i});};});}
const make=q=>typeof csysMake==='function'?csysMake(q.p,q.t,null,'RS_CLAMP'):null;
function makeAll(){SG.res.list.forEach(make);say(`${SG.res.list.length} CSYS made (Z along the route), listed in the CSYS tab for Download .stp.`);}
const asStation=(q,i)=>({name:`NEW_CLAMP_${i+1}`,c:q.p,d:q.t,part:q.like?q.like.part:''});
function addAll(){if(typeof csAddStations!=='function')return;csAddStations(SG.res.list.map(asStation));
  say(`${SG.res.list.length} new clamps added to Stations from clamps. Check route again.`);}
const shown=()=>SG.res&&runs.some(r=>r.id===SG.run&&r.visible);
// 3D: amber dots with +n on the route (route-studio rebuild → asm-view overlay hook); the picked one gets the ink ring
(root.VIEW_OVERLAYS=root.VIEW_OVERLAYS||[]).push((content,g)=>{$('sgRun').textContent=`Suggest clamps for ${runName()}`;if(!shown())return;
  const m=new THREE.MeshBasicMaterial({color:new THREE.Color(css('--warn'))}),p=typeof asmPick==='function'?asmPick():null;
  SG.res.list.forEach((q,i)=>{const s=new THREE.Mesh(g.sg,m);s.position.set(...q.p);s.scale.setScalar(g.tubeR*3);content.add(s);
    const on=p&&p.kind==='suggest'&&p.i===i;if(on)g.addTag(q.p,'','ring pick');g.addTag(q.p,`+${i+1}`,'warn'+(on?' pick':''));});});
// pick a dot (asm-view.js): its four facts and Make CSYS · Add as station · Drop this one
(root.AV_POINTS=root.AV_POINTS||[]).push(()=>shown()?SG.res.list.map((q,i)=>({o:q.p,pick:{kind:'suggest',i}})):[]);
(root.AV_FACTS=root.AV_FACTS||{}).suggest=p=>{const q=SG.res&&SG.res.list[p.i];if(!q)return{name:'',kind:'',parent:'',grid:[],facts:[]};
  const r=runs.find(x=>x.id===SG.run);
  return{name:`+${p.i+1}`,kind:'suggested clamp',parent:r?r.name:'',grid:[`<span>at</span><span>${q.p.map(v=>v.toFixed(1)).join('  ')}</span>`],
    facts:[`${f0(q.s)} mm along the route`,q.why.charAt(0).toUpperCase()+q.why.slice(1),mountTxt(q)?mountTxt(q).charAt(0).toUpperCase()+mountTxt(q).slice(1):`Needs a bracket: no part within ${f0(SG.res.reach)} mm`,likeTxt(q)?'L'+likeTxt(q).slice(1):'']
      .filter(Boolean),lines:true};};
(root.AV_ACTIONS=root.AV_ACTIONS||[]).push(p=>{if(p.kind!=='suggest'||!SG.res||!SG.res.list[p.i])return[];const q=SG.res.list[p.i];
  return[{group:'Route',order:1,primary:true,label:'Add as station',go:()=>{if(typeof csAddStations==='function')csAddStations([asStation(q,p.i)]);return`+${p.i+1} added to Stations from clamps. Use as stations, then Check again.`;}},
    {group:'Route',order:2,label:'Drop this one',go:()=>{SG.res.list.splice(p.i,1);render();asmSetPick(null);say(`+${p.i+1} dropped; ${SG.res.list.length} left.`);return'';}},
    {group:'Creo · Library',order:3,label:'Make CSYS',go:()=>{const c=make(q);return c?`${c.name} made (listed in the CSYS tab).`:'';}}];});
document.addEventListener('asm:pick',e=>{const p=e.detail,i=p&&p.kind==='suggest'?p.i:-1;if(i===SG.on)return;SG.on=i;
  $('sgList').querySelectorAll('tr[data-i]').forEach(tr=>tr.classList.toggle('on',+tr.dataset.i===i));});
$('sgRun').onclick=run;
try{const v=JSON.parse(store.get('rs.sg')||'null');if(v){$('sgSpan').value=v.span;$('sgNear').value=v.near;$('sgBends').checked=v.bends;$('sgReach').value=v.reach;}}catch(e){}
})(typeof globalThis!=="undefined"?globalThis:this);
