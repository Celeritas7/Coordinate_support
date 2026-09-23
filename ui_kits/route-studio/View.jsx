const {Button,SegmentedControl,Readout,Legend,Tag}=window.RouteStudioDesignSystem_a31f22;
const {V,fmt,css}=window.RS;
function project(p,th,el){const x1=p[0]*Math.cos(th)-p[1]*Math.sin(th),y1=p[0]*Math.sin(th)+p[1]*Math.cos(th);return[x1,y1*Math.sin(el)-p[2]*Math.cos(el)];}
function radiusColor(rad,R,SF,c){return rad<R?c.bad:(rad<R*SF?c.warn:c.ok);}
function View({runs,sel,colorMode,setColorMode,zoomed,setZoomed}){
  const ref=React.useRef(null),wrap=React.useRef(null);
  const [cam,setCam]=React.useState({th:-0.55,el:0.95});
  const [tags,setTags]=React.useState([]);
  const vis=runs.filter(r=>r.visible);
  React.useEffect(()=>{
    const cv=ref.current,box=wrap.current;if(!cv||!box)return;
    const W=box.clientWidth,H=box.clientHeight,dpr=window.devicePixelRatio||1;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=css('--paper');g.fillRect(0,0,W,H);
    if(!vis.length){setTags([]);return;}
    const all=[];vis.forEach(r=>{r.d.pts.forEach(p=>all.push(p));if(r.master)r.master.forEach(p=>all.push(p));});
    const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];all.forEach(p=>p.forEach((c,i)=>{mn[i]=Math.min(mn[i],c);mx[i]=Math.max(mx[i],c);}));
    const ctr=mn.map((c,i)=>(c+mx[i])/2),diag=Math.max(V.len(V.sub(mx,mn)),100);
    let focus=ctr,scaleDiag=diag;
    if(zoomed&&sel&&sel.visible){focus=sel.d.pts[sel.wi];scaleDiag=Math.max(sel.params.R,sel.minR)*6;}
    const pr=p=>project(V.sub(p,focus),cam.th,cam.el);
    const s=Math.min(W,H)*0.78/scaleDiag*(zoomed?1:1.15),cx=W/2,cy=H/2+(zoomed?0:H*0.02);
    const S=p=>{const q=pr(p);return[cx+q[0]*s,cy+q[1]*s];};
    const tubeR=Math.max(diag*0.0042,1.5)*s;
    // floor grid
    const gs=Math.pow(10,Math.floor(Math.log10(diag/4))),size=Math.ceil(diag*1.6/gs)*gs,z0=mn[2]-diag*0.08;
    g.strokeStyle=css('--grid');g.lineWidth=1;g.beginPath();
    for(let v=-size/2;v<=size/2+1e-6;v+=gs){let a=S([ctr[0]+v,ctr[1]-size/2,z0]),b=S([ctr[0]+v,ctr[1]+size/2,z0]);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);
      a=S([ctr[0]-size/2,ctr[1]+v,z0]);b=S([ctr[0]+size/2,ctr[1]+v,z0]);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);}
    g.stroke();
    const c={bad:css('--bad'),warn:css('--warn'),ok:css('--ok')};const T=[];
    g.lineCap='round';g.lineJoin='round';
    vis.forEach(r=>{
      if(r.master){g.strokeStyle=css('--muted');g.lineWidth=1.2;g.beginPath();r.master.forEach((p,i)=>{const q=S(p);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.stroke();
        g.fillStyle=css('--muted');r.master.forEach(p=>{const q=S(p);g.beginPath();g.arc(q[0],q[1],tubeR*1.4,0,7);g.fill();});
        const q=S(r.master[0]);T.push({x:q[0],y:q[1],text:'master',variant:'text'});}
      const R=r.params.R,SF=r.params.SF||1.5,w=(sel&&r.id===sel.id?tubeR:tubeR*0.8)*2;
      g.lineWidth=w;const pts=r.d.pts;
      for(let i=1;i<pts.length;i++){g.strokeStyle=colorMode==='radius'?radiusColor(1/r.d.k[i],R,SF,c):r.color;const a=S(pts[i-1]),b=S(pts[i]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
      g.fillStyle=r.color;r.Q.forEach((q,i)=>{const isT=!r.tidx||r.tidx.includes(i),p=S(q);g.beginPath();g.arc(p[0],p[1],isT?tubeR*1.9:tubeR*1.15,0,7);g.fill();});
    });
    if(sel&&sel.visible){const p=S(sel.d.pts[sel.wi]);const rw=sel.minR,R=sel.params.R,SF=sel.params.SF||1.5;
      const cc=rw<R?c.bad:(rw<R*SF?c.warn:c.ok);
      g.strokeStyle=cc;g.lineWidth=1.2;g.beginPath();g.arc(p[0],p[1],Math.min(rw*s,W),0,7);g.stroke();
      g.strokeStyle=css('--ink');g.setLineDash([6,4]);g.beginPath();g.arc(p[0],p[1],Math.min(R*s,W),0,7);g.stroke();g.setLineDash([]);
      T.push({x:p[0]+tubeR*3,y:p[1],text:`tightest bend R ${fmt(rw)} mm`,variant:'box'});
      sel.Q.forEach((q,i)=>{if(!sel.tidx||sel.tidx.includes(i)){const pp=S(q);T.push({x:pp[0],y:pp[1],text:'P'+((sel.tidx?sel.tidx.indexOf(i):i)+1),variant:'text'});}});}
    setTags(T);
  },[runs,sel,colorMode,cam,zoomed]);
  const drag=React.useRef(null);
  const onDown=e=>{drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);};
  const onMove=e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current={x:e.clientX,y:e.clientY};setCam(cm=>({th:cm.th-dx*0.008,el:Math.min(1.5,Math.max(0.05,cm.el+dy*0.008))}));};
  let ro=null;
  if(sel){const R=sel.params.R,SF=sel.params.SF||1.5,ok=sel.minR>=R,safe=sel.minR>=R*SF*0.98;
    const v=ok?(safe?`Passes. Tightest bend is ${(sel.minR/R).toFixed(2)}x the minimum radius.`:`Passes, but inside the x${SF} safety margin.`):`Too tight: ${fmt(R-sel.minR)} mm below the ${R} mm minimum.`;
    let extra=`${sel.Q.length} points. Length ${Math.round(sel.len)} mm.`;if(sel.clear)extra+=` Clearance ${fmt(Math.min(...sel.clear.after))}-${fmt(Math.max(...sel.clear.after))} mm.`;
    ro=<Readout value={<>R {fmt(sel.minR)}</>} name={sel.name} tone={ok?(safe?'ok':'warn'):'bad'} verdict={v} facts={extra}/>;}
  const legend=colorMode==='radius'?[{color:'var(--bad)',label:'below min radius'},{color:'var(--warn)',label:'inside safety margin'},{color:'var(--ok)',label:'OK'}]:vis.map(r=>({color:r.color,label:r.name}));
  return <div ref={wrap} style={{position:'relative',minHeight:0,overflow:'hidden'}}>
    <canvas ref={ref} aria-label="3D view of the routes" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={()=>drag.current=null} style={{position:'absolute',inset:0,touchAction:'none',cursor:drag.current?'grabbing':'grab'}}></canvas>
    <div style={{position:'absolute',left:18,top:14,pointerEvents:'none',maxWidth:'60%'}}>{ro||<div style={{fontSize:13.5,marginTop:2}}>Run a check to see it here.</div>}</div>
    <div style={{position:'absolute',right:16,top:14,display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
      <Button variant="outline" onClick={()=>setZoomed(z=>!z)}>{zoomed?'Show whole route':'Zoom to tightest bend'}</Button>
      <Button variant="outline" onClick={()=>{setCam({th:-0.55,el:0.95});setZoomed(false);}}>Fit</Button>
      <SegmentedControl label="Colour" value={colorMode} onChange={setColorMode} options={[{id:'radius',label:'Colour by radius'},{id:'run',label:'By run'}]}/>
    </div>
    <Legend items={legend} style={{position:'absolute',left:18,bottom:12}}/>
    <div style={{position:'absolute',right:16,bottom:12,fontSize:12,color:'var(--muted)',pointerEvents:'none'}}>Drag to rotate, shift-drag to pan, scroll to zoom</div>
    {tags.map((t,i)=><Tag key={i} variant={t.variant} style={{position:'absolute',left:t.x,top:t.y,pointerEvents:'none',transform:t.variant==='text'?'translate(6px,-120%)':'translate(8px,-50%)'}}>{t.text}</Tag>)}
  </div>;
}
window.View=View;
