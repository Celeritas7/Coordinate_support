// next.js — "Next:" buttons under a status line. Loaded before the panels; each panel calls nextSteps(statusId, items)
// right after it writes its status text (the next write of that text removes the buttons, so they always match the
// result they follow). items: [{label, go, title?}], up to three. Wording is provisional until the design pass.
window.nextSteps=function(id,items){
  const el=document.getElementById(id);if(!el)return;
  const old=el.nextElementSibling;if(old&&old.classList.contains('next'))old.remove();
  const live=(items||[]).filter(x=>x&&x.label&&typeof x.go==='function').slice(0,3);if(!live.length)return;
  const row=document.createElement('div');row.className='next';
  row.innerHTML='<span class="unit">Next:</span>'+live.map((x,i)=>`<button type="button" data-i="${i}"${x.title?` title="${x.title.replace(/"/g,'&quot;')}"`:''}>${x.label}</button>`).join('');
  row.querySelectorAll('button').forEach(b=>b.onclick=()=>live[+b.dataset.i].go());
  el.after(row);
};
// a status line is being rewritten by its own panel: drop the buttons that belonged to the old text
window.nextClear=id=>{const el=document.getElementById(id),old=el&&el.nextElementSibling;if(old&&old.classList.contains('next'))old.remove();};
