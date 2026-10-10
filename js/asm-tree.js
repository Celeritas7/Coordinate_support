/* asm-tree.js — the assembly part tree with a per-part "pipe?" override, shared by Route Studio and the Inspector.
 * Overrides are stored per file name in localStorage, so a part marked in one page is honoured in the other.
 * Browser only. window.AsmTree = {render, load, save}.
 */
(function (root) {
"use strict";
const KEY = "routeStudio.pipeOverrides.v1";
const all = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
function load(file) { return all()[file] || {}; }
function save(file, map) { try { const a = all(); if (Object.keys(map).length) a[file] = map; else delete a[file]; localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = v => (Math.round(v * 10) / 10).toString();
const SHORT = { plane: "plane", cylindrical: "cyl", toroidal: "torus", bspline: "spline", conical: "cone", spherical: "sphere" };
function faces(g) { const t = {}; g.solids.forEach(s => Object.entries(s.types).forEach(([k, n]) => t[k] = (t[k] || 0) + n));
  return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, n]) => n + " " + (SHORT[k] || k)).join(", "); }
function pipeText(p) { return p.kind === "hose"
  ? `hose \u00d8${f1(p.OD)} \u00b7 min R ${isFinite(p.R) ? f1(p.R) : "--"} \u00b7 ${Math.round(p.length)} mm`
  : `\u00d8${f1(p.OD)}${p.ID ? "/" + f1(p.ID) : ""} \u00b7 R ${isFinite(p.R) ? f1(p.R) : "--"} \u00b7 ${p.bends.length} bends \u00b7 ${Math.round(p.length)} mm`; }

// box: element; r: StepAsm.parse result; o: {overrides, onChange(partName, true|false|null), compact}
function render(box, r, o) {
  o = o || {}; const ov = o.overrides || {}, count = {}, first = {};
  r.instances.forEach((inst, i) => { count[inst.pd] = (count[inst.pd] || 0) + 1; if (first[inst.pd] == null) first[inst.pd] = i; });
  const rows = r.instances.map((inst, i) => {
    if (o.compact && first[inst.pd] !== i) return ""; // sidebar: each part once (×N shows the count)
    const g = inst.part, pipe = r.pipes.find(p => p.inst === i), fx = r.fixings.filter(x => x.inst === i);
    const solid = g.solids.length > 0, v = ov[g.name], o3 = v === true ? "1" : v === false ? "0" : "";
    const status = pipe ? `<b>${pipe.kind === "hose" ? "hose" : "pipe"}</b> ${esc(pipeText(pipe))}${v === true ? " (marked)" : ""}${pipe.fromCurve ? " \u00b7 from datum curve" : ""}`
      : solid ? esc(g.pipeWhy || "not a pipe") : "";
    const fixT = fx.length ? `<span class="fx">clamp bore ${fx.map(x => `\u00d8${f1(x.D)} (${esc(x.csys)})`).join(", ")}</span>` : "";
    const sel = solid && first[inst.pd] === i ? `<select data-part="${esc(g.name)}" aria-label="Is ${esc(g.name)} the pipe?"><option value=""${o3 === "" ? " selected" : ""}>auto</option><option value="1"${o3 === "1" ? " selected" : ""}>pipe</option><option value="0"${o3 === "0" ? " selected" : ""}>not a pipe</option></select>`
      : solid ? `<span class="same">as above</span>` : "";
    const at = inst.M.o.map(x => x.toFixed(1)).join(", "), cs = inst.csys.map(c => c.name);
    const title = `${g.name}${inst.path.length > 1 ? "\nin " + inst.path.slice(0, -1).join(" / ") : ""}\nplaced at ${at}\n${g.solids.length} solid${g.solids.length === 1 ? "" : "s"}${solid ? ": " + faces(g) : ""}${cs.length ? "\nCSYS: " + cs.join(", ") : ""}`;
    const pp = `${sel}<span class="st">${status}${fixT ? (status ? " \u00b7 " : "") + fixT : ""}</span>`;
    const nm = `<td class="nm" style="padding-left:${6 + inst.depth * 12}px">${esc(g.name)}${count[inst.pd] > 1 ? ` <span class="x">\u00d7${count[inst.pd]}</span>` : ""}`;
    return `<tr class="${pipe ? "is-pipe" : ""}${solid ? "" : " asm"}" title="${esc(title)}">` + (o.compact ? `${nm}<div class="pp">${pp}</div></td></tr>`
      : `${nm}</td><td class="n">${g.solids.length || ""}</td><td>${solid ? esc(faces(g)) : ""}</td><td>${esc(cs.slice(0, 4).join(", "))}${cs.length > 4 ? ` +${cs.length - 4}` : ""}</td><td class="pp">${pp}</td></tr>`);
  });
  box.innerHTML = `<table class="asmtree${o.compact ? " compact" : ""}"><thead><tr>${o.compact ? "<th>Part \u00b7 pipe?</th>" : "<th>Part</th><th>Solids</th><th>Faces</th><th>CSYS</th><th>Pipe?</th>"}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  box.querySelectorAll("select[data-part]").forEach(s => s.onchange = () => { const v = s.value === "1" ? true : s.value === "0" ? false : null; if (o.onChange) o.onChange(s.dataset.part, v); });
}
root.AsmTree = { render, load, save, pipeText };
})(typeof globalThis !== "undefined" ? globalThis : this);
