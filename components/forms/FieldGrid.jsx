import React from 'react';
/** Grid of fields: 9px gap, 12px vertical margin, 2 or 3 equal columns. */
export function FieldGrid({columns=3,children,style}){
  return <div style={{display:'grid',gap:9,margin:'12px 0',gridTemplateColumns:`repeat(${columns},1fr)`,...style}}>{children}</div>;
}
/** Muted helper text. tone hint = 12px under a control; status = 12.5px result line with reserved height. */
export function Hint({tone='hint',children,style}){
  const s=tone==='status'?{fontSize:12.5,marginTop:9,minHeight:'1.3em'}:{fontSize:12,margin:'5px 0 0'};
  return <p style={{color:'var(--muted)',...s,...style}}>{children}</p>;
}
/** Collapsed advanced settings, native details/summary. */
export function Disclosure({summary,children,open,style}){
  return <details open={open} style={{margin:'10px 0',...style}}><summary style={{cursor:'pointer',color:'var(--muted)',fontSize:13}}>{summary}</summary>{children}</details>;
}
/** Inline preset loader row: "Load: example route". */
export function Presets({children,style}){
  return <div style={{display:'flex',gap:12,margin:'6px 0 2px',fontSize:12.5,flexWrap:'wrap',alignItems:'baseline',...style}}><span style={{fontWeight:400,color:'var(--muted)'}}>Load:</span>{children}</div>;
}
