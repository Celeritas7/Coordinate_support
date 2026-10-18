// node tests/offset.test.js — pipe offset on the follower sample (piping3, two pipes and two twin clips)
const fs=require('fs'),path=require('path');
globalThis.ArcRoute=require('../js/arcroute.js');
const S=require('../js/step-asm.js'),PO=require('../js/offset.js');
const file=path.join(__dirname,'../samples/follower.stp');
if(!fs.existsSync(file)){console.log('skip: samples/follower.stp not found');process.exit(0);}
const r=S.parse(fs.readFileSync(file,'utf8'));let fail=0;
const check=(ok,msg)=>{console.log((ok?'ok   ':'FAIL ')+msg);if(!ok)fail++;};
const[A,B]=r.pipes;check(r.pipes.length===2,'two pipes');
const clips=fol=>r.holes.filter(x=>x.name==='22402156'&&S.nearest(fol.chain,x.c).d<=0.5).map(x=>({c:x.c,a:x.d,length:x.length,name:x.name}));
check(clips(A).length===2&&clips(B).length===2,'each pipe runs through both twin clips');
// 111 follows 211 at 30 mm: every spot reaches the gap
const res=PO.solve(A.Q,{R:A.R,gap:30,odFixed:B.OD,odFollow:A.OD,minStraight:30,near:p=>S.nearest(B.chain,p),clips:clips(A)});
check(res.before.minGap<3,`before: closest ${res.before.minGap.toFixed(1)} mm`);
check(res.ok&&res.after.minGap>=29.9,`111 follows 211: closest ${res.after.minGap.toFixed(1)} mm, ${res.under.length} spots under`);
check(res.W[0].every((v,i)=>Math.abs(v-A.Q[0][i])<1e-3)&&res.W[res.W.length-1].every((v,i)=>Math.abs(v-A.Q[A.Q.length-1][i])<1e-3),'ends kept (to the 0.001 mm written in the .pts)');
check(res.endDirErr<0.01,`end directions kept (${res.endDirErr.toFixed(4)}°)`);
check(res.clips.every(c=>c.on&&c.maxOff<0.3),'still straight through both clips');
check(res.minStraight>=30-1e-3,`shortest straight ${res.minStraight.toFixed(1)} mm`);
// 211 follows 111: the spots right next to the clips cannot reach 30 mm without a new bend; they are reported, not hidden
const res2=PO.solve(B.Q,{R:B.R,gap:30,odFixed:A.OD,odFollow:B.OD,minStraight:30,near:p=>S.nearest(A.chain,p),clips:clips(B)});
check(res2.after.minGap>res2.before.minGap+5,`211 follows 111: ${res2.before.minGap.toFixed(1)} → ${res2.after.minGap.toFixed(1)} mm`);
check(res2.ok||res2.under.length>0&&res2.stopWhy,'what is still under the gap is listed with a reason');
process.exit(fail?1:0);
