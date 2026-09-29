// Wire analysis: checks cables exactly as loaded. Nothing is re-routed or smoothed.
// Loaded after the main script; reuses its globals (V, $, fmt, css, analyse, addRun, runs, bundles...).
const WA_SEV={3:{t:'Fail',c:'--bad'},2:{t:'Warn',c:'--warn'},1:{t:'Changed',c:'--muted'}};
let waSel=null,waUid=1,waBatch=1;const waFilter={cable:'',check:'',show:'fw'};

function waParseBlocks(text){
  const out=[];let cur=null;
  text.split(/\r?\n/).forEach((raw,ln)=>{
    const h=raw.trim().match(/^#\s*(.+)$/);
    if(h){cur={name:h[1].trim().replace(/\.(pts|txt|csv|ibl)$/i,''),P:[],lines:[],raw:[],hl:ln};out.push(cur);return;}
    if(!cur){cur={name:'W'+(out.length+1),P:[],lines:[],raw:[],hl:-1};out.push(cur);}
    cur.raw.push(raw);
    const line=raw.split('!')[0].trim();if(!line)return;
    const v=line.replace(/,/g,' ').split(/\s+/).map(Number);
    if(v.length>=3&&v.slice(0,3).every(Number.isFinite)){cur.P.push(v.slice(0,3));cur.lines.push(ln-cur.hl);}
  });
  return out.filter(c=>c.P.length);
}
function waRows(t){return t.split(/\r?\n/).map(l=>l.split('!')[0].trim()).filter(Boolean).map(l=>l.replace(/,/g,' ').split(/\s+/));}
function waBoxDist(p,b){let o=0,dep=Infinity;
  for(let k=0;k<3;k++){const lo=b.min[k]-p[k],hi=p[k]-b.max[k],e=Math.max(lo,hi,0);o+=e*e;dep=Math.min(dep,-Math.max(lo,hi));}
  return o>0?Math.sqrt(o):-dep;}
// dense samples on Creo-style natural spline; own[i] = nearest input point (index into D)
function waSample(D,step){
  const sp=naturalSpline(D),pts=[],k=[],own=[];
  for(let i=0;i<sp.nseg;i++){const h=sp.t[i+1]-sp.t[i],m=Math.max(6,Math.ceil(h/step));
    for(let j=i?1:0;j<=m;j++){const r=sp.at(i,h*j/m);pts.push(r.p);k.push(curvOf(r.d1,r.d2));own.push(j*2<m?i:i+1);}}
  const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+V.len(V.sub(pts[i],pts[i-1])));
  return{pts,k,own,s};
}
function waGrid(pts,cs){const g=new Map();
  for(let i=0;i<pts.length-1;i++){const p=pts[i],key=Math.floor(p[0]/cs)+','+Math.floor(p[1]/cs)+','+Math.floor(p[2]/cs);
    let L=g.get(key);if(!L)g.set(key,L=[]);L.push(i);}
  return{g,cs,pts};}
function waNear(G,p,skip){let bd=Infinity,bi=-1;const ci=Math.floor(p[0]/G.cs),cj=Math.floor(p[1]/G.cs),ck=Math.floor(p[2]/G.cs);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){const L=G.g.get((ci+a)+','+(cj+b)+','+(ck+c));if(!L)continue;
    for(const i of L){if(skip&&skip(i))continue;const r=closestOnSegment(p,G.pts[i],G.pts[i+1]);if(r.d<bd){bd=r.d;bi=i;}}}
  return{d:bd,i:bi};}
// runs of consecutive flagged points (same key) -> one issue at the worst point
function waGroup(sev,bad,key){const out=[];let cur=null;
  for(let i=0;i<sev.length;i++){const s=sev[i],k=key?key[i]:'';
    if(s&&cur&&cur.b===i-1&&cur.k===k){cur.b=i;cur.sev=Math.max(cur.sev,s);if(bad[i]>bad[cur.w])cur.w=i;}
    else if(s){cur={a:i,b:i,w:i,sev:s,k};out.push(cur);}else cur=null;}
  return out;}

function waRun(){
  const st=$('statusAnalyse');st.style.color='';
  const cabs=waParseBlocks($('acab').value);
  if(!cabs.length)return st.textContent='Paste or open at least one cable.';
  ['acab','aprop','aobs','aref'].forEach(k=>store.set('rs.'+k,$(k).value));
  const num=(id,d)=>{const v=+$(id).value;return Number.isFinite(v)&&v>0?v:d;};
  const dD=num('ad',8),dR=num('ar',50),dG=+$('ag').value||0,SF=num('asf',1.5),kink=num('akink',30),ratio=num('aratio',3),
        dup=num('adup',0.5),keep=+$('akeep').value||0,mov=num('amove',5);
  const props={};waRows($('aprop').value).forEach(r=>{if(r.length>=2)props[r[0]]={d:+r[1]||dD,R:+r[2]||dR,gap:r[3]!=null?+r[3]||0:dG};});
  const obs=waRows($('aobs').value).filter(r=>r.length>=7).map(r=>{const v=r.slice(1,7).map(Number);
    return{id:r[0],min:[Math.min(v[0],v[3]),Math.min(v[1],v[4]),Math.min(v[2],v[5])],max:[Math.max(v[0],v[3]),Math.max(v[1],v[4]),Math.max(v[2],v[5])]};});
  const refs={};waParseBlocks($('aref').value).forEach(c=>refs[c.name]=c);
  const skipped=[];
  const W=cabs.map(c=>{
    const pr=props[c.name]||{d:dD,R:dR,gap:dG},P=c.P,rd=[],D=[],first=[];
    P.forEach((p,i)=>{if(!D.length||V.len(V.sub(p,D[D.length-1]))>1e-6){D.push(p);first.push(i);}rd.push(D.length-1);});
    if(D.length<3){skipped.push(c.name);return null;}
    return{c,pr,P,D,rd,first,S:waSample(D,Math.max(0.5,Math.min(2,pr.d/3)))};
  }).filter(Boolean);
  if(!W.length)return st.textContent='Each cable needs at least three distinct points.';
  const maxNeed=Math.max(...W.map(w=>w.pr.d+w.pr.gap),keep)+2;
  W.forEach(w=>{let ms=0;for(let i=1;i<w.S.pts.length;i++)ms=Math.max(ms,V.len(V.sub(w.S.pts[i],w.S.pts[i-1])));
    w.G=waGrid(w.S.pts,Math.max(2*maxNeed+2*ms,20));});
  const batch=waBatch++,made=[];
  W.forEach(w=>{
    const{c,pr,P,D,rd,first,S}=w,n=P.length,nd=D.length,issues=[];
    const add=(g,check,o)=>issues.push(Object.assign({uid:waUid++,cable:c.name,a:g.a,b:g.b,w:g.w,sev:g.sev,check,p:P[g.w],line:c.lines[g.w]},o));
    // bend radius on the spline Creo will fit through these points
    const bR=new Array(nd).fill(Infinity);S.k.forEach((k,i)=>{const r=1/k;if(r<bR[S.own[i]])bR[S.own[i]]=r;});
    const sv=[],bd=[];for(let i=0;i<n;i++){const r=bR[rd[i]];sv.push(r<pr.R?3:r<pr.R*SF?2:0);bd.push(pr.R/r);}
    waGroup(sv,bd).forEach(g=>{const r=bR[rd[g.w]];add(g,'Bend radius',{found:r,foundTxt:`R ${fmt(r)}`,limit:g.sev===3?pr.R:pr.R*SF,
      limitTxt:g.sev===3?`min ${pr.R}`:`margin ${fmt(pr.R*SF,0)}`,unit:'mm',bad:bd[g.w],
      note:g.sev===3?'The spline through these points bends tighter than the cable allows.':`Passes the minimum but is inside the x${SF} margin.`});});
    // duplicates
    for(let i=1;i<n;i++){const d=V.len(V.sub(P[i],P[i-1]));if(d<dup)add({a:i,b:i,w:i,sev:3},'Duplicate point',{found:d,foundTxt:`${fmt(d,2)} from #${i}`,limit:dup,limitTxt:`≥ ${dup}`,unit:'mm',bad:10,note:`Same position as point #${i}. Delete one of them.`});}
    // kinks, loop-backs, uneven spacing (on distinct points)
    for(let j=1;j<nd-1;j++){const a=V.sub(D[j],D[j-1]),b=V.sub(D[j+1],D[j]),la=V.len(a),lb=V.len(b);
      const ang=Math.acos(Math.max(-1,Math.min(1,V.dot(a,b)/(la*lb))))*180/Math.PI,i=first[j];
      if(ang>150)add({a:i,b:i,w:i,sev:3},'Loop-back',{found:ang,foundTxt:`${fmt(ang,0)}° turn`,limit:150,limitTxt:'< 150°',unit:'deg',bad:9,note:'Direction reverses here. The point is probably out of order.'});
      else if(ang>=kink)add({a:i,b:i,w:i,sev:ang>=2*kink?3:2},'Kink',{found:ang,foundTxt:`${fmt(ang,0)}°`,limit:kink,limitTxt:`≤ ${kink}°`,unit:'deg',bad:ang/kink,note:'Sharp change of direction. Usually a point moved off the line.'});
      if(la>=dup&&lb>=dup){const q=Math.max(la,lb)/Math.min(la,lb);
        if(q>ratio)add({a:i,b:i,w:i,sev:2},'Uneven spacing',{found:q,foundTxt:`${fmt(q)}x (${fmt(la,0)} / ${fmt(lb,0)})`,limit:ratio,limitTxt:`≤ ${ratio}x`,unit:'ratio',bad:q/ratio,note:`Gap jumps from ${fmt(la,0)} to ${fmt(lb,0)} mm. The spline can overshoot here.`});}}
    // obstacles
    if(obs.length){const g0=new Array(nd).fill(Infinity),gb=new Array(nd).fill('');
      S.pts.forEach((p,i)=>{for(const o of obs){const d=waBoxDist(p,o)-pr.d/2,j=S.own[i];if(d<g0[j]){g0[j]=d;gb[j]=o.id;}}});
      const sv2=[],bd2=[],ky=[];for(let i=0;i<n;i++){const d=g0[rd[i]];sv2.push(d<0?3:d<keep?2:0);bd2.push(2-d/Math.max(keep,1));ky.push(gb[rd[i]]);}
      waGroup(sv2,bd2,ky).forEach(g=>{const d=g0[rd[g.w]],o=gb[rd[g.w]];add(g,'Obstacle',{found:d,foundTxt:`${fmt(d)} to ${o}`,limit:keep,limitTxt:`≥ ${keep}`,unit:'mm',bad:bd2[g.w],
        note:d<0?`Passes through ${o}.`:`Closer to ${o} than the keep-out.`});});}
    // other cables
    let near=Infinity,nearNeed=0;
    W.forEach(o=>{if(o===w)return;const need=Math.max(pr.gap,o.pr.gap),rr=(pr.d+o.pr.d)/2,g0=new Array(nd).fill(Infinity);
      for(let i=0;i<S.pts.length;i+=2){const r=waNear(o.G,S.pts[i]);if(r.i<0)continue;const d=r.d-rr,j=S.own[i];if(d<g0[j])g0[j]=d;if(d<near){near=d;nearNeed=need;}}
      const sv3=[],bd3=[];for(let i=0;i<n;i++){const d=g0[rd[i]];sv3.push(d<0?3:d<need?2:0);bd3.push(2-d/Math.max(need,1));}
      waGroup(sv3,bd3).forEach(g=>{const d=g0[rd[g.w]];add(g,'Cable clearance',{found:d,foundTxt:`${fmt(d)} to ${o.c.name}`,limit:need,limitTxt:`≥ ${fmt(need,0)}`,unit:'mm',bad:bd3[g.w],
        note:d<0?`Touches or overlaps ${o.c.name}.`:`Closer to ${o.c.name} than the required gap.`});});});
    // self contact
    {const sep=Math.PI*Math.max(pr.R,pr.d+pr.gap)*1.1+pr.d+pr.gap,g0=new Array(nd).fill(Infinity),wh=new Array(nd).fill(0);
      for(let i=0;i<S.pts.length;i+=2){const si=S.s[i],r=waNear(w.G,S.pts[i],k=>Math.abs(S.s[k]-si)<sep);if(r.i<0)continue;
        const d=r.d-pr.d,j=S.own[i];if(d<g0[j]){g0[j]=d;wh[j]=S.own[r.i];}}
      const sv4=[],bd4=[];for(let i=0;i<n;i++){const d=g0[rd[i]];sv4.push(d<0?3:d<pr.gap?2:0);bd4.push(2-d/Math.max(pr.gap,1));}
      waGroup(sv4,bd4).forEach(g=>{const d=g0[rd[g.w]],k=first[wh[rd[g.w]]]+1;add(g,'Self contact',{found:d,foundTxt:`${fmt(d)} to own #${k}`,limit:pr.gap,limitTxt:`≥ ${pr.gap}`,unit:'mm',bad:bd4[g.w],
        note:`The cable comes back to its own point #${k}.`});});}
    // earlier version
    const ref=refs[c.name]||(cabs.length===1&&Object.keys(refs).length===1?Object.values(refs)[0]:null);let refDense=null,refInfo='';
    if(ref&&ref.P.length>=2){const RD=ref.P.filter((p,i)=>i===0||V.len(V.sub(p,ref.P[i-1]))>1e-6);
      refDense=RD.length>=3?waSample(RD,4).pts:RD;
      const mv=P.map(p=>closestOnPath(p,refDense).d);
      RD.forEach(q=>{const r=closestOnPath(q,S.pts);if(r.d>mv[first[S.own[r.i]]])mv[first[S.own[r.i]]]=r.d;});
      waGroup(mv.map(d=>d>mov?1:0),mv.map(d=>d/mov)).forEach(g=>{const d=mv[g.w];add(g,'Moved',{found:d,foundTxt:`${fmt(d)}`,limit:mov,limitTxt:`≤ ${mov}`,unit:'mm',bad:d/mov,
        note:`Differs from the earlier version by ${fmt(d)} mm.`});});
      const L0=pathLength(RD),L1=S.s[S.s.length-1];
      if(Math.abs(L1-L0)>mov||RD.length!==P.length){refInfo=`length ${Math.round(L0)} → ${Math.round(L1)} mm, points ${ref.P.length} → ${n}`;
        issues.push({uid:waUid++,cable:c.name,a:null,b:null,w:0,sev:1,check:'Length / count',p:P[0],line:'',found:L1-L0,foundTxt:`${L1>=L0?'+':''}${fmt(L1-L0)} mm, ${n-ref.P.length>=0?'+':''}${n-ref.P.length} pts`,
          limit:mov,limitTxt:`≤ ${mov}`,unit:'mm',bad:0,note:`Earlier version: ${refInfo}.`});}}
    const A=analyse(D);A.Q=P;
    const nf=issues.filter(x=>x.sev===3).length,nw=issues.filter(x=>x.sev===2).length;
    Object.assign(A,{name:c.name,kind:'analysis',kindLabel:'analysed as loaded',params:{R:pr.R,SF},cable:{d:pr.d,gap:pr.gap},batch,
      issues,ref:refDense,clr:isFinite(near)?{min:near,need:nearNeed}:null,
      settings:`d ${pr.d}, min R ${pr.R}, gap ${pr.gap}; ${nf} fail, ${nw} warn${ref?'; vs earlier version':''}`,
      text:c.raw.join('\n').trim()+'\n'});
    issues.forEach(x=>x.runRef=A);made.push(A);
  });
  made.forEach(a=>addRun(a));
  const all=made.flatMap(a=>a.issues),f=all.filter(x=>x.sev===3).length,wn=all.filter(x=>x.sev===2).length,ch=all.filter(x=>x.sev===1).length;
  const worst=all.slice().sort(waCmp)[0];
  if(worst){selId=worst.runRef.id;waSel=worst.uid;}
  dock='iss';showPane();renderRuns();rebuild(false);
  st.textContent=`Checked ${made.length} cable${made.length>1?'s':''}: ${f} fail, ${wn} warn${ch?`, ${ch} changed`:''}.`
    +(skipped.length?` Skipped ${skipped.join(', ')} (fewer than 3 points).`:'')+(runs.length>=12&&made.length>1?' Comparison keeps the last 12 runs.':'');
  st.style.color=f?'var(--bad)':'';
}
function waCmp(a,b){return b.sev-a.sev||b.bad-a.bad;}
function waAll(){return runs.filter(r=>r.kind==='analysis').flatMap(r=>r.issues);}
function waShown(){const f=waFilter;return waAll().filter(x=>(!f.cable||x.cable===f.cable)&&(!f.check||x.check===f.check)&&
  (f.show==='all'||(f.show==='fw'?x.sev>=2:x.sev===3))).sort(waCmp);}
function waPts(x){return x.a==null?'--':x.a===x.b?'#'+(x.a+1):`#${x.a+1}–${x.b+1}`;}

function renderIssues(){
  const box=$('iss');if(!box)return;
  const all=waAll();
  if(!runs.some(r=>r.kind==='analysis')){box.innerHTML='<p class="empty" style="padding:14px">Open or paste cables in the Analyse tab to list their issues here.</p>';return;}
  const cabs=[...new Set(all.map(x=>x.cable))],checks=[...new Set(all.map(x=>x.check))],L=waShown();
  if(waFilter.cable&&!cabs.includes(waFilter.cable))waFilter.cable='';
  const cnt=s=>all.filter(x=>x.sev===s).length,opt=(v,t,cur)=>`<option value="${v}"${v===cur?' selected':''}>${t}</option>`;
  box.innerHTML=`<div class="isshead"><span class="sum"><b style="color:var(--bad)">${cnt(3)} fail</b> &middot; <b style="color:var(--warn)">${cnt(2)} warn</b> &middot; ${cnt(1)} changed</span>
    <select id="fCab" aria-label="cable">${opt('','All cables',waFilter.cable)}${cabs.map(c=>opt(c,c,waFilter.cable)).join('')}</select>
    <select id="fChk" aria-label="check">${opt('','All checks',waFilter.check)}${checks.map(c=>opt(c,c,waFilter.check)).join('')}</select>
    <select id="fShow" aria-label="show">${opt('fw','Fail + warn',waFilter.show)}${opt('f','Fail only',waFilter.show)}${opt('all','Everything',waFilter.show)}</select>
    <span class="right"><button type="button" id="issCsv">Download .csv</button></span></div>
    ${L.length?`<table><thead><tr><th></th><th>Cable</th><th>Point</th><th>Line</th><th>Check</th><th>Found</th><th>Limit</th><th>Note</th></tr></thead><tbody>${L.map(x=>`<tr data-u="${x.uid}" data-on="${x.uid===waSel?1:0}">
      <td><span class="sev"><i style="background:var(${WA_SEV[x.sev].c})"></i>${WA_SEV[x.sev].t}</span></td><td>${x.cable}</td><td>${waPts(x)}</td><td class="metric">${x.line||'--'}</td>
      <td>${x.check}</td><td style="color:var(${WA_SEV[x.sev].c})">${x.foundTxt}</td><td class="metric">${x.limitTxt}</td><td class="note">${x.note}</td></tr>`).join('')}</tbody></table>`
      :'<p class="empty" style="padding:14px">No issues match these filters.</p>'}`;
  $('fCab').onchange=e=>{waFilter.cable=e.target.value;renderIssues();rebuild(false);};
  $('fChk').onchange=e=>{waFilter.check=e.target.value;renderIssues();rebuild(false);};
  $('fShow').onchange=e=>{waFilter.show=e.target.value;renderIssues();rebuild(false);};
  $('issCsv').onclick=waCsv;
  box.querySelectorAll('tr[data-u]').forEach(tr=>{const x=all.find(i=>i.uid===+tr.dataset.u);
    tr.onpointerenter=()=>{if(marker){marker.position.set(...x.p);marker.visible=true;draw();}};
    tr.onpointerleave=()=>{if(marker){marker.visible=false;draw();}};
    tr.onclick=()=>{waSel=x.uid;const r=x.runRef;selId=r.id;r.visible=true;renderRuns();rebuild(false);
      orbit.target.set(...x.p);orbit.dist=Math.max(r.params.R*7,diag*0.12);zoomed=true;$('zoom').textContent='Show whole route';draw();};});
}
function waCsv(){
  const q=v=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const rows=[['severity','cable','point_from','point_to','worst_point','file_line','check','x','y','z','found','limit','unit','note']];
  waShown().forEach(x=>rows.push([WA_SEV[x.sev].t,x.cable,x.a==null?'':x.a+1,x.b==null?'':x.b+1,x.a==null?'':x.w+1,x.line,x.check,
    ...x.p.map(v=>v.toFixed(2)),Number.isFinite(x.found)?x.found.toFixed(2):'',x.limit,x.unit,x.note]));
  const b=new Blob([rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n'],{type:'text/csv'}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download='wire_analysis.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
function waOverlay(){
  const vis=visible().filter(r=>r.kind==='analysis');if(!vis.length)return;
  const sg=new THREE.SphereGeometry(1,14,10),shown=waShown(),mats={};
  const mat=s=>mats[s]||(mats[s]=new THREE.MeshBasicMaterial({color:new THREE.Color(css(WA_SEV[s].c)),transparent:true,opacity:0.45,depthWrite:false}));
  vis.forEach(r=>{
    if(r.ref){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.ref.map(p=>new THREE.Vector3(...p))),
      new THREE.LineDashedMaterial({color:css('--muted'),dashSize:tubeR*3,gapSize:tubeR*2}));l.computeLineDistances();content.add(l);}
    const tr=Math.max(r.cable.d/2,tubeR*0.4);
    shown.filter(x=>x.runRef===r&&x.a!=null).forEach(x=>{const m=new THREE.Mesh(sg,mat(x.sev));m.scale.setScalar(tr*(x.uid===waSel?4.2:3));m.position.set(...x.p);content.add(m);});
  });
  const x=waAll().find(i=>i.uid===waSel);
  if(x&&x.runRef.visible)addTag(x.p,`${x.cable} ${waPts(x)}: ${x.check} ${x.foundTxt}`);
  if(vis.some(r=>r.ref))addTag(vis.find(r=>r.ref).ref[0],'earlier version','t');
  draw();
}
function waExample(){
  const bz=(a,b,c,d,n)=>{const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push([0,1,2].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]));}return o;};
  const f=P=>P.map(p=>p.map(v=>v.toFixed(2).padStart(10)).join(' ')).join('\n');
  const w1r=bz([-1600,-300,-150],[-1250,-300,-150],[-900,-750,-120],[-450,-700,-100],22),w2r=w1r.map(p=>V.add(p,[0,0,30]));
  const w1=w1r.map(p=>p.slice());w1[9]=V.add(w1[9],[0,38,0]);w1[16]=V.add(w1[16],[0,0,14]);
  let w2=w2r.map(p=>p.slice());w2[12]=V.add(w2[12],[0,0,-22]);w2[13]=V.add(w2[13],[0,0,-22]);
  w2=[...w2.slice(0,6),w2[5].slice(),...w2.slice(6,17),...w2.slice(19)];
  const w3=bz([-1500,-100,-60],[-1150,-120,40],[-850,-400,40],[-600,-450,-60],18);[w3[4],w3[5]]=[w3[5],w3[4]];
  const c=w3[10];
  return{cab:`# W1\n${f(w1)}\n# W2\n${f(w2)}\n# W3\n${f(w3)}`,
    prop:`! id  diameter  min R  gap\nW1  8   40  4\nW2  8   40  4\nW3  12  60  5`,
    obs:`! id   Xmin  Ymin  Zmin    Xmax  Ymax  Zmax\nO1  ${[c[0]-60,c[1]-15,c[2]-70,c[0]+60,c[1]+120,c[2]+10].map(v=>Math.round(v)).join('  ')}`,
    ref:`# W1\n${f(w1r)}\n# W2\n${f(w2r)}`};
}

// hook into the main app
{const _rb=rebuild;rebuild=function(refit){_rb(refit);waOverlay();};}
{const _rr=renderRuns;renderRuns=function(){_rr();renderIssues();};}
{const _ls=loadSettings;loadSettings=function(r){if(r.kind==='analysis')return showPanel('analyse');_ls(r);};}
showPanel=function(which){
  [['bend','panBend','tabBend'],['clear','panClear','tabClear'],['bundle','panBundle','tabBundle'],['analyse','panAnalyse','tabAnalyse']]
    .forEach(([k,p,t])=>{$(p).hidden=k!==which;$(t).setAttribute('aria-selected',k===which);});};
showPane=function(){
  $('paneChart').dataset.on=(dock==='rad'||dock==='clr')?1:0;
  [['cmp','paneCmp'],['pts','panePts'],['bun','paneBun'],['iss','paneIss']].forEach(([k,p])=>$(p).dataset.on=dock===k?1:0);
  ['dRad','dClr','dCmp','dPts','dBun','dIss'].forEach((id,i)=>$(id).setAttribute('aria-selected',['rad','clr','cmp','pts','bun','iss'][i]===dock));
  draw();};
$('tabAnalyse').onclick=()=>showPanel('analyse');
$('dIss').onclick=()=>{dock='iss';showPane();};
$('runAnalyse').onclick=waRun;
$('aExample').onclick=()=>{const e=waExample();$('acab').value=e.cab;$('aprop').value=e.prop;$('aobs').value=e.obs;$('aref').value=e.ref;};
$('aBundleObs').onclick=()=>{$('aobs').value=$('bob').value;};
const waLoadFiles=async(files,target)=>{const fs=[...files];if(!fs.length)return;
  const parts=await Promise.all(fs.map(f=>f.text().then(t=>`# ${f.name.replace(/\.(pts|txt|csv|ibl)$/i,'')}\n${t.trim()}`)));
  $(target).value=parts.join('\n');};
$('aOpen').onclick=()=>$('afile').click();$('afile').onchange=e=>{waLoadFiles(e.target.files,'acab');e.target.value='';};
$('aOpenRef').onclick=()=>$('areffile').click();$('areffile').onchange=e=>{waLoadFiles(e.target.files,'aref');e.target.value='';};
[['acab','acab'],['aref','aref']].forEach(([id,t])=>{const el=$(id);
  el.addEventListener('dragover',e=>{e.preventDefault();el.dataset.drop=1;});el.addEventListener('dragleave',()=>delete el.dataset.drop);
  el.addEventListener('drop',e=>{e.preventDefault();delete el.dataset.drop;if(e.dataTransfer.files.length)waLoadFiles(e.dataTransfer.files,t);});});
{const e=waExample();$('acab').value=store.get('rs.acab')||e.cab;$('aprop').value=store.get('rs.aprop')??e.prop;
  $('aobs').value=store.get('rs.aobs')??e.obs;$('aref').value=store.get('rs.aref')??e.ref;}
showPane();renderIssues();
