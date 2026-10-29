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
// side per part ("route passes it over / under / left / right"), set by clicking the part in 3D; up axis per file
const fileKey=()=>typeof ASM!=='undefined'&&ASM?ASM.name:'';
ALT.prefer=()=>{try{return JSON.parse(store.get('rs.altPrefer.'+fileKey())||'{}');}catch(e){return{};}};
const savePrefer=o=>store.set('rs.altPrefer.'+fileKey(),JSON.stringify(o));
// "passes over 95651236, right of 22577598", each with a × that clears that part's side
function sidesLine(){const o=ALT.prefer(),k=Object.keys(o),el=$('altSides');
  el.innerHTML=k.length?'· passes '+k.map(n=>`<span class="altside">${{above:'over',below:'under',left:'left of',right:'right of'}[o[n]]||esc(o[n])} ${esc(n.split(' / ').pop())} <button type="button" class="linkish" data-clr="${esc(n)}" aria-label="Clear the side for ${esc(n)}" title="Any side">×</button></span>`).join(', '):'';
  el.querySelectorAll('[data-clr]').forEach(b=>b.onclick=()=>{const p=ALT.prefer();delete p[b.dataset.clr];savePrefer(p);sidesLine();if(typeof asmPanel==='function')asmPanel();});}
$('altUp').onchange=()=>store.set('rs.altUp.'+fileKey(),$('altUp').value);
document.addEventListener('asm:loaded',()=>{$('altUp').value=store.get('rs.altUp.'+fileKey())||'+Z';sidesLine();});
(window.AV_ACTIONS=window.AV_ACTIONS||[]).push((p,r)=>{if(p.kind!=='part'||$('shape').value==='arc'||$('panBend').hidden)return[];
  const I=r.instances[p.inst],name=I.label||I.name,cur=ALT.prefer()[name]||'any';
  // the leg that passes the part (nearest to its box centre), looking from its earlier point to the next; on a leg along the
  // up axis over / under / left / right do not apply, so the choice is by axis
  const P=parsePts($('pts').value),c=I.bbox?[0,1,2].map(k=>(I.bbox.min[k]+I.bbox.max[k])/2):p.p,up=MultiRoute.parseAxis($('altUp').value)||{ax:2,sg:1};
  let leg=-1,bd=Infinity;for(let i=0;c&&i<P.length-1;i++){const a=P[i],d=V.sub(P[i+1],a),L2=V.dot(d,d)||1e-12,t=Math.max(0,Math.min(1,V.dot(V.sub(c,a),d)/L2)),e=V.len(V.sub(c,V.add(a,V.mul(d,t))));if(e<bd){bd=e;leg=i;}}
  const dl=leg>=0?V.norm(V.sub(P[leg+1],P[leg])):null,along=dl&&Math.abs(dl[up.ax])>0.9;
  const looking=leg>=0?` · looking P${leg+1} → P${leg+2}`:'';
  const opts=along?['any',...[0,1,2].filter(k=>k!==up.ax).flatMap(k=>['+'+'XYZ'[k],'-'+'XYZ'[k]])]:['any','above','below','left','right'];
  return opts.map(s=>({row:`Route passes it${looking} · up ${$('altUp').value}`,label:s==='above'?'over':s==='below'?'under':s.replace('-','−'),on:cur===s,
    title:s==='any'?'Alternatives may pass it on any side':`Alternatives keep only routes that pass ${s==='above'?'over':s==='below'?'under':'to the '+s+' of'} it (up = ${$('altUp').value})`,
    go:()=>{const o=ALT.prefer();if(s==='any')delete o[name];else o[name]=s;savePrefer(o);sidesLine();
      return s==='any'?`${I.name}: any side.`:`${I.name}: Alternatives pass it ${s==='above'?'over':s==='below'?'under':'on the '+s} (looking along the route, up ${$('altUp').value}). Run Alternatives.`;}}));});
// every new status drops the Next buttons of the one before (they belong to that result)
const say=(m,bad)=>{const e=$('statusAlt');e.textContent=m;e.style.color=bad?'var(--bad)':'';if(typeof nextClear==='function')nextClear('statusAlt');};
function typedBoxes(){
  return $('altObs').value.split(/\r?\n/).map(l=>l.split('!')[0].trim()).filter(Boolean).map(l=>l.replace(/,/g,' ').split(/\s+/))
    .filter(r=>r.length>=7&&r.slice(1,7).every(v=>Number.isFinite(+v))).map(r=>{const v=r.slice(1,7).map(Number);
      return{id:r[0],part:r[0],min:[0,1,2].map(k=>Math.min(v[k],v[k+3])),max:[0,1,2].map(k=>Math.max(v[k],v[k+3]))};});}
// a card: swatch · plain-word label · facts in a fixed order (length · min R · gap). A failing fact is red and shows its
// limit (min R 49 < 65, gap 0.8 < 4). gap = from the hose surface, so the keep-clear gap is the limit. A side preference
// that cost the clean route is an amber "forced side" tag, never red for the choice itself.
const keepGap=()=>Math.max(0,+$('cdGap').value||0);
function facts(a){const R=ALT.ctx.R,g=ALT.ctx.gap,gap=a.clearance+g,badR=a.minR<R-1e-6,badG=a.clearance<-1e-6;
  const f=(bad,t)=>bad?`<span class="bad">${t}</span>`:t;
  return[`${Math.round(a.len)} mm`,f(badR,`min R ${fmt(a.minR,0)}${badR?` &lt; ${+R}`:''}`),
    isFinite(a.clearance)?f(badG,`gap ${fmt(gap,1)}${badG?` &lt; ${+g}`:''} mm`):'gap —'].join(' · ');}
function render(){
  const box=$('altList');
  box.innerHTML=ALT.cands.map((a,i)=>`<div class="altrow${ALT.sel===i?' on':''}" data-i="${i}" title="Alternative A${i+1}"><i style="background:var(--alt${i+1})"></i>
    <span class="altt"><b>${esc(a.label)}</b>${a.forced&&ALT.forced?' <span class="sgtag">forced side</span>':''}<span class="unit altf">${facts(a)}</span></span>
    <button type="button" class="${a.ok?'pri':''}" data-use="${i}"${a.ok?'':' title="This route breaks the radius or the gap; it is added as a run all the same"'}>${a.ok?'Use this':'Use anyway'}</button></div>`).join('');
  box.querySelectorAll('.altrow').forEach(el=>el.onclick=()=>{ALT.sel=+el.dataset.i;render();rebuild(false);});
  box.querySelectorAll('button[data-use]').forEach(el=>el.onclick=e=>{e.stopPropagation();use(+el.dataset.use);});}
// the status line: one keyword (No clean route: red; a forced side: amber), facts after it; innerHTML from escaped parts
function sayLine(kind,key,text){const e=$('statusAlt');e.style.color='';if(typeof nextClear==='function')nextClear('statusAlt');
  e.innerHTML=`<div class="verdict-line"><b class="vk vk-${kind}">${esc(key)}</b> ${esc(text)}</div>`;}
const shortName=n=>String(n).split(' / ').pop();
const OPP={'left of':'right','right of':'left',over:'below',under:'above'},UIW={'left of':'on the left','right of':'on the right',over:'over',under:'under'};
// "every route tried passes X on the left, at best 8.5 mm into it" from MultiRoute's none (gap counted from the hose surface)
function noneText(none,n){if(none.rule==='radius')return`every way round needs a bend tighter than R ${+ALT.ctx.R}${isFinite(none.bestR)?` (best R ${fmt(none.bestR,0)})`:''}.`;
  const g=ALT.ctx.gap,at=s=>{const v=s.gap+g;return v<0?`${fmt(-v,1)} mm into it`:`${fmt(v,1)} mm from it, inside the ${+g} mm gap`;},p=shortName(none.part),S=none.sides||[];
  const also=none.rule==='both'?' Some routes also bend tighter than R '+(+ALT.ctx.R)+'.':'';
  const pass=w=>/^(over|under)$/.test(w)?`${w} ${p}`:`${p} ${UIW[w]||w.replace(/ of$/,'')}`;
  if(none.every&&S.length===1)return`every route tried passes ${pass(S[0].side)}, at best ${at(S[0])}.${also}`;
  if(none.every)return`${p} is in the way on every side tried: ${S.map(s=>`${(UIW[s.side]||s.side).replace(/^on the /,'')} ${at(s)}`).join(', ')}.${also}`;
  return`${p} is in the way on some routes tried: ${S.map(s=>`${(UIW[s.side]||s.side).replace(/^on the /,'').replace(/ of$/,'')} ${at(s)}`).join(', ')} (${n} tried).${also}`;}
// a side choice that cost the clean route: which, and the best that side gives
function forcedText(f,C){const b=C[0],R=ALT.ctx.R,w=[];
  if(b&&b.minR<R-1e-6)w.push(`cannot hold R ${+R}; best that side is R ${fmt(b.minR,0)}`);
  if(b&&b.clearance<-1e-6)w.push(`${w.length?'and ':''}is ${fmt(-b.clearance,b.clearance>-0.1?2:1)} mm inside the gap`);
  if(b&&!b.kept)w.push('the route slid off that side');
  const PW={above:'Over',below:'Under',left:'Left of',right:'Right of'},what=f.what.split(', ').map(x=>{const k=x.indexOf(' '),pr=x.slice(0,k),part=x.slice(k+1);
    return`${PW[pr]||`On the ${pr} side of`} ${shortName(part)}`;}).join(', ');
  return`${what} ${w.join(', ')||'is not clean'}.`;}
function stop(msg){ALT.job=0;$('runAlt').textContent=LABEL;if(msg)say(msg);}

$('runAlt').onclick=()=>{
  if(ALT.job)return stop('Stopped.');
  // the section opens below the verdict (Tools · Alternatives, or a Next button)
  $('altBox').classList.remove('shut');
  // the same stations Check routes: the ticked rows of Stations from clamps, written into Target points
  const cs=typeof csSync==='function'?csSync():null;if(cs&&cs.short)return say('Tick at least 2 stations.',true);
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
  let job;try{job=MultiRoute.start(P.map((p,i)=>({p:[p[0],p[1],p[2]],dir:dirOf(i)})),{R,SF,rad,boxes,keep:3,prefer:ALT.prefer(),up:$('altUp').value,shapeNear:typeof CadSolids!=='undefined'?CadSolids.shapeNear:null});}
  catch(e){return say(e.message,true);}
  ALT.cands=[];ALT.sel=0;ALT.ctx={P,R,SF,rad,gap:keepGap(),typed,nBoxes:boxes.length,cadParts:cad?cad.parts:0};render();rebuild(false);
  const id=++seq.n;ALT.job=id;$('runAlt').textContent='Stop';
  const extra=job.skipped?` (${job.skipped} further obstacle${job.skipped>1?'s':''} left to the solver)`:'';
  const tick=()=>{if(ALT.job!==id)return;const r=job.step(30);
    if(!r.done){say(`Shaping route ${r.k+1} of ${r.total} (${job.tried} ways round)${extra}... tightest bend R ${fmt(r.minR||0)} mm`);return defer(tick);}
    const C=r.result.candidates;ALT.cands=C;ALT.forced=r.result.forced;stop();render();rebuild(true);
    if(!C.length)return say('No route came out.',true);
    const clean=C.filter(a=>a.ok).length;
    const notes=r.result.notes.map(n=>n+'.').join(' ');
    const none=!clean&&r.result.none,f=r.result.forced;
    if(f){sayLine('warn','Forced side:',forcedText(f,C)+(notes?' '+notes:''));
      if(typeof nextSteps==='function')nextSteps('statusAlt',[{label:'Clear the side choice',title:'Any side for the parts with a chosen side, and run again',
        go:()=>{const o=ALT.prefer();C.flatMap(a=>a.prefs||[]).forEach(p=>delete o[p.part]);savePrefer(o);sidesLine();$('runAlt').click();}}]);return;}
    if(none){sayLine('bad','No clean route:',noneText(none,r.result.tried)+(notes?' '+notes:''));
      // fix the worst problem → another side → stop checking that part
      const N=[];
      // Push only helps when it is off and there are CAD faces to push from (Check never sees typed boxes): as Check's canPush
      if(none.rule!=='radius'&&!$('cdPush').checked&&cad&&cad.faces.length)N.push({label:'Push away and check again',title:'Ticks “Push the route away” under Keep clear of CAD parts and runs Check',
        go:()=>{$('cdBox').open=true;$('cdPush').checked=true;$('cdPush').dispatchEvent(new Event('change'));$('runBend').click();}});
      const S=none.sides||[],opp=none.part&&none.every&&S.length===1&&OPP[S[0].side];
      if(opp){const nm=shortName(none.part),w={left:'on the left',right:'on the right',above:'over it',below:'under it'}[opp];
        N.push({label:`Try it ${opp==='above'?'over':opp==='below'?'under':'on the '+opp}`,title:`Alternatives keep only routes that pass ${nm} ${w}, and run again`,
          go:()=>{const o=ALT.prefer();o[none.part]=opp;savePrefer(o);sidesLine();$('runAlt').click();}});}
      if(none.part&&none.sid!=null&&typeof bcKeepClear==='function'){const nm=shortName(none.part);
        N.push({label:`Stop checking ${nm}`,title:`Unticks ${nm} under Keep clear of CAD parts (its gap is no longer checked) and runs Alternatives again`,
          go:()=>{bcKeepClear(none.sid,false);$('runAlt').click();}});}
      if(N.length&&typeof nextSteps==='function')nextSteps('statusAlt',N);return;}
    say(`${C.length} distinct route${C.length>1?'s':''} from ${r.result.tried} way${r.result.tried>1?'s':''} round${extra}; ${clean===C.length?'all clean':`${clean} clean`}. Click one to highlight it.${notes?' '+notes:''}`);};
  defer(tick);
};

// the chosen candidate becomes a run, the same way the generated route is made from the solver result
function use(i){
  const a=ALT.cands[i],{P,R,SF,rad,nBoxes}=ALT.ctx,SP=+$('sp').value||85,adapt=$('adapt').checked;
  let sp=SP,s,A;for(let t=0;t<4;t++){s=samplePoints(a.route,a.x,sp,adapt,R*SF);A=analyse(s.Q);if(A.minR>=R*1.15)break;sp*=0.7;}
  A.tidx=s.tidx;
  const X=typeof bendCad==='function'?bendCad(P):null,cx=X?X.report(A):null;
  ALT.cands=[];ALT.ctx.typed=[];render();
  addRun(Object.assign(A,{name:`Alternative A${i+1} R${R} ×${SF}`,kind:'bend',kindLabel:'bend radius, alternative',
    parts:cx?cx.parts:undefined,holes:cx?cx.holes:undefined,marks:cx?cx.marks:undefined,clearDense:cx?cx.clearDense:undefined,gapLimit:cx?cx.gapLimit:undefined,spots:cx?cx.spots:undefined,
    params:{R,SF,spacing:SP},settings:`passes ${a.label} (${nBoxes} obstacle box${nBoxes>1?'es':''}, cable radius + gap ${fmt(rad)} mm), gap ${sp.toFixed(0)} mm between points${adapt?', closer in bends':''}, ×${SF} margin${cx?cx.note:''}`,
    text:toPts(A.Q,{R,designR:+(R*SF).toFixed(1),minR:A.minR,len:A.len,tidx:s.tidx})}));
  say(`A${i+1} added as a run: R ${fmt(A.minR)} mm over ${A.Q.length} points, length ${Math.round(A.len)} mm.${cx&&cx.msg?' '+cx.msg.split('\n')[0]:''}`);
}
$('altObs').value=store.get('rs.altObs')||'';
}
