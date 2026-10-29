// ---------------- Dock tables (Phase 5-D): Clearance, Clamps to add, counts on the tab labels ----------------
// Loaded last. The sidebar keeps one verdict line and the Next buttons; the rows live here.
// Clearance: the selected run's places below the gap, plate crossings and the smallest gap that passes (bend-cad.js report
// → run.clearRows), as Where · Part · Gap · Note, failing gaps red; Chart shows the gap along the route (the old pane).
// Clamps to add: clamp-suggest.js renders its table into #sgList here. CSYS: csys-make.js. Each label carries its count.
{
let clrView='table';
const fmtGap=g=>isFinite(g)?`${g<0?'−':''}${Math.abs(g).toFixed(1)} mm`:'—';
function renderClr(){const r=selected(),R=r&&r.clearRows,head=$('clrHead'),box=$('clrList');
  head.innerHTML=`<span class="lbl">${r?esc(r.name):'Clearance'}</span><span class="unit">${r&&r.clearHead?esc(r.clearHead):''}</span>`;
  if(!R||!R.length){box.innerHTML=`<p class="hint" style="margin:0">${r?'No gap to the parts on this run: keep clear of the parts near the route, then Check route.':'Check a route to list its gaps to the parts here.'}</p>`;return;}
  box.innerHTML=`<table class="dtab"><thead><tr><th>Where</th><th>Part</th><th>Gap</th><th>Note</th></tr></thead><tbody>`+
    R.map(x=>`<tr${x.bad?' class="bad"':x.warn?' class="warn"':''}><td class="n">${esc(x.where)}</td><td title="${esc(x.full||x.part)}">${esc(x.part)}</td>`+
      `<td class="n g">${fmtGap(x.gap)}</td><td>${esc(x.note)}${x.sub?`<div class="unit">${esc(x.sub)}</div>`:''}</td></tr>`).join('')+'</tbody></table>';}
// tab labels: Clearance (n failing), CSYS (n), Clamps to add (n · k needs a bracket)
function labels(){const r=selected(),n=r&&r.clearRows?r.clearRows.filter(x=>x.bad||x.warn).length:0;$('dClr').textContent=n?`Clearance (${n})`:'Clearance';
  const m=typeof csysMade==='function'?csysMade().length:0;$('dCsys').textContent=m?`CSYS (${m})`:'CSYS';
  const c=typeof sgCount==='function'?sgCount():null;$('dSg').hidden=!c;
  $('dSg').textContent=c&&c.n?`Clamps to add (${c.n}${c.brk?` · ${c.brk} need${c.brk>1?'':'s'} a bracket`:''})`:'Clamps to add';}
window.sgTab=labels;
{const prev=showPane;showPane=function(){prev();const t=dock==='clr'&&clrView==='table';
  $('paneClr').dataset.on=t?1:0;if(t)$('paneChart').dataset.on=0;$('paneSg').dataset.on=dock==='sg'?1:0;$('dSg').setAttribute('aria-selected',dock==='sg');
  // Table / Chart sits in the tab bar (it must stay reachable in Chart view), on the Clearance tab only
  $('clrSeg').hidden=dock!=='clr';$('clrSeg').querySelectorAll('[data-v]').forEach(b=>{const on=b.dataset.v===clrView;b.setAttribute('aria-checked',on);b.tabIndex=on?0:-1;});
  if(dock==='clr')renderClr();labels();};}
$('clrSeg').querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{clrView=b.dataset.v;showPane();});
$('clrSeg').onkeydown=e=>{const d=e.key==='ArrowRight'||e.key==='ArrowLeft';if(!d)return;e.preventDefault();clrView=clrView==='table'?'chart':'table';showPane();$('clrSeg').querySelector(`[data-v="${clrView}"]`).focus();};
{const prev=renderRuns;renderRuns=function(){prev();if(dock==='clr')renderClr();labels();};}
$('dSg').onclick=()=>{dock='sg';showPane();};
// the CSYS list changes from its own panel: keep its count current
new MutationObserver(labels).observe($('mkList'),{childList:true});
labels();
}
