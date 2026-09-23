import React from 'react';
const V={sidebar:{wrap:{display:'flex',borderBottom:'1px solid var(--rule)',marginBottom:14},btn:{flex:1,font:'500 14px var(--sans)',padding:'9px 4px'}},
  dock:{wrap:{display:'flex',gap:2,padding:'6px 10px 0',borderBottom:'1px solid var(--rule)',alignItems:'center'},btn:{font:'500 13px var(--sans)',padding:'7px 11px'}}};
/** Underline tabs. variant sidebar = equal-width form tabs; dock = compact tabs with an optional right slot. */
export function Tabs({tabs,value,onChange,variant='sidebar',right,style}){
  const v=V[variant]||V.sidebar;
  return <div role="tablist" style={{...v.wrap,...style}}>
    {tabs.map(t=>{const on=t.id===value;return <button key={t.id} role="tab" type="button" aria-selected={on} onClick={()=>onChange&&onChange(t.id)}
      style={{border:0,background:'none',cursor:'pointer',color:on?'var(--ink)':'var(--muted)',borderBottom:`2px solid ${on?'var(--ink)':'transparent'}`,...v.btn}}>{t.label}</button>;})}
    {right?<div style={{marginLeft:'auto',display:'flex',gap:8,paddingBottom:5}}>{right}</div>:null}
  </div>;
}
