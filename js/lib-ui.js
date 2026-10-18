// ---------------- Library: clamps, clips and grommets known by part name (js/fixlib.js) ----------------
// Cards with a picture of the part, edit in place, export / import JSON. Parts of the open assembly with a
// clamp-like hole and no matching entry are listed on top with a one-click "Add to library".
{
const LIB={edit:null};
const asmOpen=()=>typeof ASM!=='undefined'&&ASM&&ASM.r?ASM:null;
const range=e=>e.boreMin===e.boreMax?`Ø${fmt(e.boreMin,1)}`:`Ø${fmt(e.boreMin,1)}–${fmt(e.boreMax,1)}`;
const libSay=(m,bad)=>cadSay('statusLib',m,bad);
// parts of the open assembly an entry (or a typed pattern) matches
function hits(pattern){const A=asmOpen();if(!A||!pattern)return[];
  const names=new Map();A.r.instances.forEach((I,i)=>{if(!names.has(I.name))names.set(I.name,i);});
  return[...names.entries()].filter(([n])=>FixLib.test(pattern,n)).map(([name,inst])=>({name,inst,bores:(A.r.holes||A.r.fixings).filter(x=>x.inst===inst)}));}

function card(e){
  const img=e.thumb?`<img src="${e.thumb}" alt="${esc(e.pattern)}">`:`<span>No picture yet. Open an assembly that has this part.</span>`;
  return`<button type="button" class="libcard" data-id="${e.id}" title="Edit ${esc(e.pattern)}"><div class="libthumb">${img}</div><div class="libbody">
    <div class="libpat">${esc(e.pattern)}</div><div class="libmeta"><span class="libtype">${e.type}</span><span>bore ${range(e)}</span></div>
    ${e.notes?`<div class="libnote">${esc(e.notes)}</div>`:''}</div></button>`;}
function form(e){const isNew=!e.id,H=hits(e.pattern),A=asmOpen();
  const img=e.thumb?`<img src="${e.thumb}" alt="">`:`<span>No picture</span>`;
  const hitTxt=!A?'Open an assembly to see which parts this pattern catches.'
    :H.length?`Matches ${H.length} part${H.length>1?'s':''} in ${esc(A.name)}: ${H.slice(0,4).map(h=>`<b>${esc(h.name)}</b>${h.bores.length?` (bore ${h.bores.map(x=>'Ø'+fmt(x.D,2)).join(', ')})`:''}`).join(', ')}${H.length>4?` +${H.length-4}`:''}.`
    :`Matches no part in ${esc(A.name)}.`;
  return`<div class="libcard edit" data-edit="${e.id||'new'}"><div class="libthumb">${img}</div><div class="libform">
    <div class="fields c2" style="margin:0">
      <div><label for="libPat">Name pattern</label><input id="libPat" value="${esc(e.pattern)}" spellcheck="false" placeholder="e.g. 990224 or U1049*_9902??"></div>
      <div><label for="libType">Type</label><select id="libType">${FixLib.TYPES.map(t=>`<option${t===e.type?' selected':''}>${t}</option>`).join('')}</select></div>
      <div><label for="libMin">Bore Ø from <span class="unit">mm</span></label><input id="libMin" type="number" step="0.1" min="0" value="${e.boreMin||''}" inputmode="decimal"></div>
      <div><label for="libMax">to <span class="unit">mm</span></label><input id="libMax" type="number" step="0.1" min="0" value="${e.boreMax||''}" inputmode="decimal"></div>
    </div>
    <label for="libNotes" style="margin-top:9px">Notes</label><textarea id="libNotes" rows="2" spellcheck="true">${esc(e.notes)}</textarea>
    <p class="hint" id="libHits">${hitTxt}</p>
    <div class="libbtns"><button type="button" class="rfgo" id="libSave">${isNew?'Add':'Save'}</button><button type="button" class="shbtn" id="libCancel">Cancel</button>
      ${H.length?`<button type="button" class="shbtn" id="libShot" title="Draw the picture again from ${esc(H[0].name)}">${e.thumb?'Retake':'Take'} picture</button>`:''}
      ${isNew?'':`<button type="button" class="linkish libdel" id="libDel">Delete</button>`}</div>
  </div></div>`;}

function libRender(){const box=$('libCards');if(!box||$('panLib').hidden)return;
  const A=asmOpen(),U=A?FixLib.unknown(A.r,typeof asmClampLike==='function'?asmClampLike:null):[],E=FixLib.all();if(LIB.edit&&LIB.edit!=='new'&&!E.some(e=>e.id===LIB.edit))LIB.edit=null;
  $('libUnknown').innerHTML=U.length?`<div class="libunk"><p><b>${U.length} part${U.length>1?'s':''} in ${esc(A.name)}</b> ${U.length>1?'have':'has'} a clamp-like hole but no library entry, so the pipe is not routed through ${U.length>1?'them':'it'}.</p><ul>${
      U.map(u=>`<li><span class="mono">${esc(u.name)}</span> <span class="unit">bore ${u.bores.map(x=>`Ø${fmt(x.D,2)} (${esc(x.csys)})`).join(', ')}</span> <button type="button" class="linkish" data-addinst="${u.inst}">Add to library</button></li>`).join('')}</ul></div>`:'';
  const cur=LIB.edit;
  box.innerHTML=(cur==='new'?form(LIB.draft):'')+E.map(e=>cur===e.id?form(LIB.draft):card(e)).join('')+(cur==='new'?'':`<button type="button" class="libcard libadd" id="libNew">+ New entry</button>`);
  box.querySelectorAll('.libcard[data-id]').forEach(b=>b.onclick=()=>{const e=E.find(x=>x.id===b.dataset.id);LIB.edit=e.id;LIB.draft=Object.assign({},e);libRender();focusPat();});
  const nb=$('libNew');if(nb)nb.onclick=()=>{LIB.edit='new';LIB.draft={pattern:'',type:'clamp',boreMin:'',boreMax:'',notes:'',thumb:''};libRender();focusPat();};
  $('libUnknown').querySelectorAll('[data-addinst]').forEach(b=>b.onclick=()=>{const x=FixLib.addFromPart(A.r,+b.dataset.addinst);LIB.edit=x.id;LIB.draft=Object.assign({},x);
    libRender();focusPat();libSay(`Added ${x.pattern} as a ${x.type}. Check the pattern and bore range, then Save.`);});
  if(cur)wireForm();}
const focusPat=()=>{const i=$('libPat');if(i){i.focus();i.select();}};
function readForm(){return{pattern:$('libPat').value.trim(),type:$('libType').value,boreMin:+$('libMin').value||0,boreMax:+$('libMax').value||0,notes:$('libNotes').value};}
function wireForm(){
  const live=()=>{Object.assign(LIB.draft,readForm());const H=hits(LIB.draft.pattern),A=asmOpen();if(!A)return;
    $('libHits').innerHTML=H.length?`Matches ${H.length} part${H.length>1?'s':''} in ${esc(A.name)}: ${H.slice(0,4).map(h=>`<b>${esc(h.name)}</b>`).join(', ')}${H.length>4?` +${H.length-4}`:''}.`:LIB.draft.pattern?`Matches no part in ${esc(A.name)}.`:'Type a pattern.';};
  $('libPat').oninput=live;
  $('libSave').onclick=()=>{const d=Object.assign(LIB.draft,readForm());
    if(!d.pattern)return libSay('Type a name pattern first.',true);
    if(d.boreMax&&d.boreMin>d.boreMax)return libSay('Bore “from” is larger than “to”.',true);
    const clash=FixLib.all().find(e=>e.id!==d.id&&e.pattern.toLowerCase()===d.pattern.toLowerCase());if(clash)return libSay(`${d.pattern} is already in the library.`,true);
    if(!d.thumb){const H=hits(d.pattern);if(H.length)d.thumb=FixLib.thumb(asmOpen().r,H[0].inst,0,0,d);}
    const isNew=LIB.edit==='new';LIB.edit=null;if(isNew)FixLib.add(d);else FixLib.update(d.id,d);
    libSay(`${d.pattern} ${isNew?'added':'saved'}.`);};
  $('libCancel').onclick=()=>{LIB.edit=null;libRender();libSay('');};
  const sh=$('libShot');if(sh)sh.onclick=()=>{Object.assign(LIB.draft,readForm());const H=hits(LIB.draft.pattern);if(!H.length)return;
    LIB.draft.thumb=FixLib.thumb(asmOpen().r,H[0].inst,0,0,LIB.draft);libRender();libSay(`Picture taken from ${H[0].name}. Save to keep it.`);};
  const del=$('libDel');if(del)del.onclick=()=>{const d=LIB.draft;if(!confirm(`Delete ${d.pattern} from the library?`))return;LIB.edit=null;FixLib.remove(d.id);libSay(`${d.pattern} deleted.`);};
  [$('libPat'),$('libMin'),$('libMax')].forEach(i=>i.onkeydown=ev=>{if(ev.key==='Enter')$('libSave').click();if(ev.key==='Escape')$('libCancel').click();});}

$('libExport').onclick=()=>{cadDownload('route-studio-fixings.json',FixLib.toJSON());libSay(`Exported ${FixLib.all().length} entries.`);};
$('libImport').onclick=()=>$('libFile').click();
$('libFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  f.text().then(t=>{try{const r=FixLib.fromJSON(t);libSay(`${f.name}: ${r.added} added, ${r.replaced} replaced (same pattern).`);}catch(err){libSay(`${f.name}: ${err.message}.`,true);}});};
FixLib.onChange(()=>{if(LIB.edit&&LIB.edit!=='new'&&!FixLib.all().some(e=>e.id===LIB.edit))LIB.edit=null;libRender();if(typeof asmLibChanged==='function')asmLibChanged();});
window.libRender=libRender;
}
