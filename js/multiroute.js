/* multiroute.js — several distinct routes between the same stations (topology enumeration).
 * Every box that the straight line between two stations runs into can be passed on one of four sides (the two
 * axes across the direction of travel, plus or minus). Each combination of sides is one topology: it becomes a
 * via point per box, and the existing makeRoute + optimiser polish it into a smooth route. Polished routes are
 * labelled by the side they actually pass each box on, duplicates dropped, and the best `keep` returned.
 * Ranking: clean routes (no box hit, min R met) first, then shorter (1 % length buckets), then more clearance,
 * then larger min R.
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

// which side of box bx a polished curve passes: at its closest sample, the off-travel axis it is furthest out on
function passSide(curve,bx,d,rad){
  let bi=0,bd=Infinity;curve.forEach((p,i)=>{const e=boxDist(p,bx);if(e<bd){bd=e;bi=i;}});
  const c=centre(bx),h=half(bx),o=sub(curve[bi],c);let best=null;
  sides(d).forEach(s=>{const r=s.sg*o[s.ax]/(h[s.ax]+rad);if(!best||r>best.r)best={...s,r};});
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
    margin=opts.margin==null?15:+opts.margin,keep=opts.keep||3,maxPolish=opts.maxPolish||12,maxChoices=opts.maxChoices||4;
  // every (leg, obstacle in the way) is one choice with four options
  let choices=[];
  for(let i=0;i<S0.length-1;i++){const a=S0[i].p,b=S0[i+1].p,d=sub(b,a);
    cluster(blockers(a,b,boxes,rad),boxes,rad).forEach(g=>choices.push({leg:i,hit:g.hit,bx:g.box,bis:g.bis,d,opts:sides(d)}));}
  const skipped=Math.max(0,choices.length-maxChoices);choices=choices.slice(0,maxChoices);
  // all combinations (4^k), cut to the maxPolish shortest via polylines
  let combos=[[]];
  for(const c of choices){const next=[];for(const pre of combos)for(let s=0;s<c.opts.length;s++)next.push(pre.concat(s));combos=next;}
  const build=combo=>{const W=[];
    S0.forEach((st,i)=>{W.push({p:st.p,dir:st.dir,free:false});
      choices.forEach((c,k)=>{if(c.leg===i)W.push({p:viaFor(c.hit,c.bx,c.opts[combo[k]],rad,margin),dir:null,free:true});});});
    let L=0;for(let i=1;i<W.length;i++)L+=len(sub(W[i].p,W[i-1].p));return{W,L,combo};};
  const tops=combos.map(build).sort((u,v)=>u.L-v.L).slice(0,maxPolish);
  // polish each topology with the unchanged makeRoute + optimiser
  const polished=[];let k=0,cur=null,result=null;
  function begin(t){const freePts=t.W.map((w,i)=>w.free?i:-1).filter(i=>i>=0);
    const route=makeRoute(t.W.map(w=>w.p),{fixDirs:t.W.map(w=>w.dir),freePts,obstacles:boxes,rad,S:opts.S||24});
    return{route,o:optimiser(route,designR)};}
  function finish(route,r){
    const Q=sampleCurve(route,r.x);
    let clearance=Infinity;for(const p of Q)for(const bx of boxes)clearance=Math.min(clearance,boxDist(p,bx)-rad);
    // label by where the polished curve really went, not by the via it started from
    const pass=choices.map(c=>{const s=passSide(Q,c.bx,c.d,rad);return`L${c.leg + 1}:B${c.bis[0] + 1}${sideName(s)}`;});
    const sig=pass.join(' ')||'direct',ok=r.obs<=1e-6&&r.minR>=R-1e-6&&clearance>=-1e-6;
    polished.push({sig,label:pass.length?pass.map(p=>p.split(':')[1]).join(', '):'direct',len:r.len,minR:r.minR,
      clearance:boxes.length?clearance:Infinity,ok,W:route.pts(r.x),Q,route,x:r.x.slice()});}
  function rank(){
    const best=Math.min(...polished.map(p=>p.len)),bucket=p=>Math.round(p.len/(0.01*best));
    polished.sort((a,b)=>(b.ok-a.ok)||(bucket(a)-bucket(b))||(b.clearance-a.clearance)||(b.minR-a.minR));
    // distinct: a different pass signature, and not lying on top of one already kept
    const sep=Math.max(4*rad,margin,1),out=[];
    for(const p of polished){if(out.length>=keep)break;
      if(out.some(q=>q.sig===p.sig||curveGap(p.Q,q.Q)<sep))continue;out.push(p);}
    out.forEach((p,i)=>p.rank=i+1);
    return{candidates:out,tried:combos.length,polished:polished.length,skipped};}
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  function step(ms=30){
    const t0=now();let minR=null;
    while(!result){
      if(k>=tops.length){result=rank();break;}
      if(!cur)cur=begin(tops[k]);
      const r=cur.o.step(4);minR=r.minR;
      if(r.done){finish(cur.route,r);cur=null;k++;}
      if(now()-t0>=ms)break;}
    return{done:!!result,k,total:tops.length,minR,result};}
  return{step,total:tops.length,tried:combos.length,skipped};
}
// the same, run to the end in one go
function enumerate(stations,opts={}){const job=start(stations,opts);let r;do{r=job.step(1e9);}while(!r.done);return r.result;}

const API={start,enumerate,blockers,boxDist};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.MultiRoute=API;
})(typeof globalThis!=="undefined"?globalThis:this);
