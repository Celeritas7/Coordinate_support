/* multiroute.js — several distinct routes between the same stations (topology enumeration).
 * Every box that the straight line between two stations runs into can be passed on one of four sides (the two
 * axes across the direction of travel, plus or minus). Each combination of sides is one topology: it becomes a
 * via point per box, and the existing makeRoute + optimiser polish it into a smooth route. Polished routes are
 * labelled by the side they actually pass each box on, duplicates dropped, and the best `keep` returned.
 * Ranking: clean routes (no box hit, min R met) first, then shorter (1 % length buckets), then more clearance,
 * then larger min R.
 * Side preferences (opts.prefer = {part name → 'above'|'below'|'left'|'right'|'+X'…'-Z'|'any'}, with opts.up = '+Z' by
 * default): a choice that breaks a preference is never built, so it costs nothing. Above / below are ± the up axis; left /
 * right are taken looking along the leg. On a leg that runs along the up axis only axis names apply (the words are ignored,
 * with a note). When the best route on the chosen sides breaks the radius or the gap, result.forced says which and by how much.
 * No DOM. makeRoute/optimiser come from opts or the globals route-studio.js defines.
 * Browser: window.MultiRoute. Node: require('./multiroute.js').
 */
(function(root){
"use strict";
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
len=a=>Math.hypot(a[0],a[1],a[2]);
const AX='XYZ';
const centre=b=>[0,1,2].map(k=>(b.min[k]+b.max[k])/2),half=b=>[0,1,2].map(k=>(b.max[k]-b.min[k])/2);
// Euclidean distance from p to box b (0 inside)
function boxDist(p,b){let s=0;for(let k=0;k<3;k++){const d=Math.max(b.min[k]-p[k],0,p[k]-b.max[k]);s+=d*d;}return Math.sqrt(s);}
function inGrown(p,b,rad){for(let k=0;k<3;k++)if(p[k]<b.min[k]-rad||p[k]>b.max[k]+rad)return false;return true;}
function hermiteP(p0,p1,m0,m1,u){const u2=u*u,u3=u2*u,h=[2*u3-3*u2+1,u3-2*u2+u,-2*u3+3*u2,u3-u2];
  return[0,1,2].map(i=>h[0]*p0[i]+h[1]*m0[i]+h[2]*p1[i]+h[3]*m1[i]);}

// boxes the straight leg a→b runs into (grown by rad), in order along the leg, each with its deepest sample
function blockers(a,b,boxes,rad){
  const out=[];
  boxes.forEach((bx,bi)=>{let hit=null;
    for(let j=1;j<40;j++){const t=j/40,p=add(a,mul(sub(b,a),t));if(!inGrown(p,bx,rad))continue;
      const c=centre(bx),d=-len(sub(p,c));if(!hit||d>hit.d)hit={p,t,d};}
    if(hit)out.push({bi,p:hit.p,t:hit.t});});
  return out.sort((u,v)=>u.t-v.t);
}
// blockers whose boxes touch (within 2·rad) are one obstacle: a CAD part arrives as many face boxes,
// and the route has to go round the whole part, not between two of its faces
function cluster(hits,boxes,rad){
  const groups=[];
  for(const h of hits){const bx=boxes[h.bi],near=g=>[0,1,2].every(k=>bx.min[k]<=g.box.max[k]+2*rad&&bx.max[k]>=g.box.min[k]-2*rad);
    let g=groups.find(near);
    if(!g){groups.push({bis:[h.bi],box:{min:bx.min.slice(),max:bx.max.slice()},hit:h});continue;}
    g.bis.push(h.bi);for(let k=0;k<3;k++){g.box.min[k]=Math.min(g.box.min[k],bx.min[k]);g.box.max[k]=Math.max(g.box.max[k],bx.max[k]);}}
  return groups;
}
// the four ways round box bx for a leg travelling along d: ±axis for the two axes least along d
function sides(d){const ax=[0,1,2].sort((i,j)=>Math.abs(d[i])-Math.abs(d[j])).slice(0,2);
  return ax.flatMap(k=>[{ax:k,sg:1},{ax:k,sg:-1}]);}
function viaFor(hit,bx,side,rad,margin){const c=centre(bx),h=half(bx),q=hit.p.slice();
  q[side.ax]=c[side.ax]+side.sg*(h[side.ax]+rad+margin);return q;}
const sideName=s=>(s.sg>0?'+':'-')+AX[s.ax];
// '+Z' / '-y' / 'z' → {ax,sg}
function parseAxis(t){const m=/^\s*([+-]?)\s*([xyz])\s*$/i.exec(t||'');return m?{ax:'XYZ'.indexOf(m[2].toUpperCase()),sg:m[1]==='-'?-1:1}:null;}
// the plain word for passing on side s of a leg travelling along d, with up axis up: over / under / left of / right of,
// or "on the +X side of" when the side is neither (a leg running along the up axis)
function sideWord(s,d,up){
  if(s.ax===up.ax)return s.sg===up.sg?'over':'under';
  const u=[0,0,0];u[up.ax]=up.sg;
  const right=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];
  if(sides(d).some(o=>o.ax===up.ax)&&Math.abs(right[s.ax])>1e-9)return Math.sign(right[s.ax])===s.sg?'right of':'left of';
  return`on the ${sideName(s)} side of`;}
// does side s keep the preference p ('any', a word or an axis name)? null when p does not apply on this leg
function keeps(p,s,d,up){
  p=String(p||'any').trim().toLowerCase();if(!p||p==='any')return true;
  const a=parseAxis(p);if(a)return a.ax===s.ax&&a.sg===s.sg;
  const w={above:'over',over:'over',below:'under',under:'under',left:'left of',right:'right of'}[p];
  if(!w)return null;
  if(!sides(d).some(o=>o.ax===up.ax))return null;  // leg along the up axis: no over / under / left / right
  return sideWord(s,d,up)===w;}

// which side of box bx a polished curve passes: over the samples level with the box along the travel axis, the
// off-travel side it is furthest out on (the closest sample alone misreads a tall box: that is the climb beside it)
function passSide(curve,bx,d,rad){
  const c=centre(bx),h=half(bx),S=sides(d),t=[0,1,2].find(k=>!S.some(s=>s.ax===k));
  let pts=curve.filter(p=>Math.abs(p[t]-c[t])<=h[t]+rad);
  if(!pts.length){let bi=0,bd=Infinity;curve.forEach((p,i)=>{const e=boxDist(p,bx);if(e<bd){bd=e;bi=i;}});pts=[curve[bi]];}
  let best=null;
  for(const p of pts){const o=sub(p,c);S.forEach(s=>{const r=s.sg*o[s.ax]/(h[s.ax]+rad);if(!best||r>best.r)best={...s,r};});}
  return best;
}
function sampleCurve(route,x,per=40){const out=[];
  route.segs(x).forEach((g,i)=>{for(let j=i?1:0;j<=per;j++)out.push(hermiteP(g[0],g[1],g[2],g[3],j/per));});return out;}
function curveGap(A,B){let m=0;for(const p of A){let d=Infinity;for(const q of B)d=Math.min(d,len(sub(p,q)));m=Math.max(m,d);}return m;}

// stations: [[x,y,z] | {p,dir}], opts: {R, SF=1.5, rad=0, boxes:[{min,max}], margin=15, keep=3,
//   maxChoices=4 (obstacles enumerated; any further ones are left to the optimiser), maxPolish=12 (topologies
//   polished, shortest via polyline first), S=24, makeRoute, optimiser}
// start() works in chunks: step(ms) runs for about ms and returns {done, k, total, minR, result}, so a page can call
// it from a timer and stay responsive. result: {candidates:[{rank,sig,label,len,minR,clearance,ok,W,Q,route,x}], tried, polished}
function start(stations,opts={}){
  const makeRoute=opts.makeRoute||root.makeRoute,optimiser=opts.optimiser||root.optimiser;
  if(typeof makeRoute!=='function'||typeof optimiser!=='function')throw new Error('MultiRoute needs makeRoute and optimiser');
  const S0=stations.map(s=>Array.isArray(s)?{p:s.slice(0,3),dir:null}:{p:s.p.slice(0,3),dir:s.dir||null});
  if(S0.length<2)throw new Error('need at least two stations');
  const R=+opts.R||0,SF=opts.SF==null?1.5:+opts.SF,designR=R*SF,rad=+opts.rad||0,boxes=opts.boxes||[],
    margin=opts.margin==null?15:+opts.margin,keep=opts.keep||3,maxPolish=opts.maxPolish||12,maxChoices=opts.maxChoices||4,
    up=parseAxis(opts.up)||{ax:2,sg:1},prefer=opts.prefer||{},notes=[];
  const partOf=g=>{const b=g.bis.map(i=>boxes[i]).find(b=>b.part);return b?String(b.part):`B${g.bis[0]+1}`;};
  // every (leg, obstacle in the way) is one choice with four options, fewer when the part has a side preference
  let choices=[];
  for(let i=0;i<S0.length-1;i++){const a=S0[i].p,b=S0[i+1].p,d=sub(b,a);
    cluster(blockers(a,b,boxes,rad),boxes,rad).forEach(g=>{const part=partOf(g),p=prefer[part];let o=sides(d);
      if(p!=null){const k=o.filter(s=>keeps(p,s,d,up));
        if(o.some(s=>keeps(p,s,d,up)===null))notes.push(`${part}: “${p}” does not apply on leg ${i+1}, which runs along the up axis; any side kept`);
        else if(!k.length)notes.push(`${part}: “${p}” is along leg ${i+1}, not a side of it; any side kept`);
        else o=k;}
      choices.push({leg:i,hit:g.hit,bx:g.box,bis:g.bis,part,pref:p!=null&&o.length<4?p:null,d,opts:o});});}
  const skipped=Math.max(0,choices.length-maxChoices);choices=choices.slice(0,maxChoices);
  // all combinations (4^k), cut to the maxPolish shortest via polylines
  let combos=[[]];
  for(const c of choices){const next=[];for(const pre of combos)for(let s=0;s<c.opts.length;s++)next.push(pre.concat(s));combos=next;}
  const build=combo=>{const W=[];
    S0.forEach((st,i)=>{W.push({p:st.p,dir:st.dir,free:false});
      choices.forEach((c,k)=>{if(c.leg===i)W.push({p:viaFor(c.hit,c.bx,c.opts[combo[k]],rad,margin),dir:null,free:true,pref:!!c.pref});});});
    let L=0;for(let i=1;i<W.length;i++)L+=len(sub(W[i].p,W[i-1].p));return{W,L,combo};};
  const tops=combos.map(build).sort((u,v)=>u.L-v.L).slice(0,maxPolish);
  // polish each topology with the unchanged makeRoute + optimiser
  const polished=[];let k=0,cur=null,result=null;
  // a pinned topology keeps its preferred vias where they are: the retry when the optimiser slid off the chosen side
  function begin(t){const freePts=t.W.map((w,i)=>w.free&&!(t.pin&&w.pref)?i:-1).filter(i=>i>=0);
    const route=makeRoute(t.W.map(w=>w.p),{fixDirs:t.W.map(w=>w.dir),freePts,obstacles:boxes,rad,S:opts.S||24});
    return{route,o:optimiser(route,designR)};}
  function finish(route,r,t){
    const Q=sampleCurve(route,r.x);
    let clearance=Infinity;for(const p of Q)for(const bx of boxes)clearance=Math.min(clearance,boxDist(p,bx)-rad);
    // label by where the polished curve really went, not by the via it started from
    const ss=choices.map(c=>passSide(Q,c.bx,c.d,rad));
    const sig=ss.map((s,k)=>`L${choices[k].leg+1}:B${choices[k].bis[0]+1}${sideName(s)}`).join(' ')||'direct';
    // did the optimiser keep every preferred side? (it starts there, but is free to slide round)
    const kept=choices.every((c,k)=>!c.pref||keeps(c.pref,ss[k],c.d,up));
    const label=ss.length?ss.map((s,k)=>`${sideWord(s,choices[k].d,up)} ${choices[k].part}`).filter((w,k,a)=>a.indexOf(w)===k).join(', '):'direct';
    const ok=r.obs<=1e-6&&r.minR>=R-1e-6&&clearance>=-1e-6;
    if(!kept&&!t.pin){tops.splice(k+1,0,{...t,pin:true});return;}
    polished.push({sig,label,len:r.len,minR:r.minR,clearance:boxes.length?clearance:Infinity,ok,kept,obs:r.obs,
      W:route.pts(r.x),Q,route,x:r.x.slice()});}
  function rank(){
    const best=Math.min(...polished.map(p=>p.len)),bucket=p=>Math.round(p.len/(0.01*best));
    polished.sort((a,b)=>(b.kept-a.kept)||(b.ok-a.ok)||(bucket(a)-bucket(b))||(b.clearance-a.clearance)||(b.minR-a.minR));
    // distinct: a different pass signature, and not lying on top of one already kept
    const sep=Math.max(4*rad,margin,1),out=[];
    for(const p of polished){if(out.length>=keep)break;
      if(out.some(q=>q.sig===p.sig||curveGap(p.Q,q.Q)<sep))continue;out.push(p);}
    out.forEach((p,i)=>p.rank=i+1);
    // a preference that cost the clean route: say which rule broke and by how much on the best route that keeps it
    let forced=null;const pref=choices.filter(c=>c.pref);
    if(pref.length&&out.length&&!(out[0].ok&&out[0].kept)){const b=out[0],why=[];
      if(!b.kept)why.push('the route slid off the chosen side');
      if(b.minR<R-1e-6)why.push(`needs R ${b.minR.toFixed(0)}, limit R ${R}`);
      if(b.clearance<-1e-6)why.push(`${(-b.clearance).toFixed(-b.clearance<0.1?2:1)} mm into the keep-clear gap`);
      if(b.obs>1e-6&&!why.length)why.push('runs into a part');
      forced={what:[...new Set(pref.map(c=>`${c.pref} ${c.part}`))].join(', '),why:why.join('; ')||'not clean',text:''};
      forced.text=`${forced.what}: ${forced.why}`;out.forEach(p=>p.forced=true);}
    return{candidates:out,tried:combos.length,polished:polished.length,skipped,forced,notes};}
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  function step(ms=30){
    const t0=now();let minR=null;
    while(!result){
      if(k>=tops.length){result=rank();break;}
      if(!cur)cur=begin(tops[k]);
      const r=cur.o.step(4);minR=r.minR;
      if(r.done){finish(cur.route,r,tops[k]);cur=null;k++;}
      if(now()-t0>=ms)break;}
    return{done:!!result,k,total:tops.length,minR,result};}
  return{step,total:tops.length,tried:combos.length,skipped,notes};
}
// the same, run to the end in one go
function enumerate(stations,opts={}){const job=start(stations,opts);let r;do{r=job.step(1e9);}while(!r.done);return r.result;}

const API={start,enumerate,blockers,boxDist,sideWord,parseAxis};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.MultiRoute=API;
})(typeof globalThis!=="undefined"?globalThis:this);
