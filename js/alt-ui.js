// ---------------- Route through stations: Alternatives (other ways round the obstacles) ----------------
// Loaded after bend-cad.js. MultiRoute (multiroute.js) tries every side of every obstacle in the way and shapes each
// with makeRoute + optimiser; it runs in chunks from defer() so the page stays live. The top 3 are drawn over the 3D
// view (altOverlay, called from rebuild); "Use this" turns one into a normal generated run.
const ALT={cands:[],sel:0,ctx:null,job:0};
function altOverlay(content,g){
  if(ALT.ctx)ALT.ctx.typed.forEach(o=>{content.add(new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...o.min),new THREE.Vector3(...o.max)),new THREE.Color(css('--warn'))));g.addTag(o.max,o.id,'t');});
  ALT.cands.forEach((a,i)=>{const col=new THREE.Color(css(`--alt${i+1}`)),on=ALT.sel===i;
    content.add(g.tube(a.Q,a.Q.map(()=>col),g.tubeR*(on?0.9:0.55)));
    g.addTag(a.Q[Math.floor(a.Q.length/2)],`A${i+1}`,on?'':'t');});
}
{
const LABEL=$('runAlt').textContent,seq={n:0};
const say=(m,bad)=>{const e=$('statusAlt');e.textContent=m;e.style.color=bad?'var(--bad)':'';};
function typedBoxes(){
  return $('altObs').value.split(/\r?\n/).map(l=>l.split('!')[0].trim()).filter(Boolean).map(l=>l.replace(/,/g,' ').split(/\s+/))
    .filter(r=>r.length>=7&&r.slice(1,7).every(v=>Number.isFinite(+v))).map(r=>{const v=r.slice(1,7).map(Number);
      return{id:r[0],min:[0,1,2].map(k=>Math.min(v[k],v[k+3])),max:[0,1,2].map(k=>Math.max(v[k],v[k+3]))};});}
function render(){
  const box=$('altList');
  box.innerHTML=ALT.cands.map((a,i)=>`<div class="altrow${ALT.sel===i?' on':''}" data-i="${i}"><i style="background:var(--alt${i+1})"></i>
    <span class="altt"><b>A${i+1}</b> · passes ${esc(a.label)}${a.ok?'':' · <span style="color:var(--bad)">not clean</span>'}
    <span class="unit">length ${Math.round(a.len)} mm · min R ${fmt(a.minR)} mm · clearance ${isFinite(a.clearance)?fmt(a.clearance,1)+' mm':'—'}</span></span>
    <button type="button" data-use="${i}">Use this</button></div>`).join('');
  box.querySelectorAll('.altrow').forEach(el=>el.onclick=()=>{ALT.sel=+el.dataset.i;render();rebuild(false);});
  box.querySelectorAll('button[data-use]').forEach(el=>el.onclick=e=>{e.stopPropagation();use(+el.dataset.use);});}
function stop(msg){ALT.job=0;$('runAlt').textContent=LABEL;if(msg)say(msg);}

$('runAlt').onclick=()=>{
  if(ALT.job)return stop('Stopped.');
  const P=parsePts($('pts').value);
  if(P.length<2)return say('Paste at least two points.',true);
  const R=+$('r').value||65,SF=+$('sf').value||1.5,cad=typeof bendCadBoxes==='function'?bendCadBoxes():null;
  const rad=cad?cad.rad:Math.max(0.1,+$('cdD').value||8)/2+Math.max(0,+$('cdGap').value||0),typed=typedBoxes();
  const boxes=[...typed,...(cad?cad.faces:[])];
  store.set('rs.altObs',$('altObs').value);
  if(!boxes.length)return say('No obstacles to go round: type boxes under “Obstacle boxes typed by hand”, or load a parts file under “Keep clear of CAD parts” and tick the parts.',true);
  // the same station directions Check holds: bore axes from Stations from clamps, typed start / end directions winning at the ends
  const SD=typeof clampStationDirs==='function'?clampStationDirs(P):null,held=SD?SD.fixDirs(null):null;
  const dirOf=i=>(i===0&&parseDir($('sd').value))||(i===P.length-1&&parseDir($('ed').value))||(held&&held[i])||null;
  let job;try{job=MultiRoute.start(P.map((p,i)=>({p:[p[0],p[1],p[2]],dir:dirOf(i)})),{R,SF,rad,boxes,keep:3});}
  catch(e){return say(e.message,true);}
  ALT.cands=[];ALT.sel=0;ALT.ctx={P,R,SF,rad,typed,nBoxes:boxes.length,cadParts:cad?cad.parts:0};render();rebuild(false);
  const id=++seq.n;ALT.job=id;$('runAlt').textContent='Stop';
  const extra=job.skipped?` (${job.skipped} further obstacle${job.skipped>1?'s':''} left to the solver)`:'';
  const tick=()=>{if(ALT.job!==id)return;const r=job.step(30);
    if(!r.done){say(`Shaping route ${r.k+1} of ${r.total} (${job.tried} ways round)${extra}... tightest bend R ${fmt(r.minR||0)} mm`);return defer(tick);}
    const C=r.result.candidates;ALT.cands=C;stop();render();rebuild(true);
    if(!C.length)return say('No route came out.',true);
    const clean=C.filter(a=>a.ok).length;
    say(`${C.length} distinct route${C.length>1?'s':''} from ${r.result.tried} way${r.result.tried>1?'s':''} round ${boxes.length} box${boxes.length>1?'es':''}${extra}; ${clean===C.length?'all clear the boxes and hold the radius':`${clean} clean`}. Click one to highlight it.`);};
  defer(tick);
};

// the chosen candidate becomes a run, the same way the generated route is made from the solver result
function use(i){
  const a=ALT.cands[i],{P,R,SF,rad,nBoxes}=ALT.ctx,SP=+$('sp').value||85,adapt=$('adapt').checked;
  let sp=SP,s,A;for(let t=0;t<4;t++){s=samplePoints(a.route,a.x,sp,adapt,R*SF);A=analyse(s.Q);if(A.minR>=R*1.15)break;sp*=0.7;}
  A.tidx=s.tidx;
  const X=typeof bendCad==='function'?bendCad(P):null,cx=X?X.report(A):null;
  ALT.cands=[];ALT.ctx.typed=[];render();
  addRun(Object.assign(A,{name:`Alternative A${i+1} R${R} x${SF}`,kind:'bend',kindLabel:'bend radius, alternative',
    parts:cx?cx.parts:undefined,holes:cx?cx.holes:undefined,marks:cx?cx.marks:undefined,clearDense:cx?cx.clearDense:undefined,gapLimit:cx?cx.gapLimit:undefined,spots:cx?cx.spots:undefined,
    params:{R,SF,spacing:SP},settings:`passes ${a.label} (${nBoxes} obstacle box${nBoxes>1?'es':''}, cable radius + gap ${fmt(rad)} mm), gap ${sp.toFixed(0)} mm between points${adapt?', closer in bends':''}, x${SF} margin${cx?cx.note:''}`,
    text:toPts(A.Q,{R,designR:+(R*SF).toFixed(1),minR:A.minR,len:A.len,tidx:s.tidx})}));
  say(`A${i+1} added as a run: R ${fmt(A.minR)} mm over ${A.Q.length} points, length ${Math.round(A.len)} mm.${cx&&cx.msg?' '+cx.msg.split('\n')[0]:''}`);
}
$('altObs').value=store.get('rs.altObs')||'';
}
