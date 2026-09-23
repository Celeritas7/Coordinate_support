const {parsePts,analyse,generate,adjustClearance,toPts,PRESETS,PALETTE,fmt}=window.RS;
function App({seed=true}){
  const [tab,setTab]=React.useState('bend');
  const [form,setForm]=React.useState({pts:PRESETS.target,R:65,SF:1.5,SP:85,sd:'',ed:'',mpts:PRESETS.master,spts:PRESETS.slave,gap:40,mode:'min',plane:'free',smooth:2,blend:0,cr:65,lock:'',reorder:true});
  const [runs,setRuns]=React.useState([]);const [selId,setSelId]=React.useState(null);
  const [colorMode,setColorMode]=React.useState('radius');const [dock,setDock]=React.useState('rad');const [zoomed,setZoomed]=React.useState(false);
  const [status,setStatus]=React.useState('');const [busy,setBusy]=React.useState(false);
  const next=React.useRef(1);
  const add=(list,run)=>{run.id=next.current++;run.color=PALETTE[(run.id-1)%PALETTE.length];run.visible=true;const out=[...list,run];if(out.length>6)out.shift();return out;};
  const runBend=(f=form)=>{const P=parsePts(f.pts);if(P.length<3)return setStatus('Paste at least three points.');
    const R=+f.R||65,SF=+f.SF||1.5,SP=+f.SP||85;const A=analyse(P);
    const r1=Object.assign(A,{name:`As entered R${R}`,kind:'bend',kindLabel:'bend radius, as entered',params:{R,SF},settings:`${P.length} points as entered`,text:toPts(P,{R,designR:R*SF,minR:A.minR,len:A.len})});
    const G=generate(P,SP),B=analyse(G);B.tidx=P.map(p=>G.findIndex(q=>Math.abs(q[0]-p[0])<0.01&&Math.abs(q[1]-p[1])<0.01&&Math.abs(q[2]-p[2])<0.01)).filter(i=>i>=0);
    const r2=Object.assign(B,{name:`Generated R${R} x${SF}`,kind:'bend',kindLabel:'bend radius, generated',params:{R,SF,spacing:SP},settings:`gap ${SP} mm between points, x${SF} margin`,text:toPts(G,{R,designR:+(R*SF).toFixed(1),minR:B.minR,len:B.len})});
    setBusy(true);setStatus(`Shaping the curve... tightest bend so far R ${fmt(A.minR)} mm`);
    setRuns(rs=>{const a=add(rs,r1);return a;});setSelId(r1.id);
    setTimeout(()=>{setRuns(rs=>add(rs,r2));setSelId(r2.id);setBusy(false);setStatus(`Added. Generated route holds R ${fmt(B.minR)} mm over ${G.length} points.`);},700);};
  const runClear=()=>{const M=parsePts(form.mpts),S=parsePts(form.spts);if(M.length<2||S.length<2)return setStatus('Paste both routes, at least two points each.');
    const gap=+form.gap||0,mode=form.mode,plane=form.plane,R=+form.cr||65;const res=adjustClearance(M,S,gap,mode);const A=analyse(res.moved);
    A.clearDense=A.d.pts.map(p=>{let bd=Infinity;for(let i=0;i<M.length-1;i++){const a=M[i],b=M[i+1],ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L2=ab[0]**2+ab[1]**2+ab[2]**2;let t=L2?((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/L2:0;t=Math.max(0,Math.min(1,t));bd=Math.min(bd,Math.hypot(p[0]-a[0]-ab[0]*t,p[1]-a[1]-ab[1]*t,p[2]-a[2]-ab[2]*t));}return bd;});
    const r=Object.assign(A,{name:`Gap ${gap} ${mode}${plane!=='free'?' '+plane:''}`,kind:'clear',kindLabel:`clearance, ${mode}`,master:M,clear:{gap,mode,plane,...res},params:{R,SF:1.5,gap,mode,plane},
      settings:`${mode}, push ${plane}, smooth ${form.smooth}, blend ${form.blend}${form.lock?', locked '+form.lock:''}`,text:toPts(res.moved,{R,designR:R*1.5,minR:A.minR,len:A.len})});
    setRuns(rs=>add(rs,r));setSelId(r.id);setDock('clr');
    setStatus(`Clearance now ${fmt(Math.min(...res.after))} to ${fmt(Math.max(...res.after))} mm, largest shift ${fmt(Math.max(...res.shift))} mm, tightest bend R ${fmt(A.minR)} mm.`);};
  React.useEffect(()=>{if(seed)runBend();},[]);
  const sel=runs.find(r=>r.id===selId)||runs[runs.length-1]||null;
  const select=id=>{setSelId(id);const r=runs.find(x=>x.id===id);if(!r)return;if(r.kind==='clear'){setTab('clear');setForm(s=>({...s,gap:r.params.gap,mode:r.params.mode,plane:r.params.plane,cr:r.params.R}));}else{setTab('bend');setForm(s=>({...s,R:r.params.R,SF:r.params.SF,...(r.params.spacing?{SP:r.params.spacing}:{})}));}};
  return <div style={{display:'grid',gridTemplateColumns:'360px 1fr',height:'100%'}} className="rs-app">
    <Sidebar tab={tab} setTab={t=>{setTab(t);setStatus('');}} form={form} setForm={setForm} runs={runs} selId={sel&&sel.id} status={status} busy={busy}
      onRunBend={()=>runBend()} onRunClear={runClear} onToggle={(id,v)=>setRuns(rs=>rs.map(r=>r.id===id?{...r,visible:v}:r))} onSelect={select}
      onRemove={id=>setRuns(rs=>rs.filter(r=>r.id!==id))}/>
    <main style={{display:'grid',gridTemplateRows:'1fr 230px',minWidth:0,minHeight:0}} className="rs-main">
      <View runs={runs} sel={sel} colorMode={colorMode} setColorMode={setColorMode} zoomed={zoomed} setZoomed={setZoomed}/>
      <Dock runs={runs} sel={sel} dock={dock} setDock={setDock} colorMode={colorMode}/>
    </main>
  </div>;
}
window.RouteStudioApp=App;
