const {Button,Tabs,CompareTable,Label}=window.RouteStudioDesignSystem_a31f22;
const {fmt,css}=window.RS;
function Chart({runs,sel,dock,colorMode}){
  const ref=React.useRef(null),wrap=React.useRef(null);
  React.useEffect(()=>{
    const cv=ref.current,box=wrap.current;if(!cv||!box)return;const W=box.clientWidth,H=box.clientHeight,dpr=window.devicePixelRatio||1;
    cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const isRad=dock==='rad';const vis=runs.filter(r=>r.visible&&(isRad||r.clearDense));if(!vis.length||!sel)return;
    const L={l:60,r:16,t:14,b:28},pw=W-L.l-L.r,ph=H-L.t-L.b,maxLen=Math.max(...vis.map(r=>r.len)),X=s=>L.l+s/maxLen*pw;
    ctx.font='12px '+css('--sans');ctx.strokeStyle=css('--rule');ctx.lineWidth=1;let Y,ticks;
    if(isRad){const R=sel.params.R,SF=sel.params.SF||1.5,lo=Math.max(1,Math.pow(10,Math.floor(Math.log10(Math.min(R,...vis.map(r=>r.minR))*0.7)))),hi=Math.max(2000,R*SF*4);
      Y=v=>L.t+ph*(1-(Math.log10(Math.min(Math.max(v,lo),hi))-Math.log10(lo))/(Math.log10(hi)-Math.log10(lo)));ticks=[];for(let e=Math.log10(lo);e<=Math.log10(hi)+1e-9;e++)ticks.push(Math.pow(10,e));}
    else{const all=vis.flatMap(r=>r.clearDense),gap=sel.clear?sel.clear.gap:0,hi=Math.max(gap*1.6,Math.max(...all)*1.05);Y=v=>L.t+ph*(1-Math.min(Math.max(v,0),hi)/hi);
      ticks=[];const raw=hi/5,p10=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].find(m=>m*p10>=raw)*p10;for(let v=0;v<=hi;v+=st)ticks.push(v);}
    ctx.fillStyle=css('--muted');ctx.textAlign='right';
    ticks.forEach(v=>{const y=Y(v);ctx.beginPath();ctx.moveTo(L.l,y);ctx.lineTo(L.l+pw,y);ctx.stroke();ctx.fillText(v>=1000?(v/1000)+'k':String(Math.round(v)),L.l-8,y+4);});
    ctx.save();ctx.translate(15,L.t+ph/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(isRad?'bend radius, mm':'clearance to master, mm',0,0);ctx.restore();
    const step=pw<520?(maxLen>2000?1000:500):(maxLen>2000?500:250);ctx.textAlign='center';for(let s=step;s<=maxLen;s+=step)ctx.fillText(s,X(s),H-9);ctx.textAlign='left';ctx.fillText('mm along route',L.l,H-9);
    const lim=(v,cv2,t)=>{ctx.lineWidth=1.5;ctx.strokeStyle=css(cv2);ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(L.l,Y(v));ctx.lineTo(L.l+pw,Y(v));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=css(cv2);ctx.textAlign='right';ctx.fillText(t,L.l+pw-4,Y(v)-4);};
    if(isRad){lim(sel.params.R,'--bad',`min ${sel.params.R}`);lim(sel.params.R*(sel.params.SF||1.5),'--warn',`x${sel.params.SF||1.5} margin`);}else if(sel.clear)lim(sel.clear.gap,'--bad',`gap ${sel.clear.gap}`);
    ctx.lineWidth=2;
    vis.forEach(r=>{const vals=isRad?r.d.k.map(k=>1/k):r.clearDense;const single=vis.length===1&&isRad&&colorMode==='radius';
      if(single){const R=r.params.R,SF=r.params.SF||1.5;for(let i=1;i<vals.length;i++){ctx.strokeStyle=css(vals[i]<R?'--bad':(vals[i]<R*SF?'--warn':'--ok'));ctx.beginPath();ctx.moveTo(X(r.d.s[i-1]),Y(vals[i-1]));ctx.lineTo(X(r.d.s[i]),Y(vals[i]));ctx.stroke();}}
      else{ctx.strokeStyle=r.color;ctx.globalAlpha=r.id===sel.id?1:0.6;ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(X(r.d.s[i]),Y(v)):ctx.moveTo(X(r.d.s[0]),Y(v)));ctx.stroke();ctx.globalAlpha=1;}});
  },[runs,sel,dock,colorMode]);
  return <div ref={wrap} style={{height:'100%'}}><canvas ref={ref} style={{display:'block'}}></canvas></div>;
}
function Dock({runs,sel,dock,setDock,colorMode}){
  const rows=[['Use case',r=>r.kindLabel],['Points',r=>r.Q.length],['Route length, mm',r=>Math.round(r.len)],['Min bend radius, mm',r=>fmt(r.minR)],
    ['Against limit',r=>{const R=r.params.R;return r.minR>=R?`passes (${(r.minR/R).toFixed(2)}x)`:`fails by ${fmt(R-r.minR)}`;}],
    ['Min clearance, mm',r=>r.clear?fmt(Math.min(...r.clear.after)):'--'],['Max clearance, mm',r=>r.clear?fmt(Math.max(...r.clear.after)):'--'],
    ['Largest point shift, mm',r=>r.clear?fmt(Math.max(...r.clear.shift)):'--'],['Settings',r=>r.settings]];
  const [copied,setCopied]=React.useState(false);
  const copy=async()=>{if(!sel)return;try{await navigator.clipboard.writeText(sel.text);}catch(e){}setCopied(true);setTimeout(()=>setCopied(false),1600);};
  return <div style={{borderTop:'1px solid var(--rule)',background:'var(--panel)',display:'grid',gridTemplateRows:'auto 1fr',minHeight:0}}>
    <Tabs variant="dock" value={dock} onChange={setDock} tabs={[{id:'rad',label:'Bend radius'},{id:'clr',label:'Clearance'},{id:'cmp',label:'Compare'},{id:'pts',label:'Points'}]}/>
    <div style={{position:'relative',minHeight:0,overflow:'auto'}}>
      {(dock==='rad'||dock==='clr')&&<Chart runs={runs} sel={sel} dock={dock} colorMode={colorMode}/>}
      {dock==='cmp'&&(runs.length?<CompareTable runs={runs} rows={rows.map(([n,f])=>({label:n,values:runs.map(f)}))}/>:<p style={{color:'var(--muted)',fontSize:13,padding:14,margin:0}}>Nothing to compare yet.</p>)}
      {dock==='pts'&&<div style={{padding:'10px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:6}}><Label style={{margin:0}}>{sel?sel.name:'Points'}</Label>
          <span style={{display:'flex',gap:8}}><Button variant="small" onClick={copy}>{copied?'Copied':'Copy'}</Button><Button variant="small">Download .pts</Button></span></div>
        <textarea readOnly spellCheck={false} wrap="off" value={sel?sel.text:''} style={{font:'13px/1.5 var(--mono)',color:'var(--ink)',background:'var(--field)',border:'1px solid var(--rule)',borderRadius:4,width:'100%',padding:'7px 8px',height:150,resize:'vertical'}}></textarea>
      </div>}
    </div>
  </div>;
}
window.Dock=Dock;
