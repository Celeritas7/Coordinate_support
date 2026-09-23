import React from 'react';
/** Field label — 12.5px medium, with an optional muted unit/qualifier in parentheses. */
export function Label({children,unit,htmlFor,style}){
  return <label htmlFor={htmlFor} style={{display:'block',fontSize:12.5,fontWeight:500,margin:'0 0 4px',whiteSpace:'nowrap',...style}}>{children}{unit?<> <span style={{fontWeight:400,color:'var(--muted)'}}>{unit}</span></>:null}</label>;
}
