// ---------------- Pipe · Offset from another pipe (js/offset.js) ----------------
// Pick the fixed pipe and the follower (saved per file name), set the min surface gap, keep the clips both pipes
// run through. The follower's new corner points become a run and a .pts in the chosen frame.
{
const OF={last:null};const KEY='routeStudio.offsetPick.v1';
const picks=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){return{};}};
const savePick=v=>{try{const a=picks();a[ASM.name]=v;localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}};
const arcPipes=()=>ASM&&ASM.r?ASM.r.pipes.map((p,i)=>({p,i})).filter(x=>x.p.kind!=='hose'&&x.p.bends.length>0):[];
const say=(m,bad)=>cadSay('statusOffset',m,bad);
const fixI=()=>+$('ofFixed').value,folI=()=>+$('ofFollow').value;
const surf=(fix,fol,p)=>StepAsm.nearest(fix.chain,p).d-(fix.OD+fol.OD)/2;

function ofSetup(){const box=$('pipeOffset');if(!box)return;const P=arcPipes();
  $('ofOut').innerHTML='';$('ofPts').value='';['ofCopy','ofDl'].forEach(k=>$(k).disabled=true);say('');OF.last=null;
  const ui=$('ofUI');if(P.length<2){ui.hidden=true;$('ofNone').hidden=false;$('ofNone').textContent=ASM&&ASM.r?`${ASM.name} has ${P.length} lines + arcs pipe${P.length===1?'':'s'}; an offset needs two.`:'';return;}
  ui.hidden=false;$('ofNone').hidden=true;
  const opt=P.map(x=>`<option value="${x.i}">${esc(pipeShort(x.p.name))} · ${esc(AsmTree.pipeText(x.p))}</option>`).join('');
  $('ofFixed').innerHTML=opt;$('ofFollow').innerHTML=opt;
  const s=picks()[ASM.name],byName=n=>{const x=P.find(x=>x.p.name===n);return x?x.i:null;};
  let f=s?byName(s.fixed):null,w=s?byName(s.follow):null;if(f==null)f=P[0].i;if(w==null||w===f)w=P.find(x=>x.i!==f).i;
  $('ofFixed').value=String(f);$('ofFollow').value=String(w);if(s&&s.gap)$('ofGap').value=s.gap;$('ofObs').value=s&&s.obs||'';if(s&&s.obsGap!=null)$('ofObsGap').value=s.obsGap;ofPrep();}
function remember(){const r=ASM.r;savePick({fixed:r.pipes[fixI()].name,follow:r.pipes[folI()].name,gap:+$('ofGap').value||30,obs:$('ofObs').value,obsGap:+$('ofObsGap').value||0});}
// typed boxes in the .pts frame -> world boxes (axis-aligned around the moved corners)
function ofBoxes(){const F=asmFrame(),out=[],bad=[];
  $('ofObs').value.split(/\r?\n/).forEach((l,n)=>{const t=l.trim();if(!t||t[0]==='#'||t[0]==='!')return;const w=t.split(/[\s,;]+/);let id=w[0],v=w.slice(1).map(Number);
    if(!isNaN(+id)){v=w.map(Number);id='box '+(out.length+1);}if(v.length<6||v.slice(0,6).some(x=>!isFinite(x))){bad.push(n+1);return;}
    const lo=[0,1,2].map(k=>Math.min(v[k],v[k+3])),hi=[0,1,2].map(k=>Math.max(v[k],v[k+3])),mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<8;i++){const q=[i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]],p=F.M?StepAsm.F.pt(F.M,q):q;for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[k]);mx[k]=Math.max(mx[k],p[k]);}}
    out.push({id,min:mn,max:mx});});
  return{boxes:out,bad};}
// a 30 mm test cube where the follower would go at its closest spot to the fixed pipe, away from boxes already typed
function ofAddBox(){if(!ASM||!ASM.r)return;const r=ASM.r,fix=r.pipes[fixI()],fol=r.pipes[folI()],gap=+$('ofGap').value||30,F=asmFrame(),have=ofBoxes().boxes;
  const far=p=>have.every(b=>{const q=[0,1,2].map(k=>Math.max(b.min[k],Math.min(b.max[k],p[k])));return V.len(V.sub(p,q))>120;});
  const S=fol.samples.pts.map((p,i)=>({p,n:StepAsm.nearest(fix.chain,p),s:fol.samples.s[i]})).filter(x=>x.s>60&&x.s<fol.length-60&&far(x.p)).sort((a,b)=>a.n.d-b.n.d);
  if(!S.length)return say('No free spot left for another test box.',true);
  const x=S[0],u=V.norm(V.sub(x.p,x.n.q)),c=V.add(x.p,V.mul(u,gap+(fix.OD+fol.OD)/2+15)),lo=c.map(v=>v-15),hi=c.map(v=>v+15);
  const L=[lo,hi].map(q=>asmLocal(q,F)),a=[0,1,2].map(k=>Math.min(L[0][k],L[1][k])),b=[0,1,2].map(k=>Math.max(L[0][k],L[1][k]));
  const id='T'+(have.length+1),line=`${id}  ${a.map(v=>v.toFixed(1)).join(' ')}  ${b.map(v=>v.toFixed(1)).join(' ')}`;
  $('ofObs').value=($('ofObs').value.trim()?$('ofObs').value.trim()+'\n':'')+line;remember();
  say(`${id} added at ${Math.round(x.s)} mm along the follower, where it is ${fmt(x.n.d-(fix.OD+fol.OD)/2,1)} mm from ${pipeShort(fix.name)}. Run the offset to see it work around the box.`);}
// follower defaults and the clips both pipes run through
function ofPrep(){if(!ASM||!ASM.r)return;const r=ASM.r,fix=r.pipes[fixI()],fol=r.pipes[folI()];if(!fix||!fol)return;
  $('ofR').value=isFinite(fol.R)?fmt(fol.R,2):'';
  const before=(()=>{let mn=Infinity;fol.samples.pts.forEach(p=>{const g=surf(fix,fol,p);if(g<mn)mn=g;});return mn;})();
  const C=thClamps(folI()).filter(c=>c.known&&c.passes&&!c.end);OF.clips=C;
  $('ofClips').innerHTML=(C.length?C.map((c,k)=>`<label class="chk thc"><input type="checkbox" data-of="${k}" checked><span><b>${esc(c.fix.name)}</b> <span class="unit">${c.lib?c.lib.type+' · ':''}bore Ø${fmt(c.fix.D,2)} · spacing to ${esc(pipeShort(fix.name))} here ${fmt(surf(fix,fol,c.fix.c),1)} mm surface</span></span></label>`).join('')
      +`<p class="hint">Ticked: the follower keeps running straight through it, so the clip spacing wins over Min gap there.</p>`
    :`<p class="hint">The follower runs through no library clip. Add the clips under Library to hold them.</p>`)
    +`<p class="hint">Now: closest ${fmt(before,1)} mm surface to surface.</p>`;}

function ofRun(){if(!ASM||!ASM.r)return;const r=ASM.r,fi=fixI(),wi=folI(),fix=r.pipes[fi],fol=r.pipes[wi];
  if(fi===wi)return say('Pick two different pipes.',true);
  const gap=Math.max(0,+$('ofGap').value||0),R=+$('ofR').value||fol.R,minS=Math.max(0,+$('ofMin').value||0);remember();
  const C=(OF.clips||[]).filter((c,k)=>{const el=$('ofClips').querySelector(`[data-of="${k}"]`);return el&&el.checked;});
  const ob=ofBoxes(),obsGap=Math.max(0,+$('ofObsGap').value||0);if(ob.bad.length)return say(`Box line${ob.bad.length>1?'s':''} ${ob.bad.join(', ')}: need an id and six numbers.`,true);
  say(`Moving ${pipeShort(fol.name)} to ${gap} mm from ${pipeShort(fix.name)}${ob.boxes.length?` and ${obsGap} mm from ${ob.boxes.length} box${ob.boxes.length>1?'es':''}`:''} (takes a few seconds)...`);$('ofRun').disabled=true;
  setTimeout(()=>{let res;const t0=performance.now();
    try{res=PipeOffset.solve(fol.Q,{R,gap,odFixed:fix.OD,odFollow:fol.OD,minStraight:minS,near:p=>StepAsm.nearest(fix.chain,p),obstacles:ob.boxes,obsGap,
      clips:C.map(c=>({c:c.fix.c,a:c.fix.d,length:c.fix.length,name:c.fix.name}))});}
    catch(e){$('ofRun').disabled=false;return say(e.message,true);}
    $('ofRun').disabled=false;const ms=Math.round(performance.now()-t0);
    const d=ArcRoute.sample(res.G,Math.max(2,fol.OD/4));let k0=0;d.k.forEach((k,i)=>{if(k>d.k[k0])k0=i;});
    const qLabel=res.rows.map((x,i)=>i===0?'start':i===res.rows.length-1?'end':`${x.moved>0.01?'moved ':''}${x.deg.toFixed(1)}°`);
    const hdr={title:`${fol.name} offset from ${fix.name}, min gap ${gap} mm surface to surface.`,kind:'pipe',OD:fol.OD,ID:fol.ID,R,bends:res.bends,straights:res.straights,length:res.length};
    const extra=[`Min surface gap to ${fix.name}: ${fmt(res.before.minGap,1)} → ${fmt(res.after.minGap,1)} mm${res.under.length?`; still under the gap at ${res.under.length} spot${res.under.length>1?'s':''}`:''}.`,
      ...(res.obstacles.length?[`Boxes (trial obstacles, ${obsGap} mm): ${res.obstacles.map(o=>`${o.id} ${fmt(o.after,1)} mm`).join(', ')}.`]:[]),
      `Moved ${res.rows.filter(x=>x.moved>0.01).length} of ${res.rows.length} corners, largest ${fmt(Math.max(...res.rows.map(x=>x.moved)),1)} mm; ends and end directions kept${C.length?`; still through ${C.map(c=>c.fix.name).join(', ')}`:''}.`];
    runs=runs.filter(x=>!(x.offset&&x.asm&&x.asm.file===ASM.name&&x.asm.pi===wi));
    const base=asmBase(wi),marks=res.obstacles.map(o=>({p:o.at,text:`${o.id} ${fmt(o.after,1)} mm`,bad:!o.ok,warn:false})).concat(res.under.filter(u=>u.what==='pipe').map(u=>({p:u.at,text:`${fmt(u.min,1)} mm`,bad:true})));
    const run=addRun({Q:res.W,d,wi:k0,minR:R,len:res.length,tidx:[],qLabel,stations:[],parts:ob.boxes.map(b=>({name:b.id,min:b.min,max:b.max})),marks,cable:{d:fol.OD,gap:0},
      name:`${fol.name} · ${gap} mm from ${pipeShort(fix.name)}`,kind:'pipe',kindLabel:'pipe offset from another pipe',params:{R,SF:1},
      settings:`${res.W.length} corner points, single radius ${fmt(R,2)}, min gap ${gap} mm surface to surface from ${fix.name}, shortest straight ${Math.round(res.minStraight)} mm`,
      asm:{file:ASM.name,pi:wi},offset:true,clamps:asmClampViz(wi),hdr,hdrExtra:extra,text:''});
    OF.last={run,res,fix,fol,gap,C,obsGap};asmTexts();ofReport();
    say(res.ok?`Done in ${ms} ms. Every spot is at least ${gap} mm from ${pipeShort(fix.name)}${res.obstacles.length?` and ${obsGap} mm from ${res.obstacles.length===1?'the box':`all ${res.obstacles.length} boxes`}`:''}.`
      :`Done in ${ms} ms. ${res.under.length} spot${res.under.length>1?'s are':' is'} still under ${gap} mm: ${res.stopWhy||'no room to move'}. See the list below.`,!res.ok);
  },30);}
function ofReport(){const L=OF.last;if(!L)return;const{res,fix,fol,gap,C}=L,F=asmFrame(),loc=q=>asmLocal(q,F);
  const how={fixed:'end, kept',ray:'slides along the end direction',axis:'slides along the clip axis',free:''};
  const rows=res.rows.map((x,i)=>{const q=loc(x.p),note=x.kind==='fixed'?(i===0||i===res.rows.length-1?'end, kept':'held by a clip and an end'):x.moved>0.01?`moved${how[x.kind]?', '+how[x.kind]:''}`:'unchanged';
    return`<tr title="${q.map(v=>v.toFixed(3)).join('  ')}"><td>${i+1}</td><td class="${x.moved>0.01?'mv':''}">${x.moved.toFixed(2)}</td><td>${x.deg==null?'':x.deg.toFixed(1)}</td><td>${note}</td></tr>`;}).join('');
  const under=res.under.map(u=>`<li style="color:var(--bad)">${u.what==='pipe'?`${Math.round(u.from)}–${Math.round(u.to)} mm along the follower: closest ${fmt(u.min,1)} mm to ${esc(pipeShort(fix.name))}`:`${esc(u.what)}: ${fmt(u.min,1)} mm at ${Math.round(u.from)} mm along the follower (needs ${L.obsGap})`}.</li>`).join('');
  const obs=res.obstacles.filter(o=>o.ok).map(o=>`<li>${esc(o.id)}: ${fmt(o.before,1)} → ${fmt(o.after,1)} mm (needs ${L.obsGap}).</li>`).join('');
  const clips=res.clips.map(c=>`<li style="color:var(${c.on?'--ok':'--bad'})">${esc(c.name)}: ${c.on?`still straight through, ${c.maxOff.toFixed(3)} mm off its axis (as in the model)`:'the follower did not run through it'}; clip spacing ${fmt(c.gap,1)} mm surface.</li>`).join('');
  $('ofOut').innerHTML=`<ul class="sum"><li>Min surface gap to ${esc(pipeShort(fix.name))}: ${fmt(res.before.minGap,1)} → <b>${fmt(res.after.minGap,1)} mm</b> (target ${gap}).</li>${under}
    ${res.under.length?`<li class="hint" style="list-style:none;margin-left:-18px">${esc(res.stopWhy||'')}. Try the other pipe as follower, a smaller gap, or move the pipe by hand there (Refine).</li>`:''}${obs}${clips}
    <li>Ends: kept, direction ${res.endDirErr.toFixed(3)}°. Single radius ${fmt(L.run.params.R,2)}; ${res.bends.length} bends; shortest straight ${fmt(res.minStraight,1)} mm; length ${Math.round(fol.length)} → ${Math.round(res.length)} mm.</li>
    <li>${res.obstacles.length?'Only the typed boxes are checked; real parts are not read yet.':'Other parts are not checked yet: look in 3D that the moved stretches stay clear, or try boxes under Obstacles.'}</li></ul>
    <table><thead><tr><th>#</th><th>moved</th><th>bend °</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  $('ofPts').value=L.run.text;['ofCopy','ofDl'].forEach(k=>$(k).disabled=false);}

['ofFixed','ofFollow'].forEach(id=>$(id).onchange=()=>{const other=id==='ofFixed'?'ofFollow':'ofFixed';
  if($(id).value===$(other).value){const P=arcPipes(),alt=P.find(x=>String(x.i)!==$(id).value);if(alt)$(other).value=String(alt.i);}remember();ofPrep();});
$('ofSwap').onclick=()=>{const a=$('ofFixed').value;$('ofFixed').value=$('ofFollow').value;$('ofFollow').value=a;remember();ofPrep();};
$('ofGap').onchange=remember;$('ofRun').onclick=ofRun;
$('ofObs').onchange=remember;$('ofObsGap').onchange=remember;$('ofObsAdd').onclick=ofAddBox;$('ofObsClear').onclick=()=>{$('ofObs').value='';remember();say('Boxes cleared.');};
$('ofCopy').onclick=async()=>{const b=$('ofCopy');try{await navigator.clipboard.writeText($('ofPts').value);b.textContent='Copied';}catch(e){b.textContent='Copy failed: use Download';}setTimeout(()=>b.textContent='Copy .pts',1600);};
$('ofDl').onclick=()=>{const L=OF.last;if(L)cadDownload(L.fol.name.replace(/[^\w.-]+/g,'_')+'_offset.pts',$('ofPts').value);};
$('thFrame').addEventListener('change',ofReport);
window.ofSetup=ofSetup;window.ofPrep=ofPrep;
}
