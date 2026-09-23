const {Button,Tabs,Label,TextInput,Textarea,Select,Checkbox,FieldGrid,Hint,Disclosure,Presets,RunList,RunItem}=window.RouteStudioDesignSystem_a31f22;
const {PRESETS,fmt}=window.RS;
function Sidebar({tab,setTab,form,setForm,runs,selId,onRunBend,onRunClear,onToggle,onSelect,onRemove,status,busy}){
  const f=(k)=>e=>setForm(s=>({...s,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
  return <aside style={{background:'var(--panel)',borderRight:'1px solid var(--rule)',overflowY:'auto',padding:'18px 18px 28px',minHeight:0}}>
    <h1 style={{fontSize:20,fontWeight:600,margin:'0 0 3px',letterSpacing:'-.01em'}}>Route Studio</h1>
    <p style={{color:'var(--muted)',fontSize:13.5,margin:'0 0 16px'}}>Check hose routes before you build them in Creo: bend radius on a single route, clearance between two. Run several settings and compare them side by side.</p>
    <Tabs value={tab} onChange={setTab} tabs={[{id:'bend',label:'Bend radius'},{id:'clear',label:'Clearance'}]}/>
    {tab==='bend'?<section>
      <Label htmlFor="pts" unit="(X Y Z per line)">Target points</Label><Textarea id="pts" rows={7} value={form.pts} onChange={f('pts')}/>
      <Presets><Button variant="link" onClick={()=>setForm(s=>({...s,pts:PRESETS.target}))}>example route</Button></Presets>
      <FieldGrid columns={3}>
        <div><Label htmlFor="r" unit="mm">Min radius</Label><TextInput id="r" font="sans" type="number" min={1} step={1} inputMode="decimal" value={form.R} onChange={f('R')}/></div>
        <div><Label htmlFor="sf">Safety factor</Label><TextInput id="sf" font="sans" type="number" min={1} step={0.1} inputMode="decimal" value={form.SF} onChange={f('SF')}/></div>
        <div><Label htmlFor="sp" unit="mm">Spacing</Label><TextInput id="sp" font="sans" type="number" min={10} step={5} inputMode="decimal" value={form.SP} onChange={f('SP')}/></div>
      </FieldGrid>
      <Disclosure summary="Fix end directions"><FieldGrid columns={2}>
        <div><Label htmlFor="sd">Start direction</Label><TextInput id="sd" placeholder="0,-1,0" value={form.sd} onChange={f('sd')}/></div>
        <div><Label htmlFor="ed">End direction</Label><TextInput id="ed" placeholder="1,1,0" value={form.ed} onChange={f('ed')}/></div>
      </FieldGrid><Hint>Direction of travel along the hose, as X,Y,Z.</Hint></Disclosure>
      <Button variant="primary" disabled={busy} busy={busy} onClick={onRunBend}>Check, then add to comparison</Button>
      <Hint>Adds two runs: the spline through your points as entered, and a generated route that holds the radius.</Hint>
      <Hint tone="status">{status}</Hint>
    </section>:<section>
      <Label htmlFor="mpts" unit="(stays put)">Master route</Label><Textarea id="mpts" rows={5} value={form.mpts} onChange={f('mpts')}/>
      <Label htmlFor="spts" unit="(gets moved)" style={{marginTop:10}}>Slave route</Label><Textarea id="spts" rows={5} value={form.spts} onChange={f('spts')}/>
      <Presets><Button variant="link" onClick={()=>setForm(s=>({...s,mpts:PRESETS.master,spts:PRESETS.slave}))}>example pair</Button></Presets>
      <FieldGrid columns={3}>
        <div><Label htmlFor="gap" unit="mm">Gap</Label><TextInput id="gap" font="sans" type="number" min={0} step={1} value={form.gap} onChange={f('gap')}/></div>
        <div><Label htmlFor="mode">Mode</Label><Select id="mode" options={['min','const']} value={form.mode} onChange={f('mode')}/></div>
        <div><Label htmlFor="plane">Push in</Label><Select id="plane" options={['free','xy','xz','yz']} value={form.plane} onChange={f('plane')}/></div>
      </FieldGrid>
      <FieldGrid columns={3}>
        <div><Label htmlFor="smooth">Smooth</Label><TextInput id="smooth" font="sans" type="number" min={0} max={20} value={form.smooth} onChange={f('smooth')}/></div>
        <div><Label htmlFor="blend">Blend</Label><TextInput id="blend" font="sans" type="number" min={0} max={20} value={form.blend} onChange={f('blend')}/></div>
        <div><Label htmlFor="cr" unit="mm">Min radius</Label><TextInput id="cr" font="sans" type="number" min={1} value={form.cr} onChange={f('cr')}/></div>
      </FieldGrid>
      <FieldGrid columns={2}>
        <div><Label htmlFor="lock">Locked points</Label><TextInput id="lock" placeholder="0,1,16" value={form.lock} onChange={f('lock')}/></div>
        <div><Label style={{marginBottom:8}}>Point order</Label><Checkbox id="reorder" checked={form.reorder} onChange={f('reorder')} label="re-insert stray points"/></div>
      </FieldGrid>
      <Button variant="primary" onClick={onRunClear}>Adjust, then add to comparison</Button>
      <Hint tone="status">{status}</Hint>
    </section>}
    <RunList hint="Tick to show in the 3D view. Click a run to select it and load its settings.">
      {runs.map(r=><RunItem key={r.id} selected={r.id===selId} run={{name:r.name,color:r.color,visible:r.visible,sub:<>R {fmt(r.minR)} mm &middot; {r.Q.length} pts{r.clear?<> &middot; gap {fmt(Math.min(...r.clear.after))}</>:null}</>}}
        onToggle={v=>onToggle(r.id,v)} onSelect={()=>onSelect(r.id)} onRemove={()=>onRemove(r.id)}/>)}
    </RunList>
  </aside>;
}
window.Sidebar=Sidebar;
