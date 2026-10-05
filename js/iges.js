/* iges.js — Route Studio IGES reader
 * Parses Creo-exported IGES (5.3) and returns points, curves, axes and diagnostics.
 * No dependencies. Works in the browser and in node.
 *
 *   const r = IGES.parse(text);
 *   r.points   [{name, x, y, z, level, de}]
 *   r.curves   [{type, name, level, pts:[[x,y,z],...]}]
 *   r.groups   {prefix: [point,...]}      // points split by name prefix
 *   r.summary  {entities, counts, levels, units, maxCoord, product, date}
 */
(function (root) {
"use strict";

const TYPE_NAMES = {
  100:"circular arc",102:"composite curve",104:"conic arc",106:"copious data",108:"plane",
  110:"line",112:"param spline curve",114:"param spline surface",116:"point",118:"ruled surface",
  120:"surface of revolution",122:"tabulated cylinder",123:"direction",124:"transformation matrix",
  126:"b-spline curve",128:"b-spline surface",141:"boundary",142:"curve on surface",
  143:"bounded surface",144:"trimmed surface",186:"solid",190:"plane surface",
  192:"cylindrical surface",194:"conical surface",196:"spherical surface",198:"toroidal surface",
  308:"subfigure definition",314:"colour definition",402:"group",406:"property",
  408:"subfigure instance",502:"vertex",504:"edge",508:"loop",510:"face",514:"shell"
};

function num(s) {
  if (s == null) return NaN;
  return parseFloat(String(s).trim().replace(/[DdEe]/, "e"));
}

function parse(text) {
  const lines = String(text).split(/\r?\n/);
  const S = [], G = [], D = [], P = [];
  for (const line of lines) {
    if (line.length < 73) continue;
    switch (line[72]) {
      case "S": S.push(line.slice(0, 72)); break;
      case "G": G.push(line.slice(0, 72)); break;
      case "D": D.push(line); break;
      case "P": P.push(line); break;
    }
  }
  if (!D.length) throw new Error("No directory section found — is this an IGES file?");

  // ---- global section: delimiters first, then the rest
  const gtext = G.join("");
  let pd = ",", rd = ";";
  const dm = gtext.match(/^(\d+)H(.)/);
  if (dm) {
    pd = dm[2];
    const rest = gtext.slice(dm[0].length + 1);
    const rm = rest.match(/^(\d+)H(.)/);
    if (rm) rd = rm[2];
  }
  const gfields = splitHollerith(gtext, pd, rd);
  const summary = {
    product: gfields[2] || "", nativeSystem: gfields[4] || "",
    scale: num(gfields[12]), unitsFlag: parseInt(gfields[13], 10),
    units: gfields[14] || "", maxCoord: num(gfields[19]),
    author: gfields[20] || "", date: gfields[17] || "", version: gfields[22] || ""
  };

  // ---- parameter data, keyed by the directory-entry number it points back to
  const pdata = new Map();
  for (const line of P) {
    const de = parseInt(line.slice(64, 72), 10);
    if (!de) continue;
    pdata.set(de, (pdata.get(de) || "") + line.slice(0, 64));
  }

  // ---- directory entries (two lines each)
  const dir = new Map();
  const counts = {}, levels = {};
  for (let i = 0; i + 1 < D.length; i += 2) {
    const a = D[i], b = D[i + 1];
    const type = parseInt(a.slice(0, 8), 10);
    if (!Number.isFinite(type)) continue;
    const de = i + 1;                      // odd DE numbering
    const e = {
      de, type,
      level: a.slice(32, 40).trim(),
      xform: parseInt(a.slice(48, 56), 10) || 0,
      form: parseInt(b.slice(32, 40), 10) || 0,
      label: b.slice(56, 64).trim(),
      params: null
    };
    dir.set(de, e);
    counts[type] = (counts[type] || 0) + 1;
    levels[e.level] = (levels[e.level] || 0) + 1;
  }
  for (const e of dir.values()) {
    const raw = pdata.get(e.de);
    if (raw != null) e.params = splitHollerith(raw, pd, rd);
  }

  // ---- name properties (406 form 15) and transformation matrices (124)
  const names = new Map();
  for (const e of dir.values()) {
    if (e.type === 406 && e.params) {
      const v = e.params.find(s => /[A-Za-z_]/.test(s) && !/^\d+$/.test(s));
      if (v) names.set(e.de, v);
    }
  }
  const xforms = new Map();
  for (const e of dir.values()) {
    if (e.type !== 124 || !e.params) continue;
    const m = e.params.slice(1, 13).map(num);
    if (m.some(v => !Number.isFinite(v))) continue;
    xforms.set(e.de, { m, parent: e.xform });
  }
  function applyX(p, ptr, depth) {
    if (!ptr || depth > 8) return p;
    const t = xforms.get(ptr);
    if (!t) return p;
    const m = t.m, [x, y, z] = p;
    const q = [
      m[0]*x + m[1]*y + m[2]*z  + m[3],
      m[4]*x + m[5]*y + m[6]*z  + m[7],
      m[8]*x + m[9]*y + m[10]*z + m[11]
    ];
    return applyX(q, t.parent, depth + 1);
  }
  function nameOf(e) {
    if (!e.params) return "";
    for (const tok of e.params) {
      const n = parseInt(tok, 10);
      if (Number.isFinite(n) && names.has(n)) return names.get(n);
    }
    return "";
  }

  // ---- points
  const points = [];
  for (const e of dir.values()) {
    if (e.type !== 116 || !e.params) continue;
    const raw = [num(e.params[1]), num(e.params[2]), num(e.params[3])];
    if (raw.some(v => !Number.isFinite(v))) continue;
    const [x, y, z] = applyX(raw, e.xform, 0);
    points.push({ name: nameOf(e), x, y, z, level: e.level, de: e.de });
  }

  // ---- curves worth keeping: lines, arcs, b-splines
  const curves = [];
  for (const e of dir.values()) {
    if (!e.params) continue;
    let pts = null;
    if (e.type === 110) {
      const v = e.params.slice(1, 7).map(num);
      if (v.every(Number.isFinite)) pts = [[v[0], v[1], v[2]], [v[3], v[4], v[5]]];
    } else if (e.type === 126) {
      const K = parseInt(e.params[1], 10), M = parseInt(e.params[2], 10);
      if (Number.isFinite(K) && Number.isFinite(M)) {
        const nKnots = K + M + 2, nW = K + 1;
        const start = 7 + nKnots + nW;          // control points begin here
        pts = [];
        for (let i = 0; i < nW; i++) {
          const x = num(e.params[start + 3*i]),
                y = num(e.params[start + 3*i + 1]),
                z = num(e.params[start + 3*i + 2]);
          if ([x, y, z].every(Number.isFinite)) pts.push([x, y, z]);
        }
        if (!pts.length) pts = null;
      }
    }
    if (!pts) continue;
    curves.push({
      type: e.type, typeName: TYPE_NAMES[e.type] || String(e.type),
      name: nameOf(e) || e.label, level: e.level, de: e.de,
      pts: pts.map(p => applyX(p, e.xform, 0))
    });
  }

  // ---- split points by name prefix, e.g. C1_01 -> "C1"
  const groups = {};
  for (const p of points) {
    const m = /^(.*?)[_-]?(\d+)$/.exec(p.name || "");
    const key = m && m[1] ? m[1] : (p.name ? p.name : "unnamed");
    (groups[key] = groups[key] || []).push(p);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => {
      const na = parseInt((/(\d+)$/.exec(a.name) || [])[1], 10);
      const nb = parseInt((/(\d+)$/.exec(b.name) || [])[1], 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  summary.entities = dir.size;
  summary.counts = Object.entries(counts)
    .map(([t, n]) => ({ type: +t, name: TYPE_NAMES[+t] || "?", count: n }))
    .sort((a, b) => b.count - a.count);
  summary.levels = Object.entries(levels)
    .map(([l, n]) => ({ level: l, count: n })).sort((a, b) => b.count - a.count);

  return { points, curves, groups, summary, names, dir };
}

/* split an IGES record on its parameter delimiter, honouring nHstring literals */
function splitHollerith(s, pd, rd) {
  const out = [];
  let i = 0, cur = "";
  while (i < s.length) {
    const ch = s[i];
    if (ch === rd) break;
    if (ch === pd) { out.push(cur.trim()); cur = ""; i++; continue; }
    const m = /^(\d+)H/.exec(s.slice(i));
    if (m) {
      const len = parseInt(m[1], 10);
      const start = i + m[0].length;
      cur += s.slice(start, start + len);
      i = start + len;
      continue;
    }
    cur += ch; i++;
  }
  out.push(cur.trim());
  return out;
}

/* Creo datum point array (.pts) text for a list of points */
function toPts(points, header) {
  const f = v => v.toFixed(3).padStart(15);
  const head = [
    "!", "!       DATUM POINT ARRAY DATA FILE", "!",
    "! " + (header || "exported from Route Studio"),
    "!", "! Enter values with respect to datum arrays' coordinate system:", "!",
    "!CARTESIAN coordinates:", "!        X                Y                Z", "!"
  ];
  return head.concat(points.map(p => f(p.x) + f(p.y) + f(p.z))).join("\n") + "\n";
}

const API = { parse, toPts, TYPE_NAMES };
if (typeof module !== "undefined" && module.exports) module.exports = API;
root.IGES = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
