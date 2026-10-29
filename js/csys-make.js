/* csys-make.js — coordinate systems made in Route Studio, written as a STEP file Creo imports (Q6).
 * frame(o, z, xHint): a right-handed CSYS {o,x,y,z} with Z along z and X as close to xHint as Z allows (else the world axis
 * least along Z). stepText(name, list): AP203 STEP holding each CSYS as a named AXIS2_PLACEMENT_3D in one shape
 * representation, millimetres, assembly coordinates (import it into the assembly at the default placement).
 * No DOM in the logic: Node require('./csys-make.js'). The UI block runs only in the page (after asm-view.js).
 */
(function (root) {
"use strict";
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),
  mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],norm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l];},
  cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

function frame(o,z,xHint){const Z=norm(z&&len(z)>1e-9?z:[0,0,1]);
  let X=xHint&&len(xHint)>1e-9?sub(xHint,mul(Z,dot(xHint,Z))):null;
  if(!X||len(X)<1e-6){const k=[0,1,2].sort((i,j)=>Math.abs(Z[i])-Math.abs(Z[j]))[0],e=[0,0,0];e[k]=1;X=sub(e,mul(Z,dot(e,Z)));}
  X=norm(X);return{o:o.slice(0,3),x:X,y:cross(Z,X),z:Z};}
// turn X (and Y) about Z by deg; flip Z keeps X (Y follows, so the frame stays right-handed)
function turn(c,deg){const a=deg*Math.PI/180,X=norm([0,1,2].map(k=>c.x[k]*Math.cos(a)+c.y[k]*Math.sin(a)));return{...c,...frame(c.o,c.z,X)};}
function flip(c){return{...c,...frame(c.o,mul(c.z,-1),c.x)};}

// STEP names: letters, digits, _ - . only (Creo shows them as the CSYS names)
const stepName=s=>String(s||'CS').replace(/[^\w.-]+/g,'_').slice(0,60)||'CS';
function stepText(name,list){
  const E=[];let n=0;const add=s=>{E.push(`#${++n}=${s}`);return n;};
  const num=v=>(Math.abs(v)<5e-13?0:v).toExponential(12).toUpperCase(),vec=v=>`(${v.map(num).join(',')})`;
  const items=list.map(c=>add(`AXIS2_PLACEMENT_3D('${stepName(c.name)}',#${add(`CARTESIAN_POINT('',${vec(c.o)})`)},#${add(`DIRECTION('',${vec(c.z)})`)},#${add(`DIRECTION('',${vec(c.x)})`)})`));
  const u1=add('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))'),u2=add('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))'),u3=add('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const unc=add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.000000000000E-3),#${u1},'closure','')`);
  const ctx=add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${u1},#${u2},#${u3}))REPRESENTATION_CONTEXT('ID1','3'))`);
  const sr=add(`SHAPE_REPRESENTATION('CSYS',(${items.map(i=>'#'+i).join(',')}),#${ctx})`);
  const ac=add(`APPLICATION_CONTEXT('CONFIGURATION CONTROLLED 3D DESIGNS OF MECHANICAL PARTS AND ASSEMBLIES')`);
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,#${ac})`);
  const mc=add(`MECHANICAL_CONTEXT('',#${ac},'mechanical')`),dc=add(`DESIGN_CONTEXT('',#${ac},'design')`);
  const id=stepName(name).toUpperCase();
  const pr=add(`PRODUCT('${id}','${id}','NOT SPECIFIED',(#${mc}))`);
  const pf=add(`PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('1','LAST_VERSION',#${pr},.MADE.)`);
  const pd=add(`PRODUCT_DEFINITION('design','',#${pf},#${dc})`);
  const ps=add(`PRODUCT_DEFINITION_SHAPE('','SHAPE FOR ${id}.',#${pd})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(#${ps},#${sr})`);
  const date=new Date().toISOString().slice(0,19);
  return`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Coordinate systems from Route Studio'),'2;1');\nFILE_NAME('${id.toLowerCase()}','${date}',(''),(''),'Route Studio','Route Studio','');\nFILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));\nENDSEC;\nDATA;\n${E.join(';\n')};\nENDSEC;\nEND-ISO-10303-21;\n`;}
// a name not used yet: base1, base2, ...
function freeName(base,used){const u=new Set(used);let i=1;while(u.has(`${base}${i}`))i++;return`${base}${i}`;}

const API={frame,turn,flip,stepText,stepName,freeName};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
root.CsysMake=API;

// ---------------- UI ----------------
// the list is the dock tab CSYS (beside Points); the header line links to it
if(typeof document==='undefined'||!document.getElementById('paneCsys'))return;
const MK={list:[]};
const key=()=>'rs.csysMade.'+(typeof ASM!=='undefined'&&ASM?ASM.name:'');
const save=()=>store.set(key(),JSON.stringify(MK.list));
const load=()=>{try{MK.list=JSON.parse(store.get(key())||'[]');}catch(e){MK.list=[];}};
const f3=v=>(Math.abs(v)<5e-4?0:v).toFixed(3).replace('-','−'),xyz=a=>a.map(f3).join(' ');
const nums=t=>{const v=String(t).replace(/[−–]/g,'-').replace(/,/g,' ').trim().split(/\s+/).map(Number);return v.length===3&&v.every(Number.isFinite)?v:null;};
// axis words: +X … −Z; a vector within 0.999 of one is that axis
const AXES=[['+X',[1,0,0]],['−X',[-1,0,0]],['+Y',[0,1,0]],['−Y',[0,-1,0]],['+Z',[0,0,1]],['−Z',[0,0,-1]]];
const axisOf=v=>{const l=Math.hypot(...v)||1,a=AXES.find(([,e])=>(e[0]*v[0]+e[1]*v[1]+e[2]*v[2])/l>=0.999);return a?a[0]:null;};
// asm-view.js draws these and lets them be picked
root.csysMade=()=>MK.list;
const showTab=()=>{dock='csys';showPane();};
{const sp=showPane;showPane=function(){$('paneCsys').dataset.on=dock==='csys'?1:0;$('dCsys').setAttribute('aria-selected',dock==='csys');sp();};}
$('dCsys').onclick=showTab;$('shMkGo').onclick=showTab;

function render(){const n=MK.list.length;
  $('mkN').textContent=n;$('mkExport').disabled=$('mkCopy').disabled=!n;
  $('shMk').hidden=!n;$('shMkGo').textContent=`${n} CSYS made here`;if(n)$('dCsys').hidden=false;
  $('mkList').innerHTML=MK.list.map((c,i)=>{const za=axisOf(c.z),xa=axisOf(c.x);
    return`<div class="mkrow" data-i="${i}">
    <div class="mk1"><input class="mkname" value="${esc(c.name)}" aria-label="Name" title="Name (Creo shows it as the CSYS name); click to edit">
      <button type="button" data-show>show</button><button type="button" data-flip>flip Z</button><button type="button" data-turn>X +90°</button><button type="button" class="mkdel" data-del aria-label="Delete ${esc(c.name)}" title="Delete">×</button></div>
    <div class="mk2"><label>at <input class="mko" value="${xyz(c.o)}" spellcheck="false" aria-label="Origin X Y Z"></label>
      <label>Z <select class="mkzs" aria-label="Z axis">${AXES.map(([w])=>`<option${w===za?' selected':''}>${w}</option>`).join('')}<option value="typed"${za?'':' selected'}>typed…</option></select></label>
      <input class="mkz" value="${xyz(c.z)}" spellcheck="false" aria-label="Z as dX dY dZ"${za?' hidden':''}>
      <span>X ${xa||xyz(c.x)}</span></div></div>`;}).join('')||
    '<p class="hint">None yet. Click a part, hole or CSYS in the 3D view and choose “New CSYS here”, or type a point below.</p>';
  $('mkList').querySelectorAll('.mkrow').forEach(row=>{const i=+row.dataset.i,c=MK.list[i];
    row.querySelector('.mkname').onchange=e=>{c.name=CsysMake.stepName(e.target.value);done(`Renamed to ${c.name}.`);};
    row.querySelector('.mko').onchange=e=>{const v=nums(e.target.value);if(!v)return say('Origin: three numbers, X Y Z.',true);c.o=v;done(`${c.name} moved.`);};
    const setZ=v=>{Object.assign(c,CsysMake.frame(c.o,v,c.x));done(`${c.name}: Z along ${axisOf(c.z)||xyz(c.z)}.`);};
    row.querySelector('.mkzs').onchange=e=>{const w=e.target.value;if(w==='typed'){const z=row.querySelector('.mkz');z.hidden=false;z.focus();z.select();return;}
      setZ(AXES.find(a=>a[0]===w)[1]);};
    row.querySelector('.mkz').onchange=e=>{const v=nums(e.target.value);if(!v||Math.hypot(...v)<1e-9)return say('Z: three numbers, not all 0.',true);setZ(v);};
    row.querySelector('[data-flip]').onclick=()=>{Object.assign(c,CsysMake.flip(c));done(`${c.name}: Z flipped.`);};
    row.querySelector('[data-turn]').onclick=()=>{Object.assign(c,CsysMake.turn(c,90));done(`${c.name}: X turned 90° about Z.`);};
    row.querySelector('[data-show]').onclick=()=>{orbit.target.set(...c.o);orbit.dist=Math.max(diag*0.08,150);draw();if(typeof asmSetPick==='function')asmSetPick({kind:'csys',c:{...c,made:true,i},inst:null});};
    row.querySelector('[data-del]').onclick=()=>{MK.list.splice(i,1);done(`${c.name} deleted.`);};});}
const say=(m,bad)=>{const e=$('mkStatus');e.textContent=m;e.style.color=bad?'var(--bad)':'';};
function done(msg){save();render();if(typeof asmPanel==='function'){const p=asmPick&&asmPick();if(p&&p.c&&p.c.made)asmSetPick(null);}rebuild(false);if(msg)say(msg);}
// names in use: the made ones and the open assembly's own CSYS (a made one must not repeat either in Creo)
const usedNames=()=>MK.list.map(c=>c.name).concat(typeof ASM!=='undefined'&&ASM&&ASM.r?ASM.r.csys.map(c=>c.name):[]);
function make(o,z,x,base){const c={name:CsysMake.freeName(base||'RS_CS',usedNames()),...CsysMake.frame(o,z,x)};
  MK.list.push(c);done(`${c.name} made at ${xyz(c.o)}, Z ${axisOf(c.z)||xyz(c.z)}.`);return c;}
root.csysMake=make;

// pick panel (asm-view.js): a new CSYS at the picked hole / CSYS / point; edit a made one
(root.AV_ACTIONS=root.AV_ACTIONS||[]).push((p,r)=>{if(p.kind!=='csys'&&p.kind!=='part')return[];
  const G='Creo · Library';
  if(p.kind==='csys'&&p.c.made){const c=MK.list[p.c.i];if(!c)return[];
    return[{group:G,order:3,label:'Flip Z',go:()=>{Object.assign(c,CsysMake.flip(c));save();render();p.c={...c,made:true,i:p.c.i};return`${c.name}: Z flipped.`;}},
      {group:G,order:3,label:'X +90°',go:()=>{Object.assign(c,CsysMake.turn(c,90));save();render();p.c={...c,made:true,i:p.c.i};return`${c.name}: X turned 90° about Z.`;}},
      {group:G,order:3,label:'Delete',go:()=>{MK.list.splice(p.c.i,1);done(`${c.name} deleted.`);return'';}}];}
  return[{group:G,order:3,label:'New CSYS here',title:'A coordinate system at the hole centre (Z along its axis), at this CSYS, or at the clicked point; listed in the CSYS tab for export to Creo',
    go:()=>{let o,z,x,base;
      if(p.kind==='csys'){const h=p.c.hole;o=h?h.c:p.c.o;z=h?h.d:p.c.z;x=p.c.x;base=`${CsysMake.stepName(p.c.name)}_RS`;}
      else{const near=r.holes.filter(h=>h.inst===p.inst).map(h=>({h,e:Math.hypot(...[0,1,2].map(k=>h.c[k]-p.p[k]))})).sort((a,b)=>a.e-b.e)[0];
        const I=r.instances[p.inst]||{};base=`${CsysMake.stepName(I.name||'PART')}_CS`;
        if(near&&near.e<=Math.max(30,3*near.h.r)){o=near.h.c;z=near.h.d;}else{o=p.p;z=[0,0,1];}}
      const c=make(o,z,x,base);return`${c.name} made (listed in the CSYS tab).`;}}];});

$('mkAdd').onclick=()=>{const v=nums($('mkXYZ').value);if(!v)return say('Type a point as X Y Z (mm, assembly coordinates).',true);make(v,[0,0,1],null);};
$('mkExport').onclick=()=>{const asm=typeof ASM!=='undefined'&&ASM?ASM.name.replace(/\.[^.]+$/,''):'',nm=(asm||'route')+'_csys',n=MK.list.length;
  cadDownload(nm+'.stp',CsysMake.stepText(nm,MK.list),'application/step');
  say(`${nm}.stp: ${n} coordinate system${n===1?'':'s'}, mm, assembly coordinates. In Creo, assemble it into ${asm||'the assembly'} at the default placement; the systems appear under its name.`);};
// plain ASCII minus for a spreadsheet
$('mkCopy').onclick=()=>{const a=v=>v.map(q=>(Math.abs(q)<5e-4?0:q).toFixed(3)).join(' '),t=MK.list.map(c=>`${c.name}\t${a(c.o)}\tZ ${a(c.z)}\tX ${a(c.x)}`).join('\n');
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>say('Copied as a table (name, origin, Z, X).'),()=>say('Copy failed: select the list by hand.',true));};
// another file: its own list. CSYS made before any file was open go into the first file opened. asm-view.js drew the scene
// (on asm:loaded, before this) with the list it had: redraw, and drop a pick of a made CSYS from that list
document.addEventListener('asm:loaded',()=>{load();
  let pre=[];try{pre=ASM.name?JSON.parse(store.get('rs.csysMade.')||'[]'):[];}catch(e){}
  if(pre.length){pre.forEach(c=>{const u=usedNames();if(u.includes(c.name))c.name=CsysMake.freeName(c.name+'_',u);MK.list.push(c);});
    save();store.set('rs.csysMade.','[]');say(`${pre.length} CSYS made before a file was open now listed for ${ASM.name}.`);}
  render();$('dCsys').hidden=false;
  const p=typeof asmPick==='function'&&asmPick();if(p&&p.c&&p.c.made)asmSetPick(null);rebuild(false);});
load();render();
})(typeof globalThis!=="undefined"?globalThis:this);
