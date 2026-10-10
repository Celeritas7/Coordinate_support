// ---------------- Assembly STEP: parts, pipes / hoses, .pts compare, route through clamps ----------------
// Loaded last. Reads a Creo assembly export with StepAsm (js/step-asm.js): every part instance with its placement,
// named coordinate systems in world coordinates, the centreline of each swept pipe (cylinders + tori) or hose
// (tube-shaped spline faces) and the clamp bores. Each pipe / hose becomes a run.
// Parts: the tree (js/asm-tree.js) with a per-part pipe override, saved per file name.
// Compare: a .pts against the selected pipe (js/pts-compare.js). Route through clamps: js/through.js.
let ASM=null;
const TH={pick:{},last:null,cmp:null};

// ---- frames: .pts files are written in a named CSYS (MAIN for the practice files) ----
function asmFrames(){if(!ASM)return[];const seen=new Set(),out=[];
  ASM.r.instances[0].csys.concat(ASM.r.csys).forEach(c=>{if(!seen.has(c.name)){seen.add(c.name);out.push(c);}});return out;}
function asmFrame(){const n=$('thFrame')?$('thFrame').value:'';const c=asmFrames().find(f=>f.name===n);return c?{name:c.name,M:{o:c.o,x:c.x,y:c.y,z:c.z}}:{name:'file origin',M:null};}
const asmLocal=(q,F)=>F.M?StepAsm.F.toLocal(F.M,q):q;

function asmPtsText(h,Q,F,extra){
  const f=c=>c.toFixed(3).padStart(15),Ql=Q.map(q=>asmLocal(q,F));
  const how=h.kind==='hose'?`Hose OD ${fmt(h.OD,2)} mm. Creo: Curve through points (spline). Smallest bend radius on the hose ${isFinite(h.R)?fmt(h.R,1):'--'} mm, length ${Math.round(h.length)} mm. Points placed so the chord between neighbours strays at most ${fmt(h.dev,1)} mm from the hose.`
    :`Pipe OD ${fmt(h.OD,2)} mm${h.ID?`, ID ${fmt(h.ID,2)} mm`:''}. Creo: Curve through points, Single radius ${fmt(h.R,2)} mm. ${h.bends.length} bend${h.bends.length===1?'':'s'}, length ${Math.round(h.length)} mm.`;
  return["!","!       DATUM POINT ARRAY DATA FILE","!",`! ${h.title}`,`! ${how}`,
    ...(h.kind!=='hose'&&h.bends.length?[`! Bend angles: ${h.bends.map(b=>b.toFixed(1)+'°').join(', ')}. Straights: ${h.straights.map(s=>Math.round(s)).join(', ')} mm.`]:[]),
    ...(extra||[]).map(l=>'! '+l),`! Coordinates in the ${F.name} frame.`,
    "!","! Enter values with respect to datum arrays' coordinate system:","!",
    "!CARTESIAN coordinates:","!        X                Y                Z","!",
    ...Ql.map(q=>`${f(q[0])} ${f(q[1])} ${f(q[2])}`)].join("\n")+"\n";
}
function asmHeader(p,pts){const st=p.chain.pieces.filter(x=>x.type==='line').map(x=>x.len);
  return{title:`${p.name}: ${p.kind==='hose'?'points along the hose centreline':'corner points'} read from ${ASM.name}.`,kind:p.kind,OD:p.OD,ID:p.ID,R:p.R,bends:p.bends.map(b=>b.deg),straights:st,length:p.length,dev:0.2,n:pts};}
// hose: points along the centreline so that the chord between neighbours strays at most dev mm
function hosePoints(d,dev){const P=d.pts,out=[P[0]];let a=0;
  for(let i=2;i<P.length;i++){const A=P[a],B=P[i],AB=V.sub(B,A),L2=V.dot(AB,AB);let worst=0;
    for(let j=a+1;j<i;j++){const t=Math.max(0,Math.min(1,V.dot(V.sub(P[j],A),AB)/L2)),q=V.add(A,V.mul(AB,t));worst=Math.max(worst,V.len(V.sub(P[j],q)));}
    if(worst>dev){out.push(P[i-1]);a=i-1;}}
  out.push(P[P.length-1]);return out;}

// clamps shown with a pipe run: state ok (pipe passes), target (ticked, not passed yet), off
function asmClampViz(pi,okSet){const C=ASM.r.clampsFor(pi);
  return C.filter(c=>!c.end&&!c.holds).map(c=>({c:c.fix.c,d:c.fix.d,r:c.fix.r,length:c.fix.length,name:c.fix.name,
    ok:okSet?okSet.has(c.i):c.passes,on:!!TH.pick[pi+':'+c.i]}));}
const asmBase=pi=>runs.find(x=>x.kind==='pipe'&&x.asm&&ASM&&x.asm.file===ASM.name&&x.asm.pi===pi&&!x.through&&!x.cmp);

function asmRun(p,pi){
  const r=ASM.r,d=p.samples,hose=p.kind==='hose';let wi=0;d.k.forEach((k,i)=>{if(k>d.k[wi])wi=i;});
  const Q=hose?hosePoints(d,0.2):p.Q;
  const near=Math.max(p.OD,2)*1.5,stations=r.csys.filter(c=>StepAsm.nearest(p.chain,c.o).d<=near||Q.some(q=>V.len(V.sub(q,c.o))<=near)).map(c=>({p:c.o,name:c.name}));
  const label=q=>{const c=stations.find(s=>V.len(V.sub(s.p,q))<=near);return c?c.name:'';};
  const qLabel=Q.map((q,i)=>{const nm=label(q);if(i===0)return nm||'start';if(i===Q.length-1)return nm||'end';return hose?nm:(nm?nm+' ':'')+`${p.bends[i-1].deg.toFixed(1)}°`;});
  const parts=r.instances.map((inst,i)=>inst.bbox&&i!==p.inst?{name:inst.label,min:inst.bbox.min,max:inst.bbox.max}:null).filter(Boolean);
  const minR=isFinite(p.R)?p.R:1e9,od=p.OD||4,src=p.fromCurve?'datum curve':'solid';
  return{Q:Q.map(q=>q.map(v=>Math.round(v*1000)/1000)),d,wi,minR,len:p.length,tidx:hose?[0,Q.length-1]:[],qLabel,stations,parts,cable:{d:od,gap:0},
    name:`${p.name} · ${hose?'hose':'pipe'}`,kind:'pipe',kindLabel:`${hose?'hose':'pipe'} read from assembly (${src})`,params:{R:minR,SF:1},
    settings:hose?`hose Ø${p.OD?fmt(p.OD,2):'--'} mm, smallest bend radius ${isFinite(p.R)?fmt(p.R,1):'--'}, ${Math.round(p.length)} mm, ${Q.length} points (spline, ≤0.2 mm chord), from ${ASM.name}${p.forced?' (marked as pipe)':''}`
      :`Ø${fmt(p.OD,2)}${p.ID?'/'+fmt(p.ID,2):''} mm, bend R ${isFinite(p.R)?fmt(p.R,2):'--'}, ${p.bends.length} bends, shortest straight ${isFinite(p.info.minStraight)?Math.round(p.info.minStraight):'--'} mm, from ${ASM.name}${p.forced?' (marked as pipe)':''}`,
    asm:{file:ASM.name,pi},clamps:asmClampViz(pi),hdr:asmHeader(p,Q.length),text:''};
}
function asmTexts(){const F=asmFrame();
  runs.filter(r=>r.kind==='pipe'&&r.asm&&ASM&&r.asm.file===ASM.name&&!r.cmp).forEach(r=>{r.text=asmPtsText(r.hdr,r.Q,F,r.hdrExtra);});
  if(TH.last)$('thPts').value=TH.last.run.text;renderPts();}

// parse (again) with the saved overrides and replace this file's runs
function asmApply(note){
  const t0=performance.now();let r;
  try{r=StepAsm.parse(ASM.text,{pipe:ASM.ov});}catch(e){return cadSay('statusPipe',`${ASM.name}: ${e.message}`,true);}
  ASM.r=r;TH.pick={};TH.last=null;TH.cmp=null;const ms=Math.round(performance.now()-t0),s=r.summary,parts=r.instances.filter(i=>i.solids).length;
  runs=runs.filter(x=>!(x.asm&&x.asm.file===ASM.name));
  const nOv=Object.keys(ASM.ov).length,tree=`${parts} part${parts===1?'':'s'} with solids (${s.solids} solid${s.solids===1?'':'s'}), ${s.csys} coordinate systems${nOv?`, ${nOv} part${nOv>1?'s':''} marked by hand`:''}`;
  const nH=r.pipes.filter(p=>p.kind==='hose').length,nP=r.pipes.length-nH,found=[nP?`${nP} pipe${nP===1?'':'s'}`:'',nH?`${nH} hose${nH===1?'':'s'}`:''].filter(Boolean).join(', ');
  thSetup();
  if(!r.pipes.length){renderRuns();rebuild(true);renderCmp();renderPts();
    return cadSay('statusPipe',`${note?note+' ':''}${ASM.name}: ${tree}. No pipe or hose found. Open “Parts” below to see why per part, and mark the pipe there.`,true);}
  r.pipes.forEach((p,pi)=>{r.clampsFor(pi).forEach(c=>{if(c.use)TH.pick[pi+':'+c.i]=true;});});
  r.pipes.forEach((p,pi)=>addRun(asmRun(p,pi)));asmTexts();thRender();
  cadSay('statusPipe',`${note?note+' ':''}${ASM.name}: ${tree}; ${found}: ${r.pipes.map(p=>`${p.name} ${AsmTree.pipeText(p)}`).join('; ')}. Read in ${ms} ms.`);
}
function asmLoad(file){
  cadSay('statusPipe',`Reading ${file.name}...`);
  file.text().then(text=>{ASM={name:file.name,text,ov:AsmTree.load(file.name),r:null};$('asmParts').open=false;asmApply();});
}
function asmTree(){if(!ASM||!ASM.r)return;const n=new Set(ASM.r.instances.filter(i=>i.solids).map(i=>i.pd)).size;$('asmPartsN').textContent=`(${n} different)`;
  AsmTree.render($('asmTree'),ASM.r,{compact:true,overrides:ASM.ov,onChange:(name,v)=>{
    if(v==null)delete ASM.ov[name];else ASM.ov[name]=v;AsmTree.save(ASM.name,ASM.ov);
    cadSay('statusPipe',`Re-reading ${ASM.name}...`);setTimeout(()=>{asmApply(`${name} ${v==null?'back to auto':v?'marked as pipe':'marked not a pipe'}.`);$('asmParts').open=true;},10);}});}

// ---- panel setup ----
function thSetup(){const box=$('thBox');if(!ASM||!ASM.r){box.hidden=true;return;}box.hidden=false;asmTree();
  const has=ASM.r.pipes.length>0;$('asmPipeUI').hidden=!has;if(!has){$('asmParts').open=true;return;}
  $('thPipe').innerHTML=ASM.r.pipes.map((p,i)=>`<option value="${i}" title="${esc(p.name)}">${esc(pipeShort(p.name))} · ${esc(AsmTree.pipeText(p))}</option>`).join('');
  const fr=asmFrames(),def=ASM.r.instances[0].csys.find(c=>c.name==='MAIN');
  $('thFrame').innerHTML=`<option value="">file origin</option>`+fr.map(c=>`<option value="${esc(c.name)}"${def&&c===def?' selected':''}>${esc(c.name)}</option>`).join('');
  $('thOut').innerHTML='';$('thPts').value='';['thCopy','thDl'].forEach(k=>$(k).disabled=true);$('statusThrough').textContent='';
  $('cmpOut').innerHTML='';$('cmpBtns').hidden=true;$('statusCmp').textContent='';}
function thPipe(){return ASM?+$('thPipe').value||0:0;}
// pipe name without the part common to all pipes in the file (U104904_PIPING-3_PRACTICE_211 -> PRACTICE_211)
function pipeShort(n){const N=ASM&&ASM.r?ASM.r.pipes.map(p=>p.name):[];if(N.length<2)return n.replace(/^.*?_(?=[^_]+_[^_]+$)/,'');
  let k=0;while(N.every(x=>x[k]===N[0][k]))k++;const cut=N[0].lastIndexOf('_',k-1);const tail=n.slice(cut+1);
  const b=n.slice(0,cut).lastIndexOf('_');return(b>=0?n.slice(b+1,cut)+'_':'')+tail;}
function thRender(){if(!ASM)return;const pi=thPipe(),p=ASM.r.pipes[pi];if(!p)return;
  const arcs=p.kind!=='hose'&&p.bends.length>0;['thR','thMin','thMargin','thDrop','thRun'].forEach(k=>$(k).disabled=!arcs);
  $('thR').value=isFinite(p.R)?fmt(p.R,2):'';
  const C=ASM.r.clampsFor(pi),box=$('thClamps');
  if(!arcs){box.innerHTML=`<p class="hint">Routing through clamps works on lines + arcs pipes (corner points, one radius). This ${p.kind==='hose'?'hose is a spline':'pipe has no bends'}.</p>`;return;}
  if(!C.length){box.innerHTML=`<p class="hint">No clamp bore fits this pipe (Ø${fmt(p.OD,1)} ±1.5 mm). A clamp is a hole with a coordinate system on its axis, inside the hole.</p>`;return;}
  box.innerHTML=C.map(c=>{const k=pi+':'+c.i,dis=c.end||c.holds,why=c.end?'end fitting of this pipe':c.holds?`holds ${esc(c.holds)}`:c.passes?'pipe passes through it':`pipe misses it by ${fmt(c.dist,1)} mm`;
    return`<label class="chk thc"><input type="checkbox" data-k="${k}" ${TH.pick[k]&&!dis?'checked':''} ${dis?'disabled':''}><span><b>${esc(c.fix.name)}</b> <span class="unit">${esc(c.fix.csys)} · bore Ø${fmt(c.fix.D,2)} × ${fmt(c.fix.length,1)} · ${why}</span></span></label>`;}).join('')+
    `<p class="hint">Ticked: the pipe must run straight through. Bores of another size, bolt holes and end fittings are left out.</p>`;
  box.querySelectorAll('input[data-k]').forEach(el=>el.onchange=()=>{TH.pick[el.dataset.k]=el.checked;const r=asmBase(pi);if(r){r.clamps=asmClampViz(pi);rebuild(false);}});}

// ---- compare a .pts with the selected pipe ----
function cmpLoad(file){const say=(m,bad)=>{$('statusCmp').textContent=m;$('statusCmp').style.color=bad?'var(--bad)':'';};
  file.text().then(text=>{let res,pi=thPipe(),switched='';
    // the .pts may belong to another pipe in the file: take the pipe its points land on
    try{const all=ASM.r.pipes.map((q,i)=>({i,res:PtsCompare.compare(ASM.r,i,text)})),pick=all.slice().sort((a,b)=>a.res.frame.err-b.res.frame.err)[0];
      if(pick.i!==pi&&pick.res.frame.err<all[pi].res.frame.err-0.01){switched=`Points fit ${pipeShort(ASM.r.pipes[pick.i].name)}, not ${pipeShort(ASM.r.pipes[pi].name)}: switched to it. `;pi=pick.i;$('thPipe').value=String(pi);thRender();}
      res=all[pi].res;}catch(e){return say(`${file.name}: ${e.message}`,true);}
    const p=ASM.r.pipes[pi];
    // no pipe in the file takes these points: one line, not a corner-by-corner list
    if(res.frame.auto&&res.frame.err>Math.max(res.tol,p.OD||0)){TH.cmp=null;$('cmpBtns').hidden=true;$('cmpBtns').style.display='none';
      runs=runs.filter(x=>!(x.cmp&&x.asm&&x.asm.file===ASM.name));renderRuns();rebuild(false);
      $('cmpOut').innerHTML=`<ul><li class="bad">${esc(file.name)} does not fit any pipe in ${esc(ASM.name)}. Closest: ${esc(pipeShort(p.name))} in the ${esc(res.frame.frame)} frame, with the points ${res.frame.err.toFixed(1)} mm off it (median). Check that the .pts and the assembly belong together.</li></ul>`;
      return say(`${file.name}: no pipe matches.`,true);}
    const opt=[...$('thFrame').options].find(o=>(o.value||'file origin')===res.frame.frame);if(opt){$('thFrame').value=opt.value;asmTexts();thReport();}
    TH.cmp={res,file:file.name,pi};cmpReport();
    // what Creo builds from these points, in file order
    const W=res.kept.map(k=>k.w);let d=null,R=p.R;
    if(res.isPipe&&W.length>=2&&isFinite(R)){try{const G=ArcRoute.build(W,R),s=ArcRoute.sample(G,Math.max(2,p.OD/4));if(s.pts.length&&s.pts.every(q=>q.every(Number.isFinite)))d=s;}catch(e){d=null;}}
    if(!d){const pts=[],k=[],d1s=[],d2s=[];W.forEach((q,i)=>{if(!i)return;const a=W[i-1],n=Math.max(1,Math.ceil(V.len(V.sub(q,a))/5)),t=V.norm(V.sub(q,a));
        for(let j=i===1?0:1;j<=n;j++){pts.push(V.add(a,V.mul(V.sub(q,a),j/n)));k.push(1e-9);d1s.push(t);d2s.push([0,0,0]);}});
      const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+V.len(V.sub(pts[i],pts[i-1])));d={pts,k,s,d1s,d2s};}
    const base=asmBase(pi);
    runs=runs.filter(x=>!(x.cmp&&x.asm&&x.asm.pi===pi&&x.asm.file===ASM.name));
    addRun({Q:W,d,wi:0,minR:isFinite(R)?R:1e9,len:d.s[d.s.length-1],tidx:res.kept.map((k,i)=>k.status==='corner'||k.status==='on'?-1:i).filter(i=>i>=0),
      qLabel:res.kept.map(k=>`#${k.n} ${k.status==='corner'?'':k.status==='on'?'':k.status==='past'?'past end':k.status==='arc'?'on arc':'off'}${k.inOrder?'':' order'}`.trim()),
      stations:[],parts:base?base.parts:[],cable:{d:Math.max(1,(p.OD||4)*0.45),gap:0},
      name:`${file.name} vs ${p.name}`,kind:'pipe',kindLabel:'.pts compared with the assembly',params:{R:isFinite(R)?R:1e9,SF:1},
      settings:`${res.kept.length} points${res.dropped.length?` (+${res.dropped.length} repeats dropped)`:''}, ${res.frame.frame} frame; ${res.isPipe?`joined in file order with single radius ${fmt(R,1)}, as Creo would`:'joined in file order'}; big points need a look`,
      asm:{file:ASM.name,pi},cmp:true,text:PtsCompare.orderedText(res,`${file.name}: points in route order, repeats dropped (compared with ${p.name}).`)});
    say(`${switched}${file.name}: ${res.ok?'matches the pipe':'differs from the pipe'} (${res.summary.filter(s=>s.sev==='bad').length} problem${res.summary.filter(s=>s.sev==='bad').length===1?'':'s'}, ${res.summary.filter(s=>s.sev==='warn').length} note${res.summary.filter(s=>s.sev==='warn').length===1?'':'s'}).`,!res.ok);
  });}
function cmpReport(){const C=TH.cmp;if(!C)return;const{res}=C,F=asmFrame(),xyz=q=>asmLocal(q,F).map(v=>v.toFixed(3)).join('  ');
  const rows=res.raw.map((row,i)=>{const n=i+1,k=res.kept.find(x=>x.n===n),dup=res.dropped.find(x=>x.n===n);
    if(dup)return`<tr class="drop" title="line ${row.line}"><td>${n}</td><td>${row.line}</td><td>repeat of #${dup.dupOf}, dropped</td></tr>`;
    const sev=k.status==='off'||!k.inOrder?'bad':k.status==='past'||k.status==='arc'?'warn':'';
    return`<tr class="${sev}" title="${xyz(k.w)}  (s = ${k.s.toFixed(1)} mm along the ${res.isPipe?'pipe':'hose'})"><td>${n}</td><td>${row.line}</td><td>${esc(k.note)}</td></tr>`;}).join('');
  const miss=res.missing.length?`<p class="hint">Missing corners (${esc(F.name)} frame): ${res.missing.map(c=>`${c.i===0?'start':c.i===res.pipe.Q.length-1?'end':'corner '+c.i} ${xyz(c.q)}`).join('; ')}.</p>`:'';
  $('cmpOut').innerHTML=`<ul>${res.summary.map(s=>`<li class="${s.sev}">${esc(s.t)}</li>`).join('')}</ul>${miss}
    <table><thead><tr><th>#</th><th>line</th><th>point</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">Tolerance ${res.tol} mm. Hover a row for its X Y Z and its distance along the ${res.isPipe?'pipe':'hose'}. In 3D the thin tube is what Creo builds from these points in file order. Reordered .pts: same points, repeats dropped, in route order — missing corners are not added.</p>`;
  $('cmpBtns').hidden=false;$('cmpBtns').style.display='';}

// ---- route through clamps ----
function thRun(){
  if(!ASM)return;const pi=thPipe(),p=ASM.r.pipes[pi],say=(m,bad)=>{$('statusThrough').textContent=m;$('statusThrough').style.color=bad?'var(--bad)':'';};
  const C=ASM.r.clampsFor(pi).filter(c=>TH.pick[pi+':'+c.i]&&!c.end&&!c.holds);
  if(!C.length)return say('Tick at least one clamp.',true);
  const R=+$('thR').value||p.R,minS=Math.max(0,+$('thMin').value||0),margin=Math.max(0,+$('thMargin').value||0);
  say(`Routing ${p.name} through ${C.length} clamp${C.length>1?'s':''}...`);$('thRun').disabled=true;
  setTimeout(()=>{let res;const t0=performance.now();
    try{res=Through.solve(p.Q,{R,minStraight:minS,margin,dropDetours:$('thDrop').checked,clamps:C.map(c=>({c:c.fix.c,a:c.fix.d,length:c.fix.length,name:c.fix.name}))});}
    catch(e){$('thRun').disabled=false;return say(e.message,true);}
    $('thRun').disabled=false;const ms=Math.round(performance.now()-t0);
    if(!res.ok){$('thOut').innerHTML='';return say(`No route: ${res.reason}. Try a smaller margin or min straight, or untick a clamp.`,true);}
    const rep=res.report,G=rep.G,d=ArcRoute.sample(G,Math.max(2,p.OD/4));let wi=0;d.k.forEach((k,i)=>{if(k>d.k[wi])wi=i;});
    const okSet=new Set(C.filter((c,k)=>rep.clamps[k].ok).map(c=>c.i));
    const qLabel=rep.rows.map((row,i)=>i===0?'start':i===rep.rows.length-1?'end':(row.was<0?'new ':'')+(row.clamp?'clamp ':'')+`${row.deg.toFixed(1)}°`);
    const names=C.map(c=>c.fix.name).join(', '),hdr={title:`${p.name} routed through ${names}.`,kind:'pipe',OD:p.OD,ID:p.ID,R,bends:rep.bends,straights:rep.straights,length:rep.length};
    const extra=[`Through ${C.map((c,k)=>`${c.fix.name} (${c.fix.csys}, bore Ø${fmt(c.fix.D,2)})`).join(', ')}: centreline straight along each bore, at most ${Math.max(...rep.clamps.map(c=>c.maxOff)).toFixed(3)} mm off its axis.`,
      `Changed from ${ASM.name}: ${p.Q.length} → ${res.W.length} points, largest corner move ${fmt(Math.max(0,...rep.rows.map(x=>x.moved||0)),2)} mm${rep.removed.length?`, dropped corner${rep.removed.length>1?'s':''} ${rep.removed.map(i=>'#'+(i+1)).join(', ')} (detour)`:''}, ends and end directions kept.`];
    const old=asmBase(pi);if(old){old.visible=true;}
    const run=addRun({Q:res.W,d,wi,minR:R,len:rep.length,tidx:[],qLabel,stations:[],parts:old?old.parts:[],cable:{d:p.OD,gap:0},
      name:`${p.name} · through ${C.length>1?C.length+' clamps':C[0].fix.name}`,kind:'pipe',kindLabel:'pipe routed through clamps',params:{R,SF:1},
      settings:`${res.W.length} corner points, single radius ${fmt(R,2)}, shortest straight ${Math.round(rep.minStraight)} mm (min ${minS}), margin ${margin} mm, through ${names}`,
      asm:{file:ASM.name,pi},through:true,clamps:asmClampViz(pi,okSet),hdr,hdrExtra:extra,text:''});
    TH.last={run,rep,res,p,C};asmTexts();thReport();
    say(`Done in ${ms} ms. ${res.steps.map(s=>s.clamp?`${s.clamp}: ${s.how}`:s.how).join('; ')}.`);
  },20);
}
function thReport(){const L=TH.last;if(!L)return;const{rep,res,p,C}=L,F=asmFrame(),loc=q=>asmLocal(q,F);
  const rows=rep.rows.map((row,i)=>{const q=loc(row.p),note=i===0?'start, kept':i===rep.rows.length-1?'end, kept':row.was<0?'new corner':row.moved>0.0015?`moved`:'unchanged';
    return`<tr title="${q.map(v=>v.toFixed(3)).join('  ')}"><td>${i+1}</td><td>${row.was<0?'—':'#'+(row.was+1)}</td><td class="${row.moved>0.0015?'mv':''}">${row.moved==null?'—':row.moved.toFixed(3)}</td><td>${row.deg==null?'':row.deg.toFixed(1)}</td><td>${note}${row.clamp?', on bore axis':''}</td></tr>`;}).join('');
  const gone=rep.removed.length?`<p class="sum">Dropped as detours: ${rep.removed.map(i=>'#'+(i+1)).join(', ')} (old numbering). Untick “Drop detour corners” to keep them.</p>`:'';
  const cl=rep.clamps.map((c,k)=>`<li style="color:var(${c.ok?'--ok':'--bad'})">${esc(c.name)}: straight through the full ${fmt(c.half*2,1)} mm bore, ${c.maxOff.toFixed(3)} mm off its axis (limit 0.050). The straight runs ${c.covered[0].toFixed(1)} to +${c.covered[1].toFixed(1)} mm from the bore centre. Bore Ø${fmt(C[k].fix.D,2)}, pipe Ø${fmt(p.OD,2)}${C[k].fix.D<p.OD?` (${fmt(p.OD-C[k].fix.D,2)} mm tighter than the pipe)`:''}.</li>`).join('');
  $('thOut').innerHTML=`<table><thead><tr><th>#</th><th>was</th><th>moved</th><th>bend °</th><th></th></tr></thead><tbody>${rows}</tbody></table>${gone}
    <ul class="sum">${cl}<li>Ends: moved ${rep.endMove.toFixed(3)} mm, direction ${rep.endDirErr.toFixed(3)}°.</li>
    <li>Single radius ${fmt(L.run.params.R,2)}; ${rep.bends.length} bends; shortest straight between bends ${fmt(rep.minStraight,1)} mm; length ${Math.round(p.length)} → ${Math.round(rep.length)} mm.</li>
    <li>Coordinates (${esc(F.name)} frame) are in the .pts below and in the Points pane; hover a row to see them. Clearance to other parts is not checked yet.</li></ul>`;
  $('thPts').value=L.run.text;['thCopy','thDl'].forEach(k=>$(k).disabled=false);}

{const inp=$('asmfile');if(inp){$('aAsm').onclick=()=>inp.click();inp.onchange=e=>{if(e.target.files[0])asmLoad(e.target.files[0]);e.target.value='';};}
  const ci=$('cmpfile');$('cmpOpen').onclick=()=>ci.click();ci.onchange=e=>{if(e.target.files[0]&&ASM)cmpLoad(e.target.files[0]);e.target.value='';};
  $('thPipe').onchange=()=>{thRender();$('cmpOut').innerHTML='';$('cmpBtns').hidden=true;$('statusCmp').textContent='';TH.cmp=null;};
  $('thRun').onclick=thRun;$('thFrame').onchange=()=>{asmTexts();thReport();cmpReport();};
  const copy=async(btn,text,label)=>{try{await navigator.clipboard.writeText(text);btn.textContent='Copied';}catch(e){btn.textContent='Copy failed: use Download';}setTimeout(()=>btn.textContent=label,1600);};
  $('thCopy').onclick=()=>{const t=$('thPts');if(t.value)copy($('thCopy'),t.value,'Copy .pts');};
  $('thDl').onclick=()=>{const L=TH.last;if(!L)return;cadDownload(L.p.name.replace(/[^\w.-]+/g,'_')+'_through.pts',$('thPts').value);};
  const cmpText=()=>TH.cmp?PtsCompare.orderedText(TH.cmp.res,`${TH.cmp.file}: points in route order, repeats dropped (compared with ${TH.cmp.res.pipe.name}).`):'';
  $('cmpCopy').onclick=()=>{const t=cmpText();if(t)copy($('cmpCopy'),t,'Copy reordered .pts');};
  $('cmpDl').onclick=()=>{const t=cmpText();if(t)cadDownload(TH.cmp.file.replace(/\.[^.]+$/,'')+'_ordered.pts',t);};}
