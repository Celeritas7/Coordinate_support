// node tests/step-bytes.test.js — the assembly reader from the file's bytes in pieces (parse({chunks})) gives the same result
// as from the text, wherever the pieces split it. That path opens files past the 537 M-character string limit.
const S = require("../js/step-asm.js"), H = require("./make-hose-sample.js");
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fail++; };
const pieces = (text, size) => { const b = Buffer.from(text, "utf8"), out = []; for (let i = 0; i < b.length; i += size) out.push(new Uint8Array(b.buffer, b.byteOffset + i, Math.min(size, b.length - i))); return out; };
const fp = r => JSON.stringify({ s: r.summary, p: r.product, u: r.units, n: r.entities, csys: r.csys, pipes: r.pipes.map(p => ({ n: p.name, OD: p.OD, Q: p.Q, R: p.R })), inst: r.instances.map(i => ({ n: i.name, M: i.M, b: i.bbox })) },
  (k, x) => typeof x === "number" ? +x.toFixed(9) : x);

// the generated hose (spline skin, datum curve, three CSYS), plus entities a byte scanner can trip on:
// a ; and a # inside a quoted name, and a line break between #id and =
let t = H.make().stp;
const extra = "#900001=CARTESIAN_POINT('odd;name #12=X',(1.,2.,3.));\n#900002\n =DIRECTION('',(0.,0.,1.));\n";
t = t.replace(/ENDSEC;\s*END-ISO-10303-21;\s*$/, extra + "ENDSEC;\nEND-ISO-10303-21;\n");
const a = S.parse(t), A = fp(a);
check(a.pipes.length === 1 && a.csys.length >= 3, `text: ${a.pipes.length} hose, ${a.csys.length} CSYS, ${a.entities} entities`);
for (const size of [1 << 20, 4096, 997, 61, 7]) {
  const b = S.parse({ chunks: pieces(t, size) });
  check(fp(b) === A, `pieces of ${size} B (${Math.ceil(Buffer.byteLength(t) / size)}): same result as the text`); }
const E = S.tokenizeBytes(pieces(t, 13));
check(E.get(900001) === "CARTESIAN_POINT('odd;name #12=X',(1.,2.,3.))" && E.get(12) !== "X", "a ; and a # inside a quoted name do not end or start an entity");
check(E.get(900002) === "DIRECTION('',(0.,0.,1.))", "a line break between #id and = is read");
check([...E].length === E.size && E.size === a.entities, `iteration and size agree (${E.size} entities, as from the text)`);
check(/FILE_NAME/.test(E.head) && !/DATA;/.test(E.head), "head: the text before DATA;");

// both tokenizers as [id, text] lists in iteration order, and their sizes
const same = (u, sizes) => { const T = S.tokenize(u), W = JSON.stringify([...T]);
  return sizes.every(s => { const B = S.tokenizeBytes(pieces(u, s)); return JSON.stringify([...B]) === W && B.size === T.size; }); };
const wrap = d => "ISO-10303-21;\nHEADER;\nFILE_NAME('t.stp','',(''),(''),'','','');\nENDSEC;\nDATA;\n" + d + "ENDSEC;\nEND-ISO-10303-21;\n";

// $ (an omitted reference, legal in AP203/214): parse() asks get(null), which the text path answers undefined
{ const u = t.replace(/AXIS2_PLACEMENT_3D\('HOSE_START',(#\d+),#\d+,#\d+\)/, "AXIS2_PLACEMENT_3D('HOSE_START',$1,$,$)"), a1 = S.parse(u), U = fp(a1);
  check(u !== t && a1.csys.length === a.csys.length, "$ references: the sample with HOSE_START's axes omitted still reads");
  check([1 << 20, 61, 7].every(s => fp(S.parse({ chunks: pieces(u, s) })) === U), "$ references: the same from pieces as from the text");
  const B = S.tokenizeBytes(pieces(u, 61));
  check([null, undefined, -1, 1.5, "70", NaN, Infinity, 1e300].every(k => B.get(k) === undefined), "get() of null, undefined, -1, 1.5, '70', NaN: undefined, no throw"); }

// more than 32767 pieces (the piece index was 16-bit, and wrapped): ~100 KB of padding after DATA; in 2-byte pieces, then the
// sample in 4 KB pieces, so its entities sit whole in pieces numbered past 50000 (all-tiny pieces would leave none whole)
{ let pad = ""; for (let i = 0; i < 2500; i++) pad += `#${200000 + i}=CARTESIAN_POINT('pad',(${i}.,0.,0.));\n`;
  const u = t.replace("DATA;\n", "DATA;\n" + pad), b = Buffer.from(u, "utf8"), cut = b.indexOf("#200000=") + Buffer.byteLength(pad);
  const ch = []; for (let i = 0, e; i < b.length; i = e) { e = i < cut ? Math.min(cut, i + 2) : i + 4096; ch.push(b.subarray(i, e)); }
  check(ch.length > 50000 && fp(S.parse({ chunks: ch })) === fp(S.parse(u)), `${ch.length} pieces (2 B, then 4 KB): same result as the text`); }

// far-apart ids: #300000000 and #4294967296 (past 2^32) are kept aside, not in arrays sized by the largest id
{ const u = t.replace(/#70\b/g, "#300000000").replace(/#74\b/g, "#4294967296"), t0 = Date.now(), a1 = S.parse(u), U = fp(a1);
  const ok = [1 << 20, 61, 7].every(s => fp(S.parse({ chunks: pieces(u, s) })) === U), ms = Date.now() - t0;
  check(u !== t && a1.csys.length === a.csys.length && ok && ms < 2000, `ids 300000000 and 4294967296 in the sample: same result from pieces as from the text (${ms} ms)`);
  const d = wrap("#1=A('x');\n#2=B(#1);\n#300000000=C(#2);\n#4294967296=D(#300000000);\n#3=E(#4294967296);\n");
  const B = S.tokenizeBytes(pieces(d, 5));
  check(same(d, [1, 2, 5, 64]) && B.size === 5 && B.get(4294967296) === "D(#300000000)" && B.get(300000000) === "C(#2)", "ids 1, 2, 300000000, 4294967296, 3: the same entities, in file order, both ways"); }

// a repeated #id: the last text wins, at the place of the first, counted once (as Map.set in tokenize())
{ const d = wrap("#1=A;\n#1=B;\n");
  const B = S.tokenizeBytes(pieces(d, 3));
  check(B.get(1) === "B" && B.size === 1 && JSON.stringify([...B]) === '[[1,"B"]]' && same(d, [1, 2, 3, 64]), "#1=A;#1=B; reads B, once, as from the text");
  const d2 = wrap("#1=A('first');\n#2=C;\n#300000000=F;\n#1=B('second one, longer');\n#300000000=G;\n#2=D;\n");
  check(same(d2, [1, 2, 3, 4, 5, 7, 64]), "repeats among others, far ids too, wherever the pieces split them: as from the text"); }
if (fail) { console.log(`${fail} failed`); process.exit(1); }
