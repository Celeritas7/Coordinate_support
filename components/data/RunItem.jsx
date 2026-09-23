import React from 'react';
/** One comparison run in the sidebar list: show-checkbox, colour swatch, name + metric sub-line, remove ×. */
export function RunItem({run,selected,onToggle,onSelect,onRemove,style}){
  return <div data-sel={selected?1:0} onClick={onSelect} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 6px',borderRadius:4,cursor:'pointer',background:selected?'var(--field)':'transparent',boxShadow:selected?'inset 0 0 0 1px var(--rule)':'none',...style}}>
    <input type="checkbox" checked={run.visible!==false} aria-label={`show ${run.name}`} onClick={e=>e.stopPropagation()} onChange={e=>onToggle&&onToggle(e.target.checked)} style={{width:'auto',margin:0}}/>
    <span style={{width:11,height:11,borderRadius:2,flex:'none',background:run.color}}></span>
    <span style={{flex:1,fontSize:13,lineHeight:1.25,minWidth:0}}>{run.name}<small style={{display:'block',color:'var(--muted)',fontSize:11.5,fontVariantNumeric:'tabular-nums'}}>{run.sub}</small></span>
    <button type="button" title="remove" aria-label={`remove ${run.name}`} onClick={e=>{e.stopPropagation();onRemove&&onRemove();}} style={{border:0,background:'none',color:'var(--muted)',cursor:'pointer',fontSize:16,lineHeight:1,padding:'2px 4px'}}>&times;</button>
  </div>;
}
/** Section header + list wrapper for runs; shows the empty message when there are none. */
export function RunList({title='Comparison runs',children,empty='No runs yet. Run a check to add one.',hint,style}){
  const has=React.Children.count(children)>0;
  return <div style={{marginTop:20,borderTop:'1px solid var(--rule)',paddingTop:14,...style}}>
    <h2 style={{fontSize:13,fontWeight:600,margin:'0 0 8px',color:'var(--muted)'}}>{title}</h2>
    {has?children:<p style={{color:'var(--muted)',fontSize:13,margin:0}}>{empty}</p>}
    {has&&hint?<p style={{color:'var(--muted)',fontSize:12,margin:'5px 0 0'}}>{hint}</p>:null}
  </div>;
}
