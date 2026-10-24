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
if (fail) { console.log(`${fail} failed`); process.exit(1); }
