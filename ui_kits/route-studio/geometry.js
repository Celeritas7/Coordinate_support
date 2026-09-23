// Route Studio UI kit — trimmed copy of the product's geometry helpers (index.html) so screens show real numbers.
(function(){
const V={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}};
function parsePts(text){const P=[];for(const raw of text.split(/\r?\n/)){const line=raw.split('!')[0].trim();if(!line)continue;
  const v=line.replace(/,/g,' ').split(/\s+/).map(Number);if(v.length>=3&&v.slice(0,3).every(Number.isFinite))P.push(v.slice(0,3));}
  return P.filter((p,i)=>i===0||V.len(V.sub(p,P[i-1]))>1e-6);}
function naturalSpline(Q){const n=Q.length,t=[0];for(let i=1;i<n;i++)t.push(t[i-1]+V.len(V.sub(Q[i],Q[i-1])));const M=[[],[],[]];
  for(let d=0;d<3;d++){const y=Q.map(q=>q[d]),m=new Array(n).fill(0);if(n>2){const a=[],b=[],c=[],r=[];
    for(let i=1;i<n-1;i++){const h0=t[i]-t[i-1],h1=t[i+1]-t[i];a.push(h0);b.push(2*(h0+h1));c.push(h1);r.push(6*((y[i+1]-y[i])/h1-(y[i]-y[i-1])/h0));}
    const k=b.length;for(let i=1;i<k;i++){const w=a[i]/b[i-1];b[i]-=w*c[i-1];r[i]-=w*r[i-1];}const x=new Array(k);x[k-1]=r[k-1]/b[k-1];
    for(let i=k-2;i>=0;i--)x[i]=(r[i]-c[i]*x[i+1])/b[i];for(let i=0;i<k;i++)m[i+1]=x[i];}M[d]=m;}
  function at(i,s){const h=t[i+1]-t[i],p=[],d1=[],d2=[];for(let d=0;d<3;d++){const y0=Q[i][d],y1=Q[i+1][d],m0=M[d][i],m1=M[d][i+1],A=(t[i+1]-(t[i]+s))/h,B=s/h;
    p.push(A*y0+B*y1+((A*A*A-A)*m0+(B*B*B-B)*m1)*h*h/6);d1.push((y1-y0)/h-(3*A*A-1)/6*h*m0+(3*B*B-1)/6*h*m1);d2.push(A*m0+B*m1);}return{p,d1,d2};}
  return{t,at,nseg:n-1};}
const curvOf=(d1,d2)=>V.len(V.cross(d1,d2))/Math.pow(V.len(d1),3);
function sampleSpline(sp,per=40){const pts=[],k=[];for(let i=0;i<sp.nseg;i++){const h=sp.t[i+1]-sp.t[i],m=Math.max(4,Math.ceil(per*h/(sp.t[sp.nseg]/sp.nseg)));
  for(let j=(i?1:0);j<=m;j++){const r=sp.at(i,h*j/m);pts.push(r.p);k.push(curvOf(r.d1,r.d2));}}
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+V.len(V.sub(pts[i],pts[i-1])));return{pts,k,s};}
function analyse(Q){const d=sampleSpline(naturalSpline(Q));let wi=0;for(let i=1;i<d.k.length;i++)if(d.k[i]>d.k[wi])wi=i;return{Q,d,wi,minR:1/d.k[wi],len:d.s[d.s.length-1]};}
// stand-in for the optimiser: corner-cutting subdivision that keeps the end points and densifies the route
function generate(P,spacing){let Q=P.slice();for(let r=0;r<3;r++){const o=[Q[0]];for(let i=0;i<Q.length-1;i++){const a=Q[i],b=Q[i+1];o.push(V.add(V.mul(a,.75),V.mul(b,.25)));o.push(V.add(V.mul(a,.25),V.mul(b,.75)));}o.push(Q[Q.length-1]);Q=o;}
  const out=[Q[0]];for(let i=1;i<Q.length;i++){if(V.len(V.sub(Q[i],out[out.length-1]))>=spacing*0.6||i===Q.length-1)out.push(Q[i]);}
  return out.map(p=>p.map(c=>Math.round(c*100)/100));}
function closestOnPath(p,path){let bf=null,bd=Infinity;for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],ab=V.sub(b,a),L2=V.dot(ab,ab);
  let t=L2?V.dot(V.sub(p,a),ab)/L2:0;t=Math.max(0,Math.min(1,t));const foot=V.add(a,V.mul(ab,t)),d=V.len(V.sub(p,foot));if(d<bd){bd=d;bf=foot;}}return{foot:bf,d:bd};}
function adjustClearance(master,slave,gap,mode){const before=[],after=[],shift=[],moved=slave.map((p,i)=>{const{foot,d}=closestOnPath(p,master);before.push(d);
  if(mode==='min'&&d>=gap){shift.push(0);return p.slice();}const dir=V.norm(V.len(V.sub(p,foot))<1e-9?[0,0,1]:V.sub(p,foot)),q=V.add(p,V.mul(dir,gap-d));shift.push(Math.abs(gap-d));return q;});
  moved.forEach(p=>after.push(closestOnPath(p,master).d));return{moved:moved.map(p=>p.map(c=>Math.round(c*1000)/1000)),before,after,shift};}
function toPts(Q,info){const f=c=>c.toFixed(2).padStart(15);return["!","!       DATUM POINT ARRAY DATA FILE","!",`! Hose min bend radius ${info.R} mm, design ${info.designR} mm, achieved ${info.minR.toFixed(1)} mm`,
  `! ${Q.length} points, route length ~${Math.round(info.len)} mm`,"!","! Enter values with respect to datum arrays' coordinate system:","!","!CARTESIAN coordinates:","!        X                Y                Z","!",
  ...Q.map(q=>`${f(q[0])} ${f(q[1])} ${f(q[2])}`)].join("\n")+"\n";}
const PRESETS={target:`! example target points
-1655.50  -225.00  -155.50
-1133.50  -671.80   -90.00
 -833.75  -563.19  -141.16
 -583.50  -671.80   -90.00
 -253.50  -528.51     1.00
 -183.50  -279.99    -3.00
    0.00     0.00     0.00`,slave:`! slave route, gap varies 18-62 mm
-1652.80  -218.70  -138.94
-1125.25  -652.55   -39.40
 -831.65  -558.29  -128.28
 -574.20  -650.10   -32.96
 -249.75  -519.76    24.00
 -179.00  -269.49    24.60
    7.20    16.80    44.16`};
PRESETS.master=PRESETS.target.replace('example target points','master route');
const PALETTE=['#2B6CB0','#C8323C','#2F8F63','#8A5BD6','#D08A1E','#0E7C86'];
const fmt=(v,d=1)=>v==null||!isFinite(v)?'--':v.toFixed(d);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
window.RS={V,parsePts,analyse,generate,adjustClearance,toPts,PRESETS,PALETTE,fmt,css};
})();
