/* offset.js — move a lines + arcs pipe (the follower) away from another pipe (the fixed one) until the surface gap
 * is at least `gap` everywhere it can be. Only the spots that are too close move; the rest stays.
 * Constraints: both ends and end directions fixed; every straight keeps at least min(minStraight, its original length);
 * at each clip the follower already runs through, the straight stays on the clip's bore axis (clip spacing wins there).
 * Corners are pushed away from the fixed pipe, re-checked, then pulled back as far as the gap allows.
 * No DOM. Needs ArcRoute (arcroute.js). Browser: window.PipeOffset. Node: require('./offset.js').
 */
(function(root){
"use strict";
const AR=root.ArcRoute||(typeof require!=="undefined"?require("./arcroute.js"):null);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1e-12;return[a[0]/l,a[1]/l,a[2]/l];};
const DEG=180/Math.PI;
const radial=(p,c,a)=>{const v=sub(p,c);return len(sub(v,mul(a,dot(v,a))));};

// W: follower corners (incl. ends). o: {R, gap, odFixed, odFollow, near(p)->{d,q}, minStraight, clips:[{c,a,length,name}], margin, step, tol,
//   obstacles:[{id,min,max}] boxes to keep obsGap from (surface of the follower to the box)}
function solve(W0,opt){
  if(!AR)throw new Error('ArcRoute not loaded');
  const o=Object.assign({minStraight:30,margin:2,step:4,tol:0.03,iters:150},opt);
  const m=W0.length-1;if(m<2)throw new Error('The follower needs at least one bend.');
  const Dt=o.gap+(o.odFixed+o.odFollow)/2;   // centre-line distance that gives the surface gap
  const G0=AR.build(W0,o.R),need=G0.lines.map(l=>Math.min(o.minStraight,l.gap));
  const sd=norm(sub(W0[1],W0[0])),ed=norm(sub(W0[m],W0[m-1]));
  // how each corner may move: fixed ends, the corners next to them slide along the end direction, clip corners along the bore axis
  const K=W0.map((p,i)=>i===0||i===m?{kind:'fixed'}:{kind:'free'});
  K[1]={kind:'ray',d:sd};if(m-1!==1)K[m-1]={kind:'ray',d:ed};else K[1]={kind:'fixed'};
  const clips=(o.clips||[]).map(c=>({...c,a:norm(c.a),h:c.length/2+o.margin}));
  clips.forEach(c=>{c.j=-1;for(let j=0;j<m;j++)if(radial(W0[j],c.c,c.a)<0.5&&radial(W0[j+1],c.c,c.a)<0.5){c.j=j;break;}
    if(c.j<0)return;[c.j,c.j+1].forEach(i=>{const k=K[i];if(k.kind==='fixed')return;
      if(k.kind==='ray'||k.kind==='axis'){K[i]={kind:'fixed'};return;}K[i]={kind:'axis',d:c.a};});});
  const project=(i,v)=>{const k=K[i];if(k.kind==='fixed')return[0,0,0];if(k.kind==='free')return v;return mul(k.d,dot(v,k.d));};
  // which samples the gap rule applies to: not inside a clip zone (bore ± margin ± R), where the clip spacing wins
  const exempt=p=>clips.some(c=>c.j>=0&&radial(p,c.c,c.a)<1&&Math.abs(dot(sub(p,c.c),c.a))<=c.h+o.R);
  // obstacles: boxes {id,min,max}; the follower's surface keeps obsGap from them. Closest box point, and the way out
  const boxes=(o.obstacles||[]).map((b,k)=>({id:b.id||'box '+(k+1),min:b.min,max:b.max})),Do=(o.obsGap??o.gap)+o.odFollow/2;
  const boxNear=(p,b)=>{const q=[0,1,2].map(k=>Math.max(b.min[k],Math.min(b.max[k],p[k]))),d=len(sub(p,q));
    if(d>1e-9)return{d,q,n:norm(sub(p,q))};
    // inside: leave through the nearest face
    let bk=0,bs=1,bm=Infinity;for(let k=0;k<3;k++){const a=p[k]-b.min[k],c=b.max[k]-p[k];if(a<bm){bm=a;bk=k;bs=-1;}if(c<bm){bm=c;bk=k;bs=1;}}
    const n=[0,0,0];n[bk]=bs;return{d:-bm,q:p,n};};
  function evaluate(W){let G;try{G=AR.build(W,o.R);}catch(e){return null;}
    const S=AR.sample(G,o.step),pts=[];let worst=-Infinity,wi=-1,minGap=Infinity,minAt=0,area=0;const obsMin=boxes.map(()=>({g:Infinity,p:null,s:0}));
    for(let i=0;i<S.pts.length;i++){const p=S.pts[i],n=o.near(p),gapS=n.d-(o.odFixed+o.odFollow)/2,ex=exempt(p),def=Dt-n.d;
      if(gapS<minGap&&!ex){minGap=gapS;minAt=S.s[i];}if(!ex&&def>o.tol)area+=(def-o.tol)*o.step;
      let od=-Infinity,on=null;boxes.forEach((b,k)=>{const r=boxNear(p,b),g=r.d-o.odFollow/2,e=Do-r.d;if(g<obsMin[k].g)obsMin[k]={g,p,s:S.s[i]};if(e>od){od=e;on=r.n;}});
      if(!ex&&od>o.tol)area+=(od-o.tol)*o.step;
      pts.push({p,s:S.s[i],q:n.q,d:n.d,def,ex,od,on});const w=Math.max(def,od);if(!ex&&w>worst){worst=w;wi=i;}}
    return{G,S,pts,worst,wi,minGap,minAt,area,obsMin};}
  function problems(W,G){const bad=[];if(!G)return['the bends overlap'];
    G.lines.forEach((l,j)=>{if(l.gap<need[j]-1e-3)bad.push(`straight ${j+1} would be ${l.gap.toFixed(1)} mm, needs ${need[j].toFixed(0)}`);});
    G.corners.forEach((c,j)=>{if(c&&c.th>179/DEG)bad.push(`corner ${j+1} turns back on itself`);});
    for(const i of[1,m-1]){if(K[i].kind==='ray'&&dot(sub(W[i],i===1?W[0]:W[m]),i===1?sd:mul(ed,-1))<0.5)bad.push('an end straight flips over');}
    clips.forEach(c=>{if(c.j<0)return;const j=c.j,s=dot(sub(W[j+1],W[j]),c.a)>=0?1:-1,d=mul(c.a,s),tP=j>0?G.corners[j].t:0,tQ=j+1<m?G.corners[j+1].t:0;
      const from=dot(sub(W[j],c.c),d)+tP,to=dot(sub(W[j+1],c.c),d)-tQ;if(from>-c.h+1e-3||to<c.h-1e-3)bad.push(`${c.name}: the straight no longer covers the clip`);});
    return bad;}
  // segment of the corner polyline a sample belongs to, and where along it (0..1)
  function segOf(W,p){let bj=0,bt=0,bd=Infinity;for(let j=0;j<m;j++){const d=sub(W[j+1],W[j]),L2=dot(d,d),t=L2?Math.max(0,Math.min(1,dot(sub(p,W[j]),d)/L2)):0,e=len(sub(p,add(W[j],mul(d,t))));if(e<bd){bd=e;bj=j;bt=t;}}return[bj,bt];}

  let W=W0.map(p=>p.slice()),ev=evaluate(W);const before=ev;let stall=0,best=ev.area,stopWhy='';
  for(let it=0;it<o.iters&&ev.worst>o.tol;it++){
    const acc=W.map(()=>({v:[0,0,0],mag:0}));
    ev.pts.forEach(x=>{if(x.ex)return;const push=[];
      if(x.def>o.tol*0.5&&x.d>1e-6)push.push([norm(sub(x.p,x.q)),x.def]);
      if(x.od>o.tol*0.5&&x.on)push.push([x.on,x.od]);
      if(!push.length)return;const[j,t]=segOf(W,x.p);
      push.forEach(([n,def])=>[[j,1-t],[j+1,t]].forEach(([i,w])=>{if(w<0.05)return;const e=def*Math.min(1,w*1.6);acc[i].v=add(acc[i].v,mul(n,e));acc[i].mag=Math.max(acc[i].mag,e);}));});
    let mv=acc.map((a,i)=>a.mag>0?project(i,mul(norm(a.v),a.mag*1.15)):[0,0,0]);
    if(mv.every(v=>len(v)<1e-6)){stopWhy='the close spots sit where nothing may move (an end, or a clip straight)';break;}
    let took=false;
    for(let h=0;h<7;h++){const Wn=W.map((p,i)=>add(p,mv[i])),en=evaluate(Wn);if(en&&!problems(Wn,en.G).length){W=Wn;ev=en;took=true;break;}mv=mv.map(v=>mul(v,0.5));}
    if(!took){const en=evaluate(W);stopWhy=problems(W.map((p,i)=>add(p,mv[i])),en&&en.G)[0]||'no room to move further';break;}
    if(ev.area<best*0.995-0.01){best=ev.area;stall=0;}else if(++stall>12){stopWhy='the gap stopped improving';break;}}
  // pull every moved corner back towards where it was, as long as no spot gets closer than it is now
  const okW=Wc=>{const e=evaluate(Wc);return e&&!problems(Wc,e.G).length&&e.worst<=Math.max(o.tol,ev.worst)+1e-3&&e.area<=ev.area+0.01?e:null;};
  for(let pass=0;pass<2;pass++)for(let i=1;i<m;i++){const dv=sub(W[i],W0[i]);if(len(dv)<0.01)continue;let lo=0,hi=1;
    for(let k=0;k<9;k++){const t=(lo+hi)/2,Wc=W.slice();Wc[i]=add(W0[i],mul(dv,t));if(okW(Wc))hi=t;else lo=t;}
    if(hi<1){const Wc=W.slice();Wc[i]=add(W0[i],mul(dv,hi));const e=okW(Wc);if(e){W=Wc;ev=e;}}}
  {const Wr=W.map(p=>p.map(x=>Math.round(x*1000)/1000)),er=evaluate(Wr);if(er&&!problems(Wr,er.G).length){W=Wr;ev=er;}}
  const rep=o.gap-Math.max(0.1,o.tol*2);
  // spots still under the gap, merged into stretches
  const under=[];let cur=null;
  ev.pts.forEach(x=>{const g=x.d-(o.odFixed+o.odFollow)/2;if(!x.ex&&g<rep){if(!cur){cur={from:x.s,to:x.s,min:g,at:x.p,what:'pipe'};under.push(cur);}cur.to=x.s;if(g<cur.min){cur.min=g;cur.at=x.p;}}else cur=null;});
  const obsRep=boxes.map((b,k)=>{const og=o.obsGap??o.gap,a=ev.obsMin[k],bf=before.obsMin[k];if(a.g<og-Math.max(0.1,o.tol*2))under.push({from:a.s,to:a.s,min:a.g,at:a.p,what:b.id});
    return{id:b.id,before:bf.g,after:a.g,at:a.p,ok:a.g>=og-Math.max(0.1,o.tol*2)};});
  const G=ev.G,rows=W.map((p,i)=>({p,moved:len(sub(p,W0[i])),deg:i>0&&i<m&&G.corners[i]?G.corners[i].th*DEG:null,kind:K[i].kind}));
  const clipRep=clips.map(c=>{let off=0;ev.pts.forEach(x=>{const u=dot(sub(x.p,c.c),c.a),r=radial(x.p,c.c,c.a);if(r<c.length+5&&Math.abs(u)<=c.length/2)off=Math.max(off,r);});
    const n=o.near(c.c);return{name:c.name,on:c.j>=0,maxOff:off,gap:n.d-(o.odFixed+o.odFollow)/2};});
  const dirS=dot(norm(sub(W[1],W[0])),sd),dirE=dot(norm(sub(W[m],W[m-1])),ed);
  return{ok:!under.length,W,R:o.R,rows,under,clips:clipRep,obstacles:obsRep,stopWhy:under.length?stopWhy:'',G,samples:ev.S,
    before:{minGap:before.minGap,at:before.minAt},after:{minGap:ev.minGap,at:ev.minAt},
    bends:G.corners.slice(1).map(c=>c.th*DEG),straights:G.lines.map(l=>l.gap),length:ev.S.s[ev.S.s.length-1],
    minStraight:Math.min(...G.lines.slice(1,-1).map(l=>l.gap)),endDirErr:Math.max(Math.acos(Math.min(1,dirS)),Math.acos(Math.min(1,dirE)))*DEG};
}
const API={solve};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.PipeOffset=API;
})(typeof globalThis!=="undefined"?globalThis:this);
