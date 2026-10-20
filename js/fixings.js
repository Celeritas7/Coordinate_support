/* fixings.js — one answer to "is this hole a clamp?", shared by Hose · Stations from clamps and Pipe · Through clamps.
 * Input: StepAsm.parse(...) (holes: every bore, with or without a CSYS; pipes: centrelines). Each candidate hole gets
 * a role and a one-line reason; `use` is the default tick.
 *   clamp / clip / grommet  library part (name matches a Library pattern)              ticked
 *   end      end fitting of a pipe in the file (that pipe starts or ends in it)          Hose: ticked (start / end); Pipe: its own end, off
 *   other    another pipe already runs through it                                       off (Pipe only)
 *   fixing   CSYS on the bore axis, bore ≥ minLen long, not in the Library              ticked, "not in the Library"
 *   hole     CSYS on the bore axis, bore shorter than minLen (bolt / plate hole)          off, listed under "other holes"
 * A hole with neither a CSYS nor a Library match is not a candidate. Bore size: D − under … D + fit (a hose cannot pass a
 * smaller bore; Pipe context: D ± fit, since a clamp may grip a pipe with a slightly smaller bore, e.g. Ø22 on Ø22.5).
 * A Library part counts as such only for bores inside its entry's range (its other holes are mounting holes). Coaxial copies at one spot (clamp halves, split bore faces) are one candidate.
 * No DOM. Browser: window.Fixings. Node: require('./fixings.js').
 */
(function (root) {
"use strict";
const SA = root.StepAsm || (typeof require !== "undefined" ? require("./step-asm.js") : null);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1e-12; return [a[0] / l, a[1] / l, a[2] / l]; };
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const short = n => { const s = String(n || ""), m = s.match(/_(\d+)$/); return m ? s.slice(Math.max(0, s.lastIndexOf("_", s.length - m[0].length - 1) + 1)) : s; };

// opt: {D, fit=1.5, under=0.2 (Hose) / fit (Pipe), minLen=10, pipe: index into r.pipes (Pipe context) or null (Hose), lib: x => entry|null}
function find(r, opt) {
  const o = Object.assign({ fit: 1.5, minLen: 10, pipe: null, lib: null }, opt), D = +o.D;
  if (o.under == null) o.under = o.pipe != null ? o.fit : 0.2;
  if (!r || !(D > 0)) return [];
  const src = r.holes && r.holes.length ? r.holes : (r.fixings || []);
  const pipes = r.pipes || [], near = (p, c) => SA && p.chain ? SA.nearest(p.chain, c).d : Infinity;
  const out = [];
  for (const x of src) {
    if (!(x.D >= D - o.under - 1e-9 && x.D <= D + o.fit + 1e-9)) continue;
    const hit = o.lib ? o.lib(x) : null, inRange = e => !(e.boreMax > 0) || (x.D >= e.boreMin - 0.05 && x.D <= e.boreMax + 0.05);
    const lib = hit && inRange(hit) ? hit : null, libOff = hit && !lib ? ` (${hit.pattern} is in the Library, but this bore is outside its Ø${f1(hit.boreMin)}–${f1(hit.boreMax)})` : "";
    if (!x.csys && !lib) continue;
    const d = norm(x.d), same = out.find(c => len(sub(c.c, x.c)) <= Math.max(0.5, x.r) && Math.abs(dot(c.d, d)) > 0.999);
    if (same) { if (!same.csys && x.csys) Object.assign(same, { name: x.csys, csys: x.csys }); continue; }
    // which pipes run through it, and is it where one of them starts or ends
    const thru = pipes.map((p, j) => ({ j, p, d: near(p, x.c) })).filter(t => t.d <= 0.5);
    const endOf = thru.find(t => t.p.info && Math.min(len(sub(x.c, t.p.info.start)), len(sub(x.c, t.p.info.end))) < x.length / 2 + (t.p.OD || 0));
    const mine = o.pipe != null ? pipes[o.pipe] : null, dist = mine ? near(mine, x.c) : null;
    const other = mine ? thru.find(t => t.j !== o.pipe) : null;
    let role, use, reason;
    if (endOf && (!mine || endOf.j === o.pipe)) {
      role = "end"; use = !mine;
      reason = mine ? "end fitting of this pipe" : `end fitting of ${short(endOf.p.name)}: start or end of the route`;
    } else if (other && !(endOf && endOf.j === o.pipe)) {
      role = "other"; use = false; reason = `holds ${short(other.p.name)}`;
    } else if (lib) {
      role = lib.type || "clamp"; use = true; reason = `Library ${role} ${lib.pattern}`;
    } else if (x.length >= o.minLen - 1e-9) {
      role = "fixing"; use = true; reason = hit ? "bore outside its Library range" + libOff : "not in the Library";
    } else {
      role = "hole"; use = false; reason = `${f1(x.length)} mm long: a bolt or plate hole? Tick it if the hose runs through${libOff}`;
    }
    if (mine && use) reason += dist <= 0.5 ? " · pipe passes through it" : ` · pipe misses it by ${f1(dist)} mm`;
    out.push({ id: out.length, name: x.csys || "(no CSYS)", csys: x.csys || null, part: x.name, label: x.label, inst: x.inst,
      c: x.c.slice(), d, D: x.D, r: x.r, length: x.length, role, use, reason, lib: lib || null, dist,
      passes: dist != null ? dist <= 0.5 : thru.length > 0, src: x });
  }
  // ticked first; ends ahead of the rest so they can become start / end
  const rank = c => c.use ? (c.role === "end" ? 0 : 1) : (c.role === "hole" ? 3 : 2);
  return out.sort((a, b) => rank(a) - rank(b)).map((c, i) => Object.assign(c, { id: i }));
}

const API = { find };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.Fixings = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
