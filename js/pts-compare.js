/* pts-compare.js — compare a .pts file with a pipe or hose read from the assembly (StepAsm).
 * Finds the frame the points are written in, drops repeated points, puts every point on the centreline
 * (distance along it = s), and reports: points off the pipe, corners with no point (pipes), points out of
 * route order (with where they belong), and how far the pipe runs past the first / last point.
 * No DOM. Browser: window.PtsCompare. Node: require('./pts-compare.js').
 */
(function (root) {
"use strict";
const SA = root.StepAsm || (typeof require !== "undefined" ? require("./step-asm.js") : null);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],len=a=>Math.hypot(a[0],a[1],a[2]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

function readPts(text){const rows=[];
  String(text).split(/\r?\n/).forEach((raw,i)=>{const line=raw.split('!')[0].trim();if(!line)return;
    const v=line.replace(/,/g,' ').split(/\s+/).map(Number);if(v.length>=3&&v.slice(0,3).every(Number.isFinite))rows.push({line:i+1,p:v.slice(0,3)});});
  return rows;}
// indices of a longest strictly increasing run (not necessarily contiguous) of a
function lis(a){const tail=[],prev=new Array(a.length).fill(-1);
  a.forEach((x,i)=>{let lo=0,hi=tail.length;while(lo<hi){const m=(lo+hi)>>1;if(a[tail[m]]<x)lo=m+1;else hi=m;}if(lo)prev[i]=tail[lo-1];tail[lo]=i;});
  const out=[];let k=tail.length?tail[tail.length-1]:-1;while(k>=0){out.push(k);k=prev[k];}return out.reverse();}

// r: StepAsm.parse result, pi: pipe index, text: .pts file. opt: {tol=0.5 mm, frame: CSYS name or 'file origin' (auto when absent)}
function compare(r,pi,text,opt){
  opt=Object.assign({tol:0.5},opt);const p=r.pipes[pi];if(!p)throw new Error('No such pipe.');
  const raw=readPts(text);if(raw.length<2)throw new Error('The .pts file needs at least two points.');
  const kept=[],dropped=[];
  raw.forEach((row,i)=>{const n=i+1,j=kept.findIndex(k=>len(sub(k.p,row.p))<=1e-3);
    if(j>=0)dropped.push({...row,n,dupOf:kept[j].n,next:i>0&&len(sub(raw[i-1].p,row.p))<=1e-3});else kept.push({...row,n});});
  // frame
  let F;
  if(opt.frame){const c=opt.frame==='file origin'?null:r.csys.find(c=>c.name===opt.frame);F={frame:c?c.name:'file origin',M:c?{o:c.o,x:c.x,y:c.y,z:c.z}:SA.F.id(),auto:false};}
  else{const m=r.matchFrame(kept.map(k=>k.p),p);F={frame:m.frame,M:m.M,auto:true,err:m.err};}
  const toW=q=>SA.F.pt(F.M,q),toLvec=v=>[dot(v,F.M.x),dot(v,F.M.y),dot(v,F.M.z)];
  const isPipe=p.kind!=='hose'&&p.bends.length>0,Q=p.Q,L=p.length;
  const qS=Q.map(q=>SA.nearest(p.chain,q).s);
  kept.forEach(k=>{k.w=toW(k.p);const nr=SA.nearest(p.chain,k.w);k.dCurve=nr.d;k.s=nr.s;
    let bi=0,bd=Infinity;Q.forEach((q,i)=>{const d=len(sub(q,k.w));if(d<bd){bd=d;bi=i;}});k.corner=bi;k.dCorner=bd;k.delta=toLvec(sub(Q[bi],k.w));});
  // route order: the longer of increasing / decreasing s in file order
  const up=lis(kept.map(k=>k.s)),down=lis(kept.map(k=>-k.s)),reversed=down.length>up.length,inOrder=new Set(reversed?down:up);
  const sDir=k=>reversed?-k.s:k.s,chainOrder=[...inOrder].map(i=>kept[i]);
  kept.forEach((k,i)=>{k.inOrder=inOrder.has(i);
    if(!k.inOrder){const before=chainOrder.filter(c=>sDir(c)<sDir(k)).pop(),after=chainOrder.find(c=>sDir(c)>sDir(k));k.belongs={after:before?before.n:null,before:after?after.n:null};}});
  // per point verdict
  const tol=opt.tol;
  kept.forEach(k=>{
    if(isPipe&&k.dCorner<=tol){k.status='corner';k.note=k.corner===0?'pipe start':k.corner===Q.length-1?'pipe end':`corner ${k.corner} (${p.bends[k.corner-1].deg.toFixed(1)}°)`;}
    else if(k.dCurve<=tol){const onArc=isPipe&&p.chain.pieces.some(pc=>pc.type==='arc'&&SA.nearest({pieces:[pc],length:pc.len},k.w).d<=tol&&
        len(sub(SA.nearest({pieces:[pc],length:pc.len},k.w).q,pc.a))>tol&&len(sub(SA.nearest({pieces:[pc],length:pc.len},k.w).q,pc.b))>tol);
      k.status=onArc?'arc':'on';k.note=onArc?'on a bend arc, not its corner':isPipe?'on a straight (extra point)':'on the hose';}
    else{k.status='off';k.note=isPipe?`${k.dCorner.toFixed(2)} mm from corner ${k.corner}`:`${k.dCurve.toFixed(2)} mm off the hose`;}
    // beyond an end, on the end straight's axis: the solid stops short of the point (e.g. inside a fitting)
    if(k.status==='off')[[0,p.info.start,p.info.startDir.map(v=>-v),'start'],[Q.length-1,p.info.end,p.info.endDir,'end']].forEach(([ci,e,out,w])=>{
      const v=sub(k.w,e),along=dot(v,out),perp=len(sub(v,out.map(x=>x*along)));
      if(k.status==='off'&&along>tol&&perp<=tol){k.status='past';k.corner=ci;k.past=along;k.note=`${along.toFixed(2)} mm past the ${isPipe?'pipe':'hose'} ${w}, on its axis`;}});
    if(!k.inOrder)k.note+=`; out of order${k.belongs.after!=null&&k.belongs.before!=null?`, belongs between #${k.belongs.after} and #${k.belongs.before}`:k.belongs.after!=null?`, belongs after #${k.belongs.after}`:`, belongs before #${k.belongs.before}`}`;});
  // corners with no point (pipes)
  const toLpt=q=>SA.F.toLocal(F.M,q);
  const corners=isPipe?Q.map((q,i)=>{const near=kept.filter(k=>(k.status==='corner'||k.status==='past')&&k.corner===i);const nb=kept.reduce((b,k)=>{const d=len(sub(q,k.w));return!b||d<b.d?{k,d}:b;},null);
    return{i,q,local:toLpt(q),deg:i>0&&i<Q.length-1?p.bends[i-1].deg:null,hit:near.map(k=>k.n),nearest:nb?nb.k.n:null,d:nb?nb.d:Infinity,delta:nb?toLvec(sub(q,nb.k.w)):[0,0,0]};}):[];
  const missing=corners.filter(c=>!c.hit.length);
  // ends: how far the pipe runs past the first / last point (route order)
  const ss=kept.map(k=>k.s).sort((a,b)=>a-b),first=ss[0],last=ss[ss.length-1];
  const startGap=reversed?L-last:first,endGap=reversed?first:L-last;
  const gaps=[];for(let i=1;i<ss.length;i++)gaps.push(ss[i]-ss[i-1]);
  // summary
  const S=[];
  if(dropped.length)S.push({sev:'warn',t:`${dropped.length} repeated point${dropped.length>1?'s':''} dropped: ${dropped.map(d=>`#${d.n} (line ${d.line}) = #${d.dupOf}`).join(', ')}.`});
  if(F.auto)S.push({sev:F.err<=Math.max(tol,p.OD)?'ok':'bad',t:F.err<=Math.max(tol,p.OD)?`Points are in the ${F.frame} frame (median ${F.err.toFixed(3)} mm from the pipe).`:`No frame puts the points on the pipe (best: ${F.frame}, median ${F.err.toFixed(1)} mm off). Wrong file or wrong pipe?`});
  const off=kept.filter(k=>k.status==='off'),ooo=kept.filter(k=>!k.inOrder),arcs=kept.filter(k=>k.status==='arc'),past=kept.filter(k=>k.status==='past');
  const xyz=v=>v.map(x=>x.toFixed(3)).join('  '),cname=c=>c.i===0?'start':c.i===Q.length-1?'end':`corner ${c.i} (${c.deg.toFixed(1)}°)`;
  const gapAt=i=>i===0?startGap:i===Q.length-1?endGap:0;
  if(isPipe)S.push(missing.length?{sev:'bad',t:`${missing.length} of ${Q.length} corners have no point: ${missing.map(c=>`${cname(c)} at ${xyz(c.local)}`+(gapAt(c.i)>tol?` (the pipe runs ${gapAt(c.i).toFixed(1)} mm ${c.i===0?'before the first':'after the last'} point)`:c.nearest?` (nearest #${c.nearest}, ${c.d.toFixed(2)} mm)`:'')).join('; ')}.`}:{sev:'ok',t:`All ${Q.length} corners (both ends + ${Q.length-2} bends) have a point.`});
  if(past.length)S.push({sev:'warn',t:`${past.map(k=>`#${k.n} is ${k.past.toFixed(2)} mm past the ${k.corner===0?'start':'end'}`).join(', ')}, on the ${isPipe?'pipe':'hose'} axis: the solid stops short of these points (inside a fitting?).`});
  if(off.length)S.push({sev:'bad',t:`${off.length} point${off.length>1?'s':''} off the ${isPipe?'pipe corners':'hose'}: ${off.map(k=>`#${k.n} ${k.note.split(';')[0]}`).join('; ')}.`});
  if(arcs.length)S.push({sev:'warn',t:`${arcs.length} point${arcs.length>1?'s':''} on a bend arc instead of its corner (${arcs.map(k=>'#'+k.n).join(', ')}): Creo's single-radius curve will not follow the pipe there.`});
  if(ooo.length)S.push({sev:'bad',t:`${ooo.length} point${ooo.length>1?'s':''} out of route order: ${ooo.map(k=>`#${k.n}${k.belongs.after!=null&&k.belongs.before!=null?` (between #${k.belongs.after} and #${k.belongs.before})`:''}`).join(', ')}. Creo joins points in file order.`});
  else S.push({sev:'ok',t:`Points are in route order${reversed?' (listed from the pipe end to its start)':''}.`});
  [['start',startGap,0],['end',endGap,Q.length-1]].forEach(([w,g,ci])=>{if(g>tol&&!(isPipe&&missing.some(c=>c.i===ci)))S.push({sev:'warn',t:`The ${isPipe?'pipe':'hose'} runs ${g.toFixed(1)} mm past the ${w==='start'?'first':'last'} point (${w} of the ${isPipe?'pipe':'hose'} not in the .pts).`});});
  const ok=!S.some(x=>x.sev==='bad');
  // the same points, repeats dropped, in route order (frame kept)
  const ordered=kept.slice().sort((a,b)=>sDir(a)-sDir(b));
  return{pipe:p,frame:F,isPipe,raw,kept,dropped,corners,missing,startGap,endGap,maxGap:gaps.length?Math.max(...gaps):0,reversed,summary:S,ok,ordered,tol};
}
function orderedText(res,title){const f=v=>v.toFixed(3).padStart(15);
  return["!","!       DATUM POINT ARRAY DATA FILE","!",`! ${title||'Points in route order, repeats dropped.'}`,`! Coordinates in the ${res.frame.frame} frame.`,"!",
    "!CARTESIAN coordinates:","!        X                Y                Z","!",...res.ordered.map(k=>`${f(k.p[0])} ${f(k.p[1])} ${f(k.p[2])}`)].join("\n")+"\n";}

const API={compare,readPts,orderedText,lis};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.PtsCompare=API;
})(typeof globalThis!=="undefined"?globalThis:this);
