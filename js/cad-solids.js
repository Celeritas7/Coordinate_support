/* cad-solids.js — read the solids of a CAD file as obstacle boxes, one box per face.
 * IGES: B-rep solids (186 → 514 shell → 510 faces → 508 loops → 504 edges / 502 vertices), arcs (100, with their 124
 * transform) and B-splines (126, control points) add their full extent, so round faces are covered.
 * STEP: via StepAsm (step-asm.js), face vertices + circle edges, in world coordinates.
 * One box per face follows a C-channel or an L-bracket far closer than one box per part.
 * Flat faces (128 bilinear / any planar 128, 190, 108) and cylinders (120 with a line parallel to its axis) also get
 * their exact shape: the boundary loops (lines, arcs 100 + 124, B-splines 126 sampled) in the face plane / on the
 * cylinder. The gap to such a face is exact, so a hose through a hole in a plate sees the hole edge, not the box.
 * Other faces (cones, tori, free-form) stay boxes. No DOM.
 * Browser: window.CadSolids. Node: require('./cad-solids.js').
 */
(function (root) {
"use strict";
const num=x=>+String(x).replace(/D/i,'E');
function grow(b,p){for(let k=0;k<3;k++){if(p[k]<b.min[k])b.min[k]=p[k];if(p[k]>b.max[k])b.max[k]=p[k];}}
function circle(b,c,n,r){for(let k=0;k<3;k++){const s=r*Math.sqrt(Math.max(0,1-n[k]*n[k]));b.min[k]=Math.min(b.min[k],c[k]-s);b.max[k]=Math.max(b.max[k],c[k]+s);}}
const newBox=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
const ok=b=>b.min.every(Number.isFinite)&&b.max.every(Number.isFinite);
const TAU=2*Math.PI,sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len3=a=>Math.hypot(a[0],a[1],a[2]),
  unit=a=>{const l=len3(a);return l>1e-12?[a[0]/l,a[1]/l,a[2]/l]:null;},perp=n=>unit(cross3(n,Math.abs(n[0])<0.9?[1,0,0]:[0,1,0]));

// ---- exact shapes: plane with boundary loops (2D, in the plane) or cylinder band (axis, R, t and angle range) ----
// polylines: one array of 3D points per edge, grouped per loop
function planeShape(o,n,loops){const eu=perp(n),ev=cross3(n,eu),L=[],all=[Infinity,Infinity,-Infinity,-Infinity];
  for(const edges of loops){const segs=[],bb=[Infinity,Infinity,-Infinity,-Infinity],q2=[];
    for(const pl of edges){let prev=null;for(const p of pl){const w=sub3(p,o);if(Math.abs(dot3(w,n))>0.5)return null;   // boundary not on the plane: not a flat face after all
        const u=dot3(w,eu),v=dot3(w,ev);q2.push([u,v]);if(u<bb[0])bb[0]=u;if(v<bb[1])bb[1]=v;if(u>bb[2])bb[2]=u;if(v>bb[3])bb[3]=v;
        if(prev)segs.push(prev[0],prev[1],u,v);prev=[u,v];}}
    if(!segs.length)continue;
    const c=q2.reduce((a,q)=>[a[0]+q[0]/q2.length,a[1]+q[1]/q2.length],[0,0]),rs=[];
    for(let i=0;i<segs.length;i+=4)rs.push(Math.hypot(segs[i]-c[0],segs[i+1]-c[1]),Math.hypot((segs[i]+segs[i+2])/2-c[0],(segs[i+1]+segs[i+3])/2-c[1]));
    const rmin=Math.min(...rs),rmax=Math.max(...rs);
    L.push({segs:Float64Array.from(segs),bb,round:rmax-rmin<0.05*rmax+0.05?{c,r:(rmin+rmax)/2}:null,area:(bb[2]-bb[0])*(bb[3]-bb[1])});
    for(let k=0;k<2;k++){all[k]=Math.min(all[k],bb[k]);all[k+2]=Math.max(all[k+2],bb[k+2]);}}
  if(!L.length)return null;let oi=0;L.forEach((l,i)=>{if(l.area>L[oi].area)oi=i;});L.forEach((l,i)=>l.outer=i===oi);
  return{kind:'plane',o,n,eu,ev,loops:L,bb:all};}
function cylShape(a,z,ex,R,loops){const ey=cross3(z,ex),segs=[],ang=[];let t0=Infinity,t1=-Infinity;
  for(const edges of loops)for(const pl of edges){let prev=null;for(const p of pl){const w=sub3(p,a),t=dot3(w,z),x=dot3(w,ex),y=dot3(w,ey);
      if(Math.abs(Math.hypot(x,y)-R)>0.5)return null;if(t<t0)t0=t;if(t>t1)t1=t;ang.push((Math.atan2(y,x)+TAU)%TAU);
      if(prev)segs.push(prev[0],prev[1],prev[2],p[0],p[1],p[2]);prev=p;}}
  if(!segs.length)return null;ang.sort((p,q)=>p-q);let gap=ang[0]+TAU-ang[ang.length-1],th0=ang[0];
  for(let i=1;i<ang.length;i++)if(ang[i]-ang[i-1]>gap){gap=ang[i]-ang[i-1];th0=ang[i];}
  const full=gap<Math.PI/6;   // boundary leaves no gap over 30°: the full round
  return{kind:'cyl',a,z,ex,ey,R,t0,t1,full,th0,span:TAU-gap,segs:Float64Array.from(segs)};}
function seg2(u,v,g){let b=Infinity;for(let i=0;i<g.length;i+=4){const x=g[i],y=g[i+1],dx=g[i+2]-x,dy=g[i+3]-y,L2=dx*dx+dy*dy;
  let t=L2?((u-x)*dx+(v-y)*dy)/L2:0;t=t<0?0:t>1?1:t;const ex=x+dx*t-u,ey=y+dy*t-v,d=ex*ex+ey*ey;if(d<b)b=d;}return Math.sqrt(b);}
function seg3(p,g){let b=Infinity;for(let i=0;i<g.length;i+=6){const dx=g[i+3]-g[i],dy=g[i+4]-g[i+1],dz=g[i+5]-g[i+2],L2=dx*dx+dy*dy+dz*dz;
  let t=L2?((p[0]-g[i])*dx+(p[1]-g[i+1])*dy+(p[2]-g[i+2])*dz)/L2:0;t=t<0?0:t>1?1:t;
  const ex=g[i]+dx*t-p[0],ey=g[i+1]+dy*t-p[1],ez=g[i+2]+dz*t-p[2],d=ex*ex+ey*ey+ez*ez;if(d<b)b=d;}return Math.sqrt(b);}
// is (u,v) on the material of a flat face (inside the outer loop, outside every hole)? even-odd over all loops
function inFace(s,u,v){let inside=false;for(const L of s.loops){const b=L.bb;if(v<b[1]||v>b[3]||u>b[2])continue;const g=L.segs;
    for(let i=0;i<g.length;i+=4){const v1=g[i+1],v2=g[i+3];if((v1>v)!==(v2>v)&&g[i]+(v-v1)*(g[i+2]-g[i])/(v2-v1)>u)inside=!inside;}}
  return inside;}
// nearest boundary loop to (u,v): {d, loop}
function nearLoop(s,u,v){let d=Infinity,loop=null;for(const L of s.loops){const b=L.bb,du=Math.max(b[0]-u,0,u-b[2]),dv=Math.max(b[1]-v,0,v-b[3]);
    if(du*du+dv*dv>=d*d)continue;const e=seg2(u,v,L.segs);if(e<d){d=e;loop=L;}}return{d,loop};}
// exact distance from p to a face shape
function shapeDist(s,p){const w=sub3(p,s.kind==='plane'?s.o:s.a);
  if(s.kind==='plane'){const h=dot3(w,s.n),u=dot3(w,s.eu),v=dot3(w,s.ev);if(inFace(s,u,v))return Math.abs(h);return Math.hypot(h,nearLoop(s,u,v).d);}
  const t=dot3(w,s.z),x=dot3(w,s.ex),y=dot3(w,s.ey);
  if(t>=s.t0-1e-6&&t<=s.t1+1e-6&&(s.full||((Math.atan2(y,x)-s.th0)%TAU+TAU)%TAU<=s.span+1e-9))return Math.abs(Math.hypot(x,y)-s.R);
  return seg3(p,s.segs);}

function iges(text){
  const lines=String(text).split('\n'),D=[],P=[];
  for(const l of lines){const s=l.charCodeAt(72);if(s===68)D.push(l);else if(s===80)P.push(l);}
  const ents=new Map();
  for(let i=0;i+1<D.length;i+=2){const a=D[i],b=D[i+1];ents.set(i+1,{type:+a.slice(0,8),pd:+a.slice(8,16),xf:+a.slice(48,56)||0,pcount:+b.slice(24,32)});}
  const par=de=>{const e=ents.get(de);if(!e)return null;if(e.p)return e.p;let s='';for(let k=0;k<e.pcount;k++)s+=(P[e.pd-1+k]||'').slice(0,64);
    const semi=s.indexOf(';');e.p=(semi>=0?s.slice(0,semi):s).split(',');return e.p;};
  const xform=de=>{if(!de)return null;const p=par(de);if(!p)return null;const m=p.slice(1,13).map(num);
    return{R:[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]],T:[m[3],m[7],m[11]]};};
  const apply=(X,p)=>X?[X.R[0][0]*p[0]+X.R[0][1]*p[1]+X.R[0][2]*p[2]+X.T[0],X.R[1][0]*p[0]+X.R[1][1]*p[1]+X.R[1][2]*p[2]+X.T[1],X.R[2][0]*p[0]+X.R[2][1]*p[1]+X.R[2][2]*p[2]+X.T[2]]:p;
  const vls=new Map(),vl=de=>{let v=vls.get(de);if(v)return v;const p=par(de),n=+p[1];v=[];for(let k=0;k<n;k++)v.push([num(p[2+3*k]),num(p[3+3*k]),num(p[4+3*k])]);vls.set(de,v);return v;};
  const curveExt=new Map();
  function curve(b,de){const e=ents.get(de);if(!e)return;
    if(e.type===100){let c=curveExt.get(de);if(!c){const p=par(de),zt=num(p[1]),cx=num(p[2]),cy=num(p[3]),r=Math.hypot(num(p[4])-cx,num(p[5])-cy),X=xform(e.xf);
        const n=X?[X.R[0][2],X.R[1][2],X.R[2][2]]:[0,0,1];c={c:apply(X,[cx,cy,zt]),n,r};curveExt.set(de,c);}
      circle(b,c.c,c.n,c.r);}
    else if(e.type===126){let c=curveExt.get(de);if(!c){const p=par(de),K=+p[1],M=+p[2],s=7+(K+M+2)+(K+1),X=xform(e.xf);c=newBox();
        for(let k=0;k<=K;k++)grow(c,apply(X,[num(p[s+3*k]),num(p[s+3*k+1]),num(p[s+3*k+2])]));curveExt.set(de,c);}
      if(ok(c)){grow(b,c.min);grow(b,c.max);}}}
  // a curve as 3D points (lines exact, arcs every 5°, B-splines evaluated); null = unknown type
  const pts=new Map();
  function curvePts(de){if(pts.has(de))return pts.get(de);const e=ents.get(de);let out=null;const p=e&&par(de),X=e&&xform(e.xf);
    if(!e);
    else if(e.type===110)out=[apply(X,[num(p[1]),num(p[2]),num(p[3])]),apply(X,[num(p[4]),num(p[5]),num(p[6])])];
    else if(e.type===100){const zt=num(p[1]),cx=num(p[2]),cy=num(p[3]),sx=num(p[4]),sy=num(p[5]),r=Math.hypot(sx-cx,sy-cy);
      let a0=Math.atan2(sy-cy,sx-cx),a1=Math.atan2(num(p[7])-cy,num(p[6])-cx);if(Math.abs(a1-a0)<1e-9)a1=a0+TAU;else if(a1<a0)a1+=TAU;
      const n=Math.max(2,Math.ceil((a1-a0)/(Math.PI/36)));out=[];for(let q=0;q<=n;q++){const a=a0+(a1-a0)*q/n;out.push(apply(X,[cx+r*Math.cos(a),cy+r*Math.sin(a),zt]));}}
    else if(e.type===126){const K=+p[1],M=+p[2],kn=[],w=[],c=[];let s=7;
      for(let i=0;i<K+M+2;i++)kn.push(num(p[s+i]));s+=K+M+2;for(let i=0;i<=K;i++)w.push(num(p[s+i]));s+=K+1;
      for(let i=0;i<=K;i++)c.push([num(p[s+3*i]),num(p[s+3*i+1]),num(p[s+3*i+2])]);s+=3*(K+1);const v0=num(p[s]),v1=num(p[s+1]);
      const n=M===1?K:Math.min(120,Math.max(12,(K+1)*4));out=[];
      for(let q=0;q<=n;q++){const t=M===1?kn[q+1]:v0+(v1-v0)*q/n;let k=M;while(k<K&&t>=kn[k+1])k++;
        if(M===1){out.push(apply(X,c[q]));continue;}
        const d=[];for(let j=0;j<=M;j++){const i=k-M+j,ww=w[i];d.push([c[i][0]*ww,c[i][1]*ww,c[i][2]*ww,ww]);}
        for(let r=1;r<=M;r++)for(let j=M;j>=r;j--){const i=k-M+j,den=kn[i+M-r+1]-kn[i],a=den?(t-kn[i])/den:0;for(let m=0;m<4;m++)d[j][m]=(1-a)*d[j-1][m]+a*d[j][m];}
        const h=d[M];out.push(apply(X,[h[0]/h[3],h[1]/h[3],h[2]/h[3]]));}}
    else if(e.type===102){out=[];for(let k=0;k<+p[1];k++){const q=curvePts(+p[2+k]);if(!q){out=null;break;}out.push(...q);}}
    pts.set(de,out);return out;}
  const pt3=de=>{const e=ents.get(de);if(!e)return null;const p=par(de),X=xform(e.xf);return apply(X,[num(p[1]),num(p[2]),num(p[3])]);};
  const dir3=de=>{const e=ents.get(de);if(!e)return null;const p=par(de),X=xform(e.xf),v=[num(p[1]),num(p[2]),num(p[3])];
    return unit(X?[X.R[0][0]*v[0]+X.R[0][1]*v[1]+X.R[0][2]*v[2],X.R[1][0]*v[0]+X.R[1][1]*v[1]+X.R[1][2]*v[2],X.R[2][0]*v[0]+X.R[2][1]*v[1]+X.R[2][2]*v[2]]:v);};
  // exact shape of a face from its surface and its loops (polylines per loop); null = keep the box
  function faceShape(sde,loops){const e=ents.get(sde);if(!e)return null;const p=par(sde);
    if(e.type===128){const K1=+p[1],K2=+p[2],M1=+p[3],M2=+p[4],X=xform(e.xf),n1=K1+1,n2=K2+1,s=10+(K1+M1+2)+(K2+M2+2)+n1*n2,c=[];
      for(let q=0;q<n1*n2;q++)c.push(apply(X,[num(p[s+3*q]),num(p[s+3*q+1]),num(p[s+3*q+2])]));
      const n=unit(cross3(sub3(c[K1],c[0]),sub3(c[K2*n1],c[0])));if(!n)return null;
      if(c.some(q=>Math.abs(dot3(sub3(q,c[0]),n))>1e-3))return null;return planeShape(c[0],n,loops);}
    if(e.type===190){const o=pt3(+p[1]),n=dir3(+p[2]);return o&&n?planeShape(o,n,loops):null;}
    if(e.type===108){const X=xform(e.xf),a=[num(p[1]),num(p[2]),num(p[3])],l=len3(a);if(!l)return null;const n0=a.map(v=>v/l),o0=n0.map(v=>v*num(p[4])/l);
      const o=apply(X,o0),n=unit(sub3(apply(X,[o0[0]+n0[0],o0[1]+n0[1],o0[2]+n0[2]]),o));return n?planeShape(o,n,loops):null;}
    if(e.type===120){const ax=curvePts(+p[1]),g=ents.get(+p[2]);if(!ax||!g||g.type!==110||ents.get(+p[1]).type!==110)return null;const gp=curvePts(+p[2]);
      const z=unit(sub3(ax[1],ax[0])),gz=unit(sub3(gp[1],gp[0]));if(!z||!gz||len3(cross3(z,gz))>1e-6)return null;   // cone, not a cylinder
      const w=sub3(gp[0],ax[0]),rv=sub3(w,z.map(v=>v*dot3(w,z))),R=len3(rv);if(R<1e-6)return null;return cylShape(ax[0],z,rv.map(v=>v/R),R,loops);}
    return null;}
  const faces=[],solids=[];let sid=0;
  for(const [de,e] of ents){if(e.type!==186)continue;sid++;const sp=par(+par(de)[1]);if(!sp)continue;const nf=+sp[1],sb=newBox();let made=0;
    for(let k=0;k<nf;k++){const fp=par(+sp[2+2*k]);if(!fp)continue;const nl=+fp[2],b=newBox(),loops=[];let exact=true;
      for(let l=0;l<nl;l++){const lp=par(+fp[4+l]);if(!lp)continue;const ne=+lp[1],edges=[];let i=2;loops.push(edges);
        for(let q=0;q<ne;q++){const typ=+lp[i],el=+lp[i+1],ei=+lp[i+2],K=+lp[i+4];i+=5+2*K;const ep=par(el);if(!ep)continue;
          if(typ===0){const o=2+5*(ei-1),sv=vl(+ep[o+1])[+ep[o+2]-1],tv=vl(+ep[o+3])[+ep[o+4]-1],cd=+ep[o];grow(b,sv);grow(b,tv);curve(b,cd);   // 0 = edge, 1 = vertex
            const ce=ents.get(cd),cp=ce&&ce.type!==110?curvePts(cd):null;if(ce&&ce.type!==110&&!cp)exact=false;edges.push(cp||[sv,tv]);}
          else{const v=vl(el)[ei-1];if(v){grow(b,v);edges.push([v]);}}}}
      if(ok(b)){const f={sid,min:b.min,max:b.max},sh=exact?faceShape(+fp[1],loops):null;
        if(sh){f.shape=sh;const nb=newBox(),pad=sh.kind==='cyl'?sh.R*0.002+0.01:0.01;loops.forEach(e=>e.forEach(pl=>pl.forEach(p=>grow(nb,p))));   // exact face: box from its sampled boundary, not from whole circles
          if(ok(nb)){f.min=nb.min.map(v=>v-pad);f.max=nb.max.map(v=>v+pad);}}
        faces.push(f);grow(sb,f.min);grow(sb,f.max);made++;}}
    if(made)solids.push({sid,name:`solid ${sid}`,faces:made,min:sb.min,max:sb.max});}
  plates(faces);
  return{format:'IGES',solids,faces};
}

function step(text){
  const SA=root.StepAsm||(typeof require!=="undefined"?require("./step-asm.js"):null);if(!SA)throw new Error('StepAsm not loaded');
  const r=SA.parse(text),F=SA.F,faces=[],solids=[];let sid=0;
  r.instances.forEach(inst=>inst.part.solids.forEach(sol=>{sid++;const sb=newBox();let made=0;
    sol.faces.forEach(f=>{const b=newBox();f.verts.forEach(v=>grow(b,F.pt(inst.M,v)));
      f.edges.forEach(ed=>circle(b,F.pt(inst.M,ed.ax.o),F.vec(inst.M,ed.ax.z),ed.r));
      if(ok(b)){faces.push({sid,min:b.min,max:b.max});grow(sb,b.min);grow(sb,b.max);made++;}});
    if(made)solids.push({sid,name:inst.label||inst.name||`solid ${sid}`,faces:made,min:sb.min,max:sb.max});}));
  return{format:'STEP',solids,faces};
}

function read(text,name){
  const s=String(text),isStep=/^\s*ISO-10303-21/.test(s)||/\.(stp|step)$/i.test(name||'');
  const out=isStep?step(s):iges(s);out.name=name||'';return out;
}

// distance from p to box b (0 inside)
function boxDist(p,b){let q=0;for(let k=0;k<3;k++){const e=Math.max(b.min[k]-p[k],0,p[k]-b.max[k]);q+=e*e;}return Math.sqrt(q);}
// samples of a polyline every `step` mm
function along(P,step){const out=[];for(let i=0;i+1<P.length;i++){const a=P[i],b=P[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.ceil(L/step));
  for(let k=i?1:0;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,a[2]+(b[2]-a[2])*k/n]);}return out;}

// what each solid is to one route. role: 'station' = touches a station (its clip / clamp); 'clip' = small part
// (≤ clipSize) the station line runs through or touches; 'obstacle' = anything else within `reach` of the line
function survey(cad,stations,o){
  const rad=o.d/2+o.gap,touch=rad+(o.touch??5),reach=Math.max(o.reach,touch),clipSize=o.clipSize??80;
  const S=along(stations,2),by=new Map();
  for(const f of cad.faces){
    let dl=Infinity;
    for(const p of S){if(p[0]<f.min[0]-reach||p[0]>f.max[0]+reach||p[1]<f.min[1]-reach||p[1]>f.max[1]+reach||p[2]<f.min[2]-reach||p[2]>f.max[2]+reach)continue;const d=boxDist(p,f);if(d<dl)dl=d;}
    if(dl>reach)continue;f.dl=dl;
    let s=by.get(f.sid);if(!s)by.set(f.sid,s={sid:f.sid,dLine:Infinity,st:new Set(),faces:[]});
    s.faces.push(f);s.dLine=Math.min(s.dLine,dl);
    stations.forEach((p,i)=>{if(boxDist(p,f)<=touch)s.st.add(i);});}
  const solid=new Map(cad.solids.map(x=>[x.sid,x]));
  const parts=[...by.values()].map(s=>{const so=solid.get(s.sid),size=Math.max(...so.max.map((v,k)=>v-so.min[k]));
    const role=s.st.size?'station':(size<=clipSize&&s.dLine<=touch)?'clip':'obstacle';
    return{sid:s.sid,name:so.name,size,dims:so.max.map((v,k)=>v-so.min[k]),dLine:s.dLine,stations:[...s.st].sort((a,b)=>a-b),role,faces:s.faces};}).sort((a,b)=>a.dLine-b.dLine);
  return{rad,touch,reach,parts};
}

// uniform grid over boxes for fast "which boxes are near p"
function index(boxes,cell){cell=cell||50;const g=new Map(),key=(i,j,k)=>i+','+j+','+k;
  boxes.forEach((b,n)=>{const lo=b.min.map(v=>Math.floor(v/cell)),hi=b.max.map(v=>Math.floor(v/cell));
    if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>20000){(g.big=g.big||[]).push(n);return;}
    for(let i=lo[0];i<=hi[0];i++)for(let j=lo[1];j<=hi[1];j++)for(let k=lo[2];k<=hi[2];k++){const kk=key(i,j,k);let L=g.get(kk);if(!L)g.set(kk,L=[]);L.push(n);}});
  // nearest face within `r` of p: {d, box} (d = exact distance for flat / cylindrical faces, else to the box; Infinity if none)
  function nearest(p,r){const seen=new Set(),c=p.map(v=>Math.floor(v/cell)),s=Math.ceil(r/cell);let bd=Infinity,bb=null;
    const test=n=>{if(seen.has(n))return;seen.add(n);const b=boxes[n];let d=boxDist(p,b);if(d>=bd)return;if(b.shape)d=shapeDist(b.shape,p);if(d<bd){bd=d;bb=b;}};
    for(let i=-s;i<=s;i++)for(let j=-s;j<=s;j++)for(let k=-s;k<=s;k++){const L=g.get(key(c[0]+i,c[1]+j,c[2]+k));if(L)L.forEach(test);}
    (g.big||[]).forEach(test);return{d:bd,box:bb};}
  return{nearest};
}
// smallest surface gap along a dense path: hose radius d/2 taken off the centreline distance
function clearance(pts,ix,d,r){let w={gap:Infinity,i:-1,box:null};
  pts.forEach((p,i)=>{const n=ix.nearest(p,r);const gap=n.d-d/2;if(gap<w.gap)w={gap,i,box:n.box,p};});return w;}

// where a path crosses a plate (flat face with shape.plate) off its material: through a hole, or past its edge (within `near` mm of
// the outline). [{i, x, face, loop, edge}] — i = path segment, x = crossing point, loop = the boundary nearest x
// (loop.outer = the face outline), edge = centreline to that boundary, in the plane
function openings(pts,faces,near){near=near??60;const out=[];
  for(const f of faces){const s=f.shape;if(!s||s.kind!=='plane'||!s.plate)continue;let ha=null;
    for(let i=0;i<pts.length;i++){const p=pts[i];if(boxDist(p,f)>near+50){ha=null;continue;}const h=dot3(sub3(p,s.o),s.n);
      if(ha!==null&&(ha>0)!==(h>0)&&ha!==h){const a=pts[i-1],t=ha/(ha-h),x=[a[0]+(p[0]-a[0])*t,a[1]+(p[1]-a[1])*t,a[2]+(p[2]-a[2])*t],w=sub3(x,s.o),u=dot3(w,s.eu),v=dot3(w,s.ev);
        if(u>=s.bb[0]-near&&u<=s.bb[2]+near&&v>=s.bb[1]-near&&v<=s.bb[3]+near&&!inFace(s,u,v)){const nl=nearLoop(s,u,v);if(nl.d<=near||!nl.loop.outer)out.push({i:i-1,x,face:f,loop:nl.loop,edge:nl.d});}}
      ha=h;}}
  return out;}
// sheets and plates: a flat face with a parallel face of the same solid behind it (≤ maxT mm, outlines overlapping)
// gets shape.plate = {t, other}. A route crossing such a face off its material goes through the plate or past its edge.
function plates(faces,maxT){maxT=maxT??25;const by=new Map();
  faces.forEach(f=>{if(f.shape&&f.shape.kind==='plane'){let L=by.get(f.sid);if(!L)by.set(f.sid,L=[]);L.push(f);}});
  for(const L of by.values())for(const a of L){const A=a.shape;if(A.plate)continue;
    for(const b of L){if(b===a)continue;const B=b.shape;if(dot3(A.n,B.n)>-0.9999)continue;const t=-dot3(sub3(B.o,A.o),A.n);if(t<0.1||t>maxT)continue;
      let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
      for(let k=0;k<8;k++){const c=[k&1?b.max[0]:b.min[0],k&2?b.max[1]:b.min[1],k&4?b.max[2]:b.min[2]],w=sub3(c,A.o),u=dot3(w,A.eu),v=dot3(w,A.ev);u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);}
      if(Math.min(u1,A.bb[2])-Math.max(u0,A.bb[0])>1&&Math.min(v1,A.bb[3])-Math.max(v0,A.bb[1])>1){A.plate={t,other:b};if(!B.plate)B.plate={t,other:a};break;}}}}
// "Y 1000" for a face square to an axis, else ""
function planeName(s){for(let k=0;k<3;k++)if(Math.abs(Math.abs(s.n[k])-1)<1e-6)return'XYZ'[k]+' '+(Math.round(s.o[k]*10)/10);return'';}
// a loop of a flat face as 3D points (to draw it)
function loop3(s,L){const g=L.segs,out=[];for(let i=0;i<g.length;i+=4){const u=g[i],v=g[i+1];out.push([s.o[0]+s.eu[0]*u+s.ev[0]*v,s.o[1]+s.eu[1]*u+s.ev[1]*v,s.o[2]+s.eu[2]*u+s.ev[2]*v]);}return out;}

const API={read,iges,step,survey,index,clearance,boxDist,along,shapeDist,openings,loop3,planeName};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.CadSolids=API;
})(typeof globalThis!=="undefined"?globalThis:this);
