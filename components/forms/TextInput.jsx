import React from 'react';
const field={color:'var(--ink)',background:'var(--field)',border:'1px solid var(--rule)',borderRadius:4,width:'100%',padding:'7px 8px'};
/** Text input. Mono 13px by default (coordinates, directions, indices); font="sans" for the 14px numeric inputs inside a FieldGrid. */
export function TextInput({font='mono',style,...rest}){
  const f=font==='sans'?{fontFamily:'var(--sans)',fontSize:14,lineHeight:1.5}:{font:'13px/1.5 var(--mono)'};
  return <input style={{...field,...f,...style}} {...rest}/>;
}
/** Multi-line point paste area — mono, no wrap, vertical resize. */
export function Textarea({rows=7,style,...rest}){
  return <textarea rows={rows} spellCheck={false} wrap="off" style={{...field,font:'13px/1.5 var(--mono)',resize:'vertical',...style}} {...rest}/>;
}
/** Native select styled like the inputs, sans 14px. */
export function Select({options,style,...rest}){
  return <select style={{...field,fontFamily:'var(--sans)',fontSize:14,lineHeight:1.5,...style}} {...rest}>{options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}</select>;
}
