import React from 'react';
const base={cursor:'pointer',fontFamily:'var(--sans)',borderRadius:'var(--radius-control)'};
const variants={
  primary:{display:'block',width:'100%',padding:'11px',border:0,background:'var(--ink)',color:'var(--paper)',font:'600 15px var(--sans)',marginTop:4},
  outline:{border:'1px solid var(--rule)',background:'var(--panel)',color:'var(--ink)',font:'500 13px var(--sans)',padding:'6px 11px'},
  small:{border:'1px solid var(--rule)',background:'var(--field)',color:'var(--ink)',font:'500 13px var(--sans)',padding:'4px 10px'},
  link:{background:'none',border:0,padding:0,color:'var(--ok)',textDecoration:'underline',textUnderlineOffset:2,font:'inherit',borderRadius:0},
  icon:{border:0,background:'none',color:'var(--muted)',fontSize:16,lineHeight:1,padding:'2px 4px',borderRadius:0}
};
/** Route Studio button. primary = the full-width "go" action; outline = view tools; small = dock actions; link = inline presets; icon = the × remove. */
export function Button({variant='outline',disabled,busy,children,style,...rest}){
  const s={...base,...variants[variant],...(disabled?{opacity:.55,cursor:busy?'progress':'default'}:null),...style};
  return <button type="button" disabled={disabled} style={s} {...rest}>{children}</button>;
}
