import React from 'react';
const toneColor={ok:'var(--ok)',warn:'var(--warn)',bad:'var(--bad)'};
/** Headline result over the 3D view: big tabular number, muted unit + run name, coloured verdict, muted facts. */
export function Readout({value,unit='mm tightest bend',name,verdict,tone='ok',facts,style}){
  return <div style={{maxWidth:'60%',pointerEvents:'none',...style}}>
    <div style={{fontSize:30,fontWeight:600,letterSpacing:'-.02em',lineHeight:1.1,fontVariantNumeric:'tabular-nums'}}>{value} <small style={{fontSize:14,fontWeight:500,color:'var(--muted)',letterSpacing:0}}>{unit}{name?<> &middot; {name}</>:null}</small></div>
    {verdict?<div style={{fontSize:13.5,marginTop:2,color:toneColor[tone]}}>{verdict}</div>:null}
    {facts?<div style={{fontSize:12.5,color:'var(--muted)',marginTop:5,fontVariantNumeric:'tabular-nums'}}>{facts}</div>:null}
  </div>;
}
