// ---------------- Hose / Cable · Route through stations as 1 Load · 2 Stations · 3 Route (Phase 5) ----------------
// Loaded after the panels it reads (clamp-stations.js, bend-cad.js, alt-ui.js) and before shell.js. It owns no route logic:
// it shows which card is current, the one-line summary of each, the Advanced toggle and its values line, and below 900 px
// of height folds the cards before the current one to their summary (the heading is a button with aria-expanded). A folded
// Load card keeps Hose Ø (.foldkeep): the station list follows it, so it is changed right after Open.
{
const pan=$('panBend'),cards=[1,2,3].map(i=>$('card'+i)),opened=new Set(),shut=new Set();
const num=id=>{const v=+$(id).value;return isFinite(v)?v:0;};
// Advanced: on, each card shows its settings block; off, the values that matter stay readable in one mono line
const adv=on=>{pan.classList.toggle('adv-on',on);$('advTog').setAttribute('aria-pressed',on);store.set('rs.adv',on?'1':'0');};
$('advTog').onclick=()=>adv(!pan.classList.contains('adv-on'));
adv(store.get('rs.adv')==='1');
function values(){const arc=$('shape').value==='arc';
  $('advSum').textContent=arc?`R ${num('r')} · margin ×${num('sf')} · tolerance ${num('arcTol')} mm`
    :`R ${num('r')} · margin ×${num('sf')} · gap ${num('cdGap')} mm · fit +${num('csTol')}`;}
const asmOpen=()=>typeof ASM!=='undefined'&&!!ASM&&!!ASM.r;
// the example points the page starts with are not input: until points are typed, dropped or chosen (or kept from last
// time), Load is the current card
let typed=!!store.get('rs.pts');$('pts').addEventListener('input',()=>{typed=true;});
const nInput=()=>typed||(typeof PRESETS!=='undefined'&&$('pts').value!==PRESETS.target)?parsePts($('pts').value).length:0;
// the current card: Load until an assembly is open (or points are typed), Stations until 2 are ticked, then Route
function current(){const nList=$('csList').querySelectorAll('.csrow').length,nTick=typeof clampStationsTicked==='function'?clampStationsTicked().length:0,
    nPts=nInput();
  if($('shape').value==='arc')return parsePts($('pts').value).length>=2?3:2;
  if(!asmOpen()&&nPts<2)return 1;
  if(nList&&nTick<2&&!(nTick===0&&nPts>=2))return 2;
  return nList||nPts>=2?3:2;}
function update(){values();const arc=$('shape').value==='arc',cur=current(),short=innerHeight<900;
  if(arc)$('ptsBox').open=true;   // Pipe · Route through points: the points are the input
  const nList=$('csList').querySelectorAll('.csrow').length,T=typeof clampStationsTicked==='function'?clampStationsTicked():[],nPts=nInput(),nAll=parsePts($('pts').value).length;
  const kept=$('cdParts').querySelectorAll('input[type=checkbox]:checked').length,listed=$('cdParts').querySelectorAll('input[type=checkbox]').length;
  $('loadEmpty').hidden=asmOpen();
  $('csBox').classList.toggle('empty',!nList);
  $('ptsN').textContent=nAll?`(${nAll})`:'';
  $('csArmHint').hidden=!(asmOpen()&&nList&&($('csStart').value===''||$('csEnd').value===''));
  $('cdSum').textContent=listed?`Keep clear of ${kept} part${kept===1?'':'s'} near the route · ${listed} within ${num('cdReach')} mm`:'Keep clear of the parts near the route';
  $('card1Line').textContent=asmOpen()?`Ø${num('csD')}${listed?` · ${kept} part${kept===1?'':'s'} kept clear`:''}`:'nothing open';
  $('card2Line').textContent=T.length>=2?`S1 → S${T.length} · ${T.length} ticked`:nList?(nPts>=2&&!T.length?`${nPts} points as text`:'tick at least 2'):nPts?`${nPts} points as text`:arc?'':'after Load: clamps that fit the hose';
  const sel=typeof selected==='function'?selected():null;
  $('card3Line').textContent=$('runBend').disabled&&nList?'Tick at least 2 stations.':cur<3?'after 2 stations are ticked':sel?sel.name:'';
  cards.forEach((c,i)=>{const n=i+1,wait=n>cur,fold=!arc&&(shut.has(n)||(short&&n<cur&&!opened.has(n)));
    c.classList.toggle('current',n===cur);c.classList.toggle('wait',wait);c.classList.toggle('fold',fold);
    c.querySelector('.cardsum').setAttribute('aria-expanded',!fold);});}
// a heading opens or folds its card (Enter / Space on the button too)
cards.forEach((c,i)=>c.querySelector('.cardsum').onclick=()=>{const n=i+1,f=c.classList.contains('fold');
  if(f){opened.add(n);shut.delete(n);}else{shut.add(n);opened.delete(n);}update();});
$('loadOpen').onclick=()=>$('shFile').click();
['input','change'].forEach(t=>pan.addEventListener(t,update));
['cs:changed','asm:loaded','asm:removed'].forEach(t=>document.addEventListener(t,()=>setTimeout(update,0)));
// the parts list, the runs and the verdict are written by their own panels: follow them
const mo=new MutationObserver(()=>update());['cdParts','runlist','csList'].forEach(id=>mo.observe($(id),{childList:true,subtree:true,attributes:true,attributeFilter:['checked']}));
$('shape').addEventListener('change',update);addEventListener('resize',update);
update();
}
