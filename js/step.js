/* step.js — minimal STEP (AP203/AP214) reader for named datums.
 * Pulls out named coordinate systems and named points; ignores the B-rep.
 */
(function (root) {
"use strict";

function parse(text) {
  const s = String(text);
  const head = s.slice(0, s.indexOf("DATA;") + 1 || 4000);
  const ents = new Map();                       // id -> {kind, name, args}
  const re = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/g;
  let m;
  while ((m = re.exec(s))) ents.set(+m[1], { kind: m[2], raw: m[3] });

  const args = raw => {
    const out = []; let depth = 0, cur = "", q = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (q) { cur += c; if (c === "'") q = false; continue; }
      if (c === "'") { q = true; cur += c; continue; }
      if (c === "(") depth++;
      if (c === ")") depth--;
      if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const str = a => (a && a[0] === "'" ? a.slice(1, -1) : "");
  const ref = a => { const r = /^#(\d+)$/.exec(String(a).trim()); return r ? +r[1] : null; };
  const triple = a => {
    const t = /\(([^)]*)\)/.exec(a);
    if (!t) return null;
    const v = t[1].split(",").map(x => parseFloat(x));
    return v.length >= 3 && v.every(Number.isFinite) ? v.slice(0, 3) : null;
  };
  const pointAt = id => {
    const e = ents.get(id);
    if (!e || e.kind !== "CARTESIAN_POINT") return null;
    return triple(args(e.raw).slice(1).join(","));
  };
  const dirAt = id => {
    const e = ents.get(id);
    if (!e || e.kind !== "DIRECTION") return null;
    return triple(args(e.raw).slice(1).join(","));
  };

  // unit scale: millimetre assumed unless the header says inch
  let unitScale = 1, units = "MM";
  for (const e of ents.values()) {
    if (/CONVERSION_BASED_UNIT|SI_UNIT/.test(e.kind) && /INCH/i.test(e.raw)) { unitScale = 25.4; units = "INCH"; }
  }

  const csys = [], points = [];
  for (const [id, e] of ents) {
    if (e.kind === "AXIS2_PLACEMENT_3D") {
      const a = args(e.raw);
      const name = str(a[0]);
      if (!name) continue;                       // unnamed ones are geometry placements
      const o = pointAt(ref(a[1]));
      if (!o) continue;
      csys.push({
        name, x: o[0] * unitScale, y: o[1] * unitScale, z: o[2] * unitScale,
        zAxis: dirAt(ref(a[2])), xAxis: dirAt(ref(a[3])), id
      });
    } else if (e.kind === "CARTESIAN_POINT") {
      const a = args(e.raw);
      const name = str(a[0]);
      if (!name) continue;
      const o = triple(a.slice(1).join(","));
      if (!o) continue;
      points.push({ name, x: o[0] * unitScale, y: o[1] * unitScale, z: o[2] * unitScale, id });
    }
  }

  const counts = {};
  for (const e of ents.values()) counts[e.kind] = (counts[e.kind] || 0) + 1;

  return {
    csys, points,
    summary: {
      entities: ents.size, units,
      counts: Object.entries(counts).map(([k, n]) => ({ name: k, count: n }))
                 .sort((a, b) => b.count - a.count),
      schema: (/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/.exec(head) || [])[1] || "",
      product: (/FILE_NAME\s*\(\s*'([^']*)'/.exec(head) || [])[1] || ""
    }
  };
}

const API = { parse };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.STEPReader = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
