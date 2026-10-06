// ---------------- Table -> .pts ----------------
// Paste pipe points as scanned from a drawing table (X block, Y block, Z block, or X Y Z rows)
// and get a .pts file to copy or download. Also checks bend angles and the bend radius each corner leaves room for.
// Loaded last.

const PT_EXAMPLE=`X
2370.0
2215.0
2215.0
2180.0
2265.0
2572.6
2652.79
2749.62

Y
-550.0
-550.0
-500.0
-500.0
-447.0
-447.0
-397.848
-392.156

Z
1040.0
1040.0
1214.0
1300.0
1330.0
1330.0
1325.08
1350.74`;

const ptNum=s=>{const t=String(s).trim().replace(/,(?=\d{3}\b)/g,'').replace(/[−–]/g,'-');return t!==''&&isFinite(+t)?+t:null;};

// returns {P:[[x,y,z]...]} or {err}
function ptParse(text){
  const lines=String(text).split(/\r?\n/).map(l=>l.trim());
  const isHead=l=>/^[XYZ]\s*(\(.*\))?\s*[:：]?$/i.test(l);
  // 1. column blocks: a heading X / Y / Z, then one value per line
  if(lines.some(isHead)){
    const cols={};let cur=null,stray=0;
    for(const l of lines){
      if(!l)continue;
      if(isHead(l)){cur=l[0].toUpperCase();if(cols[cur])return{err:`Heading ${cur} appears twice.`};cols[cur]=[];continue;}
      const v=ptNum(l);
      if(v===null||!cur){stray++;continue;}
      cols[cur].push(v);}
    const miss=['X','Y','Z'].filter(k=>!cols[k]);
    if(miss.length)return{err:`No ${miss.join(' / ')} block found. Each block starts with a line holding only X, Y or Z.`};
    const n=['X','Y','Z'].map(k=>cols[k].length);
    if(n[0]!==n[1]||n[1]!==n[2])return{err:`Columns differ in length: X ${n[0]}, Y ${n[1]}, Z ${n[2]} values. Check the paste.`};
    return{P:cols.X.map((x,i)=>[x,cols.Y[i],cols.Z[i]]),stray,how:'column blocks'};}
  // 2. rows: X Y Z (optionally a point number first), tabs, spaces or commas
  const P=[];let stray=0;
  for(const l of lines){
    if(!l||/^[!#]/.test(l))continue;
    const v=l.split(/[\t;]+|\s+|,(?!\d{3}\b)/).map(ptNum).filter(x=>x!==null);
    if(v.length===3)P.push(v);else if(v.length===4)P.push(v.slice(1));else stray++;}
  if(!P.length)return{err:'No points found. Paste X, Y and Z blocks, or rows of X Y Z.'};
  return{P,stray,how:'rows'};
}

// corner check: angle at each interior point, and the largest bend radius that fits between neighbours
function ptCheck(P){
  const n=P.length,seg=[],ang=[],tan=[];
  for(let i=0;i<n-1;i++)seg.push(V.len(V.sub(P[i+1],P[i])));
  for(let i=0;i<n;i++){
    if(i===0||i===n-1){ang.push(null);tan.push(0);continue;}
    const u=V.norm(V.sub(P[i],P[i-1])),w=V.norm(V.sub(P[i+1],P[i]));
    const a=Math.acos(Math.max(-1,Math.min(1,V.dot(u,w))));ang.push(a*180/Math.PI);tan.push(a>1e-6?Math.tan(Math.min(a,3.1)/2):0);}
  // a segment holds the tangent lengths of the arcs at both its ends: R*(tan_i + tan_i+1) <= L
  const segMax=seg.map((L,i)=>{const t=tan[i]+tan[i+1];return t>1e-9?L/t:Infinity;});
  const cornerMax=P.map((_,i)=>(i===0||i===n-1||!tan[i])?Infinity:Math.min(segMax[i-1],segMax[i]));
  return{seg,ang,segMax,cornerMax,maxR:Math.min(...segMax)};
}

function ptPts(P,dec,name){
  const f=v=>v.toFixed(dec).padStart(15);
  return['!','!       DATUM POINT ARRAY DATA FILE','!',`! ${name}: ${P.length} points from a drawing table.`,'!',
    "! Enter values with respect to datum arrays' coordinate system:",'!','!CARTESIAN coordinates:','!        X                Y                Z','!',
    ...P.map(p=>`${f(p[0])} ${f(p[1])} ${f(p[2])}`)].join('\n')+'\n';
}

let ptLast=null;
function ptRun(){
  const say=(m,bad)=>{$('statusTable').textContent=m;$('statusTable').style.color=bad?'var(--bad)':'';};
  const txt=$('tin').value;store.set('rs.table',txt);
  const off=()=>{ptLast=null;$('tout').value='';$('tcheck').innerHTML='';['tCopy','tDl','tToBend'].forEach(k=>$(k).disabled=true);};
  if(!txt.trim()){off();return say('');}
  const r=ptParse(txt);if(r.err){off();return say(r.err,true);}
  const P=r.P.filter((p,i)=>i===0||V.len(V.sub(p,r.P[i-1]))>1e-9),dup=r.P.length-P.length;
  if(P.length<2){off();return say('Need at least two points.',true);}
  const dec=Math.max(0,Math.min(6,Math.round(+$('tdec').value||0))),name=($('tname').value||'pipe_route').trim();
  ptLast={P,name};$('tout').value=ptPts(P,dec,name);['tCopy','tDl','tToBend'].forEach(k=>$(k).disabled=false);
  const c=ptCheck(P),BR=+$('tbr').value||0,fit=v=>v>=1e6?'—':fmt(v,0);
  const bad=BR?P.map((_,i)=>c.cornerMax[i]<BR):P.map(()=>false);
  $('tcheck').innerHTML=`<table><thead><tr><th>Pt</th><th>X</th><th>Y</th><th>Z</th><th>Bend °</th><th>Max R</th><th>Next seg</th></tr></thead><tbody>${
    P.map((p,i)=>`<tr><td>P${i+1}</td><td>${p[0].toFixed(dec)}</td><td>${p[1].toFixed(dec)}</td><td>${p[2].toFixed(dec)}</td><td>${c.ang[i]==null?'':c.ang[i].toFixed(1)}</td><td class="${bad[i]?'bad':''}">${c.ang[i]==null||c.ang[i]<1e-4?'':fit(c.cornerMax[i])}</td><td>${i<c.seg.length?c.seg[i].toFixed(1):''}</td></tr>`).join('')
  }</tbody></table><div class="sum">${
    isFinite(c.maxR)?`Bend radius fits up to <b>R ${fmt(c.maxR,0)} mm</b> (limited between P${c.segMax.indexOf(c.maxR)+1} and P${c.segMax.indexOf(c.maxR)+2}).`:'Straight run, no bends.'}${
    BR?(bad.some(Boolean)?` <span style="color:var(--bad)">R ${BR} does not fit at ${P.map((_,i)=>bad[i]?'P'+(i+1):'').filter(Boolean).join(', ')}.</span>`:` <span style="color:var(--ok)">R ${BR} fits at every corner.</span>`):''}</div>`;
  say(`${P.length} points read (${r.how})${dup?`, ${dup} repeated point${dup>1?'s':''} dropped`:''}${r.stray?`, ${r.stray} line${r.stray>1?'s':''} ignored`:''}.`);
}

{const tabs=[['bend','panBend','tabBend'],['clear','panClear','tabClear'],['bundle','panBundle','tabBundle'],['analyse','panAnalyse','tabAnalyse'],['table','panTable','tabTable']];
  showPanel=function(which){tabs.forEach(([k,p,t])=>{$(p).hidden=k!==which;$(t).setAttribute('aria-selected',k===which);});};
  $('tabTable').onclick=()=>showPanel('table');
  let tmr=0;const later=()=>{clearTimeout(tmr);tmr=setTimeout(ptRun,150);};
  ['tin','tname','tdec','tbr'].forEach(k=>$(k).addEventListener('input',later));
  $('tExample').onclick=()=>{$('tin').value=PT_EXAMPLE;ptRun();};
  $('tClear').onclick=()=>{$('tin').value='';ptRun();$('tin').focus();};
  $('tCopy').onclick=async()=>{const t=$('tout');if(!t.value)return;
    try{await navigator.clipboard.writeText(t.value);$('tCopy').textContent='Copied';}
    catch(e){t.select();try{document.execCommand('copy');$('tCopy').textContent='Copied';}catch(e2){$('tCopy').textContent='Select and copy';}}
    setTimeout(()=>$('tCopy').textContent='Copy .pts',1600);};
  $('tDl').onclick=()=>{if(!ptLast)return;const nm=ptLast.name.replace(/[^\w.-]+/g,'_').replace(/\.pts$/i,'')+'.pts';
    if(typeof cadDownload==='function')return cadDownload(nm,$('tout').value);
    const b=new Blob([$('tout').value],{type:'text/plain'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=nm;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);};
  $('tToBend').onclick=()=>{if(!ptLast)return;$('pts').value=ptLast.P.map(p=>p.map(v=>v.toFixed(3).padStart(12)).join(' ')).join('\n')+'\n';
    if($('cadpick_pts'))$('cadpick_pts').hidden=true;showPanel('bend');$('statusBend').textContent=`${ptLast.P.length} points from the table. Press Check to route them.`;};
  const saved=store.get('rs.table');if(saved){$('tin').value=saved;ptRun();}}
