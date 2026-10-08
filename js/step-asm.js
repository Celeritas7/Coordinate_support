/* step-asm.js — Creo assembly STEP reader (AP203 / AP214).
 * Product tree with placements, named datums per instance, solids per part, and the centreline of swept
 * pipes / hoses: cylinder axes + torus centre circles chained end to end (exact bend radius = torus major R),
 * cross-checked against the part's datum curves when Creo exported them.
 * No DOM. Browser: window.StepAsm. Node: require('./step-asm.js').
 */
(function factory(root) {
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
function tokenize(text,progress){
  const ents=new Map(),s=String(text),n=s.length;let i=s.indexOf('DATA;');if(i<0)i=0;let next=1<<20;
  for(;;){
    if(progress&&i>next){progress('Reading entities',i/n);next=i+(1<<20);}
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
// every #id in an entity, quoted strings removed first: names like 'Placement #0' are not references
const rawRefs=raw=>{const out=[],t=raw.replace(/'(?:[^']|'')*'/g,"''"),re=/#(\d+)/g;let m;while((m=re.exec(t)))out.push(+m[1]);return out;};
const nums=a=>(a||'').replace(/^\(|\)$/g,'').split(',').map(parseFloat);

// ---------- pieces: lines and arcs with end tangents ----------
function mkLine(a,b,name){const t=norm(sub(b,a));return{type:'line',a,b,ta:t,tb:t,len:len(sub(b,a)),name:name||''};}
// arc from a, rotating about n (unit) by th (counter-clockwise, 0<th<=2pi) with centre c and radius R
function mkArc(c,n,R,a,th,name){const u=sub(a,c),w=cross(n,u);
  const b=add(c,add(mul(u,Math.cos(th)),mul(w,Math.sin(th))));
  return{type:'arc',c,n,R,a,b,th,ta:norm(w),tb:norm(cross(n,sub(b,c))),len:R*th,name:name||''};}
function reverse(p){return p.type==='line'?{...p,a:p.b,b:p.a,ta:mul(p.tb,-1),tb:mul(p.ta,-1)}:{...p,a:p.b,b:p.a,n:mul(p.n,-1),ta:mul(p.tb,-1),tb:mul(p.ta,-1)};}
function xformPiece(M,p){const o={...p,a:F.pt(M,p.a),b:F.pt(M,p.b),ta:F.vec(M,p.ta),tb:F.vec(M,p.tb)};if(p.type==='arc'){o.c=F.pt(M,p.c);o.n=F.vec(M,p.n);}return o;}
function dedupe(pieces,tol){const out=[];
  for(const p of pieces){if(out.some(q=>q.type===p.type&&((len(sub(q.a,p.a))<=tol&&len(sub(q.b,p.b))<=tol)||(len(sub(q.a,p.b))<=tol&&len(sub(q.b,p.a))<=tol))))continue;out.push(p);}
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
    for(const [s,e] of m)if(e-s>1e-6)out.push(mkLine(add(o,mul(d,s)),add(o,mul(d,e)),L.name));});
  return out;}

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
  const inner=P.slice(1,-1).filter(p=>p.type==='line').map(p=>p.len);
  return{Q,bends,start:P[0].a,end:P[P.length-1].b,startDir:P[0].ta,endDir:P[P.length-1].tb,length:ch.length,
    R:bends.length?Math.min(...bends.map(b=>b.R)):Infinity,minStraight:inner.length?Math.min(...inner):Infinity,straights:P.filter(p=>p.type==='line').length};
}
// dense samples in route-studio's run shape {pts,k,s,d1s,d2s}: exact curvature
function sample(ch,step){
  step=step||10;const pts=[],k=[],d1s=[],d2s=[],STRAIGHT=1e-9;
  const push=(p,kk,d1,d2)=>{pts.push(p);k.push(kk);d1s.push(d1);d2s.push(d2);};
  ch.pieces.forEach((pc,j)=>{
    if(pc.type==='line'){const N=Math.max(1,Math.ceil(pc.len/step)),d=sub(pc.b,pc.a);for(let i=j?1:0;i<=N;i++)push(add(pc.a,mul(d,i/N)),STRAIGHT,pc.ta,[0,0,0]);}
    else{const N=Math.max(2,Math.ceil(pc.th*DEG/3)),u=sub(pc.a,pc.c),w=cross(pc.n,u);
      for(let i=j?1:0;i<=N;i++){const f=pc.th*i/N,p=add(pc.c,add(mul(u,Math.cos(f)),mul(w,Math.sin(f))));
        push(p,1/pc.R,norm(add(mul(u,-Math.sin(f)),mul(w,Math.cos(f)))),mul(norm(sub(pc.c,p)),1/pc.R));}}});
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+len(sub(pts[i],pts[i-1])));
  return{pts,k,s,d1s,d2s};
}
// nearest point on the centreline to p
function nearest(ch,p){let bd=Infinity,bq=null;
  for(const pc of ch.pieces){let q;
    if(pc.type==='line'){const d=sub(pc.b,pc.a),L2=dot(d,d),t=L2?Math.max(0,Math.min(1,dot(sub(p,pc.a),d)/L2)):0;q=add(pc.a,mul(d,t));}
    else{const u=norm(sub(pc.a,pc.c)),w=cross(pc.n,u),r=sub(p,pc.c),rp=sub(r,mul(pc.n,dot(r,pc.n)));
      let f=len(rp)<1e-9?0:mod(Math.atan2(dot(rp,w),dot(rp,u)));if(f>pc.th)f=(f-pc.th<(TAU-pc.th)/2)?pc.th:0;
      q=add(pc.c,add(mul(u,pc.R*Math.cos(f)),mul(w,pc.R*Math.sin(f))));}
    const d=len(sub(p,q));if(d<bd){bd=d;bq=q;}}
  return{q:bq,d:bd};
}

// ---------- main ----------
// opts.progress(stage, fraction 0..1); opts.cloudStep: edge sample spacing in mm (default 5)
function parse(text,opts){
  opts=opts||{};const progress=opts.progress||null,STEP=opts.cloudStep>0?opts.cloudStep:5;
  const E=tokenize(text,progress);const get=id=>{const e=E.get(id);return e?decode(e):null;};
  const has=(e,k)=>!!e&&e.kinds.includes(k),A=(e,k)=>e.argsOf[k]||e.args;
  const byKind=new Map();let nd=0;
  for(const [id,e] of E){decode(e);for(const k of e.kinds){if(!byKind.has(k))byKind.set(k,[]);byKind.get(k).push(id);}
    if(progress&&++nd%20000===0)progress('Decoding entities',nd/E.size);}
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
    return null;}

  function solid(id){const e=get(id),sh=get(ref(e.args[1]));if(!sh)return null;const faces=[],types={},verts=[],ext=[];
    for(const fid of refs(sh.args[1])){const f=get(fid);if(!f||!(has(f,'ADVANCED_FACE')||has(f,'FACE_SURFACE')))continue;const fa=f.args,S=get(ref(fa[2]));if(!S)continue;
      const kind=S.kind.replace(/_SURFACE.*$/,'').toLowerCase().replace(/^b_spline.*/,'bspline');const face={kind,verts:[],edges:[],sense:!/\.F\./.test(fa[3]||'')};
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


  // ---------- edge cloud: every EDGE_CURVE of a part sampled about every STEP mm ----------
  // Lines, trimmed circles and ellipses, B-spline curves (rational too). Enough for clearance; faces are not meshed.
  const DESCEND=new Set(['MANIFOLD_SOLID_BREP','BREP_WITH_VOIDS','SHELL_BASED_SURFACE_MODEL','FACE_BASED_SURFACE_MODEL','CLOSED_SHELL','OPEN_SHELL',
    'ORIENTED_CLOSED_SHELL','ORIENTED_OPEN_SHELL','CONNECTED_FACE_SET','ADVANCED_FACE','FACE_SURFACE','FACE_OUTER_BOUND','FACE_BOUND','EDGE_LOOP','ORIENTED_EDGE']);
  function edgeIds(roots){const out=new Set(),seen=new Set(),st=roots.slice();
    while(st.length){const id=st.pop();if(seen.has(id))continue;seen.add(id);const e=get(id);if(!e)continue;
      if(has(e,'EDGE_CURVE')){out.add(id);continue;}
      if(!e.kinds.some(k=>DESCEND.has(k)))continue;
      for(const r of rawRefs(e.raw))if(!seen.has(r))st.push(r);}
    return out;}
  // SURFACE_CURVE / SEAM_CURVE wrap the 3D curve
  const curveOf=id=>{let c=get(id);for(let n=0;n<4&&c;n++){const w=c.kinds.find(k=>k==='SURFACE_CURVE'||k==='SEAM_CURVE'||k==='INTERSECTION_CURVE');if(!w)break;c=get(ref(c.argsOf[w][1]));}return c;};
  function bsplinePts(c){
    const W=c.argsOf.B_SPLINE_CURVE_WITH_KNOTS,base=c.argsOf.B_SPLINE_CURVE;let deg,cps,mults,knots,w=null;
    if(base&&W){deg=+base[0];cps=refs(base[1]);mults=nums(W[0]);knots=nums(W[1]);const R=c.argsOf.RATIONAL_B_SPLINE_CURVE;if(R)w=nums(R[0]);}
    else if(W){deg=+W[1];cps=refs(W[2]);mults=nums(W[6]);knots=nums(W[7]);}else return null;
    const P=cps.map(point);if(!(deg>=1)||P.length<2||P.some(p=>!p))return null;
    const U=[];mults.forEach((m,i)=>{for(let k=0;k<m;k++)U.push(knots[i]);});
    const n=P.length-1,p=deg;if(U.length!==n+p+2||(w&&w.length!==P.length))return null;
    const at=t=>{let k=p;while(k<n&&U[k+1]<=t)k++;const d=[];
      for(let j=0;j<=p;j++){const q=P[k-p+j],ww=w?w[k-p+j]:1;d.push([q[0]*ww,q[1]*ww,q[2]*ww,ww]);}
      for(let r=1;r<=p;r++)for(let j=p;j>=r;j--){const i=k-p+j,den=U[i+p-r+1]-U[i],a=den?(t-U[i])/den:0;for(let m=0;m<4;m++)d[j][m]=(1-a)*d[j-1][m]+a*d[j][m];}
      const h=d[p];return[h[0]/h[3],h[1]/h[3],h[2]/h[3]];};
    let L=0;for(let i=1;i<P.length;i++)L+=len(sub(P[i],P[i-1]));
    const N=Math.min(400,Math.max(8,Math.ceil(L/STEP))),t0=U[p],t1=U[n+1],o=[];for(let i=0;i<=N;i++)o.push(at(t0+(t1-t0)*i/N));return o;}
  function sampleEdge(id){const a=get(id).args,v1=vertex(ref(a[1])),v2=vertex(ref(a[2])),same=!/\.F\./.test(a[4]||''),c=curveOf(ref(a[3]));
    const seg=(p,q)=>{const N=Math.min(400,Math.max(1,Math.ceil(len(sub(q,p))/STEP))),o=[];for(let i=0;i<=N;i++)o.push(add(p,mul(sub(q,p),i/N)));return o;};
    const straight=()=>v1&&v2?seg(v1,v2):v1?[v1]:[];
    if(!c||has(c,'LINE'))return straight();
    if(has(c,'CIRCLE')||has(c,'ELLIPSE')){const k=has(c,'CIRCLE')?'CIRCLE':'ELLIPSE',ca=A(c,k),ax=axis(ref(ca[1]));if(!ax)return straight();
      const ra=parseFloat(ca[2])*unitScale,rb=k==='ELLIPSE'?parseFloat(ca[3])*unitScale:ra;if(!(ra>0&&rb>0))return straight();
      const ang=q=>{const d=sub(q,ax.o);return Math.atan2(dot(d,ax.y)/rb,dot(d,ax.x)/ra);};
      // the curve runs counter-clockwise about its axis; a reversed edge (same_sense .F.) covers v2 -> v1
      let a0=v1?ang(v1):0,th=TAU;if(v1&&v2&&len(sub(v1,v2))>1e-6){const s=same?v1:v2,e=same?v2:v1;a0=ang(s);th=mod(ang(e)-a0);if(th<1e-9)th=TAU;}
      const N=Math.min(400,Math.max(8,Math.ceil(th*Math.max(ra,rb)/STEP))),o=[];
      for(let i=0;i<=N;i++){const f=a0+th*i/N;o.push(add(ax.o,add(mul(ax.x,ra*Math.cos(f)),mul(ax.y,rb*Math.sin(f)))));}return o;}
    if(has(c,'B_SPLINE_CURVE_WITH_KNOTS')){const P=bsplinePts(c);if(!P)return straight();
      if(v1&&v2&&len(sub(v1,v2))>1e-6){const near=v=>{let bi=0,bd=Infinity;P.forEach((q,i)=>{const d=len(sub(q,v));if(d<bd){bd=d;bi=i;}});return bi;};
        const i1=near(v1),i2=near(v2);return[v1].concat(P.slice(Math.min(i1,i2)+1,Math.max(i1,i2)),[v2]);}
      return P;}
    return straight();}
  function partCloud(roots){const ids=edgeIds(roots),arr=[];for(const id of ids)for(const p of sampleEdge(id))arr.push(p[0],p[1],p[2]);return{cloud:Float64Array.from(arr),edges:ids.size};}

  // skin pieces of a swept solid: lines from cylinders, arcs from tori. The pipe radius is the one carrying the
  // most length (end beads, bosses and the bore carry less); the bore is the next radius with comparable length
  function solidPieces(sol){
    const groups=new Map();
    for(const f of sol.faces){if(!f.ax||!(f.r>0))continue;let pc=null;
      if(f.kind==='cylindrical'){const c=f.ax.o,n=f.ax.z;let t0=Infinity,t1=-Infinity;for(const v of f.verts){const t=dot(sub(v,c),n);t0=Math.min(t0,t);t1=Math.max(t1,t);}
        if(t1-t0>1e-6)pc=mkLine(add(c,mul(n,t0)),add(c,mul(n,t1)));}
      else if(f.kind==='toroidal'&&f.R>0){const c=f.ax.o,n=f.ax.z,u=f.ax.x,v=f.ax.y,ang=p=>{const d=sub(p,c);return Math.atan2(dot(d,v),dot(d,u));};
        let span=null;
        for(const ed of f.edges){if(!ed.v1||!ed.v2||Math.abs(dot(ed.ax.z,n))<0.999)continue;        // longitudinal arcs run around the bend
          const s=ed.same?ed.v1:ed.v2,t=ed.same?ed.v2:ed.v1,flip=dot(ed.ax.z,n)<0;
          const a0=ang(flip?t:s),th0=mod(ang(flip?s:t)-a0);span={a0,th:th0<1e-9?TAU:th0};break;}
        if(!span){const as=f.verts.map(ang);if(!as.length)continue;for(const a of as){const th=Math.max(...as.map(b=>mod(b-a)));if(!span||th<span.th)span={a0:a,th};}}
        pc=mkArc(c,n,f.R,add(c,add(mul(u,f.R*Math.cos(span.a0)),mul(v,f.R*Math.sin(span.a0)))),span.th,'');}
      if(!pc)continue;const key=+f.r.toFixed(3);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pc);}
    if(!groups.size)return null;
    const G=[...groups.entries()].map(([r,ps])=>{const pieces=merge(dedupe(ps,0.02));return{r,pieces,total:pieces.reduce((s,p)=>s+p.len,0)};}).sort((a,b)=>b.total-a.total);
    const big=G.filter(g=>g.total>=0.6*G[0].total).sort((a,b)=>b.r-a.r),main=big[0],bore=big[1];
    return{ro:main.r,ri:bore?bore.r:0,pieces:main.pieces,radii:G.map(g=>({r:g.r,total:g.total}))};}

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
    const g={name:P.name,pd,csys:[],points:[],curves:[],solids:[]},seen=new Set(),shells=[];
    const take=id=>{if(seen.has(id))return;seen.add(id);const e=get(id);if(!e)return;
      if(has(e,'AXIS2_PLACEMENT_3D')){const ax=axis(id);if(ax&&ax.name)g.csys.push(ax);}
      else if(has(e,'CARTESIAN_POINT')){const nm=str(e.args[0]);const p=point(id);if(nm&&p)g.points.push({name:nm,p});}
      else if(has(e,'GEOMETRIC_SET')||has(e,'GEOMETRIC_CURVE_SET'))refs(A(e,e.kinds.find(k=>/GEOMETRIC/.test(k)))[1]).forEach(take);
      else if(has(e,'TRIMMED_CURVE')){const c=trimmed(id);if(c)g.curves.push(c);}
      else if(has(e,'MANIFOLD_SOLID_BREP')||has(e,'BREP_WITH_VOIDS')){const s=solid(id);if(s)g.solids.push(s);shells.push(id);}
      else if(has(e,'SHELL_BASED_SURFACE_MODEL')||has(e,'FACE_BASED_SURFACE_MODEL'))shells.push(id);};
    items.forEach(take);
    const pc=partCloud(shells);g.cloud=pc.cloud;g.edges=pc.edges;
    g.pipe=pipeOf(g);partCache.set(pd,g);return g;}

  // the swept solid: longest recoverable centreline, cylinders + tori (+ end planes) only scores best
  function pipeOf(g){const cand=[];
    for(const sol of g.solids){const sp=solidPieces(sol);if(!sp||!sp.pieces.length)continue;
      const odd=Object.keys(sol.types).filter(k=>!['plane','cylindrical','toroidal'].includes(k));
      const ch=chain(sp.pieces,0.05,false),d=describe(ch);if(!d)continue;
      cand.push({sol,sp,ch,d,odd,score:d.length/(2*sp.ro)+(d.bends.length?20:0)-(odd.length?30:0)});}
    cand.sort((a,b)=>b.score-a.score);const b=cand[0];
    // a pipe: at least 3 mm across, 100 mm long and 8 diameters long; chamfers/threads (cones, splines) only on a clearly long or bent one
    if(!b||b.sp.ro<1.5||b.d.length<100||b.d.length<16*b.sp.ro||(b.odd.length&&b.d.bends.length<2&&b.d.length<300))return null;
    let curve=null;
    if(g.curves.length){const ch=chain(dedupe(g.curves.map(c=>({...c})),0.02),0.05,true),d=describe(ch);
      if(d&&d.length>b.d.length*0.5){const err=Math.max(...d.Q.map(q=>Math.min(...b.d.Q.map(p=>len(sub(p,q))))));curve={chain:ch,info:d,maxErr:err};}}
    return{solid:b.sol,OD:2*b.sp.ro,ID:2*b.sp.ri,chain:b.ch,info:b.d,curve,candidates:cand.length,odd:b.odd};}

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
  instances.forEach((inst,idx)=>{if(progress)progress('Placing parts',idx/instances.length);const g=part(inst.pd);inst.part=g;inst.label=inst.path.slice(1).join(' / ')||g.name;
    inst.csys=g.csys.map(c=>({name:c.name,o:F.pt(inst.M,c.o),x:F.vec(inst.M,c.x),y:F.vec(inst.M,c.y),z:F.vec(inst.M,c.z),inst:idx}));
    inst.points=g.points.map(p=>({name:p.name,p:F.pt(inst.M,p.p),inst:idx}));
    inst.solids=g.solids.length;inst.bbox=null;g.solids.forEach(s=>{if(!s.bbox)return;const w=bboxWorld(inst.M,s.bbox);if(!inst.bbox)inst.bbox=w;else for(let k=0;k<3;k++){inst.bbox.min[k]=Math.min(inst.bbox.min[k],w.min[k]);inst.bbox.max[k]=Math.max(inst.bbox.max[k],w.max[k]);}});
    // edge cloud in world coordinates; its box is exact for the edges (a box of the rotated local box is not)
    inst.cloud=null;inst.edges=g.edges;
    if(g.cloud.length){const c=g.cloud,w=new Float32Array(c.length),M=inst.M,b={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
      for(let i=0;i<c.length;i+=3){const x=c[i],y=c[i+1],z=c[i+2];
        for(let k=0;k<3;k++){const v=M.o[k]+M.x[k]*x+M.y[k]*y+M.z[k]*z;w[i+k]=v;if(v<b.min[k])b.min[k]=v;if(v>b.max[k])b.max[k]=v;}}
      inst.cloud=w;inst.bbox=b;}
    csys.push(...inst.csys);points.push(...inst.points);
    if(g.pipe){const ch={pieces:g.pipe.chain.pieces.map(p=>xformPiece(inst.M,p)),length:g.pipe.chain.length,leftover:g.pipe.chain.leftover},info=describe(ch);
      pipes.push({inst:idx,name:g.name,label:inst.label,OD:g.pipe.OD,ID:g.pipe.ID,R:info.R,chain:ch,info,Q:info.Q,bends:info.bends,length:info.length,
        curveAgree:g.pipe.curve?g.pipe.curve.maxErr:null,candidates:g.pipe.candidates,odd:g.pipe.odd,samples:sample(ch,Math.max(2,g.pipe.OD/4))});}});

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

  if(progress)progress('Done',1);
  // the parts' local clouds have been placed; the world clouds are kept per instance
  for(const P of partCache.values())P.cloud=null;
  const placed=instances.filter(i=>i.cloud||i.solids);
  return attach({product,units,degrees,entities:E.size,products:[...products.values()].map(P=>({pd:P.pd,name:P.name,pid:P.pid})),instances,csys,points,pipes,fixings,
    debug:{solidPieces,part},
    summary:{parts:products.size,instances:instances.length,placed:placed.length,solids:instances.reduce((s,i)=>s+i.solids,0),
      cloudPoints:instances.reduce((s,i)=>s+(i.cloud?i.cloud.length/3:0),0),pipes:pipes.length,fixings:fixings.length,csys:csys.length,points:points.length}});
}

// methods on a parse result. Kept outside parse() so a result made in a Web Worker (plain data) gets them back.
function attach(r){
  const{csys,pipes,fixings}=r;
  // which named frame a .pts file is written in: the one that lands its points on the centreline or its corners
  r.matchFrame=function(pts,pipe){let best=null;
    const cands=[{name:'file origin',M:F.id()}].concat(csys.map(c=>({name:c.name,M:{o:c.o,x:c.x,y:c.y,z:c.z}})));
    const distQ=p=>Math.min(...pipe.Q.map(q=>len(sub(q,p))));
    for(const c of cands){const errs=pts.map(p=>{const w=F.pt(c.M,p);return Math.min(nearest(pipe.chain,w).d,distQ(w));}).sort((a,b)=>a-b);
      const err=errs[Math.floor((errs.length-1)/2)];if(!best||err<best.err)best={frame:c.name,M:c.M,err,errs};}
    return best;};
  // the clamps that matter for one pipe: bore fits its OD (±1.5 mm), not its own end fitting, not holding another pipe
  r.clampsFor=function(pi){const p=pipes[pi];if(!p)return[];
    const through=(q,x)=>{const v=nearest(q.chain,x.c);return v.d<=0.5;};
    return fixings.map((x,i)=>{const dist=nearest(p.chain,x.c).d,fits=Math.abs(x.D-p.OD)<=1.5,passes=dist<=0.5;
      const end=passes&&Math.min(len(sub(x.c,p.info.start)),len(sub(x.c,p.info.end)))<x.length/2+p.OD;
      const other=pipes.find((q,j)=>j!==pi&&through(q,x));
      return{i,fix:x,dist,fits,passes,end,holds:other?other.name:null,use:fits&&!end&&!other};})
      .filter(c=>c.fits).sort((a,b)=>(b.use-a.use)||(a.dist-b.dist));};
  r.toFrame=F.toLocal;r.fromFrame=F.pt;r.nearest=nearest;
  return r;
}

// ---------- parse in a Web Worker, with progress ----------
// The worker is built from this file's own source (a Blob URL), so it also runs when index.html is opened from disk.
// Without Worker support it falls back to parsing on the page.
const WORKER_MAIN=`self.onmessage=function(ev){try{
  const r=StepAsm.parse(ev.data.text,{cloudStep:ev.data.cloudStep,progress:function(stage,f){self.postMessage({type:'progress',stage:stage,f:f});}});
  const out={},tr=[];for(const k in r)if(typeof r[k]!=='function'&&k!=='debug')out[k]=r[k];
  r.instances.forEach(function(i){if(i.cloud)tr.push(i.cloud.buffer);});
  self.postMessage({type:'done',r:out},tr);
}catch(e){self.postMessage({type:'error',message:String(e&&e.message||e)});}};`;
let workerURL=null;
function parseAsync(text,opts){opts=opts||{};const progress=opts.progress||null;
  return new Promise((resolve,reject)=>{
    const onPage=()=>setTimeout(()=>{try{resolve(parse(text,opts));}catch(e){reject(e);}},20);
    let w=null;
    try{if(typeof Worker!=='undefined'&&typeof Blob!=='undefined'&&typeof URL!=='undefined'){
      if(!workerURL)workerURL=URL.createObjectURL(new Blob(['('+factory.toString()+')(self);\n'+WORKER_MAIN],{type:'text/javascript'}));
      w=new Worker(workerURL);}}catch(e){w=null;}
    if(!w)return onPage();
    let heard=false;
    w.onmessage=ev=>{const m=ev.data;heard=true;
      if(m.type==='progress'){if(progress)progress(m.stage,m.f);}
      else if(m.type==='done'){w.terminate();resolve(attach(m.r));}
      else{w.terminate();reject(new Error(m.message));}};
    w.onerror=ev=>{if(ev&&ev.preventDefault)ev.preventDefault();w.terminate();if(heard)reject(new Error((ev&&ev.message)||'STEP worker failed'));else onPage();};
    w.postMessage({text:String(text),cloudStep:opts.cloudStep});
  });
}

const API={parse,parseAsync,attach,chain,describe,sample,nearest,F};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.StepAsm=API;
})(typeof globalThis!=="undefined"?globalThis:this);
