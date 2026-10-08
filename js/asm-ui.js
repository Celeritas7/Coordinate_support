// ---------------- Assembly STEP: parts, stations, pipe centrelines, route through clamps ----------------
// Loaded last. Reads a Creo assembly export with StepAsm (js/step-asm.js): every part instance with its placement,
// named coordinate systems in world coordinates, the centreline of each swept pipe (cylinders + tori) and the clamp
// bores (a hole with a CSYS on its axis). Each pipe becomes a run. "Route through clamps" (js/through.js) re-routes
// a pipe so it runs straight through the ticked bores, ends and radius kept.
let ASM=null;
const TH={pick:{},last:null};

// ---- frames: .pts files are written in a named CSYS (MAIN for the practice files) ----
function asmFrames(){if(!ASM)return[];const seen=new Set(),out=[];
  ASM.r.instances[0].csys.concat(ASM.r.csys).forEach(c=>{if(!seen.has(c.name)){seen.add(c.name);out.push(c);}});return out;}
function asmFrame(){const n=$('thFrame')?$('thFrame').value:'';const c=asmFrames().find(f=>f.name===n);return c?{name:c.name,M:{o:c.o,x:c.x,y:c.y,z:c.z}}:{name:'file origin',M:null};}
const asmLocal=(q,F)=>F.M?StepAsm.F.toLocal(F.M,q):q;

function asmPtsText(h,Q,F,extra){
  const f=c=>c.toFixed(3).padStart(15),Ql=Q.map(q=>asmLocal(q,F));
  return["!","!       DATUM POINT ARRAY DATA FILE","!",
    `! ${h.title}`,
    `! Pipe OD ${fmt(h.OD,2)} mm${h.ID?`, ID ${fmt(h.ID,2)} mm`:''}. Creo: Curve through points, Single radius ${fmt(h.R,2)} mm. ${h.bends.length} bend${h.bends.length===1?'':'s'}, length ${Math.round(h.length)} mm.`,
    ...(h.bends.length?[`! Bend angles: ${h.bends.map(b=>b.toFixed(1)+'°').join(', ')}. Straights: ${h.straights.map(s=>Math.round(s)).join(', ')} mm.`]:[]),
    ...(extra||[]).map(l=>'! '+l),
    `! Coordinates in the ${F.name} frame.`,
    "!","! Enter values with respect to datum arrays' coordinate system:","!",
    "!CARTESIAN coordinates:","!        X                Y                Z","!",
    ...Ql.map(q=>`${f(q[0])} ${f(q[1])} ${f(q[2])}`)].join("\n")+"\n";
}
function asmHeader(p){const st=p.chain.pieces.filter(x=>x.type==='line').map(x=>x.len);
  return{title:`${p.name}: corner points read from ${ASM.name}.`,OD:p.OD,ID:p.ID,R:p.R,bends:p.bends.map(b=>b.deg),straights:st,length:p.length};}

// clamps shown with a pipe run: state ok (pipe passes), target (ticked, not passed yet), off
function asmClampViz(pi,okSet){const C=ASM.r.clampsFor(pi);
  return C.filter(c=>!c.end&&!c.holds).map(c=>({c:c.fix.c,d:c.fix.d,r:c.fix.r,length:c.fix.length,name:c.fix.name,
    ok:okSet?okSet.has(c.i):c.passes,on:!!TH.pick[pi+':'+c.i]}));}

function asmRun(p,pi){
  const r=ASM.r,d=p.samples;let wi=0;d.k.forEach((k,i)=>{if(k>d.k[wi])wi=i;});
  const near=p.OD*1.5,stations=r.csys.filter(c=>StepAsm.nearest(p.chain,c.o).d<=near||p.Q.some(q=>V.len(V.sub(q,c.o))<=near)).map(c=>({p:c.o,name:c.name}));
  const label=q=>{const c=stations.find(s=>V.len(V.sub(s.p,q))<=near);return c?c.name:'';};
  const qLabel=p.Q.map((q,i)=>{const nm=label(q);if(i===0)return nm||'start';if(i===p.Q.length-1)return nm||'end';return (nm?nm+' ':'')+`${p.bends[i-1].deg.toFixed(1)}°`;});
  const parts=r.instances.map((inst,i)=>inst.bbox&&i!==p.inst?{name:inst.label,min:inst.bbox.min,max:inst.bbox.max}:null).filter(Boolean);
  const minR=isFinite(p.R)?p.R:1e9;
  return{Q:p.Q.map(q=>q.map(v=>Math.round(v*1000)/1000)),d,wi,minR,len:p.length,tidx:[],qLabel,stations,parts,cable:{d:p.OD,gap:0},
    name:`${p.name} · pipe`,kind:'pipe',kindLabel:'pipe read from assembly',params:{R:minR,SF:1},
    settings:`Ø${fmt(p.OD,2)}${p.ID?'/'+fmt(p.ID,2):''} mm, bend R ${isFinite(p.R)?fmt(p.R,2):'--'}, ${p.bends.length} bends, shortest straight ${isFinite(p.info.minStraight)?Math.round(p.info.minStraight):'--'} mm, from ${ASM.name}`,
    asm:{file:ASM.name,pi},clamps:asmClampViz(pi),hdr:asmHeader(p),text:''};
}
function asmTexts(){const F=asmFrame();
  runs.filter(r=>r.kind==='pipe'&&r.asm&&ASM&&r.asm.file===ASM.name).forEach(r=>{r.text=asmPtsText(r.hdr,r.Q,F,r.hdrExtra);});
  if(TH.last)$('thPts').value=TH.last.run.text;renderPts();}

// placed parts with their world box and edge cloud (Phase A of the hose module)
function asmPartsList(r){const box=$('asmParts');if(!box)return;
  const rows=r.instances.filter(i=>i.cloud||i.solids),by=new Map();rows.forEach(i=>{if(!by.has(i.name))by.set(i.name,[]);by.get(i.name).push(i);});
  const b=i=>i.bbox?`${i.bbox.min.map(v=>v.toFixed(1)).join(' ')} … ${i.bbox.max.map(v=>v.toFixed(1)).join(' ')}`:'--';
  box.querySelector('summary').textContent=`Parts: ${by.size} part${by.size===1?'':'s'}, ${rows.length} placed instances, ${r.summary.cloudPoints.toLocaleString()} edge points`;
  box.querySelector('.asmtbl').innerHTML=`<table><thead><tr><th>Part</th><th>edges</th><th>points</th><th>box X Y Z min … max (mm)</th></tr></thead><tbody>${
    rows.map(i=>`<tr title="${esc(i.label)}"><td>${esc(i.name)}</td><td class="n">${i.edges||0}</td><td class="n">${i.cloud?i.cloud.length/3:0}</td><td>${b(i)}</td></tr>`).join('')}</tbody></table>`;
  box.hidden=!rows.length;}

function asmLoad(file){
  cadSay('statusAnalyse',`Reading ${file.name}...`);
  const prog=$('asmProg'),bar=prog&&prog.querySelector('progress'),lab=prog&&prog.querySelector('span');
  const show=(stage,f)=>{if(!prog)return;prog.hidden=false;bar.value=f;lab.textContent=`${stage} ${Math.round(f*100)}%`;};
  $('aAsm').disabled=true;show('Opening file',0);
  file.text().then(text=>{const t0=performance.now();
    return StepAsm.parseAsync(text,{progress:show}).then(r=>{
    ASM={name:file.name,r};TH.pick={};TH.last=null;const ms=Math.round(performance.now()-t0),s=r.summary;
    const tree=`${s.parts} products, ${s.placed} placed part instances (${s.solids} solids, ${s.cloudPoints.toLocaleString()} edge points), ${s.csys} coordinate systems, read in ${(ms/1000).toFixed(1)} s`;
    asmPartsList(r);thSetup();
    if(!r.pipes.length)return cadSay('statusAnalyse',`${file.name}: ${tree}. No swept pipe found (cylinders and tori of one radius); a hose made of B-spline faces is read in the next step.`,!s.placed);
    r.pipes.forEach((p,pi)=>{r.clampsFor(pi).forEach(c=>{if(c.use)TH.pick[pi+':'+c.i]=true;});});
    r.pipes.forEach((p,pi)=>addRun(asmRun(p,pi)));asmTexts();thRender();
    cadSay('statusAnalyse',`${file.name}: ${tree}; ${r.pipes.length} pipe${r.pipes.length===1?'':'s'}: ${r.pipes.map(p=>`${p.name} Ø${fmt(p.OD,1)} R ${isFinite(p.R)?fmt(p.R,1):'--'}, ${p.bends.length} bends, ${Math.round(p.length)} mm`).join('; ')}.`);
  });}).catch(e=>cadSay('statusAnalyse',`${file.name}: ${e.message}`,true))
  .finally(()=>{$('aAsm').disabled=false;if(prog)prog.hidden=true;});
}

// ---- route through clamps panel ----
function thSetup(){const box=$('thBox');if(!ASM||!ASM.r.pipes.length){box.hidden=true;return;}box.hidden=false;
  $('thPipe').innerHTML=ASM.r.pipes.map((p,i)=>`<option value="${i}">${esc(p.name)} · Ø${fmt(p.OD,1)} R ${fmt(p.R,1)}</option>`).join('');
  const fr=asmFrames(),def=ASM.r.instances[0].csys.find(c=>c.name==='MAIN');
  $('thFrame').innerHTML=`<option value="">file origin</option>`+fr.map(c=>`<option value="${esc(c.name)}"${def&&c===def?' selected':''}>${esc(c.name)}</option>`).join('');
  $('thOut').innerHTML='';$('thPts').value='';['thCopy','thDl'].forEach(k=>$(k).disabled=true);$('statusThrough').textContent='';}
function thPipe(){return ASM?+$('thPipe').value||0:0;}
function thRender(){if(!ASM)return;const pi=thPipe(),p=ASM.r.pipes[pi];if(!p)return;
  $('thR').value=fmt(p.R,2);
  const C=ASM.r.clampsFor(pi),box=$('thClamps');
  if(!C.length){box.innerHTML=`<p class="hint">No clamp bore fits this pipe (Ø${fmt(p.OD,1)} ±1.5 mm). A clamp is a hole with a coordinate system on its axis, inside the hole.</p>`;return;}
  box.innerHTML=C.map(c=>{const k=pi+':'+c.i,dis=c.end||c.holds,why=c.end?'end fitting of this pipe':c.holds?`holds ${esc(c.holds)}`:c.passes?'pipe passes through it':`pipe misses it by ${fmt(c.dist,1)} mm`;
    return`<label class="chk thc"><input type="checkbox" data-k="${k}" ${TH.pick[k]&&!dis?'checked':''} ${dis?'disabled':''}><span><b>${esc(c.fix.name)}</b> <span class="unit">${esc(c.fix.csys)} · bore Ø${fmt(c.fix.D,2)} × ${fmt(c.fix.length,1)} · ${why}</span></span></label>`;}).join('')+
    `<p class="hint">Ticked: the pipe must run straight through. Bores of another size, bolt holes and end fittings are left out.</p>`;
  box.querySelectorAll('input[data-k]').forEach(el=>el.onchange=()=>{TH.pick[el.dataset.k]=el.checked;const r=runs.find(x=>x.kind==='pipe'&&x.asm&&x.asm.pi===pi&&!x.through);if(r){r.clamps=asmClampViz(pi);rebuild(false);}});}
function thRun(){
  if(!ASM)return;const pi=thPipe(),p=ASM.r.pipes[pi],say=(m,bad)=>{$('statusThrough').textContent=m;$('statusThrough').style.color=bad?'var(--bad)':'';};
  const C=ASM.r.clampsFor(pi).filter(c=>TH.pick[pi+':'+c.i]&&!c.end&&!c.holds);
  if(!C.length)return say('Tick at least one clamp.',true);
  const R=+$('thR').value||p.R,minS=Math.max(0,+$('thMin').value||0),margin=Math.max(0,+$('thMargin').value||0);
  say(`Routing ${p.name} through ${C.length} clamp${C.length>1?'s':''}...`);$('thRun').disabled=true;
  setTimeout(()=>{let res;const t0=performance.now();
    try{res=Through.solve(p.Q,{R,minStraight:minS,margin,clamps:C.map(c=>({c:c.fix.c,a:c.fix.d,length:c.fix.length,name:c.fix.name}))});}
    catch(e){$('thRun').disabled=false;return say(e.message,true);}
    $('thRun').disabled=false;const ms=Math.round(performance.now()-t0);
    if(!res.ok){$('thOut').innerHTML='';return say(`No route: ${res.reason}. Try a smaller margin or min straight, or untick a clamp.`,true);}
    const rep=res.report,G=rep.G,d=ArcRoute.sample(G,Math.max(2,p.OD/4));let wi=0;d.k.forEach((k,i)=>{if(k>d.k[wi])wi=i;});
    const okSet=new Set(C.filter((c,k)=>rep.clamps[k].ok).map(c=>c.i));
    const qLabel=rep.rows.map((row,i)=>i===0?'start':i===rep.rows.length-1?'end':(row.was<0?'new ':'')+(row.clamp?'clamp ':'')+`${row.deg.toFixed(1)}°`);
    const names=C.map(c=>c.fix.name).join(', '),hdr={title:`${p.name} routed through ${names}.`,OD:p.OD,ID:p.ID,R,bends:rep.bends,straights:rep.straights,length:rep.length};
    const extra=[`Through ${C.map((c,k)=>`${c.fix.name} (${c.fix.csys}, bore Ø${fmt(c.fix.D,2)})`).join(', ')}: centreline straight along each bore, at most ${Math.max(...rep.clamps.map(c=>c.maxOff)).toFixed(3)} mm off its axis.`,
      `Changed from ${ASM.name}: ${p.Q.length} → ${res.W.length} points, largest corner move ${fmt(Math.max(0,...rep.rows.map(x=>x.moved||0)),2)} mm, ends and end directions kept.`];
    const old=runs.find(x=>x.kind==='pipe'&&x.asm&&x.asm.pi===pi&&!x.through);if(old){old.visible=true;}
    const run=addRun({Q:res.W,d,wi,minR:R,len:rep.length,tidx:[],qLabel,stations:[],parts:old?old.parts:[],cable:{d:p.OD,gap:0},
      name:`${p.name} · through ${C.length>1?C.length+' clamps':C[0].fix.name}`,kind:'pipe',kindLabel:'pipe routed through clamps',params:{R,SF:1},
      settings:`${res.W.length} corner points, single radius ${fmt(R,2)}, shortest straight ${Math.round(rep.minStraight)} mm (min ${minS}), margin ${margin} mm, through ${names}`,
      asm:{file:ASM.name,pi},through:true,clamps:asmClampViz(pi,okSet),hdr,hdrExtra:extra,text:''});
    TH.last={run,rep,res,p,C};asmTexts();thReport();
    say(`Done in ${ms} ms. ${res.steps.map(s=>`${s.clamp}: ${s.how}`).join('; ')}.`);
  },20);
}
function thReport(){const L=TH.last;if(!L)return;const{rep,res,p,C}=L,F=asmFrame(),loc=q=>asmLocal(q,F);
  const rows=rep.rows.map((row,i)=>{const q=loc(row.p),note=i===0?'start, kept':i===rep.rows.length-1?'end, kept':row.was<0?'new corner':row.moved>0.0015?`moved`:'unchanged';
    return`<tr title="${q.map(v=>v.toFixed(3)).join('  ')}"><td>${i+1}</td><td>${row.was<0?'—':'#'+(row.was+1)}</td><td class="${row.moved>0.0015?'mv':''}">${row.moved==null?'—':row.moved.toFixed(3)}</td><td>${row.deg==null?'':row.deg.toFixed(1)}</td><td>${note}${row.clamp?', on bore axis':''}</td></tr>`;}).join('');
  const gone=rep.removed.length?`<p class="sum">Removed: ${rep.removed.map(i=>'#'+(i+1)).join(', ')} (old numbering).</p>`:'';
  const cl=rep.clamps.map((c,k)=>`<li style="color:var(${c.ok?'--ok':'--bad'})">${esc(c.name)}: straight through the full ${fmt(c.half*2,1)} mm bore, ${c.maxOff.toFixed(3)} mm off its axis (limit 0.050). The straight runs ${c.covered[0].toFixed(1)} to +${c.covered[1].toFixed(1)} mm from the bore centre. Bore Ø${fmt(C[k].fix.D,2)}, pipe Ø${fmt(p.OD,2)}${C[k].fix.D<p.OD?` (${fmt(p.OD-C[k].fix.D,2)} mm tighter than the pipe)`:''}.</li>`).join('');
  $('thOut').innerHTML=`<table><thead><tr><th>#</th><th>was</th><th>moved</th><th>bend °</th><th></th></tr></thead><tbody>${rows}</tbody></table>${gone}
    <ul class="sum">${cl}<li>Ends: moved ${rep.endMove.toFixed(3)} mm, direction ${rep.endDirErr.toFixed(3)}°.</li>
    <li>Single radius ${fmt(L.run.params.R,2)}; ${rep.bends.length} bends; shortest straight between bends ${fmt(rep.minStraight,1)} mm; length ${Math.round(p.length)} → ${Math.round(rep.length)} mm.</li>
    <li>Coordinates (${esc(F.name)} frame) are in the .pts below and in the Points pane; hover a row to see them. Clearance to other parts is not checked yet.</li></ul>`;
  $('thPts').value=L.run.text;['thCopy','thDl'].forEach(k=>$(k).disabled=false);}

{const inp=$('asmfile');if(inp){$('aAsm').onclick=()=>inp.click();inp.onchange=e=>{if(e.target.files[0])asmLoad(e.target.files[0]);e.target.value='';};}
  $('thPipe').onchange=thRender;$('thRun').onclick=thRun;$('thFrame').onchange=()=>{asmTexts();thReport();};
  $('thCopy').onclick=async()=>{const t=$('thPts');if(!t.value)return;
    try{await navigator.clipboard.writeText(t.value);$('thCopy').textContent='Copied';}catch(e){t.select();try{document.execCommand('copy');$('thCopy').textContent='Copied';}catch(e2){$('thCopy').textContent='Select and copy';}}
    setTimeout(()=>$('thCopy').textContent='Copy .pts',1600);};
  $('thDl').onclick=()=>{const L=TH.last;if(!L)return;cadDownload(L.p.name.replace(/[^\w.-]+/g,'_')+'_through.pts',$('thPts').value);};}
