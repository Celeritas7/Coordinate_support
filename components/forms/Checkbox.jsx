import React from 'react';
/** Inline checkbox with regular-weight 12.5px label, as in "re-insert stray points". */
export function Checkbox({label,style,...rest}){
  return <label style={{display:'flex',alignItems:'center',fontWeight:400,fontSize:12.5,whiteSpace:'normal',...style}}>
    <input type="checkbox" style={{width:'auto',margin:'0 6px 0 0'}} {...rest}/>{label}</label>;
}
