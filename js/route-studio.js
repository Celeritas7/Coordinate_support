// ---------- core math (no DOM) ----------
const V={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
 mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}};

function parsePts(text){
  const P=[];
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('!')[0].trim(); if(!line) continue;
    const v=line.replace(/,/g,' ').split(/\s+/).map(Number);
    if(v.length>=3&&v.slice(0,3).every(Number.isFinite)){const p=v.slice(0,3);if(Number.isFinite(v[3])&&v[3]>0)p.loc=v[3];P.push(p);}
  }
  return P.filter((p,i)=>i===0||V.len(V.sub(p,P[i-1]))>1e-6);
}

// natural cubic spline through Q, chord-length parameter; returns sampler
function naturalSpline(Q){
  const n=Q.length; const t=[0];
  for(let i=1;i<n;i++) t.push(t[i-1]+V.len(V.sub(Q[i],Q[i-1])));
  const M=[[],[],[]];
  for(let d=0;d<3;d++){
    const y=Q.map(q=>q[d]); const m=new Array(n).fill(0);
    if(n>2){
      const a=[],b=[],c=[],r=[];
      for(let i=1;i<n-1;i++){const h0=t[i]-t[i-1],h1=t[i+1]-t[i];
        a.push(h0);b.push(2*(h0+h1));c.push(h1);r.push(6*((y[i+1]-y[i])/h1-(y[i]-y[i-1])/h0));}
      const k=b.length;
      for(let i=1;i<k;i++){const w=a[i]/b[i-1];b[i]-=w*c[i-1];r[i]-=w*r[i-1];}
      const x=new Array(k);x[k-1]=r[k-1]/b[k-1];
      for(let i=k-2;i>=0;i--)x[i]=(r[i]-c[i]*x[i+1])/b[i];
      for(let i=0;i<k;i++)m[i+1]=x[i];
    }
    M[d]=m;
  }
  function at(i,s){ // segment i, local s in [0,h]
    const h=t[i+1]-t[i];const p=[],d1=[],d2=[];
    for(let d=0;d<3;d++){const y0=Q[i][d],y1=Q[i+1][d],m0=M[d][i],m1=M[d][i+1];
      const A=(t[i+1]-(t[i]+s))/h,B=s/h;
      p.push(A*y0+B*y1+((A*A*A-A)*m0+(B*B*B-B)*m1)*h*h/6);
      d1.push((y1-y0)/h-(3*A*A-1)/6*h*m0+(3*B*B-1)/6*h*m1);
      d2.push(A*m0+B*m1);}
    return{p,d1,d2};
  }
  return{t,at,nseg:n-1};
}
function curvOf(d1,d2){const c=V.len(V.cross(d1,d2)),l=V.len(d1);return c/(l*l*l);}

// sample a curve source into dense polyline with curvature + arclength
function sampleSpline(sp,per=40){
  const pts=[],k=[],d1s=[],d2s=[];
  for(let i=0;i<sp.nseg;i++){const h=sp.t[i+1]-sp.t[i];const m=Math.max(4,Math.ceil(per*h/ (sp.t[sp.nseg]/sp.nseg)));
    for(let j=(i?1:0);j<=m;j++){const r=sp.at(i,h*j/m);pts.push(r.p);k.push(curvOf(r.d1,r.d2));d1s.push(r.d1);d2s.push(r.d2);}}
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+V.len(V.sub(pts[i],pts[i-1])));
  return{pts,k,s,d1s,d2s};
}

// ---------- Hermite route optimisation ----------
function hermite(p0,p1,m0,m1,u){
  const u2=u*u,u3=u2*u;
  const h=[2*u3-3*u2+1,u3-2*u2+u,-2*u3+3*u2,u3-u2],
        d=[6*u2-6*u,3*u2-4*u+1,-6*u2+6*u,3*u2-2*u],
        e=[12*u-6,6*u-4,-12*u+6,6*u-2];
  const f=w=>[0,1,2].map(i=>w[0]*p0[i]+w[1]*m0[i]+w[2]*p1[i]+w[3]*m1[i]);
  return{p:f(h),d1:f(d),d2:f(e)};
}
// opts: startDir/endDir, fixDirs[i] (fixed tangent per point), localR[i] (min radius near point i),
// freePts (indices whose position the solver may move), obstacles [{min,max}] + rad (cable radius + keep-out)
function makeRoute(P,opts={}){
  const n=P.length,chord0=P.reduce((a,p,i)=>i?a+V.len(V.sub(p,P[i-1])):0,0);
  const fix=[];for(let i=0;i<n;i++)fix[i]=(opts.fixDirs&&opts.fixDirs[i])||null;
  if(opts.startDir)fix[0]=opts.startDir;if(opts.endDir)fix[n-1]=opts.endDir;
  const free=(opts.freePts||[]).slice(),off=3*n+2*(n-1),loc=opts.localR||[];
  const T0=P.map((_,i)=>fix[i]?V.norm(fix[i]):V.norm(V.sub(P[Math.min(i+1,n-1)],P[Math.max(i-1,0)])));
  const x=[];T0.forEach(t=>x.push(...t));for(let i=0;i<2*(n-1);i++)x.push(1);
  free.forEach(i=>x.push(...V.mul(P[i],1/chord0)));
  const av=opts.avoid||[],me=opts.self||{r:0,g:0},cell=Math.max(20,...av.map(a=>a[3]+a[4]))+me.r,grid=new Map(),key=(i,j,k)=>i+','+j+','+k;
  av.forEach(a=>{const kk=key(Math.floor(a[0]/cell),Math.floor(a[1]/cell),Math.floor(a[2]/cell));if(!grid.has(kk))grid.set(kk,[]);grid.get(kk).push(a);});
  function avoidDepth(p){if(!av.length)return 0;let s=0;const ci=Math.floor(p[0]/cell),cj=Math.floor(p[1]/cell),ck=Math.floor(p[2]/cell);
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const L=grid.get(key(ci+i,cj+j,ck+k));if(!L)continue;
      for(const a of L){const need=a[3]+me.r+Math.max(a[4],me.g)+1,dx=p[0]-a[0],dy=p[1]-a[1],dz=p[2]-a[2],d2=dx*dx+dy*dy+dz*dz;if(d2<need*need){const e=need-Math.sqrt(d2);s+=e*e;}}}
    return s;}
  function pts(x){const Q=P.map(p=>p.slice(0,3));free.forEach((i,f)=>{Q[i]=[x[off+3*f],x[off+3*f+1],x[off+3*f+2]].map(c=>c*chord0);});return Q;}
  function segs(x){
    const Q=pts(x),T=[];for(let i=0;i<n;i++)T.push(fix[i]?V.norm(fix[i]):V.norm([x[3*i],x[3*i+1],x[3*i+2]]));
    const out=[];for(let i=0;i<n-1;i++){const L=V.len(V.sub(Q[i+1],Q[i])),s0=x[3*n+2*i],s1=x[3*n+2*i+1];
      out.push([Q[i],Q[i+1],V.mul(T[i],L*s0),V.mul(T[i+1],L*s1)]);}
    return out;
  }
  function evalX(x,S=40){
    let len=0,kmax=0,obs=0;const ks=[],rl=[],rad=opts.rad||0,boxes=opts.obstacles||[];
    segs(x).forEach((g,i)=>{let prev=null;const r0=loc[i]||0,r1=loc[i+1]||0;
      for(let j=0;j<=S;j++){const u=j/S,r=hermite(g[0],g[1],g[2],g[3],u),k=curvOf(r.d1,r.d2);ks.push(k);rl.push(r0*(1-u)+r1*u);if(k>kmax)kmax=k;
        if(prev)len+=V.len(V.sub(r.p,prev));prev=r.p;
        for(const b of boxes){const d=boxDepth(r.p,b,rad);if(d>0)obs+=d*d;}
        if(j>0&&j<S)obs+=avoidDepth(r.p);}});
    return{len,ks,rl,kmax,obs};
  }
  return{P,n,chord:chord0,x,segs,pts,evalX,opts,fix,free};
}
// depth of p inside box b grown by rad (>0 = inside)
function boxDepth(p,b,rad){let m=Infinity;for(let k=0;k<3;k++)m=Math.min(m,p[k]-b.min[k]+rad,b.max[k]+rad-p[k]);return m;}
// one optimisation "chunk": returns updated state; Adam on penalty objective
function optimiser(route,designR){
  const x=route.x.slice(),N=x.length,n=route.n;
  const m=new Array(N).fill(0),v=new Array(N).fill(0),fixed=new Array(N).fill(false);
  for(let i=0;i<n;i++)if(route.fix[i])for(let d=0;d<3;d++)fixed[3*i+d]=true;
  const os=1/Math.pow(Math.max(route.opts.rad||0,10),2);
  const vio=r=>{let m=0;for(let i=0;i<r.ks.length;i++)m=Math.max(m,r.ks[i]*Math.max(designR,r.rl[i]));return m;};
  let w=10,it=0,t=0;const ws=[10,1e2,1e3,1e4,1e5];let stage=0;
  function f(x){const r=route.evalX(x,24);let pen=0;
    for(let i=0;i<r.ks.length;i++){const kt=1/Math.max(designR,r.rl[i]),e=Math.max(r.ks[i]-kt,0)/kt;pen+=e*e;}
    return r.len/route.chord+w*(pen/r.ks.length+r.obs*os);}
  function step(k){
    for(let s=0;s<k;s++){
      const f0=f(x),g=new Array(N).fill(0);
      for(let i=0;i<N;i++){if(fixed[i])continue;const hh=1e-4;const old=x[i];x[i]=old+hh;g[i]=(f(x)-f0)/hh;x[i]=old;}
      t++;const lr=0.01;
      for(let i=0;i<N;i++){if(fixed[i])continue;m[i]=0.9*m[i]+0.1*g[i];v[i]=0.999*v[i]+0.001*g[i]*g[i];
        const mh=m[i]/(1-Math.pow(0.9,t)),vh=v[i]/(1-Math.pow(0.999,t));x[i]-=lr*mh/(Math.sqrt(vh)+1e-8);}
      for(let i=0;i<n;i++){const u=V.norm([x[3*i],x[3*i+1],x[3*i+2]]);x[3*i]=u[0];x[3*i+1]=u[1];x[3*i+2]=u[2];}
      for(let i=3*n;i<3*n+2*(n-1);i++)x[i]=Math.min(2,Math.max(0.2,x[i]));
      it++;
      if(it%120===0&&stage<ws.length-1){const r=route.evalX(x,40);
        if(vio(r)>1.01||r.obs*os>1e-4){stage++;w=ws[stage];t=0;m.fill(0);v.fill(0);}}
    }
    const r=route.evalX(x,60);return{x,it,minR:1/r.kmax,len:r.len,obs:r.obs,done:it>=900||(it>=240&&vio(r)<=1.01&&r.obs*os<1e-4&&stage>0)};
  }
  return{step,x};
}
// adapt: shrink spacing (down to 40%) where the bend radius drops below 3x the design radius
function samplePoints(route,x,spacing,adapt,designR){
  const out=[],tidx=[],G=route.segs(x),fr=new Set(route.free);
  G.forEach((g,i)=>{
    const D=[],K=[];for(let j=0;j<=600;j++){const r=hermite(g[0],g[1],g[2],g[3],j/600);D.push(r.p);K.push(curvOf(r.d1,r.d2));}
    const s=[0];for(let j=1;j<D.length;j++){let ds=V.len(V.sub(D[j],D[j-1]));
      if(adapt)ds/=Math.min(1,Math.max(0.4,(1/Math.max(K[j],1e-9))/(designR*3)));s.push(s[j-1]+ds);}
    const m=Math.max(1,Math.ceil(s[s.length-1]/spacing));
    if(!fr.has(i))tidx.push(out.length);out.push(g[0].slice(0,3));
    let j=0;for(let q=1;q<m;q++){const tgt=s[s.length-1]*q/m;while(s[j]<tgt)j++;out.push(D[j]);}
  });
  tidx.push(out.length);out.push(G[G.length-1][1].slice(0,3));
  return{Q:out.map(p=>p.map(c=>Math.round(c*100)/100)),tidx};
}
function toPts(Q,info){
  const f=c=>c.toFixed(2).padStart(15);
  return["!","!       DATUM POINT ARRAY DATA FILE","!",
   `! Hose min bend radius ${info.R} mm, design ${info.designR} mm, achieved ${info.minR.toFixed(1)} mm`,
   `! ${Q.length} points, route length ~${Math.round(info.len)} mm`,
   `! Target points at positions: ${info.tidx.map(i=>i+1).join(', ')}`,
   "!","! Enter values with respect to datum arrays' coordinate system:","!",
   "!CARTESIAN coordinates:","!        X                Y                Z","!",
   ...Q.map(q=>`${f(q[0])} ${f(q[1])} ${f(q[2])}`)].join("\n")+"\n";
}
// ---------- clearance between two routes (port of route_parallel.py) ----------
const PLANE={free:[1,1,1],xy:[1,1,0],xz:[1,0,1],yz:[0,1,1]};
function closestOnSegment(p,a,b){
  const ab=V.sub(b,a),L2=V.dot(ab,ab);
  if(L2===0)return{foot:a,d:V.len(V.sub(p,a)),t:0};
  let t=V.dot(V.sub(p,a),ab)/L2;t=Math.max(0,Math.min(1,t));
  const foot=V.add(a,V.mul(ab,t));return{foot,d:V.len(V.sub(p,foot)),t};
}
function closestOnPath(p,path){let bf=null,bd=Infinity,bi=0,bt=0;
  for(let i=0;i<path.length-1;i++){const r=closestOnSegment(p,path[i],path[i+1]);if(r.d<bd){bd=r.d;bf=r.foot;bi=i;bt=r.t;}}
  return{foot:bf,d:bd,i:bi,t:bt};}
// parallel-transport frame (T,N,B) at each vertex of a polyline
function frameAlong(Q){
  const T=Q.map((_,i)=>V.norm(V.sub(Q[Math.min(i+1,Q.length-1)],Q[Math.max(i-1,0)])));
  let N=Math.abs(T[0][2])<0.9?[0,0,1]:[1,0,0];const Ns=[];
  for(let i=0;i<T.length;i++){N=V.sub(N,V.mul(T[i],V.dot(N,T[i])));if(V.len(N)<1e-9)N=Math.abs(T[i][2])<0.9?[0,0,1]:[1,0,0];N=V.norm(N);Ns.push(N);}
  return{T,N:Ns,B:T.map((t,i)=>V.cross(t,Ns[i]))};
}
function pathLength(Q){let s=0;for(let i=1;i<Q.length;i++)s+=V.len(V.sub(Q[i],Q[i-1]));return s;}
// re-insert stray points so the route reads in true order; first point stays the start
function reorderPath(pts){
  if(pts.length>150)return{pts,moves:0};
  let order=pts.map((_,i)=>i),moves=0;
  for(let round=0;round<40;round++){
    let improved=false;
    for(const idx of order.slice()){
      const cur=order.indexOf(idx);if(cur===0)continue;
      const without=order.filter(i=>i!==idx);
      let bestPos=cur,bestLen=pathLength(order.map(i=>pts[i]));
      for(let pos=1;pos<=without.length;pos++){
        const trial=without.slice(0,pos).concat([idx],without.slice(pos));
        const L=pathLength(trial.map(i=>pts[i]));
        if(L<bestLen-1e-6){bestPos=pos;bestLen=L;}
      }
      if(bestPos!==cur){order=without.slice(0,bestPos).concat([idx],without.slice(bestPos));improved=true;moves++;}
    }
    if(!improved)break;
  }
  return{pts:order.map(i=>pts[i]),moves};
}
function smoothDirs(vecs,passes){
  let out=vecs.map(v=>v.slice());
  for(let p=0;p<passes;p++){
    const nx=[out[0]];
    for(let i=1;i<out.length-1;i++)nx.push(V.norm([0,1,2].map(k=>(out[i-1][k]+2*out[i][k]+out[i+1][k])/4)));
    nx.push(out[out.length-1]);out=nx;
  }
  return out;
}
function blendPts(moved,delta,locks,blend){
  for(let b=0;b<blend;b++){
    const out=moved.map(p=>p.slice());
    for(let i=1;i<moved.length-1;i++){
      if(locks.has(i)||delta[i]>0)continue;
      if(delta[i-1]===0&&delta[i+1]===0)continue;
      for(let k=0;k<3;k++)out[i][k]=moved[i][k]+0.25*((moved[i-1][k]+moved[i+1][k])/2-moved[i][k]);
    }
    for(let i=0;i<moved.length;i++)moved[i]=out[i];
  }
}
// true parallel offset: every slave point sits at the same angle around the master, measured in a
// parallel-transported frame, at exactly `gap` from the master's tangent line
function adjustNormal(master,slave,gap,mode,locks,blend){
  const F=frameAlong(master);
  const info=slave.map(p=>{const c=closestOnPath(p,master),a=c.i,b=Math.min(c.i+1,master.length-1),w=c.t;
    const N=V.norm(V.add(V.mul(F.N[a],1-w),V.mul(F.N[b],w))),B=V.norm(V.add(V.mul(F.B[a],1-w),V.mul(F.B[b],w)));
    const v=V.sub(p,c.foot);return{foot:c.foot,d:c.d,N,B,ang:Math.atan2(V.dot(v,B),V.dot(v,N))};});
  let sx=0,sy=0;info.forEach(q=>{if(q.d>1e-6){sx+=Math.cos(q.ang);sy+=Math.sin(q.ang);}});
  const A=Math.atan2(sy,sx),moved=slave.map(p=>p.slice()),delta=slave.map(()=>0);
  slave.forEach((p,i)=>{if(locks.has(i))return;const q=info[i];if(mode==='min'&&q.d>=gap)return;
    const dir=V.add(V.mul(q.N,Math.cos(A)),V.mul(q.B,Math.sin(A)));moved[i]=V.add(q.foot,V.mul(dir,gap));delta[i]=V.len(V.sub(moved[i],p));});
  blendPts(moved,delta,locks,blend);
  const after=moved.map(p=>closestOnPath(p,master).d),shift=slave.map((p,i)=>V.len(V.sub(moved[i],p)));
  return{moved:moved.map(p=>p.map(c=>Math.round(c*1000)/1000)),before:info.map(q=>q.d),after,shift};
}
function adjustClearance(master,slave,gap,mode,plane,smooth,locks,blend){
  if(plane==='normal')return adjustNormal(master,slave,gap,mode,locks,blend);
  const mask=PLANE[plane]||PLANE.free,pr=q=>[q[0]*mask[0],q[1]*mask[1],q[2]*mask[2]];
  const pm=master.map(pr);
  let dirs=[],gaps=[];
  for(const p of slave){const{foot,d}=closestOnPath(pr(p),pm);let v=V.sub(pr(p),foot);
    if(V.len(v)<1e-9)v=mask[1]?[0,1,0]:[0,0,1];dirs.push(V.norm(v));gaps.push(d);}
  if(smooth)dirs=smoothDirs(dirs,smooth);
  const moved=slave.map(p=>p.slice()),delta=slave.map(()=>0);
  slave.forEach((p,i)=>{
    if(locks.has(i))return;
    if(mode==='min'&&gaps[i]>=gap)return;
    const d=V.mul(dirs[i],gap-gaps[i]);moved[i]=V.add(p,d);delta[i]=V.len(d);
  });
  blendPts(moved,delta,locks,blend);
  const after=moved.map(p=>closestOnPath(pr(p),pm).d),shift=slave.map((p,i)=>V.len(V.sub(moved[i],p)));
  return{moved:moved.map(p=>p.map(c=>Math.round(c*1000)/1000)),before:gaps,after,shift};
}
// clearance of a dense curve against a master polyline (for the graph)
function clearanceProfile(pts,master,plane){
  const mask=PLANE[plane]||PLANE.free,pr=q=>[q[0]*mask[0],q[1]*mask[1],q[2]*mask[2]];
  const pm=master.map(pr);return pts.map(p=>closestOnPath(pr(p),pm).d);
}
const PRESETS={target:`! example target points
-1655.50  -225.00  -155.50
-1133.50  -671.80   -90.00
 -833.75  -563.19  -141.16   180   ! 4th value: smoother loop here, min R 180
 -583.50  -671.80   -90.00
 -253.50  -528.51     1.00
 -183.50  -279.99    -3.00
    0.00     0.00     0.00`,
master:`! master route
-1655.50  -225.00  -155.50
-1133.50  -671.80   -90.00
 -833.75  -563.19  -141.16
 -583.50  -671.80   -90.00
 -253.50  -528.51     1.00
 -183.50  -279.99    -3.00
    0.00     0.00     0.00`,
slave:`! slave route, gap varies 18-62 mm
-1652.80  -218.70  -138.94
-1125.25  -652.55   -39.40
 -831.65  -558.29  -128.28
 -574.20  -650.10   -32.96
 -249.75  -519.76    24.00
 -179.00  -269.49    24.60
    7.20    16.80    44.16`,
bcab:`! id  diameter  min bend R  gap   (mm)
C1   12   60   5
C2   12   60   5
C3    8   45   4
C4    8   45   4
C5   16   90   6
C6    6   35   3`,
brt:`! id   start X Y Z          end X Y Z           clamps in order
C1  -1650 -250 -160       0    0    0      K1,K2,K3
C2  -1650 -290 -160       0  -40    0      K1,K2,K3
C3  -1650 -210 -140     -60  -80   30      K1,K2,K3
C4  -1650 -330 -140    -450 -560   40      K1,K2
C5  -1650 -270 -200      40   30  -60      K1,K2,K3
C6  -1650 -250 -110   -1050 -700  -80      K1`,
bcl:`! id    X     Y     Z     axis dX dY dZ
K1  -1250  -400  -120    1  -0.35  0
K2   -800  -600  -100    1   0.15  0.05
K3   -350  -450   -20    1   0.6   0.1`,
bob:`! id   Xmin  Ymin  Zmin    Xmax  Ymax  Zmax
O1  -1050  -560  -160    -950  -420  -40`};
const PALETTE=['#2B6CB0','#C8323C','#2F8F63','#8A5BD6','#D08A1E','#0E7C86'];
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt=(v,d=1)=>v==null||!isFinite(v)?'--':v.toFixed(d);
// yield to the UI without timer throttling (setTimeout is clamped in background tabs)
const defer=(()=>{const ch=new MessageChannel(),q=[];ch.port1.onmessage=()=>{const f=q.shift();if(f)f();};return f=>{q.push(f);ch.port2.postMessage(0);};})();

let runs=[],selId=null,colorMode='radius',dock='rad',nextId=1,hover=null,bundles={},bundleSeq=1;

// ---------------- analysis helpers ----------------
function analyse(Q){const d=sampleSpline(naturalSpline(Q),40);let wi=0;
  for(let i=1;i<d.k.length;i++)if(d.k[i]>d.k[wi])wi=i;
  return{Q,d,wi,minR:1/d.k[wi],len:d.s[d.s.length-1]};}
function parseDir(s){const v=(s||'').split(/[,\s]+/).filter(Boolean).map(Number);
  return v.length===3&&v.every(Number.isFinite)&&Math.hypot(...v)>0?v:null;}
function addRun(run){run.id=nextId++;run.color=PALETTE[(run.id-1)%PALETTE.length];run.visible=true;
  runs.push(run);if(runs.length>12){const gone=runs.shift();if(selId===gone.id)selId=null;}
  selId=run.id;renderRuns();rebuild(true);return run;}
function selected(){return runs.find(r=>r.id===selId)||runs[runs.length-1]||null;}
function visible(){return runs.filter(r=>r.visible);}

// ---------------- three.js ----------------
const renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,1,1e6);camera.up.set(0,0,1);
scene.add(new THREE.AmbientLight(0xffffff,0.55));const dl=new THREE.DirectionalLight(0xffffff,0.75);scene.add(dl);
let content=new THREE.Group();scene.add(content);
const orbit={target:new THREE.Vector3(),dist:3000,theta:-2.2,phi:1.05};
let diag=1000,tubeR=6,marker=null,tagEls=[],home=null,zoomed=false;
function placeCamera(){const o=orbit,sp=Math.sin(o.phi);
  camera.position.set(o.target.x+o.dist*sp*Math.cos(o.theta),o.target.y+o.dist*sp*Math.sin(o.theta),o.target.z+o.dist*Math.cos(o.phi));
  camera.lookAt(o.target);dl.position.copy(camera.position);camera.near=o.dist/200;camera.far=o.dist*50;camera.updateProjectionMatrix();}
function fitAll(){const b=new THREE.Box3();let any=false;
  visible().forEach(r=>{r.Q.forEach(p=>{b.expandByPoint(new THREE.Vector3(...p));any=true;});
    if(r.master)r.master.forEach(p=>b.expandByPoint(new THREE.Vector3(...p)));
    const B=r.bundle&&bundles[r.bundle];if(B){Object.values(B.clamps).forEach(k=>b.expandByPoint(new THREE.Vector3(...k.p)));
      B.obstacles.forEach(o=>{b.expandByPoint(new THREE.Vector3(...o.min));b.expandByPoint(new THREE.Vector3(...o.max));});}});
  if(!any)return;b.getCenter(orbit.target);diag=Math.max(b.getSize(new THREE.Vector3()).length(),100);
  const asp=($('view').clientWidth||1)/($('view').clientHeight||1);
  orbit.dist=diag*1.35*Math.max(1,Math.pow(1/asp,0.8));tubeR=Math.max(diag*0.0042,1.5);
  home={t:orbit.target.clone(),d:orbit.dist};zoomed=false;$('zoom').textContent='Zoom to tightest bend';}
function tube(pts,colors,r){
  const seg=9,pos=[],cols=[],idx=[];let N=null;
  for(let i=0;i<pts.length;i++){
    const p=new THREE.Vector3(...pts[i]);
    const T=new THREE.Vector3(...pts[Math.min(i+1,pts.length-1)]).sub(new THREE.Vector3(...pts[Math.max(i-1,0)])).normalize();
    if(!N){N=Math.abs(T.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);}
    N=N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    const B=new THREE.Vector3().crossVectors(T,N);
    for(let j=0;j<seg;j++){const a=j/seg*Math.PI*2;
      const v=N.clone().multiplyScalar(Math.cos(a)*r).add(B.clone().multiplyScalar(Math.sin(a)*r)).add(p);
      pos.push(v.x,v.y,v.z);const c=colors[i];cols.push(c.r,c.g,c.b);}
    if(i>0)for(let j=0;j<seg;j++){const a0=(i-1)*seg+j,a1=(i-1)*seg+(j+1)%seg,b0=i*seg+j,b1=i*seg+(j+1)%seg;idx.push(a0,b0,a1,a1,b0,b1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.setIndex(idx);g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true}));
}
function circle(c,u,v,r,color,dashed){const pts=[];
  for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;pts.push(new THREE.Vector3(
    c[0]+r*(Math.cos(a)*u[0]+Math.sin(a)*v[0]),c[1]+r*(Math.cos(a)*u[1]+Math.sin(a)*v[1]),c[2]+r*(Math.cos(a)*u[2]+Math.sin(a)*v[2])));}
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  const l=new THREE.Line(g,dashed?new THREE.LineDashedMaterial({color,dashSize:r*0.12,gapSize:r*0.08}):new THREE.LineBasicMaterial({color}));
  if(dashed)l.computeLineDistances();return l;}
function radiusColor(rad,R,SF,c){return rad<R?c.bad:(rad<R*SF?c.warn:c.ok);}
function addTag(p,text,cls){const e=document.createElement('div');e.className='tag '+(cls||'');e.textContent=text;
  $('tags').appendChild(e);tagEls.push({e,p:new THREE.Vector3(...p)});}

function rebuild(refit){
  scene.remove(content);content.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&o.material.dispose();});
  content=new THREE.Group();scene.add(content);$('tags').innerHTML='';tagEls=[];
  renderer.setClearColor(css('--paper'));
  if(refit)fitAll();
  const vis=visible(),sel=selected();
  if(vis.length){
    let zmin=Infinity;vis.forEach(r=>r.Q.forEach(p=>zmin=Math.min(zmin,p[2])));
    const gs=Math.pow(10,Math.floor(Math.log10(diag/4))),size=Math.ceil(diag*1.6/gs)*gs;
    const grid=new THREE.GridHelper(size,Math.round(size/gs),css('--grid'),css('--grid'));
    grid.rotation.x=Math.PI/2;grid.position.set(orbit.target.x,orbit.target.y,zmin-diag*0.08);content.add(grid);
  }
  const c={bad:new THREE.Color(css('--bad')),warn:new THREE.Color(css('--warn')),ok:new THREE.Color(css('--ok'))};
  const sg=new THREE.SphereGeometry(1,14,10);
  const masters=new Set();
  vis.forEach(r=>{
    const R=r.params.R,SF=r.params.SF||1.5;
    const cols=colorMode==='radius'&&r.kind!=='master'
      ? r.d.k.map(k=>radiusColor(1/k,R,SF,c))
      : r.d.k.map(()=>new THREE.Color(r.color));
    const tr=r.cable?Math.max(r.cable.d/2,tubeR*0.4):(r.id===(sel&&sel.id)?tubeR:tubeR*0.8);
    content.add(tube(r.d.pts,cols,tr));
    const pm=new THREE.MeshLambertMaterial({color:new THREE.Color(r.color)});
    r.Q.forEach((q,i)=>{const isT=!r.tidx||r.tidx.includes(i);const s=new THREE.Mesh(sg,pm);
      s.scale.setScalar(isT?tr*1.9:tr*1.15);s.position.set(...q);content.add(s);});
    if(r.master&&!masters.has(r.master)){masters.add(r.master);
      const mp=r.master.map(p=>new THREE.Vector3(...p));
      const ml=new THREE.Line(new THREE.BufferGeometry().setFromPoints(mp),new THREE.LineBasicMaterial({color:css('--muted')}));
      content.add(ml);const mm=new THREE.MeshLambertMaterial({color:css('--muted')});
      r.master.forEach(p=>{const s=new THREE.Mesh(sg,mm);s.scale.setScalar(tubeR*1.4);s.position.set(...p);content.add(s);});
      addTag(r.master[0],'master','t');}
  });
  const shownB=new Set();
  vis.forEach(r=>{const B=r.bundle&&bundles[r.bundle];if(!B||shownB.has(B))return;shownB.add(B);
    Object.values(B.clamps).forEach(k=>{const f=B.frame[k.id];if(!f)return;
      content.add(circle(k.p,f.u,f.v,B.ringR[k.id]||tubeR*4,css('--ink'),false));
      const ax=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...V.sub(k.p,V.mul(k.a,B.ringR[k.id]||30))),new THREE.Vector3(...V.add(k.p,V.mul(k.a,B.ringR[k.id]||30)))]),new THREE.LineBasicMaterial({color:css('--muted')}));
      content.add(ax);addTag(k.p,k.id,'t');});
    B.obstacles.forEach(o=>{content.add(new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...o.min),new THREE.Vector3(...o.max)),new THREE.Color(css('--warn'))));addTag(o.max,o.id,'t');});
  });
  if(sel&&sel.visible){
    const p=sel.d.pts[sel.wi],T=V.norm(sel.d.d1s[sel.wi]),d2=sel.d.d2s[sel.wi];
    let N=V.sub(d2,V.mul(T,V.dot(d2,T)));
    if(V.len(N)>1e-12){N=V.norm(N);const R=sel.params.R,SF=sel.params.SF||1.5,rw=sel.minR;
      const cc=rw<R?css('--bad'):(rw<R*SF?css('--warn'):css('--ok'));
      if(rw<diag*2)content.add(circle(V.add(p,V.mul(N,rw)),V.mul(N,-1),T,rw,cc,false));
      content.add(circle(V.add(p,V.mul(N,R)),V.mul(N,-1),T,R,css('--ink'),true));
      addTag(V.add(p,V.mul(N,-tubeR*3)),`tightest bend R ${fmt(rw)} mm`);}
    sel.Q.forEach((q,i)=>{if(!sel.tidx||sel.tidx.includes(i))addTag(q,'P'+((sel.tidx?sel.tidx.indexOf(i):i)+1),'t');});
  }
  marker=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:css('--ink')}));
  marker.scale.setScalar(tubeR*2.6);marker.visible=false;content.add(marker);
  readout();legend();draw();
}
function readout(){
  const r=selected();
  if(!r){$('readout').innerHTML='<div class="verdict">Run a check to see it here.</div>';return;}
  const R=r.params.R,SF=r.params.SF||1.5,ok=r.minR>=R,safe=r.minR>=R*SF*0.98;
  const v=ok?(safe?`Passes. Tightest bend is ${(r.minR/R).toFixed(2)}x the minimum radius.`:`Passes, but inside the x${SF} safety margin.`)
            :`Too tight: ${fmt(R-r.minR)} mm below the ${R} mm minimum.`;
  let extra=`${r.Q.length} points. Length ${Math.round(r.len)} mm.`;
  if(r.clear)extra+=` Clearance ${fmt(Math.min(...r.clear.after))}-${fmt(Math.max(...r.clear.after))} mm.`;
  if(r.clr&&isFinite(r.clr.min))extra+=` Nearest cable ${fmt(r.clr.min)} mm surface gap, needs ${fmt(r.clr.need,0)}.`;
  $('readout').innerHTML=`<div class="big">R ${fmt(r.minR)} <small>mm tightest bend &middot; ${r.name}</small></div>
    <div class="verdict" style="color:var(${ok?(safe?'--ok':'--warn'):'--bad'})">${v}</div><div class="facts">${extra}</div>`;
}
function legend(){
  const L=$('legend');
  if(colorMode==='radius')L.innerHTML=`<span><i style="background:var(--bad)"></i>below min radius</span>
    <span><i style="background:var(--warn)"></i>inside safety margin</span><span><i style="background:var(--ok)"></i>OK</span>`;
  else L.innerHTML=visible().map(r=>`<span><i style="background:${r.color}"></i>${r.name}</span>`).join('');
}
function draw(){
  const w=$('view').clientWidth,h=$('view').clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;placeCamera();renderer.render(scene,camera);
  for(const t of tagEls){const v=t.p.clone().project(camera);
    t.e.style.left=((v.x+1)/2*w)+'px';t.e.style.top=((1-v.y)/2*h)+'px';t.e.style.display=v.z<1?'':'none';}
  drawChart();
}
(function(){let drag=null,pinch=null;const cv=$('gl');
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};});
  cv.addEventListener('pointermove',e=>{if(!drag||pinch)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
    if(drag.pan){const s=orbit.dist*0.0012,right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
      orbit.target.add(right.multiplyScalar(-dx*s)).add(up.multiplyScalar(dy*s));}
    else{orbit.theta-=dx*0.008;orbit.phi=Math.min(3.1,Math.max(0.05,orbit.phi-dy*0.008));}draw();});
  cv.addEventListener('pointerup',()=>drag=null);cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('wheel',e=>{e.preventDefault();orbit.dist*=Math.exp(e.deltaY*0.001);draw();},{passive:false});
  cv.addEventListener('touchstart',e=>{if(e.touches.length===2){drag=null;pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:true});
  cv.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);orbit.dist*=pinch/d;pinch=d;draw();}},{passive:true});
  cv.addEventListener('touchend',e=>{if(e.touches.length<2)pinch=null;},{passive:true});
})();

// ---------------- charts ----------------
const ctx=$('ch').getContext('2d');let chartGeom=null;
function drawChart(){
  const cv=$('ch'),dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  if(!W||!H)return;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  const vis=visible().filter(r=>dock!=='clr'||r.clearDense);
  const sel=selected();if(!vis.length||!sel){chartGeom=null;return;}
  const L={l:60,r:16,t:14,b:28},pw=W-L.l-L.r,ph=H-L.t-L.b;
  const maxLen=Math.max(...vis.map(r=>r.len));
  const X=s=>L.l+s/maxLen*pw;
  ctx.font='12px '+css('--sans');ctx.strokeStyle=css('--rule');ctx.lineWidth=1;
  const isRad=dock==='rad';
  let Y,ticks;
  if(isRad){
    const R=sel.params.R,SF=sel.params.SF||1.5;
    const lo=Math.max(1,Math.pow(10,Math.floor(Math.log10(Math.min(R,...vis.map(r=>r.minR))*0.7)))),hi=Math.max(2000,R*SF*4);
    Y=v=>L.t+ph*(1-(Math.log10(Math.min(Math.max(v,lo),hi))-Math.log10(lo))/(Math.log10(hi)-Math.log10(lo)));
    ticks=[];for(let e=Math.log10(lo);e<=Math.log10(hi)+1e-9;e++)ticks.push(Math.pow(10,e));
  }else{
    const all=vis.flatMap(r=>r.clearDense),gap=sel.clear?sel.clear.gap:0;
    const hi=Math.max(gap*1.6,Math.max(...all)*1.05),lo=0;
    Y=v=>L.t+ph*(1-(Math.min(Math.max(v,lo),hi)-lo)/(hi-lo));
    ticks=[];const raw=hi/5,p10=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].find(m=>m*p10>=raw)*p10;for(let v=0;v<=hi;v+=st)ticks.push(v);
  }
  ctx.fillStyle=css('--muted');ctx.textAlign='right';
  ticks.forEach(v=>{const y=Y(v);ctx.beginPath();ctx.moveTo(L.l,y);ctx.lineTo(L.l+pw,y);ctx.stroke();
    ctx.fillText(v>=1000?(v/1000)+'k':String(Math.round(v)),L.l-8,y+4);});
  ctx.save();ctx.translate(15,L.t+ph/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';
  ctx.fillText(isRad?'bend radius, mm':'clearance to master, mm',0,0);ctx.restore();
  const step=pw<520?(maxLen>2000?1000:500):(maxLen>2000?500:250);
  ctx.textAlign='center';for(let s=step;s<=maxLen;s+=step)ctx.fillText(s,X(s),H-9);
  ctx.textAlign='left';ctx.fillText('mm along route',L.l,H-9);
  const lim=(v,cv2,t)=>{ctx.lineWidth=1.5;ctx.strokeStyle=css(cv2);ctx.setLineDash([6,4]);ctx.beginPath();
    ctx.moveTo(L.l,Y(v));ctx.lineTo(L.l+pw,Y(v));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=css(cv2);ctx.textAlign='right';ctx.fillText(t,L.l+pw-4,Y(v)-4);};
  if(isRad){lim(sel.params.R,'--bad',`min ${sel.params.R}`);lim(sel.params.R*(sel.params.SF||1.5),'--warn',`x${sel.params.SF||1.5} margin`);}
  else if(sel.clear)lim(sel.clear.gap,'--bad',`gap ${sel.clear.gap}`);
  ctx.lineWidth=2;
  vis.forEach(r=>{
    const vals=isRad?r.d.k.map(k=>1/k):r.clearDense;
    const single=vis.length===1&&isRad&&colorMode==='radius';
    if(single){const R=r.params.R,SF=r.params.SF||1.5,cb=css('--bad'),cw=css('--warn'),co=css('--ok');
      for(let i=1;i<vals.length;i++){ctx.strokeStyle=vals[i]<R?cb:(vals[i]<R*SF?cw:co);
        ctx.beginPath();ctx.moveTo(X(r.d.s[i-1]),Y(vals[i-1]));ctx.lineTo(X(r.d.s[i]),Y(vals[i]));ctx.stroke();}
    }else{ctx.strokeStyle=r.color;ctx.globalAlpha=r.id===sel.id?1:0.6;ctx.beginPath();
      vals.forEach((v,i)=>i?ctx.lineTo(X(r.d.s[i]),Y(v)):ctx.moveTo(X(r.d.s[0]),Y(v)));ctx.stroke();ctx.globalAlpha=1;}
  });
  chartGeom={L,pw,maxLen,X,Y,isRad};
  if(hover!=null&&sel){const i=Math.min(hover,sel.d.pts.length-1);const x=X(sel.d.s[i]);
    ctx.strokeStyle=css('--ink');ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,L.t);ctx.lineTo(x,L.t+ph);ctx.stroke();
    const v=isRad?1/sel.d.k[i]:sel.clearDense[i];ctx.font='500 12px '+css('--sans');ctx.fillStyle=css('--ink');
    ctx.textAlign=x>W-170?'right':'left';
    ctx.fillText(`${isRad?'R':'gap'} ${v>=1e4?'inf':fmt(v)} mm at ${Math.round(sel.d.s[i])} mm`,x+(x>W-170?-6:6),Y(v)-8);}
}
function chartHover(e){
  if(!chartGeom||dock==='cmp'||dock==='pts')return;const sel=selected();if(!sel)return;
  const rect=$('ch').getBoundingClientRect(),x=e.clientX-rect.left,{L,pw,maxLen}=chartGeom;
  if(x<L.l||x>L.l+pw){hover=null;if(marker)marker.visible=false;return draw();}
  const s=(x-L.l)/pw*maxLen;let i=0;while(i<sel.d.s.length-1&&sel.d.s[i]<s)i++;hover=i;
  if(marker){marker.position.set(...sel.d.pts[i]);marker.visible=true;}draw();
}
$('ch').addEventListener('pointermove',chartHover);$('ch').addEventListener('pointerdown',chartHover);
$('ch').addEventListener('pointerleave',()=>{hover=null;if(marker)marker.visible=false;draw();});

// ---------------- runs list, compare table, points ----------------
function renderRuns(){
  const box=$('runlist');
  $('clearAll').hidden=!runs.length;
  if(!runs.length){box.innerHTML='<p class="empty">No runs yet. Run a check to add one.</p>';$('runhint').hidden=true;}
  else{$('runhint').hidden=false;
    box.innerHTML=runs.map(r=>`<div class="run" data-id="${r.id}" data-sel="${r.id===selId?1:0}">
      <input type="checkbox" ${r.visible?'checked':''} aria-label="show ${r.name}">
      <span class="sw" style="background:${r.color}"></span>
      <span class="nm">${r.name}<small>R ${fmt(r.minR)} mm &middot; ${r.Q.length} pts${r.clear?' &middot; gap '+fmt(Math.min(...r.clear.after)):''}${r.clr&&isFinite(r.clr.min)?' &middot; gap '+fmt(r.clr.min):''}</small></span>
      <button class="del" title="remove" aria-label="remove ${r.name}">&times;</button></div>`).join('');
  }
  box.querySelectorAll('.run').forEach(el=>{
    const id=+el.dataset.id,r=runs.find(x=>x.id===id);
    el.querySelector('input').onchange=e=>{r.visible=e.target.checked;rebuild(true);renderRuns();};
    el.querySelector('.del').onclick=e=>{e.stopPropagation();runs=runs.filter(x=>x.id!==id);
      if(selId===id)selId=runs.length?runs[runs.length-1].id:null;renderRuns();rebuild(true);renderCmp();renderPts();};
    el.onclick=()=>{selId=id;loadSettings(r);renderRuns();rebuild(false);renderCmp();renderPts();};
  });
  renderCmp();renderPts();renderBun();
}
function loadSettings(r){
  const p=r.params;
  if(r.kind==='bundle'){showPanel('bundle');$('bsf').value=p.SF;if(p.spacing)$('bsp').value=p.spacing;}
  else if(r.kind==='clear'){showPanel('clear');$('gap').value=p.gap;$('mode').value=p.mode;$('plane').value=p.plane;
    $('smooth').value=p.smooth;$('blend').value=p.blend;$('cr').value=p.R;$('lock').value=p.lock||'';}
  else{showPanel('bend');$('r').value=p.R;$('sf').value=p.SF;if(p.spacing)$('sp').value=p.spacing;}
}
function renderCmp(){
  const box=$('cmp');
  if(!runs.length){box.innerHTML='<p class="empty" style="padding:14px">Nothing to compare yet.</p>';return;}
  const rows=[
    ['Use case',r=>r.kindLabel],
    ['Points',r=>r.Q.length],
    ['Route length, mm',r=>Math.round(r.len)],
    ['Min bend radius, mm',r=>fmt(r.minR)],
    ['Against limit',r=>{const R=r.params.R;return r.minR>=R?`passes (${(r.minR/R).toFixed(2)}x)`:`fails by ${fmt(R-r.minR)}`;}],
    ['Min clearance, mm',r=>r.clear?fmt(Math.min(...r.clear.after)):'--'],
    ['Max clearance, mm',r=>r.clear?fmt(Math.max(...r.clear.after)):'--'],
    ['Largest point shift, mm',r=>r.clear?fmt(Math.max(...r.clear.shift)):'--'],
    ['Cable clearance, mm',r=>r.clr&&isFinite(r.clr.min)?`${fmt(r.clr.min)} (needs ${fmt(r.clr.need,0)})`:'--'],
    ['Settings',r=>r.settings]];
  box.innerHTML=`<table><thead><tr><th></th>${runs.map(r=>`<th style="color:${r.color}">${r.name}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([n,f])=>`<tr><td class="metric">${n}</td>${runs.map(r=>`<td>${f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function renderPts(){
  const r=selected();$('ptsname').textContent=r?r.name:'Points';
  $('outtxt').value=r?r.text:'';$('dlzip').hidden=!(r&&r.bundle);
  const box=$('ptstable');if(!r){box.innerHTML='<p class="empty">Select a run to list its points.</p>';return;}
  const R=r.params.R,SF=r.params.SF||1.5;
  const Rat=q=>{let bi=0,bd=Infinity;r.d.pts.forEach((p,i)=>{const d=V.len(V.sub(p,q));if(d<bd){bd=d;bi=i;}});return 1/r.d.k[bi];};
  box.innerHTML=`<table><thead><tr><th>#</th><th>X</th><th>Y</th><th>Z</th><th>Bend R, mm</th><th></th></tr></thead><tbody>${r.Q.map((q,i)=>{
    const isT=!r.tidx||r.tidx.includes(i),rr=Rat(q),col=rr<R?'--bad':rr<R*SF?'--warn':'--ok';
    return `<tr data-i="${i}"><td class="metric">${i+1}</td><td>${q[0].toFixed(2)}</td><td>${q[1].toFixed(2)}</td><td>${q[2].toFixed(2)}</td><td style="color:var(${col})">${rr>1e4?'straight':fmt(rr)}</td><td class="metric">${isT&&r.tidx?'P'+(r.tidx.indexOf(i)+1):''}</td></tr>`;}).join('')}</tbody></table>`;
  box.querySelectorAll('tr[data-i]').forEach(tr=>{const q=r.Q[+tr.dataset.i];
    tr.onpointerenter=()=>{if(marker){marker.position.set(...q);marker.visible=true;draw();}};
    tr.onpointerleave=()=>{if(marker){marker.visible=false;draw();}};
    tr.onclick=()=>{orbit.target.set(...q);orbit.dist=Math.max(R*6,diag*0.2);zoomed=true;$('zoom').textContent='Show whole route';draw();};});
}
function renderBun(){
  const box=$('bun'),r=selected(),B=r&&r.bundle&&bundles[r.bundle];
  if(!B||!B.clr){box.innerHTML='<p class="empty" style="padding:14px">Route a bundle to see cable-to-cable clearance here.</p>';return;}
  const idx=B.runs.map((c,i)=>runs.includes(c)?i:-1).filter(i=>i>=0),cs=idx.map(i=>B.runs[i]);
  box.innerHTML=`<table><thead><tr><th>surface gap / needed, mm</th>${cs.map(c=>`<th style="color:${c.color}">${c.name}</th>`).join('')}<th>Min bend R / limit</th><th>Length</th><th>Points</th></tr></thead><tbody>${idx.map((i,a)=>{const A=B.runs[i];
    return `<tr><td class="metric" style="color:${A.color}">${A.name} <span class="unit">d ${A.cable.d}</span></td>${idx.map(j=>{if(i===j)return'<td class="metric">--</td>';const m=B.clr[i][j],need=B.need[i][j];
      return `<td style="color:var(${m<need?'--bad':'--ok'})">${fmt(m)} <span class="unit">/ ${fmt(need,0)}</span></td>`;}).join('')}<td style="color:var(${A.minR<A.params.R?'--bad':A.minR<A.params.R*A.params.SF?'--warn':'--ok'})">${fmt(A.minR)} <span class="unit">/ ${A.params.R}</span></td><td>${Math.round(A.len)}</td><td>${A.Q.length}</td></tr>`;}).join('')}</tbody></table>`;
}
function showPane(){
  $('paneChart').dataset.on=(dock==='rad'||dock==='clr')?1:0;
  $('paneCmp').dataset.on=dock==='cmp'?1:0;$('panePts').dataset.on=dock==='pts'?1:0;$('paneBun').dataset.on=dock==='bun'?1:0;
  ['dRad','dClr','dCmp','dPts','dBun'].forEach((id,i)=>$(id).setAttribute('aria-selected',['rad','clr','cmp','pts','bun'][i]===dock));
  draw();
}
['rad','clr','cmp','pts','bun'].forEach((k,i)=>$(['dRad','dClr','dCmp','dPts','dBun'][i]).onclick=()=>{dock=k;showPane();});

// ---------------- running the checks ----------------
function showPanel(which){
  [['bend','panBend','tabBend'],['clear','panClear','tabClear'],['bundle','panBundle','tabBundle']].forEach(([k,p,t])=>{$(p).hidden=k!==which;$(t).setAttribute('aria-selected',k===which);});
}
$('tabBend').onclick=()=>showPanel('bend');$('tabClear').onclick=()=>showPanel('clear');$('tabBundle').onclick=()=>showPanel('bundle');
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{
  if(b.dataset.preset==='target')$('pts').value=PRESETS.target;
  else if(b.dataset.preset==='bundle'){$('bcab').value=PRESETS.bcab;$('brt').value=PRESETS.brt;$('bcl').value=PRESETS.bcl;$('bob').value=PRESETS.bob;}
  else{$('mpts').value=PRESETS.master;$('spts').value=PRESETS.slave;}});

$('runBend').onclick=()=>{
  const P=parsePts($('pts').value);
  if(P.length<3)return $('statusBend').textContent='Paste at least three points.';
  const R=+$('r').value||65,SF=+$('sf').value||1.5,SP=+$('sp').value||85;
  const asEntered=analyse(P);
  addRun(Object.assign(asEntered,{name:`As entered R${R}`,kind:'bend',kindLabel:'bend radius, as entered',
    params:{R,SF},settings:`${P.length} points as entered`,text:toPts(P,{R,designR:R*SF,minR:asEntered.minR,len:asEntered.len,tidx:P.map((_,i)=>i)})}));
  store.set('rs.pts',$('pts').value);
  const route=makeRoute(P,{startDir:parseDir($('sd').value),endDir:parseDir($('ed').value),localR:P.map(p=>p.loc||0)});
  const nloc=P.filter(p=>p.loc).length;
  const o=optimiser(route,R*SF);$('runBend').disabled=true;
  const tick=()=>{const t0=performance.now();let r;do{r=o.step(6);}while(!r.done&&performance.now()-t0<40);$('statusBend').textContent=`Shaping the curve... tightest bend so far R ${fmt(r.minR)} mm`;
    if(!r.done)return defer(tick);
    let sp=SP,res;for(let a=0;a<4;a++){const s=samplePoints(route,r.x,sp,$('adapt').checked,R*SF);const A=analyse(s.Q);res={A,s};if(A.minR>=R*1.15)break;sp*=0.7;}
    const A=res.A;A.tidx=res.s.tidx;
    addRun(Object.assign(A,{name:`Generated R${R} x${SF}`,kind:'bend',kindLabel:'bend radius, generated',
      params:{R,SF,spacing:SP},settings:`gap ${sp.toFixed(0)} mm between points${$('adapt').checked?', closer in bends':''}, x${SF} margin${nloc?`, ${nloc} local radius override${nloc>1?'s':''}`:''}`,
      text:toPts(A.Q,{R,designR:+(R*SF).toFixed(1),minR:A.minR,len:A.len,tidx:A.tidx})}));
    $('runBend').disabled=false;
    $('statusBend').textContent=`Added. Generated route holds R ${fmt(A.minR)} mm over ${A.Q.length} points.`;};
  setTimeout(tick,20);
};

$('runClear').onclick=()=>{
  let M=parsePts($('mpts').value),S=parsePts($('spts').value);
  if(M.length<2||S.length<2)return $('statusClear').textContent='Paste both routes, at least two points each.';
  let note='';
  if($('reorder').checked){const rm=reorderPath(M),rs=reorderPath(S);M=rm.pts;S=rs.pts;
    if(rm.moves||rs.moves)note=` Reordered ${rm.moves} master and ${rs.moves} slave point(s).`;}
  const gap=+$('gap').value||0,mode=$('mode').value,plane=$('plane').value,
        smooth=+$('smooth').value||0,blend=+$('blend').value||0,R=+$('cr').value||65,
        lockTxt=$('lock').value.trim(),locks=new Set(lockTxt.split(/[,\s]+/).filter(v=>v!=='').map(Number).filter(Number.isFinite));
  const res=adjustClearance(M,S,gap,mode,plane,smooth,locks,blend);
  const A=analyse(res.moved);A.clearDense=clearanceProfile(A.d.pts,M,plane);
  addRun(Object.assign(A,{name:`Gap ${gap} ${mode}${plane!=='free'?' '+plane:''}`,kind:'clear',kindLabel:`clearance, ${mode}`,
    master:M,clear:{gap,mode,plane,before:res.before,after:res.after,shift:res.shift},
    params:{R,SF:1.5,gap,mode,plane,smooth,blend,lock:lockTxt},
    settings:`${mode}, push ${plane}, smooth ${smooth}, blend ${blend}${locks.size?', locked '+lockTxt:''}`,
    text:toPts(res.moved,{R,designR:R*1.5,minR:A.minR,len:A.len,tidx:res.moved.map((_,i)=>i)})}));
  store.set('rs.master',$('mpts').value);store.set('rs.slave',$('spts').value);
  $('statusClear').textContent=`Clearance now ${fmt(Math.min(...res.after))} to ${fmt(Math.max(...res.after))} mm, `
    +`largest shift ${fmt(Math.max(...res.shift))} mm, tightest bend R ${fmt(A.minR)} mm.`+note;
};

// ---------------- view controls, output ----------------
$('clearAll').onclick=()=>{if(!confirm(`Remove all ${runs.length} run${runs.length>1?'s':''} from the view?`))return;
  runs=[];selId=null;bundles={};hover=null;$('nudge').hidden=true;['statusBundle'].forEach(k=>{const e=$(k);if(e){e.textContent='';e.style.color='';}});
  renderRuns();rebuild(true);renderCmp();renderPts();if(typeof renderBun==='function')renderBun();};
$('fit').onclick=()=>{fitAll();draw();};
$('zoom').onclick=()=>{const r=selected();if(!r)return;
  if(zoomed&&home){orbit.target.copy(home.t);orbit.dist=home.d;zoomed=false;$('zoom').textContent='Zoom to tightest bend';}
  else{orbit.target.set(...r.d.pts[r.wi]);orbit.dist=Math.max(r.params.R,r.minR)*9;zoomed=true;$('zoom').textContent='Show whole route';}
  draw();};
$('cRad').onclick=()=>{colorMode='radius';$('cRad').setAttribute('aria-pressed','true');$('cRun').setAttribute('aria-pressed','false');rebuild(false);};
$('cRun').onclick=()=>{colorMode='run';$('cRun').setAttribute('aria-pressed','true');$('cRad').setAttribute('aria-pressed','false');rebuild(false);};
$('copy').onclick=async()=>{const t=$('outtxt');if(!t.value)return;
  try{await navigator.clipboard.writeText(t.value);$('copy').textContent='Copied';}
  catch(e){t.select();try{document.execCommand('copy');$('copy').textContent='Copied';}catch(e2){$('copy').textContent='Select and copy';}}
  setTimeout(()=>$('copy').textContent='Copy',1600);};
$('dl').onclick=()=>{const r=selected();if(!r)return;
  try{const b=new Blob([r.text],{type:'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=r.name.replace(/[^\w.-]+/g,'_')+'.pts';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),2000);}
  catch(e){$('dl').textContent='Use Copy instead';setTimeout(()=>$('dl').textContent='Download .pts',2000);}};

// ---------------- bundle routing ----------------
function parseBundle(){
  const rows=t=>t.split(/\r?\n/).map(l=>l.split('!')[0].trim()).filter(Boolean).map(l=>l.replace(/,/g,' ').split(/\s+/));
  const cables=rows($('bcab').value).filter(r=>r.length>=3).map(r=>({id:r[0],d:+r[1]||8,R:+r[2]||50,gap:+r[3]||0}));
  const clamps={};rows($('bcl').value).forEach(r=>{if(r.length>=7)clamps[r[0]]={id:r[0],p:r.slice(1,4).map(Number),a:V.norm(r.slice(4,7).map(Number))};});
  const obstacles=rows($('bob').value).filter(r=>r.length>=7).map(r=>{const v=r.slice(1,7).map(Number);
    return{id:r[0],min:[0,1,2].map(k=>Math.min(v[k],v[k+3])),max:[0,1,2].map(k=>Math.max(v[k],v[k+3]))};});
  const routes={};rows($('brt').value).forEach(r=>{if(r.length>=7)routes[r[0]]={start:r.slice(1,4).map(Number),end:r.slice(4,7).map(Number),clamps:r.slice(7)};});
  return{cables,clamps,obstacles,routes};
}
// one angular slot per cable, identical at every clamp, on a ring sized so neighbours clear each other
function packClamps(cables,clamps,routes){
  const order=[];cables.forEach(c=>routes[c.id].clamps.forEach(k=>{if(clamps[k]&&!order.includes(k))order.push(k);}));
  const frame={},slots={},ringR={};let N=null;
  order.forEach(k=>{const a=clamps[k].a;let u=N||(Math.abs(a[2])<0.9?[0,0,1]:[1,0,0]);u=V.sub(u,V.mul(a,V.dot(u,a)));
    if(V.len(u)<1e-9)u=Math.abs(a[2])<0.9?[0,0,1]:[1,0,0];u=V.norm(u);frame[k]={u,v:V.cross(a,u)};N=u;});
  // slot order follows where each cable's start sits around the bundle, seen along the first clamp axis
  let rank=cables.map((c,i)=>i);
  if(order.length){const f=frame[order[0]],cen=V.mul(cables.reduce((s,c)=>V.add(s,routes[c.id].start),[0,0,0]),1/cables.length);
    const ang=c=>{const v=V.sub(routes[c.id].start,cen);return Math.atan2(V.dot(v,f.v),V.dot(v,f.u));};
    const sorted=cables.slice().sort((a,b)=>ang(a)-ang(b));rank=cables.map(c=>sorted.indexOf(c));}
  order.forEach(k=>{
    const list=cables.filter(c=>routes[c.id].clamps.includes(k)),big=Math.max(...list.map(c=>c.d+2*c.gap));slots[k]={};
    if(list.length===1){slots[k][list[0].id]=[0,0,0];ringR[k]=big/2+4;}
    else{const rr=big/(2*Math.sin(Math.PI/cables.length));ringR[k]=rr+big/2+4;
      list.forEach(c=>{const ang=2*Math.PI*rank[cables.indexOf(c)]/cables.length;slots[k][c.id]=V.add(V.mul(frame[k].u,rr*Math.cos(ang)),V.mul(frame[k].v,rr*Math.sin(ang)));});}
  });
  return{order,frame,slots,ringR,rank};
}
// where a straight leg cuts an obstacle, add a free via point pushed out of the box
function viaPoints(W,obstacles,rad){
  const out=[];
  for(let i=0;i<W.length;i++){out.push(W[i]);if(i===W.length-1)break;
    for(const b of obstacles){let hit=null;
      for(let j=1;j<20;j++){const p=V.add(W[i].p,V.mul(V.sub(W[i+1].p,W[i].p),j/20)),d=boxDepth(p,b,rad);if(d>0&&(!hit||d>hit.d))hit={p,d};}
      if(!hit)continue;
      const c=[0,1,2].map(k=>(b.min[k]+b.max[k])/2),sz=[0,1,2].map(k=>(b.max[k]-b.min[k])/2);
      let ax=0,bd=Infinity,sg=1;for(let k=0;k<3;k++){const dd=sz[k]+rad-Math.abs(hit.p[k]-c[k]);if(dd<bd){bd=dd;ax=k;sg=hit.p[k]>=c[k]?1:-1;}}
      const q=hit.p.slice();q[ax]=c[ax]+sg*(sz[ax]+rad+15);out.push({p:q,dir:null,free:true});break;}
  }
  return out;
}
// parallel-transport frame along a polyline starting from reference normal N0
function transport(Q,N0,T1){
  const T=Q.length>1?Q.map((_,i)=>V.norm(V.sub(Q[Math.min(i+1,Q.length-1)],Q[Math.max(i-1,0)]))):[T1];
  let N=N0||(Math.abs(T[0][2])<0.9?[0,0,1]:[1,0,0]);const Ns=[];
  for(let i=0;i<T.length;i++){N=V.sub(N,V.mul(T[i],V.dot(N,T[i])));if(V.len(N)<1e-9)N=Math.abs(T[i][2])<0.9?[0,0,1]:[1,0,0];N=V.norm(N);Ns.push(N);}
  return{T,N:Ns,B:T.map((t,i)=>V.cross(t,Ns[i]))};
}
// bundle: one trunk centreline through the clamps; each cable rides it at a fixed angular slot
// (so cables cannot cross), then free breakout legs join the trunk to each start and end
$('runBundle').onclick=()=>{
  const{cables,clamps,obstacles,routes}=parseBundle(),list=cables.filter(c=>routes[c.id]);
  const st=$('statusBundle');st.style.color='';$('nudge').hidden=true;
  if(!list.length)return st.textContent='Need at least one cable that has a route line.';
  const SF=+$('bsf').value||1.5,SP=+$('bsp').value||60,keep=+$('bkeep').value||0;
  ['bcab','brt','bcl','bob'].forEach(k=>store.set('rs.'+k,$(k).value));
  const pk=packClamps(list,clamps,routes),K=pk.order,bid='B'+(bundleSeq++),n=list.length;
  const big=Math.max(...list.map(c=>c.d+2*c.gap)),rr=n>1?big/(2*Math.sin(Math.PI/n)):0,ringR={};K.forEach(k=>ringR[k]=rr+big/2+4);
  const B=bundles[bid]={id:bid,clamps,obstacles,frame:pk.frame,ringR,runs:[],keep};
  $('runBundle').disabled=true;
  const solve=(route,dR,label,cb)=>{const o=optimiser(route,dR);
    const tick=()=>{const t0=performance.now();let r;do{r=o.step(6);}while(!r.done&&performance.now()-t0<40);
      st.textContent=`${label}... tightest bend so far R ${fmt(r.minR)} mm`;if(!r.done)return defer(tick);cb(r);};defer(tick);};
  const placed=[];
  const leg=(W0,rad,self,mid)=>{let W=viaPoints(W0,obstacles,rad);const vias=W.filter(w=>w.free).length;
    if(mid&&W.length===2)W=[W[0],{p:V.mul(V.add(W[0].p,W[1].p),0.5),dir:null,free:true},W[1]];
    const freePts=W.map((w,i)=>w.free?i:-1).filter(i=>i>=0);
    return{route:makeRoute(W.map(w=>w.p),{fixDirs:W.map(w=>w.dir),freePts,obstacles,rad,avoid:self?placed:[],self}),vias};};
  // trunk
  const cen=list.reduce((s,c)=>V.add(s,V.sub(routes[c.id].end,routes[c.id].start)),[0,0,0]);
  const TW=K.map((k,i)=>{const a=clamps[k].a,ch=K.length>1?V.sub(clamps[K[Math.min(i+1,K.length-1)]].p,clamps[K[Math.max(i-1,0)]].p):cen;
    return{p:clamps[k].p,dir:V.dot(a,ch)<0?V.mul(a,-1):a,k};});
  const trunkDone=(dense,idx,tv)=>{
    const F=transport(dense,K.length?pk.frame[K[0]].u:null,TW.length?TW[0].dir:[1,0,0]);let ci=0;
    const nextCable=()=>{
      if(ci>=n)return finish();
      const c=list[ci],rt=routes[c.id],ks=rt.clamps.filter(k=>clamps[k]&&k in idx),rad=c.d/2+keep,label=`Routing ${c.id} (${ci+1} of ${n})`;
      const done=(Q,tidx,vias)=>{const A=analyse(Q);
        {let acc=0;A.d.pts.forEach((p,i)=>{if(i)acc+=V.len(V.sub(p,A.d.pts[i-1]));if(i===0||acc>=4){acc=0;placed.push([p[0],p[1],p[2],c.d/2,c.gap]);}});}A.tidx=tidx;A.wp=[rt.start,...ks.map(k=>clamps[k].p),rt.end];A.clampIds=ks;
        Object.assign(A,{name:c.id,kind:'bundle',kindLabel:'bundle cable',bundle:bid,cable:c,params:{R:c.R,SF,spacing:SP},
          settings:`d ${c.d}, gap ${c.gap}, via ${ks.join(' > ')||'no clamps'}${vias?`, ${vias} obstacle via point${vias>1?'s':''}`:''}`,
          text:toPts(Q,{R:c.R,designR:+(c.R*SF).toFixed(1),minR:A.minR,len:A.len,tidx})});
        B.runs.push(A);ci++;nextCable();};
      const me={r:c.d/2,g:c.gap};
      if(!ks.length){const L=leg([{p:rt.start,dir:null},{p:rt.end,dir:null}],rad,me,true);
        return solve(L.route,c.R*SF,label,r=>{const s=samplePoints(L.route,r.x,SP,true,c.R*SF);done(s.Q,[0,s.Q.length-1],L.vias);});}
      let i0=idx[ks[0]],i1=idx[ks[ks.length-1]];const rev=i0>i1,ang=2*Math.PI*pk.rank[cables.indexOf(c)]/n;
      if(rev)[i0,i1]=[i1,i0];
      const off=i=>V.add(dense[i],V.add(V.mul(F.N[i],rr*Math.cos(ang)),V.mul(F.B[i],rr*Math.sin(ang))));
      const step=Math.max(1,Math.round(SP/tv)),keepIdx=new Set(ks.map(k=>idx[k]));
      let tr=[];for(let i=i0;i<=i1;i++)if((i-i0)%step===0||keepIdx.has(i)||i===i1)tr.push({p:off(i),T:F.T[i],clamp:keepIdx.has(i)});
      if(rev)tr=tr.reverse().map(q=>({...q,T:V.mul(q.T,-1)}));
      const LA=leg([{p:rt.start,dir:null},{p:tr[0].p,dir:tr[0].T}],rad,me,true);
      solve(LA.route,c.R*SF,label+', start leg',ra=>{
        const LB=leg([{p:tr[tr.length-1].p,dir:tr[tr.length-1].T},{p:rt.end,dir:null}],rad,me,true);
        solve(LB.route,c.R*SF,label+', end leg',rb=>{
          const a=samplePoints(LA.route,ra.x,SP,true,c.R*SF).Q,b=samplePoints(LB.route,rb.x,SP,true,c.R*SF).Q;
          const Q=[...a.slice(0,-1)],tidx=[0];tr.forEach(q=>{if(q.clamp)tidx.push(Q.length);Q.push(q.p.map(v=>Math.round(v*100)/100));});
          Q.push(...b.slice(1));tidx.push(Q.length-1);done(Q,tidx,LA.vias+LB.vias);});});
    };
    nextCable();
  };
  if(K.length<2)trunkDone(K.length?[clamps[K[0]].p]:[],K.length?{[K[0]]:0}:{},1);
  else{const L=leg(TW,rr+big/2+keep);
    solve(L.route,Math.max(...list.map(c=>c.R))*SF+rr,'Routing the trunk',r=>{
      const G=L.route.segs(r.x),S=60,dense=[];G.forEach((g,i)=>{for(let j=i?1:0;j<=S;j++)dense.push(hermite(g[0],g[1],g[2],g[3],j/S).p);});
      const idx={},pts=L.route.pts(r.x);let w=0;pts.forEach((p,i)=>{const k=K.find(k=>V.len(V.sub(clamps[k].p,p))<1e-6);if(k)idx[k]=i*S;});
      trunkDone(dense,idx,pathLength(dense)/(dense.length-1));});}
  const finish=()=>{
    B.clr=B.runs.map(()=>[]);B.need=B.runs.map(()=>[]);const m=B.runs.length;
    for(let i=0;i<m;i++)for(let j=0;j<m;j++){if(i===j){B.clr[i][j]=Infinity;B.need[i][j]=0;continue;}
      const a=B.runs[i],b=B.runs[j];let d=Infinity;for(let q=0;q<a.d.pts.length;q+=2)d=Math.min(d,closestOnPath(a.d.pts[q],b.d.pts).d);
      B.clr[i][j]=d-(a.cable.d+b.cable.d)/2;B.need[i][j]=Math.max(a.cable.gap,b.cable.gap);}
    B.runs.forEach((r,i)=>{let mn=Infinity,nd=0;for(let j=0;j<m;j++)if(j!==i&&B.clr[i][j]<mn){mn=B.clr[i][j];nd=B.need[i][j];}r.clr={min:mn,need:nd};});
    B.runs.forEach(r=>addRun(r));
    const bad=B.runs.filter(r=>r.minR<r.params.R),tight=B.runs.filter(r=>r.clr.min<r.clr.need);
    $('runBundle').disabled=false;dock='bun';showPane();
    let msg=`Routed ${m} cable${m>1?'s':''}.`;
    if(bad.length){msg+=` Below min bend radius: ${bad.map(r=>`${r.name} (R ${fmt(r.minR)} of ${r.params.R})`).join(', ')}.`;
      const w=bad[0];$('nudge').hidden=false;$('nudge').textContent=`Nudge a clamp to open up ${w.name}`;$('nudge').onclick=()=>nudgeClamp(B,w);}
    if(tight.length)msg+=` Too close to a neighbour: ${tight.map(r=>r.name).join(', ')}.`;
    if(!bad.length&&!tight.length)msg+=' All bends and gaps pass.';
    st.textContent=msg;st.style.color=bad.length||tight.length?'var(--bad)':'';
  };
};
// try single-axis moves of the clamp nearest the tightest bend; apply the best one to the clamp text
function nudgeClamp(B,r){
  const W=r.wp,ks=r.clampIds,st=$('statusBundle');
  if(!ks.length)return st.textContent=`${r.name} passes through no clamp; move its start or end point instead.`;
  const tp=r.d.pts[r.wi];let bi=0,bd=Infinity;ks.forEach((k,i)=>{const d=V.len(V.sub(W[i+1],tp));if(d<bd){bd=d;bi=i;}});
  const k=B.clamps[ks[bi]],wi=bi+1,base=analyse(W).minR;let best={gain:0};
  for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])for(const s of [15,30,60,100]){
    const m=analyse(W.map((p,i)=>i===wi?V.add(p,V.mul(d,s)):p)).minR;if(m-base>best.gain)best={gain:m-base,d,s,m};}
  if(!best.d)return st.textContent=`No single move of ${k.id} opens up ${r.name}. Try moving its end point, or a larger clamp spacing.`;
  const np=V.add(k.p,V.mul(best.d,best.s));
  $('bcl').value=$('bcl').value.split(/\r?\n/).map(l=>{const t=l.split('!')[0].trim().replace(/,/g,' ').split(/\s+/);
    return t[0]===k.id?`${k.id}  ${np.map(c=>c.toFixed(1)).join('  ')}    ${t.slice(4,7).join(' ')}`:l;}).join('\n');
  const ax=['X','Y','Z'][best.d.findIndex(c=>c!==0)],sg=best.d.some(c=>c<0)?'-':'+';
  st.style.color='';st.textContent=`Moved ${k.id} ${best.s} mm in ${sg}${ax}; the bend on ${r.name} opens to about R ${fmt(best.m)} mm. Route the bundle again to check.`;$('nudge').hidden=true;
}
// minimal zip writer (store, no compression)
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}return t;})();
function crc32(u8){let c=-1;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return(c^-1)>>>0;}
function zipFiles(files){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  const u16=v=>[v&255,v>>8&255],u32=v=>[v&255,v>>8&255,v>>16&255,v>>>24&255];
  for(const f of files){const nm=enc.encode(f.name),dt=enc.encode(f.text),crc=crc32(dt);
    const hdr=new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(dt.length),...u32(dt.length),...u16(nm.length),0,0,...nm]);
    parts.push(hdr,dt);
    cd.push(new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(dt.length),...u32(dt.length),...u16(nm.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(off),...nm]));
    off+=hdr.length+dt.length;}
  const cdLen=cd.reduce((a,b)=>a+b.length,0);
  return new Blob([...parts,...cd,new Uint8Array([80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cdLen),...u32(off),0,0])],{type:'application/zip'});
}
$('dlzip').onclick=()=>{const r=selected(),B=r&&bundles[r.bundle];if(!B)return;
  const b=zipFiles(B.runs.filter(c=>runs.includes(c)).map(c=>({name:c.name+'.pts',text:c.text}))),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download='bundle_'+B.id+'.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);};

window.addEventListener('resize',draw);
const mq=matchMedia('(prefers-color-scheme: dark)');mq.addEventListener&&mq.addEventListener('change',()=>rebuild(false));

// init
$('pts').value=store.get('rs.pts')||PRESETS.target;
$('mpts').value=store.get('rs.master')||PRESETS.master;
$('spts').value=store.get('rs.slave')||PRESETS.slave;
['bcab','brt','bcl','bob'].forEach(k=>$(k).value=store.get('rs.'+k)||PRESETS[k]);
showPanel('bend');showPane();renderRuns();rebuild(true);
