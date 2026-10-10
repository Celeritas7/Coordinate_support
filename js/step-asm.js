/* step-asm.js — Creo assembly STEP reader (AP203 / AP214).
 * Product tree with placements, named datums per instance, solids per part, and the centreline of swept
 * pipes / hoses: cylinder axes + torus centre circles chained end to end (exact bend radius = torus major R),
 * cross-checked against the part's datum curves when Creo exported them.
 * No DOM. Browser: window.StepAsm. Node: require('./step-asm.js').
 */
(function (root) {
"use strict";
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1e-12;return[a[0]/l,a[1]/l,a[2]/l];},DEG=180/Math.PI,TAU=2*Math.PI;
const mod=(a)=>((a%TAU)+TAU)%TAU;

// ---------- frames (rotation columns x,y,z + origin o) ----------
const F={
  id:()=>({o:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]}),
  pt:(M,p)=>add(M.o,add(mul(M.x,p[0]),add(mul(M.y,p[1]),mul(M.z,p[2])))),
  vec:(M,v)=>add(mul(M.x,v[0]),add(mul(M.y,v[1]),mul(M.z,v[2]))),
  inv:M=>({o:[-dot(M.x,M.o),-dot(M.y,M.o),-dot(M.z,M.o)],x:[M.x[0],M.y[0],M.z[0]],y:[M.x[1],M.y[1],M.z[1]],z:[M.x[2],M.y[2],M.z[2]]}),
  compose:(M2,M1)=>({o:F.pt(M2,M1.o),x:F.vec(M2,M1.x),y:F.vec(M2,M1.y),z:F.vec(M2,M1.z)}),
  // point in world -> coordinates in frame M
  toLocal:(M,p)=>{const d=sub(p,M.o);return[dot(d,M.x),dot(d,M.y),dot(d,M.z)];}
};

// ---------- tokenizer ----------
function tokenize(text){
  const ents=new Map(),s=String(text),n=s.length;let i=s.indexOf('DATA;');if(i<0)i=0;
  for(;;){
    const h=s.indexOf('#',i);if(h<0)break;
    let j=h+1,id=0,any=false;
    while(j<n){const c=s.charCodeAt(j);if(c>=48&&c<=57){id=id*10+(c-48);any=true;j++;}else break;}
    while(j<n&&(s[j]===' '||s[j]==='\n'||s[j]==='\r'||s[j]==='\t'))j++;
    if(!any||s[j]!=='='){i=h+1;continue;}
    j++;let depth=0,q=false,k=j;
    for(;k<n;k++){const c=s[k];if(q){if(c==="'")q=false;continue;}if(c==="'")q=true;else if(c==='(')depth++;else if(c===')')depth--;else if(c===';'&&depth===0)break;}
    ents.set(id,{raw:s.slice(j,k).trim()});i=k+1;
  }
  return ents;
}
function splitArgs(raw){
  const out=[];let depth=0,cur='',q=false;
  for(let i=0;i<raw.length;i++){const c=raw[i];if(q){cur+=c;if(c==="'")q=false;continue;}
    if(c==="'"){q=true;cur+=c;continue;}if(c==='(')depth++;if(c===')')depth--;
    if(c===','&&depth===0){out.push(cur.trim());cur='';continue;}cur+=c;}
  out.push(cur.trim());return out;
}
function decode(e){
  if(e.kinds)return e;const raw=e.raw;e.kinds=[];e.argsOf={};
  if(raw[0]==='('){let i=1;
    for(;;){const m=/^\s*([A-Z0-9_]+)\s*\(/.exec(raw.slice(i));if(!m)break;const name=m[1];let j=i+m[0].length,depth=1,q=false;
      for(;j<raw.length&&depth;j++){const c=raw[j];if(q){if(c==="'")q=false;continue;}if(c==="'")q=true;else if(c==='(')depth++;else if(c===')')depth--;}
      e.kinds.push(name);e.argsOf[name]=splitArgs(raw.slice(i+m[0].length,j-1));i=j;}
  }else{const p=raw.indexOf('(');if(p<0){e.kinds=[raw];e.argsOf[raw]=[];}else{const name=raw.slice(0,p).trim();e.kinds=[name];e.argsOf[name]=splitArgs(raw.slice(p+1,raw.lastIndexOf(')')));}}
  e.kind=e.kinds[0];e.args=e.argsOf[e.kind];return e;
}
const ref=a=>{const m=/^#(\d+)$/.exec((a||'').trim());return m?+m[1]:null;};
const refs=a=>(a||'').replace(/^\(|\)$/g,'').split(',').map(x=>ref(x)).filter(x=>x!=null);
const str=a=>a&&a[0]==="'"?a.slice(1,-1):'';
const nums=a=>(a||'').replace(/^\(|\)$/g,'').split(',').map(parseFloat);
const lerp=(a,b,t)=>a+(b-a)*t;

// ---------- NURBS (B_SPLINE_CURVE / SURFACE _WITH_KNOTS, rational or not) ----------
function knotVec(m,k){const U=[];m.forEach((c,i)=>{for(let j=0;j<c;j++)U.push(k[i]);});return U;}
function findSpan(U,p,n,u){if(u>=U[n+1])return n;if(u<=U[p])return p;let lo=p,hi=n+1,mid=(lo+hi)>>1;while(u<U[mid]||u>=U[mid+1]){if(u<U[mid])hi=mid;else lo=mid;mid=(lo+hi)>>1;}return mid;}
function basisFuns(U,p,i,u){const N=[1],L=[],Rr=[];for(let j=1;j<=p;j++){L[j]=u-U[i+1-j];Rr[j]=U[i+j]-u;let s=0;for(let r=0;r<j;r++){const d=Rr[r+1]+L[j-r],t=d?N[r]/d:0;N[r]=s+Rr[r+1]*t;s=L[j-r]*t;}N[j]=s;}return N;}
function curveEval(c,u){const n=c.P.length-1,sp=findSpan(c.U,c.p,n,u),N=basisFuns(c.U,c.p,sp,u);let x=0,y=0,z=0,w=0;
  for(let j=0;j<=c.p;j++){const k=sp-c.p+j,b=N[j]*(c.W?c.W[k]:1);x+=b*c.P[k][0];y+=b*c.P[k][1];z+=b*c.P[k][2];w+=b;}return[x/w,y/w,z/w];}
function surfEval(s,u,v){const nu=s.P.length-1,nv=s.P[0].length-1,su=findSpan(s.U,s.pu,nu,u),sv=findSpan(s.V,s.pv,nv,v),Nu=basisFuns(s.U,s.pu,su,u),Nv=basisFuns(s.V,s.pv,sv,v);let x=0,y=0,z=0,w=0;
  for(let a=0;a<=s.pu;a++)for(let b=0;b<=s.pv;b++){const i=su-s.pu+a,j=sv-s.pv+b,f=Nu[a]*Nv[b]*(s.W?s.W[i][j]:1),P=s.P[i][j];x+=f*P[0];y+=f*P[1];z+=f*P[2];w+=f;}return[x/w,y/w,z/w];}
// circle through three points
function circ3(a,b,c){const ab=sub(b,a),ac=sub(c,a),n=cross(ab,ac),nn=dot(n,n);if(nn<1e-18*Math.max(1,dot(ab,ab)*dot(ac,ac)))return null;
  const o=add(a,mul(add(mul(cross(n,ab),dot(ac,ac)),mul(cross(ac,n),dot(ab,ab))),1/(2*nn)));return{c:o,r:len(sub(a,o)),n:norm(n)};}
// centreline of a tube-shaped spline face: one parameter direction runs round a circle of constant radius.
// Returns {r, pts (centres, ~step mm apart), cov (angle the face covers round the tube)} or null
function tubeOfSurface(s,step){
  const u0=s.U[s.pu],u1=s.U[s.P.length],v0=s.V[s.pv],v1=s.V[s.P[0].length];
  const at=(round,t,g)=>round==='u'?surfEval(s,lerp(u0,u1,g),lerp(v0,v1,t)):surfEval(s,lerp(u0,u1,t),lerp(v0,v1,g));
  const sec=(round,t)=>circ3(at(round,t,0.02),at(round,t,0.5),at(round,t,0.98));
  const test=round=>{const rs=[];let err=0;
    for(const t of[0,0.15,0.3,0.5,0.7,0.85,1]){const c=sec(round,t);if(!c||!(c.r<1e4))return null;rs.push(c.r);
      for(const g of[0,0.25,0.75,1])err=Math.max(err,Math.abs(len(sub(at(round,t,g),c.c))-c.r));}
    const r=rs.reduce((a,b)=>a+b,0)/rs.length;return{round,r,err:Math.max(err,Math.max(...rs)-Math.min(...rs))};};
  const T=[test('u'),test('v')].filter(x=>x&&x.err<=Math.max(0.01,0.002*x.r)).sort((a,b)=>a.err-b.err)[0];if(!T)return null;
  const coarse=[];for(let i=0;i<=12;i++){const c=sec(T.round,i/12);if(!c)return null;coarse.push(c.c);}
  let L=0;for(let i=1;i<coarse.length;i++)L+=len(sub(coarse[i],coarse[i-1]));if(L<1e-6)return null;
  const N=Math.max(8,Math.min(1500,Math.ceil(L/(step||1)))),pts=[];
  for(let i=0;i<=N;i++){const c=sec(T.round,i/N);if(!c)return null;pts.push(c.c);}
  const m=sec(T.round,0.5),pa=at(T.round,0.5,0),pb=at(T.round,0.5,1),pm=at(T.round,0.5,0.5);
  const ang=(p,q)=>Math.acos(Math.max(-1,Math.min(1,dot(norm(sub(p,m.c)),norm(sub(q,m.c))))));
  const cov=len(sub(pa,pb))<1e-6?TAU:ang(pa,pm)+ang(pm,pb);
  return{r:T.r,pts,cov,err:T.err};}

// ---------- pieces: lines and arcs with end tangents ----------
function mkLine(a,b,name){const t=norm(sub(b,a));return{type:'line',a,b,ta:t,tb:t,len:len(sub(b,a)),name:name||''};}
// arc from a, rotating about n (unit) by th (counter-clockwise, 0<th<=2pi) with centre c and radius R
function mkArc(c,n,R,a,th,name){const u=sub(a,c),w=cross(n,u);
  const b=add(c,add(mul(u,Math.cos(th)),mul(w,Math.sin(th))));
  return{type:'arc',c,n,R,a,b,th,ta:norm(w),tb:norm(cross(n,sub(b,c))),len:R*th,name:name||''};}
// spline centreline (hose sweep or datum curve) as a sampled polyline; k = curvature over an ~4 mm chord, kv points at the centre
function mkPoly(pts,name,cov){
  const P=[pts[0]];for(let i=1;i<pts.length;i++)if(len(sub(pts[i],P[P.length-1]))>1e-6)P.push(pts[i]);
  if(P.length<2)return null;const cum=[0];for(let i=1;i<P.length;i++)cum.push(cum[i-1]+len(sub(P[i],P[i-1])));const L=cum[cum.length-1];
  const k=[],kv=[],h=Math.min(4,L/4);
  for(let i=0;i<P.length;i++){let a=i,b=i;while(a>0&&cum[i]-cum[a]<h)a--;while(b<P.length-1&&cum[b]-cum[i]<h)b++;
    if(a===i||b===i){k.push(null);kv.push([0,0,0]);continue;}const c=circ3(P[a],P[i],P[b]);
    if(!c||c.r>1e6){k.push(1e-9);kv.push([0,0,0]);}else{k.push(1/c.r);kv.push(mul(norm(sub(c.c,P[i])),1/c.r));}}
  for(let i=0;i<k.length;i++)if(k[i]==null){const j=i===0?k.findIndex(x=>x!=null):(()=>{let j=i;while(j>0&&k[j]==null)j--;return j;})();k[i]=j>=0&&k[j]!=null?k[j]:1e-9;kv[i]=j>=0?kv[j]:[0,0,0];}
  const n=P.length;return{type:'poly',pts:P,cum,k,kv,a:P[0],b:P[n-1],ta:norm(sub(P[1],P[0])),tb:norm(sub(P[n-1],P[n-2])),len:L,name:name||'',cov:cov==null?TAU:cov,
    kmax:Math.max(...k.slice(1,-1).concat([1e-9]))};}
function reverse(p){if(p.type==='poly'){const pts=p.pts.slice().reverse(),cum=p.cum.map(c=>p.len-c).reverse();return{...p,pts,cum,k:p.k.slice().reverse(),kv:p.kv.slice().reverse(),a:p.b,b:p.a,ta:mul(p.tb,-1),tb:mul(p.ta,-1)};}
  return p.type==='line'?{...p,a:p.b,b:p.a,ta:mul(p.tb,-1),tb:mul(p.ta,-1)}:{...p,a:p.b,b:p.a,n:mul(p.n,-1),ta:mul(p.tb,-1),tb:mul(p.ta,-1)};}
function xformPiece(M,p){const o={...p,a:F.pt(M,p.a),b:F.pt(M,p.b),ta:F.vec(M,p.ta),tb:F.vec(M,p.tb)};if(p.type==='arc'){o.c=F.pt(M,p.c);o.n=F.vec(M,p.n);}
  if(p.type==='poly'){o.pts=p.pts.map(q=>F.pt(M,q));o.kv=p.kv.map(v=>F.vec(M,v));}return o;}
function dedupe(pieces,tol){const out=[];
  for(const p of pieces){const q=out.find(q=>q.type===p.type&&((len(sub(q.a,p.a))<=tol&&len(sub(q.b,p.b))<=tol)||(len(sub(q.a,p.b))<=tol&&len(sub(q.b,p.a))<=tol)));
    if(q){if(q.cov!=null&&p.cov!=null)q.cov=Math.min(TAU,q.cov+p.cov);continue;}out.push({...p});}
  return out;}
// faces get split by features: join coaxial arcs on one centre circle and collinear lines on one axis
function merge(pieces){
  const arcs=pieces.filter(p=>p.type==='arc'),lines=pieces.filter(p=>p.type==='line'),out=[],used=new Set();
  arcs.forEach((A,i)=>{if(used.has(i))return;used.add(i);const{c,n,R}=A,u=norm(sub(A.a,c)),w=cross(n,u),ang=p=>mod(Math.atan2(dot(sub(p,c),w),dot(sub(p,c),u)));
    const ivs=[];const addIv=B=>{const s=dot(B.n,n)>0?ang(B.a):ang(B.b);ivs.push([s,s+B.th]);};addIv(A);
    arcs.forEach((B,j)=>{if(used.has(j)||Math.abs(B.R-R)>1e-3||len(sub(B.c,c))>0.05||Math.abs(dot(B.n,n))<0.9999)return;used.add(j);addIv(B);});
    const gap=Math.max(0.5,0.03*R)/R;ivs.sort((a,b)=>a[0]-b[0]);const m=[];
    for(const iv of ivs){const L=m[m.length-1];if(L&&iv[0]<=L[1]+gap)L[1]=Math.max(L[1],iv[1]);else m.push(iv.slice());}
    if(m.length>1&&m[0][0]+TAU<=m[m.length-1][1]+gap){m[m.length-1][1]=Math.max(m[m.length-1][1],m[0][1]+TAU);m.shift();}
    for(const [s,e] of m)out.push(mkArc(c,n,R,add(c,add(mul(u,R*Math.cos(s)),mul(w,R*Math.sin(s)))),Math.min(e-s,TAU),A.name));});
  const usedL=new Set();
  lines.forEach((L,i)=>{if(usedL.has(i))return;usedL.add(i);const d=L.ta,o=L.a,t=p=>dot(sub(p,o),d),ivs=[[0,L.len]];
    lines.forEach((M,j)=>{if(usedL.has(j)||Math.abs(dot(M.ta,d))<0.99999)return;const r=sub(M.a,o);if(len(sub(r,mul(d,dot(r,d))))>0.05)return;usedL.add(j);const ta=t(M.a),tb=t(M.b);ivs.push([Math.min(ta,tb),Math.max(ta,tb)]);});
    ivs.sort((a,b)=>a[0]-b[0]);const m=[];for(const iv of ivs){const P=m[m.length-1];if(P&&iv[0]<=P[1]+30)P[1]=Math.max(P[1],iv[1]);else m.push(iv.slice());}
    const same=[L].concat(lines.filter((M,j)=>j!==i&&Math.abs(dot(M.ta,d))>=0.99999&&len(sub(sub(M.a,o),mul(d,dot(sub(M.a,o),d))))<=0.05)),cov=Math.max(...same.map(x=>x.cov==null?TAU:x.cov));
    for(const [s,e] of m)if(e-s>1e-6){const ln=mkLine(add(o,mul(d,s)),add(o,mul(d,e)),L.name);ln.cov=cov;out.push(ln);}});
  return out.concat(pieces.filter(p=>p.type==='poly'));}

// chain pieces into one route: endpoints joined within tol, tangent-continuous where possible.
// dropCorners: remove pairs of non-collinear lines meeting alone at a node (Creo's bend construction lines)
function chain(pieces,tol,dropCorners){
  tol=tol||0.02;let alive=pieces.map(()=>true);
  const makeNodes=()=>{const nodes=[];const nodeOf=p=>{for(let i=0;i<nodes.length;i++)if(len(sub(nodes[i].p,p))<=tol)return i;nodes.push({p,ends:[]});return nodes.length-1;};
    pieces.forEach((pc,i)=>{if(!alive[i])return;pc.na=nodeOf(pc.a);pc.nb=nodeOf(pc.b);nodes[pc.na].ends.push({i,end:'a'});nodes[pc.nb].ends.push({i,end:'b'});});return nodes;};
  let nodes=makeNodes();
  if(dropCorners){let changed=false;
    nodes.forEach(nd=>{if(nd.ends.length!==2)return;const p1=pieces[nd.ends[0].i],p2=pieces[nd.ends[1].i];
      if(p1.type!=='line'||p2.type!=='line'||p1===p2)return;if(Math.abs(dot(p1.ta,p2.ta))<Math.cos(0.5/DEG)){alive[nd.ends[0].i]=false;alive[nd.ends[1].i]=false;changed=true;}});
    if(changed)nodes=makeNodes();}
  // connected components by total length
  const comp=pieces.map(()=>-1);let nc=0;
  pieces.forEach((pc,i)=>{if(!alive[i]||comp[i]>=0)return;const st=[i];comp[i]=nc;
    while(st.length){const k=st.pop();for(const nd of[pieces[k].na,pieces[k].nb])for(const e of nodes[nd].ends)if(comp[e.i]<0){comp[e.i]=nc;st.push(e.i);}}nc++;});
  const total=new Array(nc).fill(0);pieces.forEach((pc,i)=>{if(alive[i])total[comp[i]]+=pc.len;});
  let best=-1;total.forEach((t,i)=>{if(best<0||t>total[best])best=i;});
  if(best<0)return{pieces:[],length:0,leftover:0};
  const inComp=i=>alive[i]&&comp[i]===best;
  let start=null;
  for(const nd of nodes){const ends=nd.ends.filter(e=>inComp(e.i));if(ends.length===1){start=ends[0];break;}}
  if(!start){const i=pieces.findIndex((p,i)=>inComp(i));start={i,end:'a'};}
  const used=new Set(),out=[];let cur=start;
  while(cur){const pc=pieces[cur.i];used.add(cur.i);const o=cur.end==='a'?pc:reverse(pc);out.push(o);
    const endNode=cur.end==='a'?pc.nb:pc.na;let pick=null;
    for(const e of nodes[endNode].ends){if(used.has(e.i)||!inComp(e.i))continue;const q=pieces[e.i],oq=e.end==='a'?q:reverse(q);
      const d=dot(o.tb,oq.ta),score=d+(q.type==='arc'?1e-3:0);if(d>Math.cos(3/DEG)&&(!pick||score>pick.score))pick={e,score};}
    if(!pick){const c=nodes[endNode].ends.filter(e=>!used.has(e.i)&&inComp(e.i));if(c.length===1)pick={e:c[0]};}
    cur=pick?pick.e:null;}
  const length=out.reduce((s,p)=>s+p.len,0);
  return{pieces:out,length,leftover:total[best]-length,components:nc};
}

// corners, bends and straights of a chained centreline
function describe(ch){
  const P=ch.pieces;if(!P.length)return null;
  const bends=[],Q=[P[0].a];
  P.forEach((pc,i)=>{if(pc.type!=='arc')return;
    const prev=P[i-1],next=P[i+1],before=prev&&prev.type==='line'?prev.len:0,after=next&&next.type==='line'?next.len:0;
    if(pc.th>170/DEG){ // a near-U bend needs two corner points: split the arc in half
      const u=sub(pc.a,pc.c),w=cross(pc.n,u),h=pc.th/2,mid=add(pc.c,add(mul(u,Math.cos(h)),mul(w,Math.sin(h)))),tm=norm(add(mul(u,-Math.sin(h)),mul(w,Math.cos(h)))),t=pc.R*Math.tan(h/2);
      const c1=add(pc.a,mul(pc.ta,t)),c2=add(mid,mul(tm,t));
      bends.push({corner:c1,R:pc.R,deg:h*DEG,before,after:0,piece:i,split:true},{corner:c2,R:pc.R,deg:h*DEG,before:0,after,piece:i,split:true});Q.push(c1,c2);return;}
    const t=pc.R*Math.tan(pc.th/2),corner=add(pc.a,mul(pc.ta,t));
    bends.push({corner,R:pc.R,deg:pc.th*DEG,before,after,piece:i});
    Q.push(corner);});
  Q.push(P[P.length-1].b);
  const inner=P.slice(1,-1).filter(p=>p.type==='line').map(p=>p.len),polys=P.filter(p=>p.type==='poly');
  const polyR=polys.length?1/Math.max(...polys.map(p=>p.kmax)):Infinity,arcR=bends.length?Math.min(...bends.map(b=>b.R)):Infinity;
  return{Q,bends,start:P[0].a,end:P[P.length-1].b,startDir:P[0].ta,endDir:P[P.length-1].tb,length:ch.length,
    R:Math.min(arcR,polyR),arcR,polyR,kind:polys.length?'hose':'pipe',splineLen:polys.reduce((s,p)=>s+p.len,0),
    minStraight:inner.length?Math.min(...inner):Infinity,straights:P.filter(p=>p.type==='line').length};
}
// dense samples in route-studio's run shape {pts,k,s,d1s,d2s}: exact curvature
function sample(ch,step){
  step=step||10;const pts=[],k=[],d1s=[],d2s=[],STRAIGHT=1e-9;
  const push=(p,kk,d1,d2)=>{pts.push(p);k.push(kk);d1s.push(d1);d2s.push(d2);};
  ch.pieces.forEach((pc,j)=>{
    if(pc.type==='line'){const N=Math.max(1,Math.ceil(pc.len/step)),d=sub(pc.b,pc.a);for(let i=j?1:0;i<=N;i++)push(add(pc.a,mul(d,i/N)),STRAIGHT,pc.ta,[0,0,0]);}
    else if(pc.type==='poly'){let last=-Infinity;const n=pc.pts.length;
      for(let i=j?1:0;i<n;i++){if(i<n-1&&pc.cum[i]-last<Math.min(step,2))continue;last=pc.cum[i];const i0=Math.max(0,i-1),i1=Math.min(n-1,i+1);
        push(pc.pts[i],Math.max(pc.k[i],STRAIGHT),norm(sub(pc.pts[i1],pc.pts[i0])),pc.kv[i]);}}
    else{const N=Math.max(2,Math.ceil(pc.th*DEG/3)),u=sub(pc.a,pc.c),w=cross(pc.n,u);
      for(let i=j?1:0;i<=N;i++){const f=pc.th*i/N,p=add(pc.c,add(mul(u,Math.cos(f)),mul(w,Math.sin(f))));
        push(p,1/pc.R,norm(add(mul(u,-Math.sin(f)),mul(w,Math.cos(f)))),mul(norm(sub(pc.c,p)),1/pc.R));}}});
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+len(sub(pts[i],pts[i-1])));
  return{pts,k,s,d1s,d2s};
}
// nearest point on the centreline to p; s = distance along the centreline from its start
function nearest(ch,p){let bd=Infinity,bq=null,bs=0,s0=0;
  for(const pc of ch.pieces){let q,s;
    if(pc.type==='line'){const d=sub(pc.b,pc.a),L2=dot(d,d),t=L2?Math.max(0,Math.min(1,dot(sub(p,pc.a),d)/L2)):0;q=add(pc.a,mul(d,t));s=s0+t*pc.len;}
    else if(pc.type==='poly'){let dd=Infinity;for(let i=1;i<pc.pts.length;i++){const a=pc.pts[i-1],d=sub(pc.pts[i],a),L2=dot(d,d),t=L2?Math.max(0,Math.min(1,dot(sub(p,a),d)/L2)):0,qq=add(a,mul(d,t)),e=len(sub(p,qq));
        if(e<dd){dd=e;q=qq;s=s0+pc.cum[i-1]+t*(pc.cum[i]-pc.cum[i-1]);}}}
    else{const u=norm(sub(pc.a,pc.c)),w=cross(pc.n,u),r=sub(p,pc.c),rp=sub(r,mul(pc.n,dot(r,pc.n)));
      let f=len(rp)<1e-9?0:mod(Math.atan2(dot(rp,w),dot(rp,u)));if(f>pc.th)f=(f-pc.th<(TAU-pc.th)/2)?pc.th:0;
      q=add(pc.c,add(mul(u,pc.R*Math.cos(f)),mul(w,pc.R*Math.sin(f))));s=s0+f*pc.R;}
    const d=len(sub(p,q));if(d<bd){bd=d;bq=q;bs=s;}s0+=pc.len;}
  return{q:bq,d:bd,s:bs};
}

// ---------- main ----------
// opts.pipe: {partName: true|false} — user override of pipe detection (true = this is the pipe, false = not a pipe)
function parse(text,opts){
  opts=opts||{};const force=opts.pipe||{};
  const E=tokenize(text);const get=id=>{const e=E.get(id);return e?decode(e):null;};
  const has=(e,k)=>!!e&&e.kinds.includes(k),A=(e,k)=>e.argsOf[k]||e.args;
  const byKind=new Map();for(const [id,e] of E){decode(e);for(const k of e.kinds){if(!byKind.has(k))byKind.set(k,[]);byKind.get(k).push(id);}}
  const list=k=>byKind.get(k)||[];
  let unitScale=1,units='MM';
  for(const id of list('CONVERSION_BASED_UNIT')){if(/INCH/i.test(get(id).raw)){unitScale=25.4;units='INCH';}}
  const degrees=list('CONVERSION_BASED_UNIT').some(id=>/DEGREE/i.test(get(id).raw));
  const head=String(text).slice(0,Math.max(0,String(text).indexOf('DATA;')));
  const product=(/FILE_NAME\s*\(\s*'([^']*)'/.exec(head)||[])[1]||'';

  const point=id=>{const e=get(id);if(!has(e,'CARTESIAN_POINT'))return null;const v=nums(A(e,'CARTESIAN_POINT')[1]);return v.length>=3&&v.every(Number.isFinite)?mul(v.slice(0,3),unitScale):null;};
  const dir=id=>{const e=get(id);if(!has(e,'DIRECTION'))return null;const v=nums(A(e,'DIRECTION')[1]);return v.length>=3&&v.every(Number.isFinite)?v.slice(0,3):null;};
  const axis=id=>{const e=get(id);if(!has(e,'AXIS2_PLACEMENT_3D'))return null;const a=A(e,'AXIS2_PLACEMENT_3D');
    const o=point(ref(a[1]))||[0,0,0],z=norm(dir(ref(a[2]))||[0,0,1]);let x=dir(ref(a[3]))||(Math.abs(z[0])<0.9?[1,0,0]:[0,1,0]);
    x=norm(sub(x,mul(z,dot(x,z))));return{name:str(a[0]),o,x,y:cross(z,x),z,id};};
  const vertex=id=>{const v=get(id);if(!v)return null;if(has(v,'VERTEX_POINT'))return point(ref(v.args[1]));if(has(v,'CARTESIAN_POINT'))return point(id);return null;};
  // B-spline readers: plain and complex (rational) entity forms
  const grid=a=>splitArgs((a||'').trim().slice(1,-1)).map(row=>refs(row).map(point));
  function bsCurve(e){const K=e.argsOf.B_SPLINE_CURVE_WITH_KNOTS,B=e.argsOf.B_SPLINE_CURVE,RW=e.argsOf.RATIONAL_B_SPLINE_CURVE;if(!K)return null;
    let p,P,m,k;if(B){p=+B[0];P=refs(B[1]).map(point);m=nums(K[0]);k=nums(K[1]);}else{p=+K[1];P=refs(K[2]).map(point);m=nums(K[6]);k=nums(K[7]);}
    if(!(p>=1)||P.some(x=>!x)||P.length<p+1)return null;const U=knotVec(m,k);if(U.length!==P.length+p+1)return null;
    return{p,P,U,W:RW?nums(RW[0]):null};}
  function bsSurf(e){const K=e.argsOf.B_SPLINE_SURFACE_WITH_KNOTS,B=e.argsOf.B_SPLINE_SURFACE,RW=e.argsOf.RATIONAL_B_SPLINE_SURFACE;if(!K)return null;
    let pu,pv,P,um,vm,uk,vk;if(B){pu=+B[0];pv=+B[1];P=grid(B[2]);[um,vm,uk,vk]=[K[0],K[1],K[2],K[3]].map(nums);}else{pu=+K[1];pv=+K[2];P=grid(K[3]);[um,vm,uk,vk]=[K[8],K[9],K[10],K[11]].map(nums);}
    if(!P.length||P.some(r=>r.some(x=>!x)||r.length!==P[0].length))return null;const U=knotVec(um,uk),Vk=knotVec(vm,vk);
    if(U.length!==P.length+pu+1||Vk.length!==P[0].length+pv+1)return null;
    return{pu,pv,P,U,V:Vk,W:RW?splitArgs(RW[0].trim().slice(1,-1)).map(nums):null};}
  const bsSample=(c,n)=>{const a=c.U[c.p],b=c.U[c.P.length],o=[];for(let i=0;i<=n;i++)o.push(curveEval(c,lerp(a,b,i/n)));return o;};

  function trimmed(id){const e=get(id),a=e.args,name=str(a[0]),c=get(ref(a[1]));if(!c)return null;
    const t1=a[2],t2=a[3],sense=!/\.F\./.test(a[4]||'');
    const pval=t=>{const m=/PARAMETER_VALUE\(([^)]*)\)/.exec(t);return m?parseFloat(m[1]):null;},pref=t=>{const m=/#(\d+)/.exec(t);return m?point(+m[1]):null;};
    if(has(c,'LINE')){const la=A(c,'LINE'),p0=point(ref(la[1])),v=get(ref(la[2]));if(!p0||!v)return null;const d=dir(ref(v.args[1])),mag=parseFloat(v.args[2])*unitScale;if(!d||!Number.isFinite(mag))return null;
      const at=t=>add(p0,mul(d,mag*t));const pa=pref(t1)||at(pval(t1)??0),pb=pref(t2)||at(pval(t2)??1);if(len(sub(pa,pb))<1e-9)return null;return mkLine(pa,pb,name);}
    if(has(c,'CIRCLE')){const ca=A(c,'CIRCLE'),ax=axis(ref(ca[1])),R=parseFloat(ca[2])*unitScale;if(!ax||!(R>0))return null;
      const ang=t=>{const p=pref(t);if(p){const d=sub(p,ax.o);return Math.atan2(dot(d,ax.y),dot(d,ax.x));}let v=pval(t);if(v==null)return null;return degrees?v/DEG:v;};
      const a0=ang(t1),a1=ang(t2);if(a0==null||a1==null)return null;
      let th=mod(sense?a1-a0:a0-a1);if(th<1e-9)th=TAU;
      return mkArc(ax.o,sense?ax.z:mul(ax.z,-1),R,add(ax.o,add(mul(ax.x,R*Math.cos(a0)),mul(ax.y,R*Math.sin(a0)))),th,name);}
    if(has(c,'B_SPLINE_CURVE_WITH_KNOTS')){const bc=bsCurve(c);if(!bc)return null;let pts=bsSample(bc,400);
      const cut=t=>{const p=pref(t);if(p){let bi=0,bd=Infinity;pts.forEach((q,i)=>{const d=len(sub(q,p));if(d<bd){bd=d;bi=i;}});return bi;}const v=pval(t);if(v==null)return null;
        const a=bc.U[bc.p],b=bc.U[bc.P.length];return Math.round(Math.max(0,Math.min(1,(v-a)/(b-a)))*400);};
      let i0=cut(t1),i1=cut(t2);if(i0==null)i0=0;if(i1==null)i1=400;if(i0>i1)[i0,i1]=[i1,i0];pts=pts.slice(i0,i1+1);if(!sense)pts.reverse();
      return mkPoly(pts,name);}
    return null;}
  function curveItem(id,name){const e=get(id);if(!e)return[];
    if(has(e,'TRIMMED_CURVE')){const c=trimmed(id);return c?[c]:[];}
    if(has(e,'B_SPLINE_CURVE_WITH_KNOTS')){const bc=bsCurve(e);if(!bc)return[];const n=Math.max(60,Math.min(1500,bc.P.length*30));const pl=mkPoly(bsSample(bc,n),name||str(A(e,e.kinds.find(k=>/REPRESENTATION_ITEM/.test(k))||e.kind)[0]));return pl?[pl]:[];}
    if(has(e,'COMPOSITE_CURVE')){const a=A(e,'COMPOSITE_CURVE');return refs(a[1]).flatMap(sid=>{const s=get(sid);if(!s)return[];const sa=s.args;const out=curveItem(ref(sa[2]),str(a[0]));
      return /\.F\./.test(sa[1]||'')?out.map(reverse).reverse():out;});}
    return[];}

  function solid(id){const e=get(id),sh=get(ref(e.args[1]));if(!sh)return null;const faces=[],types={},verts=[],ext=[];
    for(const fid of refs(sh.args[1])){const f=get(fid);if(!f||!(has(f,'ADVANCED_FACE')||has(f,'FACE_SURFACE')))continue;const fa=f.args,S=get(ref(fa[2]));if(!S)continue;
      const kind=has(S,'B_SPLINE_SURFACE_WITH_KNOTS')?'bspline':S.kind.replace(/_SURFACE.*$/,'').toLowerCase().replace(/^b_spline.*/,'bspline');const face={kind,verts:[],edges:[],sense:!/\.F\./.test(fa[3]||'')};
      if(kind==='bspline')face.S=S;
      if(S.args[1]&&ref(S.args[1])!=null&&!/BOUNDED|B_SPLINE|OFFSET|REVOLUTION|EXTRUSION/.test(S.kind))face.ax=axis(ref(S.args[1]));
      if(has(S,'CYLINDRICAL_SURFACE')||has(S,'SPHERICAL_SURFACE')||has(S,'CONICAL_SURFACE'))face.r=parseFloat(S.args[2])*unitScale;
      if(has(S,'TOROIDAL_SURFACE')){face.R=parseFloat(S.args[2])*unitScale;face.r=parseFloat(S.args[3])*unitScale;}
      for(const bid of refs(fa[1])){const b=get(bid);if(!b)continue;const loop=get(ref(b.args[1]));if(!loop||!loop.args[1])continue;
        for(const oid of refs(loop.args[1])){const oe=get(oid);if(!oe)continue;const ec=get(ref(oe.args[3]));if(!has(ec,'EDGE_CURVE'))continue;
          const v1=vertex(ref(ec.args[1])),v2=vertex(ref(ec.args[2])),cv=get(ref(ec.args[3])),same=!/\.F\./.test(ec.args[4]||'');
          if(v1)face.verts.push(v1);if(v2)face.verts.push(v2);
          if(has(cv,'CIRCLE')){const ax=axis(ref(A(cv,'CIRCLE')[1])),cr=parseFloat(A(cv,'CIRCLE')[2])*unitScale;if(ax){face.edges.push({ax,r:cr,v1,v2,same});ext.push({c:ax.o,n:ax.z,r:cr});}}}}
      face.verts.forEach(v=>verts.push(v));types[kind]=(types[kind]||0)+1;faces.push(face);}
    // box from vertices plus the full extent of every circular edge (a round part's seam vertices sit on one side)
    let bbox=null;if(verts.length){bbox={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};const grow=(k,v)=>{bbox.min[k]=Math.min(bbox.min[k],v);bbox.max[k]=Math.max(bbox.max[k],v);};
      for(const v of verts)for(let k=0;k<3;k++)grow(k,v[k]);
      for(const c of ext)for(let k=0;k<3;k++){const s=c.r*Math.sqrt(Math.max(0,1-c.n[k]*c.n[k]));grow(k,c.c[k]-s);grow(k,c.c[k]+s);}}
    return{id,name:str(e.args[0]),faces,types,bbox,nVerts:verts.length};}

  // skin pieces of a swept solid: lines from cylinders, arcs from tori. The pipe radius is the one carrying the
  // most length (end beads, bosses and the bore carry less); the bore is the next radius with comparable length
  function solidPieces(sol){
    const groups=new Map(),keyOf=r=>{for(const k of groups.keys())if(Math.abs(k-r)<=Math.max(0.01,0.001*r))return k;return +r.toFixed(3);};
    const span=(f)=>{if(f.edges.some(e=>e.v1&&e.v2&&len(sub(e.v1,e.v2))<1e-6))return TAU;const c=f.ax.o,u=f.ax.x,v=f.ax.y;
      const as=f.verts.map(p=>{const d=sub(p,c);return mod(Math.atan2(dot(d,v),dot(d,u)));}).sort((a,b)=>a-b);if(as.length<2)return TAU;
      let gap=TAU-as[as.length-1]+as[0];for(let i=1;i<as.length;i++)gap=Math.max(gap,as[i]-as[i-1]);return TAU-gap;};
    let splineFaces=0;
    for(const f of sol.faces){let pc=null,r=f.r;
      if(f.kind==='bspline'&&f.S){const s=bsSurf(f.S);const tb=s&&tubeOfSurface(s,1);if(!tb)continue;r=tb.r;pc=mkPoly(tb.pts,'',tb.cov);if(pc)splineFaces++;}
      else{if(!f.ax||!(f.r>0))continue;
      if(f.kind==='cylindrical'){const c=f.ax.o,n=f.ax.z;let t0=Infinity,t1=-Infinity;for(const v of f.verts){const t=dot(sub(v,c),n);t0=Math.min(t0,t);t1=Math.max(t1,t);}
        if(t1-t0>1e-6){pc=mkLine(add(c,mul(n,t0)),add(c,mul(n,t1)));pc.cov=span(f);}}
      else if(f.kind==='toroidal'&&f.R>0){const c=f.ax.o,n=f.ax.z,u=f.ax.x,v=f.ax.y,ang=p=>{const d=sub(p,c);return Math.atan2(dot(d,v),dot(d,u));};
        let span=null;
        for(const ed of f.edges){if(!ed.v1||!ed.v2||Math.abs(dot(ed.ax.z,n))<0.999)continue;        // longitudinal arcs run around the bend
          const s=ed.same?ed.v1:ed.v2,t=ed.same?ed.v2:ed.v1,flip=dot(ed.ax.z,n)<0;
          const a0=ang(flip?t:s),th0=mod(ang(flip?s:t)-a0);span={a0,th:th0<1e-9?TAU:th0};break;}
        if(!span){const as=f.verts.map(ang);if(!as.length)continue;for(const a of as){const th=Math.max(...as.map(b=>mod(b-a)));if(!span||th<span.th)span={a0:a,th};}}
        pc=mkArc(c,n,f.R,add(c,add(mul(u,f.R*Math.cos(span.a0)),mul(v,f.R*Math.sin(span.a0)))),span.th,'');}}
      if(!pc)continue;const key=keyOf(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pc);}
    if(!groups.size)return null;
    const G=[...groups.entries()].map(([r,ps])=>{const pieces=merge(dedupe(ps,0.05));return{r,pieces,total:pieces.reduce((s,p)=>s+p.len,0)};}).sort((a,b)=>b.total-a.total);
    const big=G.filter(g=>g.total>=0.6*G[0].total).sort((a,b)=>b.r-a.r),main=big[0],bore=big[1];
    const cv=main.pieces.filter(p=>p.type!=='arc'),covLen=cv.reduce((s,p)=>s+p.len,0),cover=covLen?cv.reduce((s,p)=>s+p.len*(p.cov==null?TAU:p.cov),0)/covLen:TAU;
    return{ro:main.r,ri:bore?bore.r:0,pieces:main.pieces,cover,splineFaces,radii:G.map(g=>({r:g.r,total:g.total}))};}

  // ---- products, shape reps ----
  const products=new Map();
  for(const id of list('PRODUCT_DEFINITION')){const e=get(id),a=A(e,'PRODUCT_DEFINITION'),pf=get(ref(a[2])),pr=pf?get(ref(pf.args[2])):null,pa=pr?A(pr,'PRODUCT'):null;
    products.set(id,{pd:id,name:pa?(str(pa[1])||str(pa[0])):'#'+id,pid:pa?str(pa[0]):'',reps:[]});}
  for(const id of list('SHAPE_DEFINITION_REPRESENTATION')){const a=get(id).args,pds=get(ref(a[0]));if(!pds)continue;const P=products.get(ref(pds.args[2]));if(P)P.reps.push(ref(a[1]));}
  const srr=new Map(),link=(a,b)=>{if(a==null||b==null)return;if(!srr.has(a))srr.set(a,new Set());srr.get(a).add(b);};
  for(const id of list('SHAPE_REPRESENTATION_RELATIONSHIP')){const e=get(id);if(has(e,'REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION'))continue;
    let a=e.argsOf.SHAPE_REPRESENTATION_RELATIONSHIP;if(!a||a.length<4)a=e.argsOf.REPRESENTATION_RELATIONSHIP;if(!a)continue;link(ref(a[2]),ref(a[3]));link(ref(a[3]),ref(a[2]));}
  const repOwner=new Map();for(const P of products.values()){const seen=new Set(),q=P.reps.slice();while(q.length){const r=q.pop();if(seen.has(r))continue;seen.add(r);for(const x of(srr.get(r)||[]))q.push(x);}P.reps=[...seen];P.reps.forEach(r=>repOwner.set(r,P.pd));}

  const partCache=new Map();
  function part(pd){if(partCache.has(pd))return partCache.get(pd);const P=products.get(pd);
    const items=[];for(const r of P.reps){const e=get(r);if(!e)continue;const k=e.kinds.find(k=>/REPRESENTATION$/.test(k));if(!k)continue;const a=e.argsOf[k];if(a&&a[1]&&a[1][0]==='(')items.push(...refs(a[1]));}
    const g={name:P.name,pd,csys:[],points:[],curves:[],solids:[]},seen=new Set();
    const take=id=>{if(seen.has(id))return;seen.add(id);const e=get(id);if(!e)return;
      if(has(e,'AXIS2_PLACEMENT_3D')){const ax=axis(id);if(ax&&ax.name)g.csys.push(ax);}
      else if(has(e,'CARTESIAN_POINT')){const nm=str(e.args[0]);const p=point(id);if(nm&&p)g.points.push({name:nm,p});}
      else if(has(e,'GEOMETRIC_SET')||has(e,'GEOMETRIC_CURVE_SET'))refs(A(e,e.kinds.find(k=>/GEOMETRIC/.test(k)))[1]).forEach(take);
      else if(has(e,'TRIMMED_CURVE')||has(e,'B_SPLINE_CURVE_WITH_KNOTS')||has(e,'COMPOSITE_CURVE'))g.curves.push(...curveItem(id));
      else if(has(e,'MANIFOLD_SOLID_BREP')||has(e,'BREP_WITH_VOIDS')){const s=solid(id);if(s)g.solids.push(s);}};
    items.forEach(take);
    const pr=pipeOf(g);g.pipe=pr.pipe;g.pipeWhy=pr.why;g.pipeForced=pr.forced;g.pipeBest=pr.best||null;partCache.set(pd,g);return g;}

  // the swept solid: longest recoverable centreline; cylinders + tori (+ end planes), or tube-shaped spline faces for a hose.
  // force[name]===true takes the best candidate whatever its size; false skips the part. why = reason it is (not) a pipe
  function pipeOf(g){const cand=[],f=force[g.name];
    if(f===false)return{pipe:null,why:'marked “not a pipe”',forced:false};
    for(const sol of g.solids){const sp=solidPieces(sol);if(!sp||!sp.pieces.length)continue;
      const hose=sp.pieces.some(p=>p.type==='poly'),okTypes=['plane','cylindrical','toroidal'].concat(hose?['bspline']:[]);
      const odd=Object.keys(sol.types).filter(k=>!okTypes.includes(k));
      const ch=chain(sp.pieces,0.05,false),d=describe(ch);if(!d)continue;
      cand.push({sol,sp,ch,d,odd,hose,score:d.length/(2*sp.ro)+(d.bends.length||hose?20:0)-(odd.length?30:0)});}
    cand.sort((a,b)=>b.score-a.score);const b=cand[0];
    let curve=null;
    if(g.curves.length){const ch=chain(dedupe(g.curves.map(c=>({...c})),0.02),0.05,true),d=describe(ch);if(d)curve={chain:ch,info:d};}
    const why=!b?(g.solids.length?'no cylinder, torus or tube-shaped spline face':'no solid'):
      b.sp.ro<1.5?`too thin (Ø${(2*b.sp.ro).toFixed(1)})`:b.d.length<100?`too short (${b.d.length.toFixed(0)} mm)`:b.d.length<16*b.sp.ro?`too stubby (${b.d.length.toFixed(0)} mm for Ø${(2*b.sp.ro).toFixed(1)})`:
      b.sp.cover<0.75*Math.PI?`only part of a tube (${(b.sp.cover*DEG).toFixed(0)}° round, e.g. an edge round)`:(b.odd.length&&b.d.bends.length<2&&!b.hose&&b.d.length<300)?`fitting-like (has ${b.odd.join(', ')} faces)`:'';
    if(!b){if(f===true&&curve)return{pipe:{solid:null,OD:0,ID:0,chain:curve.chain,info:curve.info,curve:null,candidates:0,odd:[],hose:curve.info.kind==='hose',fromCurve:true},why:'marked “pipe”: centreline from the datum curve (no tube faces)',forced:true};
      return{pipe:null,why,forced:f};}
    if(why&&f!==true)return{pipe:null,why,forced:f,best:{OD:2*b.sp.ro,length:b.d.length}};
    if(curve){const S=sample(curve.chain,2).pts;curve.maxErr=Math.max(...S.map(q=>nearest(b.ch,q).d));}
    return{pipe:{solid:b.sol,OD:2*b.sp.ro,ID:2*b.sp.ri,chain:b.ch,info:b.d,curve:curve&&curve.info.length>b.d.length*0.5?curve:null,candidates:cand.length,odd:b.odd,hose:b.hose,cover:b.sp.cover},
      why:f===true?(why?`marked “pipe” (on its own: ${why})`:'marked “pipe”'):'',forced:f};}

  // ---- assembly tree ----
  const nauos=list('NEXT_ASSEMBLY_USAGE_OCCURRENCE').map(id=>{const a=get(id).args;return{id,name:str(a[1])||str(a[0]),parent:ref(a[3]),child:ref(a[4]),M:null};});
  for(const id of list('CONTEXT_DEPENDENT_SHAPE_REPRESENTATION')){const a=get(id).args,rr=get(ref(a[0])),pds=get(ref(a[1]));if(!rr||!pds)continue;
    const nauo=nauos.find(n=>n.id===ref(pds.args[2]));if(!nauo)continue;
    const ta=rr.argsOf.REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION,idt=ta?get(ref(ta[0])):null;if(!idt||!has(idt,'ITEM_DEFINED_TRANSFORMATION'))continue;
    const ax1=axis(ref(idt.args[2])),ax2=axis(ref(idt.args[3])),ra=rr.argsOf.REPRESENTATION_RELATIONSHIP||rr.args;
    const childIs1=repOwner.get(ref(ra[2]))===nauo.child;const axC=childIs1?ax1:ax2,axP=childIs1?ax2:ax1;
    if(axC&&axP)nauo.M=F.compose(axP,F.inv(axC));}
  const instances=[];
  function build(pd,M,path,depth,parentIdx){const P=products.get(pd),inst={pd,name:P.name,M,path,depth,parent:parentIdx,children:[]};const idx=instances.push(inst)-1;
    if(depth<40)for(const n of nauos)if(n.parent===pd)inst.children.push(build(n.child,n.M?F.compose(M,n.M):M,path.concat(products.get(n.child).name),depth+1,idx));
    return idx;}
  const roots=[...products.keys()].filter(pd=>products.get(pd).reps.length&&!nauos.some(n=>n.child===pd));
  roots.forEach(pd=>build(pd,F.id(),[products.get(pd).name],0,-1));

  // ---- world data ----
  const csys=[],points=[],pipes=[];
  const bboxWorld=(M,b)=>{const o={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(let i=0;i<8;i++){const p=F.pt(M,[i&1?b.max[0]:b.min[0],i&2?b.max[1]:b.min[1],i&4?b.max[2]:b.min[2]]);for(let k=0;k<3;k++){o.min[k]=Math.min(o.min[k],p[k]);o.max[k]=Math.max(o.max[k],p[k]);}}return o;};
  instances.forEach((inst,idx)=>{const g=part(inst.pd);inst.part=g;inst.label=inst.path.slice(1).join(' / ')||g.name;
    inst.csys=g.csys.map(c=>({name:c.name,o:F.pt(inst.M,c.o),x:F.vec(inst.M,c.x),y:F.vec(inst.M,c.y),z:F.vec(inst.M,c.z),inst:idx}));
    inst.points=g.points.map(p=>({name:p.name,p:F.pt(inst.M,p.p),inst:idx}));
    inst.solids=g.solids.length;inst.bbox=null;g.solids.forEach(s=>{if(!s.bbox)return;const w=bboxWorld(inst.M,s.bbox);if(!inst.bbox)inst.bbox=w;else for(let k=0;k<3;k++){inst.bbox.min[k]=Math.min(inst.bbox.min[k],w.min[k]);inst.bbox.max[k]=Math.max(inst.bbox.max[k],w.max[k]);}});
    csys.push(...inst.csys);points.push(...inst.points);
    if(g.pipe){const ch={pieces:g.pipe.chain.pieces.map(p=>xformPiece(inst.M,p)),length:g.pipe.chain.length,leftover:g.pipe.chain.leftover},info=describe(ch);
      pipes.push({inst:idx,name:g.name,label:inst.label,OD:g.pipe.OD,ID:g.pipe.ID,R:info.R,chain:ch,info,Q:info.Q,bends:info.bends,length:info.length,kind:info.kind,
        forced:g.pipeForced===true,fromCurve:!!g.pipe.fromCurve,
        curveAgree:g.pipe.curve?g.pipe.curve.maxErr:null,candidates:g.pipe.candidates,odd:g.pipe.odd,samples:sample(ch,Math.max(2,g.pipe.OD/4||2))});}});

  // fixings: a hole (cylinder face whose normal points at its axis) with a named CSYS origin on the axis, inside the hole.
  // The bore axis and length come from the hole faces, never from the CSYS axes.
  const fixings=[];
  instances.forEach((inst,idx)=>{if(pipes.some(p=>p.inst===idx))return;
    inst.part.solids.forEach(sol=>{const groups=[];
      for(const f of sol.faces){if(f.kind!=='cylindrical'||!f.ax||f.sense||!(f.r>0)||!f.verts.length)continue;
        const c=F.pt(inst.M,f.ax.o),d=norm(F.vec(inst.M,f.ax.z));let t0=Infinity,t1=-Infinity;
        for(const v of f.verts){const t=dot(sub(F.pt(inst.M,v),c),d);t0=Math.min(t0,t);t1=Math.max(t1,t);}if(!(t1-t0>1e-6))continue;
        let g=groups.find(g=>Math.abs(dot(g.d,d))>0.99999&&len(sub(sub(c,g.c),mul(g.d,dot(sub(c,g.c),g.d))))<0.05);
        if(!g){g={c,d,faces:[]};groups.push(g);}
        const s=dot(sub(c,g.c),g.d),sg=dot(d,g.d)>0?1:-1,a=s+sg*t0,b=s+sg*t1;g.faces.push({r:f.r,t0:Math.min(a,b),t1:Math.max(a,b)});}
      for(const g of groups){const rmin=Math.min(...g.faces.map(f=>f.r)),bore=g.faces.filter(f=>Math.abs(f.r-rmin)<1e-6);
        const t0=Math.min(...bore.map(f=>f.t0)),t1=Math.max(...bore.map(f=>f.t1)),c=add(g.c,mul(g.d,(t0+t1)/2)),L=t1-t0;
        const on=csys.filter(cs=>{const v=sub(cs.o,c),u=dot(v,g.d);return len(sub(v,mul(g.d,u)))<0.5&&Math.abs(u)<=L/2+1;}).sort((a,b)=>(b.inst===idx)-(a.inst===idx));
        if(!on.length)continue;
        fixings.push({inst:idx,name:inst.name,label:inst.label,csys:on[0].name,c,d:g.d,r:rmin,D:2*rmin,length:L});}});});

  // which named frame a .pts file is written in: the one that lands its points on the centreline or its corners
  function matchFrame(pts,pipe){let best=null;
    const cands=[{name:'file origin',M:F.id()}].concat(csys.map(c=>({name:c.name,M:{o:c.o,x:c.x,y:c.y,z:c.z}})));
    const distQ=p=>Math.min(...pipe.Q.map(q=>len(sub(q,p))));
    for(const c of cands){const errs=pts.map(p=>{const w=F.pt(c.M,p);return Math.min(nearest(pipe.chain,w).d,distQ(w));}).sort((a,b)=>a-b);
      const err=errs[Math.floor((errs.length-1)/2)];if(!best||err<best.err)best={frame:c.name,M:c.M,err,errs};}
    return best;}

  // the clamps that matter for one pipe: bore fits its OD (±1.5 mm), not its own end fitting, not holding another pipe
  function clampsFor(pi){const p=pipes[pi];if(!p)return[];
    const through=(q,x)=>{const v=nearest(q.chain,x.c);return v.d<=0.5;};
    return fixings.map((x,i)=>{const dist=nearest(p.chain,x.c).d,fits=Math.abs(x.D-p.OD)<=1.5,passes=dist<=0.5;
      const end=passes&&Math.min(len(sub(x.c,p.info.start)),len(sub(x.c,p.info.end)))<x.length/2+p.OD;
      const other=pipes.find((q,j)=>j!==pi&&through(q,x));
      return{i,fix:x,dist,fits,passes,end,holds:other?other.name:null,use:fits&&!end&&!other};})
      .filter(c=>c.fits).sort((a,b)=>(b.use-a.use)||(a.dist-b.dist));}

  return{product,units,degrees,entities:E.size,products:[...products.values()].map(P=>({pd:P.pd,name:P.name,pid:P.pid})),instances,csys,points,pipes,fixings,clampsFor,
    matchFrame,toFrame:F.toLocal,fromFrame:F.pt,nearest,debug:{solidPieces,part},
    summary:{parts:products.size,instances:instances.length,solids:instances.reduce((s,i)=>s+i.solids,0),pipes:pipes.length,fixings:fixings.length,csys:csys.length,points:points.length}};
}

const API={parse,chain,describe,sample,nearest,F};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.StepAsm=API;
})(typeof globalThis!=="undefined"?globalThis:this);
