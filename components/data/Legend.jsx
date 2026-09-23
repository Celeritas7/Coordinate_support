import React from 'react';
/** Legend row: 16×5 rounded colour bars with 12px muted labels. */
export function Legend({items,style}){
  return <div style={{display:'flex',gap:13,fontSize:12,color:'var(--muted)',flexWrap:'wrap',pointerEvents:'none',...style}}>
    {items.map((it,i)=><span key={i}><i style={{display:'inline-block',width:16,height:5,borderRadius:3,verticalAlign:'middle',marginRight:5,background:it.color}}></i>{it.label}</span>)}
  </div>;
}
/** Floating label in the 3D view. box = bordered panel chip (measurements); text = bare muted text (point names). */
export function Tag({children,variant='box',style}){
  const s=variant==='text'?{border:0,background:'none',padding:0,color:'var(--muted)'}:{background:'var(--panel)',border:'1px solid var(--rule)',padding:'2px 5px',borderRadius:3};
  return <span style={{display:'inline-block',font:'500 12px var(--sans)',whiteSpace:'nowrap',...s,...style}}>{children}</span>;
}
/** Comparison table: muted metric column, run columns headed in each run's colour, tabular numerals, 1px rule dividers. */
export function CompareTable({runs,rows,style}){
  return <table style={{borderCollapse:'collapse',width:'100%',fontSize:13,...style}}>
    <thead><tr><th style={th}></th>{runs.map((r,i)=><th key={i} style={{...th,color:r.color}}>{r.name}</th>)}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={i}><td style={{...td,color:'var(--muted)'}}>{row.label}</td>{row.values.map((v,j)=><td key={j} style={td}>{v}</td>)}</tr>)}</tbody>
  </table>;
}
const td={borderBottom:'1px solid var(--rule)',padding:'7px 12px',textAlign:'left',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'};
const th={...td,fontWeight:600,color:'var(--muted)'};
