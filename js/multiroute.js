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

// is p within rad of face bx? exact when the face has a shape and sn (CadSolids.shapeNear) is given, its box grown by rad otherwise
const within=(p,bx,rad,sn)=>inGrown(p,bx,rad)&&(!(bx.shape&&sn)||sn(bx.shape,p,rad)<rad);
// station zones: within 2·rad + margin of a station the hose sits in what holds it, the part (clip, bracket with a bore,
// tank with a port) one of whose faces the station point is within rad (+1 mm) of. Every face of that part is exempt there,
// so the end faces of a long bore are not clashes; faces without a solid id (.sid) count alone. Any other part near the
// station still asks its gap (a frame plate 10 mm in front of a port is a clash, not a holder).
// makeRoute (opts.held), the clearance and blockers() share it through heldAt.
function zones(stations,boxes,rad,margin=15,sn=null){const r=2*rad+margin;
  return stations.map(s=>{const p=(Array.isArray(s)?s:s.p).slice(0,3),touch=boxes.filter(b=>within(p,b,rad+1,sn)),
    sids=new Set(touch.map(b=>b.sid).filter(v=>v!=null));
    return{p,r,hold:new Set(sids.size?touch.concat(boxes.filter(b=>sids.has(b.sid))):touch)};});}
// the holders exempt at p (null when none)
function heldAt(p,Z){let h=null;if(Z)for(const z of Z){if(!z.hold.size)continue;const dx=p[0]-z.p[0],dy=p[1]-z.p[1],dz=p[2]-z.p[2];
  if(dx*dx+dy*dy+dz*dz<z.r*z.r)h=h?new Set([...h,...z.hold]):z.hold;}return h;}
// box round a list of points (a loop: spreading a long list into Math.min overflows the argument limit)
function ptsBox(P,g=0){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of P)for(let k=0;k<3;k++){if(p[k]<min[k])min[k]=p[k];if(p[k]>max[k])max[k]=p[k];}
  return{min:min.map(v=>v-g),max:max.map(v=>v+g)};}
// sample spacing for the clash tests: no coarser than the hose radius (nor 4 mm), so a thin plate cannot fall between samples
const spacing=rad=>Math.max(0.5,Math.min(rad,4));
// faces the straight leg a→b comes within rad of, in order along the leg, each with its deepest sample and every sample it
// blocks. Samples every spacing(rad) mm over the stretch inside the face's box grown by rad. A station's holders (Z) are left out near it.
function blockers(a,b,boxes,rad,sn,Z){
  const out=[],d=sub(b,a),n=Math.min(4000,Math.max(40,Math.ceil(len(d)/spacing(rad)))),lo=[0,1,2].map(k=>Math.min(a[k],b[k])-rad),hi=[0,1,2].map(k=>Math.max(a[k],b[k])+rad);
  boxes.forEach((bx,bi)=>{if(![0,1,2].every(k=>bx.max[k]>=lo[k]&&bx.min[k]<=hi[k]))return;let hit=null,t0=0,t1=1;const at=[];
    for(let k=0;k<3;k++){const l=bx.min[k]-rad-a[k],h=bx.max[k]+rad-a[k];if(Math.abs(d[k])<1e-12){if(l>0||h<0)return;continue;}
      const u=l/d[k],v=h/d[k];t0=Math.max(t0,Math.min(u,v));t1=Math.min(t1,Math.max(u,v));}
    for(let j=Math.max(1,Math.ceil(t0*n));j<=Math.min(n-1,Math.floor(t1*n));j++){const t=j/n,p=add(a,mul(d,t));if(!within(p,bx,rad,sn))continue;
      const H=heldAt(p,Z);if(H&&H.has(bx))continue;at.push(p);
      const e=bx.shape&&sn?-sn(bx.shape,p,rad):-len(sub(p,centre(bx)));if(!hit||e>hit.d)hit={p,t,d:e};}
    if(hit)out.push({bi,p:hit.p,t:hit.t,at});});
  return out.sort((u,v)=>u.t-v.t);
}
// blockers whose boxes touch (within 2·rad) and carry the same .part (or none) are one obstacle. Touching too when named:
// repeated clips of one product share a name, and two of them 400 mm apart are two obstacles, not one.
// Its box is local: the blocking faces' boxes clipped to the stretch of leg they block (± win), so a 9 m frame rail the leg
// crosses is a 300 mm obstacle there, not a 9 m one. The via search (viaFor) then pushes out until the point is clear.
function cluster(hits,boxes,rad,win){
  const groups=[],clip=(bx,h)=>{const{min:lo,max:hi}=ptsBox(h.at,win);
    return{min:[0,1,2].map(k=>Math.max(bx.min[k],lo[k])),max:[0,1,2].map(k=>Math.min(bx.max[k],hi[k]))};};
  for(const h of hits){const bx=boxes[h.bi],c=clip(bx,h),part=bx.part!=null?String(bx.part):null;
    const near=g=>(part!=null?g.part===part:g.part==null)&&[0,1,2].every(k=>c.min[k]<=g.box.max[k]+2*rad&&c.max[k]>=g.box.min[k]-2*rad);
    let g=groups.find(near);
    if(!g){groups.push({bis:[h.bi],part,box:c,hit:h});continue;}
    g.bis.push(h.bi);for(let k=0;k<3;k++){g.box.min[k]=Math.min(g.box.min[k],c.min[k]);g.box.max[k]=Math.max(g.box.max[k],c.max[k]);}}
  return groups;
}
// the four ways round box bx for a leg travelling along d: ±axis for the two axes least along d
function sides(d){const ax=[0,1,2].sort((i,j)=>Math.abs(d[i])-Math.abs(d[j])).slice(0,2);
  return ax.flatMap(k=>[{ax:k,sg:1},{ax:k,sg:-1}]);}
function viaFor(hit,bx,side,rad,margin){const c=centre(bx),h=half(bx),q=hit.p.slice();
  q[side.ax]=c[side.ax]+side.sg*(h[side.ax]+rad+margin);return q;}
// the via for one side, pushed further out along that side until it is clear of every face (by rad + margin/2); null when
// that takes more than `limit` from the leg: that side would be a long detour (along a rail), so it is not tried
function viaClear(hit,bx,side,rad,margin,boxes,sn,limit){const q=viaFor(hit,bx,side,rad,margin),r=rad+margin/2;
  const clear=p=>!boxes.some(b=>within(p,b,r,sn));let step=Math.max(5,rad);
  for(;;){if(Math.abs(q[side.ax]-hit.p[side.ax])>limit)return null;if(clear(q))return q;q[side.ax]+=side.sg*step;step*=1.25;}}
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
// the curve every sp mm or closer, on a grid holding the optimiser's own 60 per segment (r.obs is counted there)
function denseCurve(route,x,sp){const out=[];
  route.segs(x).forEach((g,i)=>{let m=1,q=null;for(let j=0;j<=60;j++){const p=hermiteP(g[0],g[1],g[2],g[3],j/60);if(q)m=Math.max(m,Math.ceil(len(sub(p,q))/sp));q=p;}
    const per=60*Math.min(m,50);for(let j=i?1:0;j<=per;j++)out.push(hermiteP(g[0],g[1],g[2],g[3],j/per));});return out;}
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
  const sn=opts.shapeNear||null;
  // round each station the hose sits in what holds it (a port on a tank, a bore in a bracket): that part asks no gap
  // there, neither of the solver nor of the clearance reported; every other part does (zones above)
  const quiet=opts.quiet||zones(S0,boxes,rad,margin,sn),sp=spacing(rad);
  // the choice (obstacle) face bi belongs to, so a report names it as the route labels do
  const nameOf=bi=>{const ci=choices.findIndex(c=>c.bis.includes(bi));
    return{part:ci>=0?choices[ci].part:boxes[bi].part!=null?String(boxes[bi].part):`B${bi+1}`,sid:boxes[bi].sid??null,ci};};
  // every (leg, obstacle in the way) is one choice with up to four options: fewer when the part has a side preference, or
  // when a side cannot be cleared within a short push (its via would be a long detour)
  let choices=[];
  for(let i=0;i<S0.length-1;i++){const a=S0[i].p,b=S0[i+1].p,d=sub(b,a),Lg=len(d),limit=Math.max(300,0.75*Lg);
    cluster(blockers(a,b,boxes,rad,sn,quiet),boxes,rad,2*rad+margin).forEach(g=>{const part=partOf(g),p=prefer[part];let o=sides(d);
      if(p!=null){const k=o.filter(s=>keeps(p,s,d,up));
        if(o.some(s=>keeps(p,s,d,up)===null))notes.push(`${part}: “${p}” does not apply on leg ${i+1}, which runs along the up axis; any side kept`);
        else if(!k.length)notes.push(`${part}: “${p}” is along leg ${i+1}, not a side of it; any side kept`);
        else o=k;}
      const pref=p!=null&&o.length<sides(d).length?p:null;
      // sides whose via clears within the limit; a chosen side is kept even when it does not (the result then says so)
      const vias=new Map(o.map(s=>[s,viaClear(g.hit,g.box,s,rad,margin,boxes,sn,limit)]));
      const can=o.filter(s=>vias.get(s));
      if(can.length&&!pref)o=can;
      if(!can.length&&!pref)notes.push(`${String(part).split(' / ').pop()} on leg ${i+1}: no side clears within ${Math.round(limit)} mm, every side tried`);
      o.forEach(s=>{if(!vias.get(s))vias.set(s,viaFor(g.hit,g.box,s,rad,margin));});
      choices.push({leg:i,hit:g.hit,bx:g.box,bis:g.bis,part,pref,d,opts:o,vias});});}
  const skipped=Math.max(0,choices.length-maxChoices);choices=choices.slice(0,maxChoices);
  // all combinations (4^k), cut to the maxPolish shortest via polylines
  let combos=[[]];
  for(const c of choices){const next=[];for(const pre of combos)for(let s=0;s<c.opts.length;s++)next.push(pre.concat(s));combos=next;}
  const build=combo=>{const W=[];
    S0.forEach((st,i)=>{W.push({p:st.p,dir:st.dir,free:false});
      choices.forEach((c,k)=>{if(c.leg===i)W.push({p:c.vias.get(c.opts[combo[k]]),dir:null,free:true,pref:!!c.pref});});});
    let L=0;for(let i=1;i<W.length;i++)L+=len(sub(W[i].p,W[i-1].p));return{W,L,combo};};
  const tops=combos.map(build).sort((u,v)=>u.L-v.L).slice(0,maxPolish);
  // polish each topology with the unchanged makeRoute + optimiser
  const polished=[];let k=0,cur=null,result=null;
  // a pinned topology keeps its preferred vias where they are: the retry when the optimiser slid off the chosen side
  function begin(t){const freePts=t.W.map((w,i)=>w.free&&!(t.pin&&w.pref)?i:-1).filter(i=>i>=0);
    const route=makeRoute(t.W.map(w=>w.p),{fixDirs:t.W.map(w=>w.dir),freePts,obstacles:boxes,rad,S:opts.S||24,shapeNear:sn,held:p=>heldAt(p,quiet)});
    return{route,o:optimiser(route,designR)};}
  function finish(route,r,t){
    // the gap is measured every sp mm (a 14 mm plate is not stepped over) and on the optimiser's own samples; a station's
    // holders are left out near it (H). No boxes: nothing to measure, no dense samples.
    const Q=sampleCurve(route,r.x);let clearance=Infinity,worst=-1;
    if(boxes.length){const Qd=denseCurve(route,r.x,sp),H=Qd.map(p=>heldAt(p,quiet));
      // smallest gap and the box it is to. Boxes sorted by their distance to the curve's own box: once that distance passes
      // the best gap found, no later box can be closer (exact, and far fewer tests on a frame of thousands of face boxes)
      const qb=ptsBox(Qd),bd=(a,b)=>Math.hypot(...[0,1,2].map(k=>Math.max(a.min[k]-b.max[k],0,b.min[k]-a.max[k])));
      for(const [d0,bi] of boxes.map((b,bi)=>[bd(qb,b),bi]).sort((a,b)=>a[0]-b[0])){if(d0-rad>=clearance)break;const bx=boxes[bi];
        for(let i=0;i<Qd.length;i++){if(H[i]&&H[i].has(bx))continue;const p=Qd[i];let g=boxDist(p,bx)-rad;if(g>=clearance)continue;
          if(bx.shape&&sn)g=sn(bx.shape,p,clearance+rad)-rad;if(g<clearance){clearance=g;worst=bi;}}}}
    // label by where the polished curve really went, not by the via it started from
    const ss=choices.map(c=>passSide(Q,c.bx,c.d,rad));
    const sig=ss.map((s,k)=>`L${choices[k].leg+1}:B${choices[k].bis[0]+1}${sideName(s)}`).join(' ')||'direct';
    // did the optimiser keep every preferred side? (it starts there, but is free to slide round)
    const kept=choices.every((c,k)=>!c.pref||keeps(c.pref,ss[k],c.d,up));
    // parts named by the last step of their assembly path ("A / B / 22648999" → "22648999")
    const label=ss.length?ss.map((s,k)=>`${sideWord(s,choices[k].d,up)} ${String(choices[k].part).split(' / ').pop()}`).filter((w,k,a)=>a.indexOf(w)===k).join(', '):'direct';
    // clean is judged by the measured gap, not the solver's depth (r.obs): that counts a face's box grown by rad per axis,
    // so it is > 0 round a box corner where the true gap holds. It only steers the optimiser.
    const ok=r.minR>=R-1e-6&&clearance>=-1e-6;
    if(!kept&&!t.pin){tops.splice(k+1,0,{...t,pin:true});return;}
    // per part with a side preference: the side wanted, the side the curve took, and whether that keeps it
    const prefs=choices.map((c,k)=>c.pref?{part:c.part,want:c.pref,went:sideWord(ss[k],c.d,up),kept:!!keeps(c.pref,ss[k],c.d,up)}:null).filter(Boolean);
    const near=worst>=0?nameOf(worst):null;
    polished.push({sig,label,len:r.len,minR:r.minR,clearance:boxes.length?clearance:Infinity,ok,kept,prefs,obs:r.obs,near,sides:ss.map((s,k)=>sideWord(s,choices[k].d,up)),
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
      forced={what:[...new Set(pref.map(c=>`${c.pref} ${c.part}`))].join(', '),why:why.join('; ')||'not clean',text:''};
      forced.text=`${forced.what}: ${forced.why}`;out.forEach(p=>p.forced=true);}
    return{candidates:out,tried:combos.length,polished:polished.length,skipped,forced,notes,none:polished.some(p=>p.ok)?null:noneClean()};}
  // no route came out clean: which part is in the way on every side tried (best gap per side), or the radius. A route fails
  // on the gap when its measured gap is short
  function noneClean(){if(!polished.length)return null;
    const short=n=>String(n).split(' / ').pop(),radF=polished.filter(p=>p.minR<R-1e-6),
      bad=p=>p.clearance<-1e-6?p.near:null,gapF=polished.filter(bad);
    const bestR=Math.max(...polished.map(p=>p.minR));
    if(!gapF.length){const b=Math.max(...radF.map(p=>p.minR));
      const t=`every way round needs a bend tighter than R ${R}${isFinite(b)?` (best R ${b.toFixed(0)})`:''}`;return{rule:'radius',part:null,sid:null,bestR,sides:[],text:t};}
    const count=new Map();gapF.forEach(p=>{const k=bad(p).part;count.set(k,(count.get(k)||0)+1);});
    const [part,nPart]=[...count].sort((a,b)=>b[1]-a[1])[0],every=nPart===polished.length,of=gapF.find(p=>bad(p).part===part);
    const ci=bad(of).ci>=0?bad(of).ci:choices.findIndex(c=>c.part===part);
    // best gap for each side of that part the routes took (or for each route, when it was not one of the parts enumerated)
    const by=new Map();polished.forEach(p=>{const side=ci>=0?p.sides[ci]:p.label;const b=by.get(side);if(!b||p.clearance>b.gap)by.set(side,{side,gap:p.clearance,minR:p.minR});});
    const sides=[...by.values()].sort((a,b)=>b.gap-a.gap);
    const f=s=>s.gap<-1e-6?`−${(-s.gap).toFixed(1)} mm`:`${s.gap.toFixed(1)} mm`,rule=radF.length?'both':'gap';
    const where=every?(sides.length>1?'every side tried':`every route tried (all passed it ${ci>=0?sides[0].side.replace(/ of$/,''):'the same way'})`)
      :`${nPart} of ${polished.length} routes tried`;
    const also=rule==='both'?`; ${radF.length} also need a bend tighter than R ${R}`:'';
    const text=`${short(part)} is in the way on ${where}: `+
      sides.map(s=>`${ci>=0?s.side.replace(/ of$/,''):'via '+s.side} ${f(s)}`).join(', ')+` (gap counted from the hose surface + keep-clear gap)`+also;
    return{rule,part,sid:bad(of).sid,every,sides,bestR,text};}
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

const API={start,enumerate,blockers,zones,heldAt,denseCurve,spacing,boxDist,sideWord,parseAxis};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.MultiRoute=API;
})(typeof globalThis!=="undefined"?globalThis:this);
