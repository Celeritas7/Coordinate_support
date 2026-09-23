import React from 'react';
/** Two-or-more option toggle, one pressed at a time (Colour by radius / By run). */
export function SegmentedControl({options,value,onChange,label,style}){
  return <div role="group" aria-label={label} style={{display:'inline-flex',border:'1px solid var(--rule)',borderRadius:4,overflow:'hidden',background:'var(--panel)',...style}}>
    {options.map(o=>{const on=o.id===value;return <button key={o.id} type="button" aria-pressed={on} onClick={()=>onChange&&onChange(o.id)}
      style={{border:0,borderRadius:0,background:on?'var(--ink)':'transparent',color:on?'var(--paper)':'var(--muted)',font:'500 13px var(--sans)',padding:'6px 11px',cursor:'pointer'}}>{o.label}</button>;})}
  </div>;
}
