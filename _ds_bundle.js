/* @ds-bundle: {"format":4,"namespace":"RouteStudioDesignSystem_a31f22","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"SegmentedControl","sourcePath":"components/actions/SegmentedControl.jsx"},{"name":"Legend","sourcePath":"components/data/Legend.jsx"},{"name":"Tag","sourcePath":"components/data/Legend.jsx"},{"name":"CompareTable","sourcePath":"components/data/Legend.jsx"},{"name":"Readout","sourcePath":"components/data/Readout.jsx"},{"name":"RunItem","sourcePath":"components/data/RunItem.jsx"},{"name":"RunList","sourcePath":"components/data/RunItem.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"FieldGrid","sourcePath":"components/forms/FieldGrid.jsx"},{"name":"Hint","sourcePath":"components/forms/FieldGrid.jsx"},{"name":"Disclosure","sourcePath":"components/forms/FieldGrid.jsx"},{"name":"Presets","sourcePath":"components/forms/FieldGrid.jsx"},{"name":"Label","sourcePath":"components/forms/Label.jsx"},{"name":"TextInput","sourcePath":"components/forms/TextInput.jsx"},{"name":"Textarea","sourcePath":"components/forms/TextInput.jsx"},{"name":"Select","sourcePath":"components/forms/TextInput.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"5460b239d87f","components/actions/SegmentedControl.jsx":"4367bd9848d4","components/data/Legend.jsx":"d5031f1559dd","components/data/Readout.jsx":"d805eded2148","components/data/RunItem.jsx":"c047f5a68a55","components/forms/Checkbox.jsx":"9b3dbaf7670f","components/forms/FieldGrid.jsx":"c85832b939f6","components/forms/Label.jsx":"dd689d8b9606","components/forms/TextInput.jsx":"1a6f03dec465","components/navigation/Tabs.jsx":"7d278d979035","ui_kits/route-studio/App.jsx":"0e9ce2914afb","ui_kits/route-studio/Dock.jsx":"dad1058a5f3c","ui_kits/route-studio/Sidebar.jsx":"36f6cecefaa5","ui_kits/route-studio/View.jsx":"2a4c249cf3b7","ui_kits/route-studio/geometry.js":"f70610cd5775"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RouteStudioDesignSystem_a31f22 = window.RouteStudioDesignSystem_a31f22 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  cursor: 'pointer',
  fontFamily: 'var(--sans)',
  borderRadius: 'var(--radius-control)'
};
const variants = {
  primary: {
    display: 'block',
    width: '100%',
    padding: '11px',
    border: 0,
    background: 'var(--ink)',
    color: 'var(--paper)',
    font: '600 15px var(--sans)',
    marginTop: 4
  },
  outline: {
    border: '1px solid var(--rule)',
    background: 'var(--panel)',
    color: 'var(--ink)',
    font: '500 13px var(--sans)',
    padding: '6px 11px'
  },
  small: {
    border: '1px solid var(--rule)',
    background: 'var(--field)',
    color: 'var(--ink)',
    font: '500 13px var(--sans)',
    padding: '4px 10px'
  },
  link: {
    background: 'none',
    border: 0,
    padding: 0,
    color: 'var(--ok)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    font: 'inherit',
    borderRadius: 0
  },
  icon: {
    border: 0,
    background: 'none',
    color: 'var(--muted)',
    fontSize: 16,
    lineHeight: 1,
    padding: '2px 4px',
    borderRadius: 0
  }
};
/** Route Studio button. primary = the full-width "go" action; outline = view tools; small = dock actions; link = inline presets; icon = the × remove. */
function Button({
  variant = 'outline',
  disabled,
  busy,
  children,
  style,
  ...rest
}) {
  const s = {
    ...base,
    ...variants[variant],
    ...(disabled ? {
      opacity: .55,
      cursor: busy ? 'progress' : 'default'
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: s
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/SegmentedControl.jsx
try { (() => {
/** Two-or-more option toggle, one pressed at a time (Colour by radius / By run). */
function SegmentedControl({
  options,
  value,
  onChange,
  label,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": label,
    style: {
      display: 'inline-flex',
      border: '1px solid var(--rule)',
      borderRadius: 4,
      overflow: 'hidden',
      background: 'var(--panel)',
      ...style
    }
  }, options.map(o => {
    const on = o.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id,
      type: "button",
      "aria-pressed": on,
      onClick: () => onChange && onChange(o.id),
      style: {
        border: 0,
        borderRadius: 0,
        background: on ? 'var(--ink)' : 'transparent',
        color: on ? 'var(--paper)' : 'var(--muted)',
        font: '500 13px var(--sans)',
        padding: '6px 11px',
        cursor: 'pointer'
      }
    }, o.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/data/Legend.jsx
try { (() => {
/** Legend row: 16×5 rounded colour bars with 12px muted labels. */
function Legend({
  items,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 13,
      fontSize: 12,
      color: 'var(--muted)',
      flexWrap: 'wrap',
      pointerEvents: 'none',
      ...style
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      display: 'inline-block',
      width: 16,
      height: 5,
      borderRadius: 3,
      verticalAlign: 'middle',
      marginRight: 5,
      background: it.color
    }
  }), it.label)));
}
/** Floating label in the 3D view. box = bordered panel chip (measurements); text = bare muted text (point names). */
function Tag({
  children,
  variant = 'box',
  style
}) {
  const s = variant === 'text' ? {
    border: 0,
    background: 'none',
    padding: 0,
    color: 'var(--muted)'
  } : {
    background: 'var(--panel)',
    border: '1px solid var(--rule)',
    padding: '2px 5px',
    borderRadius: 3
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      font: '500 12px var(--sans)',
      whiteSpace: 'nowrap',
      ...s,
      ...style
    }
  }, children);
}
/** Comparison table: muted metric column, run columns headed in each run's colour, tabular numerals, 1px rule dividers. */
function CompareTable({
  runs,
  rows,
  style
}) {
  return /*#__PURE__*/React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: 13,
      ...style
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: th
  }), runs.map((r, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      ...th,
      color: r.color
    }
  }, r.name)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      color: 'var(--muted)'
    }
  }, row.label), row.values.map((v, j) => /*#__PURE__*/React.createElement("td", {
    key: j,
    style: td
  }, v))))));
}
const td = {
  borderBottom: '1px solid var(--rule)',
  padding: '7px 12px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums'
};
const th = {
  ...td,
  fontWeight: 600,
  color: 'var(--muted)'
};
Object.assign(__ds_scope, { Legend, Tag, CompareTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Legend.jsx", error: String((e && e.message) || e) }); }

// components/data/Readout.jsx
try { (() => {
const toneColor = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)'
};
/** Headline result over the 3D view: big tabular number, muted unit + run name, coloured verdict, muted facts. */
function Readout({
  value,
  unit = 'mm tightest bend',
  name,
  verdict,
  tone = 'ok',
  facts,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '60%',
      pointerEvents: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: '-.02em',
      lineHeight: 1.1,
      fontVariantNumeric: 'tabular-nums'
    }
  }, value, " ", /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--muted)',
      letterSpacing: 0
    }
  }, unit, name ? /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", name) : null)), verdict ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      marginTop: 2,
      color: toneColor[tone]
    }
  }, verdict) : null, facts ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      marginTop: 5,
      fontVariantNumeric: 'tabular-nums'
    }
  }, facts) : null);
}
Object.assign(__ds_scope, { Readout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Readout.jsx", error: String((e && e.message) || e) }); }

// components/data/RunItem.jsx
try { (() => {
/** One comparison run in the sidebar list: show-checkbox, colour swatch, name + metric sub-line, remove ×. */
function RunItem({
  run,
  selected,
  onToggle,
  onSelect,
  onRemove,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    "data-sel": selected ? 1 : 0,
    onClick: onSelect,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 6px',
      borderRadius: 4,
      cursor: 'pointer',
      background: selected ? 'var(--field)' : 'transparent',
      boxShadow: selected ? 'inset 0 0 0 1px var(--rule)' : 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: run.visible !== false,
    "aria-label": `show ${run.name}`,
    onClick: e => e.stopPropagation(),
    onChange: e => onToggle && onToggle(e.target.checked),
    style: {
      width: 'auto',
      margin: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 2,
      flex: 'none',
      background: run.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      lineHeight: 1.25,
      minWidth: 0
    }
  }, run.name, /*#__PURE__*/React.createElement("small", {
    style: {
      display: 'block',
      color: 'var(--muted)',
      fontSize: 11.5,
      fontVariantNumeric: 'tabular-nums'
    }
  }, run.sub)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "remove",
    "aria-label": `remove ${run.name}`,
    onClick: e => {
      e.stopPropagation();
      onRemove && onRemove();
    },
    style: {
      border: 0,
      background: 'none',
      color: 'var(--muted)',
      cursor: 'pointer',
      fontSize: 16,
      lineHeight: 1,
      padding: '2px 4px'
    }
  }, "\xD7"));
}
/** Section header + list wrapper for runs; shows the empty message when there are none. */
function RunList({
  title = 'Comparison runs',
  children,
  empty = 'No runs yet. Run a check to add one.',
  hint,
  style
}) {
  const has = React.Children.count(children) > 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      borderTop: '1px solid var(--rule)',
      paddingTop: 14,
      ...style
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      margin: '0 0 8px',
      color: 'var(--muted)'
    }
  }, title), has ? children : /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--muted)',
      fontSize: 13,
      margin: 0
    }
  }, empty), has && hint ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--muted)',
      fontSize: 12,
      margin: '5px 0 0'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { RunItem, RunList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RunItem.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Inline checkbox with regular-weight 12.5px label, as in "re-insert stray points". */
function Checkbox({
  label,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontWeight: 400,
      fontSize: 12.5,
      whiteSpace: 'normal',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    style: {
      width: 'auto',
      margin: '0 6px 0 0'
    }
  }, rest)), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/FieldGrid.jsx
try { (() => {
/** Grid of fields: 9px gap, 12px vertical margin, 2 or 3 equal columns. */
function FieldGrid({
  columns = 3,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 9,
      margin: '12px 0',
      gridTemplateColumns: `repeat(${columns},1fr)`,
      ...style
    }
  }, children);
}
/** Muted helper text. tone hint = 12px under a control; status = 12.5px result line with reserved height. */
function Hint({
  tone = 'hint',
  children,
  style
}) {
  const s = tone === 'status' ? {
    fontSize: 12.5,
    marginTop: 9,
    minHeight: '1.3em'
  } : {
    fontSize: 12,
    margin: '5px 0 0'
  };
  return /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--muted)',
      ...s,
      ...style
    }
  }, children);
}
/** Collapsed advanced settings, native details/summary. */
function Disclosure({
  summary,
  children,
  open,
  style
}) {
  return /*#__PURE__*/React.createElement("details", {
    open: open,
    style: {
      margin: '10px 0',
      ...style
    }
  }, /*#__PURE__*/React.createElement("summary", {
    style: {
      cursor: 'pointer',
      color: 'var(--muted)',
      fontSize: 13
    }
  }, summary), children);
}
/** Inline preset loader row: "Load: example route". */
function Presets({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      margin: '6px 0 2px',
      fontSize: 12.5,
      flexWrap: 'wrap',
      alignItems: 'baseline',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      color: 'var(--muted)'
    }
  }, "Load:"), children);
}
Object.assign(__ds_scope, { FieldGrid, Hint, Disclosure, Presets });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FieldGrid.jsx", error: String((e && e.message) || e) }); }

// components/forms/Label.jsx
try { (() => {
/** Field label — 12.5px medium, with an optional muted unit/qualifier in parentheses. */
function Label({
  children,
  unit,
  htmlFor,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      display: 'block',
      fontSize: 12.5,
      fontWeight: 500,
      margin: '0 0 4px',
      whiteSpace: 'nowrap',
      ...style
    }
  }, children, unit ? /*#__PURE__*/React.createElement(React.Fragment, null, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      color: 'var(--muted)'
    }
  }, unit)) : null);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Label.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const field = {
  color: 'var(--ink)',
  background: 'var(--field)',
  border: '1px solid var(--rule)',
  borderRadius: 4,
  width: '100%',
  padding: '7px 8px'
};
/** Text input. Mono 13px by default (coordinates, directions, indices); font="sans" for the 14px numeric inputs inside a FieldGrid. */
function TextInput({
  font = 'mono',
  style,
  ...rest
}) {
  const f = font === 'sans' ? {
    fontFamily: 'var(--sans)',
    fontSize: 14,
    lineHeight: 1.5
  } : {
    font: '13px/1.5 var(--mono)'
  };
  return /*#__PURE__*/React.createElement("input", _extends({
    style: {
      ...field,
      ...f,
      ...style
    }
  }, rest));
}
/** Multi-line point paste area — mono, no wrap, vertical resize. */
function Textarea({
  rows = 7,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    spellCheck: false,
    wrap: "off",
    style: {
      ...field,
      font: '13px/1.5 var(--mono)',
      resize: 'vertical',
      ...style
    }
  }, rest));
}
/** Native select styled like the inputs, sans 14px. */
function Select({
  options,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    style: {
      ...field,
      fontFamily: 'var(--sans)',
      fontSize: 14,
      lineHeight: 1.5,
      ...style
    }
  }, rest), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value ?? o,
    value: o.value ?? o
  }, o.label ?? o)));
}
Object.assign(__ds_scope, { TextInput, Textarea, Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
const V = {
  sidebar: {
    wrap: {
      display: 'flex',
      borderBottom: '1px solid var(--rule)',
      marginBottom: 14
    },
    btn: {
      flex: 1,
      font: '500 14px var(--sans)',
      padding: '9px 4px'
    }
  },
  dock: {
    wrap: {
      display: 'flex',
      gap: 2,
      padding: '6px 10px 0',
      borderBottom: '1px solid var(--rule)',
      alignItems: 'center'
    },
    btn: {
      font: '500 13px var(--sans)',
      padding: '7px 11px'
    }
  }
};
/** Underline tabs. variant sidebar = equal-width form tabs; dock = compact tabs with an optional right slot. */
function Tabs({
  tabs,
  value,
  onChange,
  variant = 'sidebar',
  right,
  style
}) {
  const v = V[variant] || V.sidebar;
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      ...v.wrap,
      ...style
    }
  }, tabs.map(t => {
    const on = t.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      role: "tab",
      type: "button",
      "aria-selected": on,
      onClick: () => onChange && onChange(t.id),
      style: {
        border: 0,
        background: 'none',
        cursor: 'pointer',
        color: on ? 'var(--ink)' : 'var(--muted)',
        borderBottom: `2px solid ${on ? 'var(--ink)' : 'transparent'}`,
        ...v.btn
      }
    }, t.label);
  }), right ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 8,
      paddingBottom: 5
    }
  }, right) : null);
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/route-studio/App.jsx
try { (() => {
const {
  parsePts,
  analyse,
  generate,
  adjustClearance,
  toPts,
  PRESETS,
  PALETTE,
  fmt
} = window.RS;
function App({
  seed = true
}) {
  const [tab, setTab] = React.useState('bend');
  const [form, setForm] = React.useState({
    pts: PRESETS.target,
    R: 65,
    SF: 1.5,
    SP: 85,
    sd: '',
    ed: '',
    mpts: PRESETS.master,
    spts: PRESETS.slave,
    gap: 40,
    mode: 'min',
    plane: 'free',
    smooth: 2,
    blend: 0,
    cr: 65,
    lock: '',
    reorder: true
  });
  const [runs, setRuns] = React.useState([]);
  const [selId, setSelId] = React.useState(null);
  const [colorMode, setColorMode] = React.useState('radius');
  const [dock, setDock] = React.useState('rad');
  const [zoomed, setZoomed] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const next = React.useRef(1);
  const add = (list, run) => {
    run.id = next.current++;
    run.color = PALETTE[(run.id - 1) % PALETTE.length];
    run.visible = true;
    const out = [...list, run];
    if (out.length > 6) out.shift();
    return out;
  };
  const runBend = (f = form) => {
    const P = parsePts(f.pts);
    if (P.length < 3) return setStatus('Paste at least three points.');
    const R = +f.R || 65,
      SF = +f.SF || 1.5,
      SP = +f.SP || 85;
    const A = analyse(P);
    const r1 = Object.assign(A, {
      name: `As entered R${R}`,
      kind: 'bend',
      kindLabel: 'bend radius, as entered',
      params: {
        R,
        SF
      },
      settings: `${P.length} points as entered`,
      text: toPts(P, {
        R,
        designR: R * SF,
        minR: A.minR,
        len: A.len
      })
    });
    const G = generate(P, SP),
      B = analyse(G);
    B.tidx = P.map(p => G.findIndex(q => Math.abs(q[0] - p[0]) < 0.01 && Math.abs(q[1] - p[1]) < 0.01 && Math.abs(q[2] - p[2]) < 0.01)).filter(i => i >= 0);
    const r2 = Object.assign(B, {
      name: `Generated R${R} x${SF}`,
      kind: 'bend',
      kindLabel: 'bend radius, generated',
      params: {
        R,
        SF,
        spacing: SP
      },
      settings: `gap ${SP} mm between points, x${SF} margin`,
      text: toPts(G, {
        R,
        designR: +(R * SF).toFixed(1),
        minR: B.minR,
        len: B.len
      })
    });
    setBusy(true);
    setStatus(`Shaping the curve... tightest bend so far R ${fmt(A.minR)} mm`);
    setRuns(rs => {
      const a = add(rs, r1);
      return a;
    });
    setSelId(r1.id);
    setTimeout(() => {
      setRuns(rs => add(rs, r2));
      setSelId(r2.id);
      setBusy(false);
      setStatus(`Added. Generated route holds R ${fmt(B.minR)} mm over ${G.length} points.`);
    }, 700);
  };
  const runClear = () => {
    const M = parsePts(form.mpts),
      S = parsePts(form.spts);
    if (M.length < 2 || S.length < 2) return setStatus('Paste both routes, at least two points each.');
    const gap = +form.gap || 0,
      mode = form.mode,
      plane = form.plane,
      R = +form.cr || 65;
    const res = adjustClearance(M, S, gap, mode);
    const A = analyse(res.moved);
    A.clearDense = A.d.pts.map(p => {
      let bd = Infinity;
      for (let i = 0; i < M.length - 1; i++) {
        const a = M[i],
          b = M[i + 1],
          ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
          L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        let t = L2 ? ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        bd = Math.min(bd, Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t));
      }
      return bd;
    });
    const r = Object.assign(A, {
      name: `Gap ${gap} ${mode}${plane !== 'free' ? ' ' + plane : ''}`,
      kind: 'clear',
      kindLabel: `clearance, ${mode}`,
      master: M,
      clear: {
        gap,
        mode,
        plane,
        ...res
      },
      params: {
        R,
        SF: 1.5,
        gap,
        mode,
        plane
      },
      settings: `${mode}, push ${plane}, smooth ${form.smooth}, blend ${form.blend}${form.lock ? ', locked ' + form.lock : ''}`,
      text: toPts(res.moved, {
        R,
        designR: R * 1.5,
        minR: A.minR,
        len: A.len
      })
    });
    setRuns(rs => add(rs, r));
    setSelId(r.id);
    setDock('clr');
    setStatus(`Clearance now ${fmt(Math.min(...res.after))} to ${fmt(Math.max(...res.after))} mm, largest shift ${fmt(Math.max(...res.shift))} mm, tightest bend R ${fmt(A.minR)} mm.`);
  };
  React.useEffect(() => {
    if (seed) runBend();
  }, []);
  const sel = runs.find(r => r.id === selId) || runs[runs.length - 1] || null;
  const select = id => {
    setSelId(id);
    const r = runs.find(x => x.id === id);
    if (!r) return;
    if (r.kind === 'clear') {
      setTab('clear');
      setForm(s => ({
        ...s,
        gap: r.params.gap,
        mode: r.params.mode,
        plane: r.params.plane,
        cr: r.params.R
      }));
    } else {
      setTab('bend');
      setForm(s => ({
        ...s,
        R: r.params.R,
        SF: r.params.SF,
        ...(r.params.spacing ? {
          SP: r.params.spacing
        } : {})
      }));
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '360px 1fr',
      height: '100%'
    },
    className: "rs-app"
  }, /*#__PURE__*/React.createElement(Sidebar, {
    tab: tab,
    setTab: t => {
      setTab(t);
      setStatus('');
    },
    form: form,
    setForm: setForm,
    runs: runs,
    selId: sel && sel.id,
    status: status,
    busy: busy,
    onRunBend: () => runBend(),
    onRunClear: runClear,
    onToggle: (id, v) => setRuns(rs => rs.map(r => r.id === id ? {
      ...r,
      visible: v
    } : r)),
    onSelect: select,
    onRemove: id => setRuns(rs => rs.filter(r => r.id !== id))
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      display: 'grid',
      gridTemplateRows: '1fr 230px',
      minWidth: 0,
      minHeight: 0
    },
    className: "rs-main"
  }, /*#__PURE__*/React.createElement(View, {
    runs: runs,
    sel: sel,
    colorMode: colorMode,
    setColorMode: setColorMode,
    zoomed: zoomed,
    setZoomed: setZoomed
  }), /*#__PURE__*/React.createElement(Dock, {
    runs: runs,
    sel: sel,
    dock: dock,
    setDock: setDock,
    colorMode: colorMode
  })));
}
window.RouteStudioApp = App;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/route-studio/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/route-studio/Dock.jsx
try { (() => {
const {
  Button,
  Tabs,
  CompareTable,
  Label
} = window.RouteStudioDesignSystem_a31f22;
const {
  fmt,
  css
} = window.RS;
function Chart({
  runs,
  sel,
  dock,
  colorMode
}) {
  const ref = React.useRef(null),
    wrap = React.useRef(null);
  React.useEffect(() => {
    const cv = ref.current,
      box = wrap.current;
    if (!cv || !box) return;
    const W = box.clientWidth,
      H = box.clientHeight,
      dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const isRad = dock === 'rad';
    const vis = runs.filter(r => r.visible && (isRad || r.clearDense));
    if (!vis.length || !sel) return;
    const L = {
        l: 60,
        r: 16,
        t: 14,
        b: 28
      },
      pw = W - L.l - L.r,
      ph = H - L.t - L.b,
      maxLen = Math.max(...vis.map(r => r.len)),
      X = s => L.l + s / maxLen * pw;
    ctx.font = '12px ' + css('--sans');
    ctx.strokeStyle = css('--rule');
    ctx.lineWidth = 1;
    let Y, ticks;
    if (isRad) {
      const R = sel.params.R,
        SF = sel.params.SF || 1.5,
        lo = Math.max(1, Math.pow(10, Math.floor(Math.log10(Math.min(R, ...vis.map(r => r.minR)) * 0.7)))),
        hi = Math.max(2000, R * SF * 4);
      Y = v => L.t + ph * (1 - (Math.log10(Math.min(Math.max(v, lo), hi)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)));
      ticks = [];
      for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e++) ticks.push(Math.pow(10, e));
    } else {
      const all = vis.flatMap(r => r.clearDense),
        gap = sel.clear ? sel.clear.gap : 0,
        hi = Math.max(gap * 1.6, Math.max(...all) * 1.05);
      Y = v => L.t + ph * (1 - Math.min(Math.max(v, 0), hi) / hi);
      ticks = [];
      const raw = hi / 5,
        p10 = Math.pow(10, Math.floor(Math.log10(raw))),
        st = [1, 2, 2.5, 5, 10].find(m => m * p10 >= raw) * p10;
      for (let v = 0; v <= hi; v += st) ticks.push(v);
    }
    ctx.fillStyle = css('--muted');
    ctx.textAlign = 'right';
    ticks.forEach(v => {
      const y = Y(v);
      ctx.beginPath();
      ctx.moveTo(L.l, y);
      ctx.lineTo(L.l + pw, y);
      ctx.stroke();
      ctx.fillText(v >= 1000 ? v / 1000 + 'k' : String(Math.round(v)), L.l - 8, y + 4);
    });
    ctx.save();
    ctx.translate(15, L.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(isRad ? 'bend radius, mm' : 'clearance to master, mm', 0, 0);
    ctx.restore();
    const step = pw < 520 ? maxLen > 2000 ? 1000 : 500 : maxLen > 2000 ? 500 : 250;
    ctx.textAlign = 'center';
    for (let s = step; s <= maxLen; s += step) ctx.fillText(s, X(s), H - 9);
    ctx.textAlign = 'left';
    ctx.fillText('mm along route', L.l, H - 9);
    const lim = (v, cv2, t) => {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = css(cv2);
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(L.l, Y(v));
      ctx.lineTo(L.l + pw, Y(v));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css(cv2);
      ctx.textAlign = 'right';
      ctx.fillText(t, L.l + pw - 4, Y(v) - 4);
    };
    if (isRad) {
      lim(sel.params.R, '--bad', `min ${sel.params.R}`);
      lim(sel.params.R * (sel.params.SF || 1.5), '--warn', `x${sel.params.SF || 1.5} margin`);
    } else if (sel.clear) lim(sel.clear.gap, '--bad', `gap ${sel.clear.gap}`);
    ctx.lineWidth = 2;
    vis.forEach(r => {
      const vals = isRad ? r.d.k.map(k => 1 / k) : r.clearDense;
      const single = vis.length === 1 && isRad && colorMode === 'radius';
      if (single) {
        const R = r.params.R,
          SF = r.params.SF || 1.5;
        for (let i = 1; i < vals.length; i++) {
          ctx.strokeStyle = css(vals[i] < R ? '--bad' : vals[i] < R * SF ? '--warn' : '--ok');
          ctx.beginPath();
          ctx.moveTo(X(r.d.s[i - 1]), Y(vals[i - 1]));
          ctx.lineTo(X(r.d.s[i]), Y(vals[i]));
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = r.id === sel.id ? 1 : 0.6;
        ctx.beginPath();
        vals.forEach((v, i) => i ? ctx.lineTo(X(r.d.s[i]), Y(v)) : ctx.moveTo(X(r.d.s[0]), Y(v)));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }, [runs, sel, dock, colorMode]);
  return /*#__PURE__*/React.createElement("div", {
    ref: wrap,
    style: {
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    style: {
      display: 'block'
    }
  }));
}
function Dock({
  runs,
  sel,
  dock,
  setDock,
  colorMode
}) {
  const rows = [['Use case', r => r.kindLabel], ['Points', r => r.Q.length], ['Route length, mm', r => Math.round(r.len)], ['Min bend radius, mm', r => fmt(r.minR)], ['Against limit', r => {
    const R = r.params.R;
    return r.minR >= R ? `passes (${(r.minR / R).toFixed(2)}x)` : `fails by ${fmt(R - r.minR)}`;
  }], ['Min clearance, mm', r => r.clear ? fmt(Math.min(...r.clear.after)) : '--'], ['Max clearance, mm', r => r.clear ? fmt(Math.max(...r.clear.after)) : '--'], ['Largest point shift, mm', r => r.clear ? fmt(Math.max(...r.clear.shift)) : '--'], ['Settings', r => r.settings]];
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (!sel) return;
    try {
      await navigator.clipboard.writeText(sel.text);
    } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule)',
      background: 'var(--panel)',
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "dock",
    value: dock,
    onChange: setDock,
    tabs: [{
      id: 'rad',
      label: 'Bend radius'
    }, {
      id: 'clr',
      label: 'Clearance'
    }, {
      id: 'cmp',
      label: 'Compare'
    }, {
      id: 'pts',
      label: 'Points'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minHeight: 0,
      overflow: 'auto'
    }
  }, (dock === 'rad' || dock === 'clr') && /*#__PURE__*/React.createElement(Chart, {
    runs: runs,
    sel: sel,
    dock: dock,
    colorMode: colorMode
  }), dock === 'cmp' && (runs.length ? /*#__PURE__*/React.createElement(CompareTable, {
    runs: runs,
    rows: rows.map(([n, f]) => ({
      label: n,
      values: runs.map(f)
    }))
  }) : /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--muted)',
      fontSize: 13,
      padding: 14,
      margin: 0
    }
  }, "Nothing to compare yet.")), dock === 'pts' && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(Label, {
    style: {
      margin: 0
    }
  }, sel ? sel.name : 'Points'), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "small",
    onClick: copy
  }, copied ? 'Copied' : 'Copy'), /*#__PURE__*/React.createElement(Button, {
    variant: "small"
  }, "Download .pts"))), /*#__PURE__*/React.createElement("textarea", {
    readOnly: true,
    spellCheck: false,
    wrap: "off",
    value: sel ? sel.text : '',
    style: {
      font: '13px/1.5 var(--mono)',
      color: 'var(--ink)',
      background: 'var(--field)',
      border: '1px solid var(--rule)',
      borderRadius: 4,
      width: '100%',
      padding: '7px 8px',
      height: 150,
      resize: 'vertical'
    }
  }))));
}
window.Dock = Dock;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/route-studio/Dock.jsx", error: String((e && e.message) || e) }); }

// ui_kits/route-studio/Sidebar.jsx
try { (() => {
const {
  Button,
  Tabs,
  Label,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  FieldGrid,
  Hint,
  Disclosure,
  Presets,
  RunList,
  RunItem
} = window.RouteStudioDesignSystem_a31f22;
const {
  PRESETS,
  fmt
} = window.RS;
function Sidebar({
  tab,
  setTab,
  form,
  setForm,
  runs,
  selId,
  onRunBend,
  onRunClear,
  onToggle,
  onSelect,
  onRemove,
  status,
  busy
}) {
  const f = k => e => setForm(s => ({
    ...s,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }));
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      background: 'var(--panel)',
      borderRight: '1px solid var(--rule)',
      overflowY: 'auto',
      padding: '18px 18px 28px',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 20,
      fontWeight: 600,
      margin: '0 0 3px',
      letterSpacing: '-.01em'
    }
  }, "Route Studio"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--muted)',
      fontSize: 13.5,
      margin: '0 0 16px'
    }
  }, "Check hose routes before you build them in Creo: bend radius on a single route, clearance between two. Run several settings and compare them side by side."), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      id: 'bend',
      label: 'Bend radius'
    }, {
      id: 'clear',
      label: 'Clearance'
    }]
  }), tab === 'bend' ? /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "pts",
    unit: "(X Y Z per line)"
  }, "Target points"), /*#__PURE__*/React.createElement(Textarea, {
    id: "pts",
    rows: 7,
    value: form.pts,
    onChange: f('pts')
  }), /*#__PURE__*/React.createElement(Presets, null, /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    onClick: () => setForm(s => ({
      ...s,
      pts: PRESETS.target
    }))
  }, "example route")), /*#__PURE__*/React.createElement(FieldGrid, {
    columns: 3
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "r",
    unit: "mm"
  }, "Min radius"), /*#__PURE__*/React.createElement(TextInput, {
    id: "r",
    font: "sans",
    type: "number",
    min: 1,
    step: 1,
    inputMode: "decimal",
    value: form.R,
    onChange: f('R')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "sf"
  }, "Safety factor"), /*#__PURE__*/React.createElement(TextInput, {
    id: "sf",
    font: "sans",
    type: "number",
    min: 1,
    step: 0.1,
    inputMode: "decimal",
    value: form.SF,
    onChange: f('SF')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "sp",
    unit: "mm"
  }, "Spacing"), /*#__PURE__*/React.createElement(TextInput, {
    id: "sp",
    font: "sans",
    type: "number",
    min: 10,
    step: 5,
    inputMode: "decimal",
    value: form.SP,
    onChange: f('SP')
  }))), /*#__PURE__*/React.createElement(Disclosure, {
    summary: "Fix end directions"
  }, /*#__PURE__*/React.createElement(FieldGrid, {
    columns: 2
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "sd"
  }, "Start direction"), /*#__PURE__*/React.createElement(TextInput, {
    id: "sd",
    placeholder: "0,-1,0",
    value: form.sd,
    onChange: f('sd')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "ed"
  }, "End direction"), /*#__PURE__*/React.createElement(TextInput, {
    id: "ed",
    placeholder: "1,1,0",
    value: form.ed,
    onChange: f('ed')
  }))), /*#__PURE__*/React.createElement(Hint, null, "Direction of travel along the hose, as X,Y,Z.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: busy,
    busy: busy,
    onClick: onRunBend
  }, "Check, then add to comparison"), /*#__PURE__*/React.createElement(Hint, null, "Adds two runs: the spline through your points as entered, and a generated route that holds the radius."), /*#__PURE__*/React.createElement(Hint, {
    tone: "status"
  }, status)) : /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "mpts",
    unit: "(stays put)"
  }, "Master route"), /*#__PURE__*/React.createElement(Textarea, {
    id: "mpts",
    rows: 5,
    value: form.mpts,
    onChange: f('mpts')
  }), /*#__PURE__*/React.createElement(Label, {
    htmlFor: "spts",
    unit: "(gets moved)",
    style: {
      marginTop: 10
    }
  }, "Slave route"), /*#__PURE__*/React.createElement(Textarea, {
    id: "spts",
    rows: 5,
    value: form.spts,
    onChange: f('spts')
  }), /*#__PURE__*/React.createElement(Presets, null, /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    onClick: () => setForm(s => ({
      ...s,
      mpts: PRESETS.master,
      spts: PRESETS.slave
    }))
  }, "example pair")), /*#__PURE__*/React.createElement(FieldGrid, {
    columns: 3
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "gap",
    unit: "mm"
  }, "Gap"), /*#__PURE__*/React.createElement(TextInput, {
    id: "gap",
    font: "sans",
    type: "number",
    min: 0,
    step: 1,
    value: form.gap,
    onChange: f('gap')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "mode"
  }, "Mode"), /*#__PURE__*/React.createElement(Select, {
    id: "mode",
    options: ['min', 'const'],
    value: form.mode,
    onChange: f('mode')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "plane"
  }, "Push in"), /*#__PURE__*/React.createElement(Select, {
    id: "plane",
    options: ['free', 'xy', 'xz', 'yz'],
    value: form.plane,
    onChange: f('plane')
  }))), /*#__PURE__*/React.createElement(FieldGrid, {
    columns: 3
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "smooth"
  }, "Smooth"), /*#__PURE__*/React.createElement(TextInput, {
    id: "smooth",
    font: "sans",
    type: "number",
    min: 0,
    max: 20,
    value: form.smooth,
    onChange: f('smooth')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "blend"
  }, "Blend"), /*#__PURE__*/React.createElement(TextInput, {
    id: "blend",
    font: "sans",
    type: "number",
    min: 0,
    max: 20,
    value: form.blend,
    onChange: f('blend')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "cr",
    unit: "mm"
  }, "Min radius"), /*#__PURE__*/React.createElement(TextInput, {
    id: "cr",
    font: "sans",
    type: "number",
    min: 1,
    value: form.cr,
    onChange: f('cr')
  }))), /*#__PURE__*/React.createElement(FieldGrid, {
    columns: 2
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "lock"
  }, "Locked points"), /*#__PURE__*/React.createElement(TextInput, {
    id: "lock",
    placeholder: "0,1,16",
    value: form.lock,
    onChange: f('lock')
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    style: {
      marginBottom: 8
    }
  }, "Point order"), /*#__PURE__*/React.createElement(Checkbox, {
    id: "reorder",
    checked: form.reorder,
    onChange: f('reorder'),
    label: "re-insert stray points"
  }))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onRunClear
  }, "Adjust, then add to comparison"), /*#__PURE__*/React.createElement(Hint, {
    tone: "status"
  }, status)), /*#__PURE__*/React.createElement(RunList, {
    hint: "Tick to show in the 3D view. Click a run to select it and load its settings."
  }, runs.map(r => /*#__PURE__*/React.createElement(RunItem, {
    key: r.id,
    selected: r.id === selId,
    run: {
      name: r.name,
      color: r.color,
      visible: r.visible,
      sub: /*#__PURE__*/React.createElement(React.Fragment, null, "R ", fmt(r.minR), " mm \xB7 ", r.Q.length, " pts", r.clear ? /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 gap ", fmt(Math.min(...r.clear.after))) : null)
    },
    onToggle: v => onToggle(r.id, v),
    onSelect: () => onSelect(r.id),
    onRemove: () => onRemove(r.id)
  }))));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/route-studio/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/route-studio/View.jsx
try { (() => {
const {
  Button,
  SegmentedControl,
  Readout,
  Legend,
  Tag
} = window.RouteStudioDesignSystem_a31f22;
const {
  V,
  fmt,
  css
} = window.RS;
function project(p, th, el) {
  const x1 = p[0] * Math.cos(th) - p[1] * Math.sin(th),
    y1 = p[0] * Math.sin(th) + p[1] * Math.cos(th);
  return [x1, y1 * Math.sin(el) - p[2] * Math.cos(el)];
}
function radiusColor(rad, R, SF, c) {
  return rad < R ? c.bad : rad < R * SF ? c.warn : c.ok;
}
function View({
  runs,
  sel,
  colorMode,
  setColorMode,
  zoomed,
  setZoomed
}) {
  const ref = React.useRef(null),
    wrap = React.useRef(null);
  const [cam, setCam] = React.useState({
    th: -0.55,
    el: 0.95
  });
  const [tags, setTags] = React.useState([]);
  const vis = runs.filter(r => r.visible);
  React.useEffect(() => {
    const cv = ref.current,
      box = wrap.current;
    if (!cv || !box) return;
    const W = box.clientWidth,
      H = box.clientHeight,
      dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = css('--paper');
    g.fillRect(0, 0, W, H);
    if (!vis.length) {
      setTags([]);
      return;
    }
    const all = [];
    vis.forEach(r => {
      r.d.pts.forEach(p => all.push(p));
      if (r.master) r.master.forEach(p => all.push(p));
    });
    const mn = [Infinity, Infinity, Infinity],
      mx = [-Infinity, -Infinity, -Infinity];
    all.forEach(p => p.forEach((c, i) => {
      mn[i] = Math.min(mn[i], c);
      mx[i] = Math.max(mx[i], c);
    }));
    const ctr = mn.map((c, i) => (c + mx[i]) / 2),
      diag = Math.max(V.len(V.sub(mx, mn)), 100);
    let focus = ctr,
      scaleDiag = diag;
    if (zoomed && sel && sel.visible) {
      focus = sel.d.pts[sel.wi];
      scaleDiag = Math.max(sel.params.R, sel.minR) * 6;
    }
    const pr = p => project(V.sub(p, focus), cam.th, cam.el);
    const s = Math.min(W, H) * 0.78 / scaleDiag * (zoomed ? 1 : 1.15),
      cx = W / 2,
      cy = H / 2 + (zoomed ? 0 : H * 0.02);
    const S = p => {
      const q = pr(p);
      return [cx + q[0] * s, cy + q[1] * s];
    };
    const tubeR = Math.max(diag * 0.0042, 1.5) * s;
    // floor grid
    const gs = Math.pow(10, Math.floor(Math.log10(diag / 4))),
      size = Math.ceil(diag * 1.6 / gs) * gs,
      z0 = mn[2] - diag * 0.08;
    g.strokeStyle = css('--grid');
    g.lineWidth = 1;
    g.beginPath();
    for (let v = -size / 2; v <= size / 2 + 1e-6; v += gs) {
      let a = S([ctr[0] + v, ctr[1] - size / 2, z0]),
        b = S([ctr[0] + v, ctr[1] + size / 2, z0]);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      a = S([ctr[0] - size / 2, ctr[1] + v, z0]);
      b = S([ctr[0] + size / 2, ctr[1] + v, z0]);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    g.stroke();
    const c = {
      bad: css('--bad'),
      warn: css('--warn'),
      ok: css('--ok')
    };
    const T = [];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    vis.forEach(r => {
      if (r.master) {
        g.strokeStyle = css('--muted');
        g.lineWidth = 1.2;
        g.beginPath();
        r.master.forEach((p, i) => {
          const q = S(p);
          i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
        });
        g.stroke();
        g.fillStyle = css('--muted');
        r.master.forEach(p => {
          const q = S(p);
          g.beginPath();
          g.arc(q[0], q[1], tubeR * 1.4, 0, 7);
          g.fill();
        });
        const q = S(r.master[0]);
        T.push({
          x: q[0],
          y: q[1],
          text: 'master',
          variant: 'text'
        });
      }
      const R = r.params.R,
        SF = r.params.SF || 1.5,
        w = (sel && r.id === sel.id ? tubeR : tubeR * 0.8) * 2;
      g.lineWidth = w;
      const pts = r.d.pts;
      for (let i = 1; i < pts.length; i++) {
        g.strokeStyle = colorMode === 'radius' ? radiusColor(1 / r.d.k[i], R, SF, c) : r.color;
        const a = S(pts[i - 1]),
          b = S(pts[i]);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
      g.fillStyle = r.color;
      r.Q.forEach((q, i) => {
        const isT = !r.tidx || r.tidx.includes(i),
          p = S(q);
        g.beginPath();
        g.arc(p[0], p[1], isT ? tubeR * 1.9 : tubeR * 1.15, 0, 7);
        g.fill();
      });
    });
    if (sel && sel.visible) {
      const p = S(sel.d.pts[sel.wi]);
      const rw = sel.minR,
        R = sel.params.R,
        SF = sel.params.SF || 1.5;
      const cc = rw < R ? c.bad : rw < R * SF ? c.warn : c.ok;
      g.strokeStyle = cc;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(p[0], p[1], Math.min(rw * s, W), 0, 7);
      g.stroke();
      g.strokeStyle = css('--ink');
      g.setLineDash([6, 4]);
      g.beginPath();
      g.arc(p[0], p[1], Math.min(R * s, W), 0, 7);
      g.stroke();
      g.setLineDash([]);
      T.push({
        x: p[0] + tubeR * 3,
        y: p[1],
        text: `tightest bend R ${fmt(rw)} mm`,
        variant: 'box'
      });
      sel.Q.forEach((q, i) => {
        if (!sel.tidx || sel.tidx.includes(i)) {
          const pp = S(q);
          T.push({
            x: pp[0],
            y: pp[1],
            text: 'P' + ((sel.tidx ? sel.tidx.indexOf(i) : i) + 1),
            variant: 'text'
          });
        }
      });
    }
    setTags(T);
  }, [runs, sel, colorMode, cam, zoomed]);
  const drag = React.useRef(null);
  const onDown = e => {
    drag.current = {
      x: e.clientX,
      y: e.clientY
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = e => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x,
      dy = e.clientY - drag.current.y;
    drag.current = {
      x: e.clientX,
      y: e.clientY
    };
    setCam(cm => ({
      th: cm.th - dx * 0.008,
      el: Math.min(1.5, Math.max(0.05, cm.el + dy * 0.008))
    }));
  };
  let ro = null;
  if (sel) {
    const R = sel.params.R,
      SF = sel.params.SF || 1.5,
      ok = sel.minR >= R,
      safe = sel.minR >= R * SF * 0.98;
    const v = ok ? safe ? `Passes. Tightest bend is ${(sel.minR / R).toFixed(2)}x the minimum radius.` : `Passes, but inside the x${SF} safety margin.` : `Too tight: ${fmt(R - sel.minR)} mm below the ${R} mm minimum.`;
    let extra = `${sel.Q.length} points. Length ${Math.round(sel.len)} mm.`;
    if (sel.clear) extra += ` Clearance ${fmt(Math.min(...sel.clear.after))}-${fmt(Math.max(...sel.clear.after))} mm.`;
    ro = /*#__PURE__*/React.createElement(Readout, {
      value: /*#__PURE__*/React.createElement(React.Fragment, null, "R ", fmt(sel.minR)),
      name: sel.name,
      tone: ok ? safe ? 'ok' : 'warn' : 'bad',
      verdict: v,
      facts: extra
    });
  }
  const legend = colorMode === 'radius' ? [{
    color: 'var(--bad)',
    label: 'below min radius'
  }, {
    color: 'var(--warn)',
    label: 'inside safety margin'
  }, {
    color: 'var(--ok)',
    label: 'OK'
  }] : vis.map(r => ({
    color: r.color,
    label: r.name
  }));
  return /*#__PURE__*/React.createElement("div", {
    ref: wrap,
    style: {
      position: 'relative',
      minHeight: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    "aria-label": "3D view of the routes",
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: () => drag.current = null,
    style: {
      position: 'absolute',
      inset: 0,
      touchAction: 'none',
      cursor: drag.current ? 'grabbing' : 'grab'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 18,
      top: 14,
      pointerEvents: 'none',
      maxWidth: '60%'
    }
  }, ro || /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      marginTop: 2
    }
  }, "Run a check to see it here.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 16,
      top: 14,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => setZoomed(z => !z)
  }, zoomed ? 'Show whole route' : 'Zoom to tightest bend'), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: () => {
      setCam({
        th: -0.55,
        el: 0.95
      });
      setZoomed(false);
    }
  }, "Fit"), /*#__PURE__*/React.createElement(SegmentedControl, {
    label: "Colour",
    value: colorMode,
    onChange: setColorMode,
    options: [{
      id: 'radius',
      label: 'Colour by radius'
    }, {
      id: 'run',
      label: 'By run'
    }]
  })), /*#__PURE__*/React.createElement(Legend, {
    items: legend,
    style: {
      position: 'absolute',
      left: 18,
      bottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 16,
      bottom: 12,
      fontSize: 12,
      color: 'var(--muted)',
      pointerEvents: 'none'
    }
  }, "Drag to rotate, shift-drag to pan, scroll to zoom"), tags.map((t, i) => /*#__PURE__*/React.createElement(Tag, {
    key: i,
    variant: t.variant,
    style: {
      position: 'absolute',
      left: t.x,
      top: t.y,
      pointerEvents: 'none',
      transform: t.variant === 'text' ? 'translate(6px,-120%)' : 'translate(8px,-50%)'
    }
  }, t.text)));
}
window.View = View;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/route-studio/View.jsx", error: String((e && e.message) || e) }); }

// ui_kits/route-studio/geometry.js
try { (() => {
// Route Studio UI kit — trimmed copy of the product's geometry helpers (index.html) so screens show real numbers.
(function () {
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    }
  };
  function parsePts(text) {
    const P = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.split('!')[0].trim();
      if (!line) continue;
      const v = line.replace(/,/g, ' ').split(/\s+/).map(Number);
      if (v.length >= 3 && v.slice(0, 3).every(Number.isFinite)) P.push(v.slice(0, 3));
    }
    return P.filter((p, i) => i === 0 || V.len(V.sub(p, P[i - 1])) > 1e-6);
  }
  function naturalSpline(Q) {
    const n = Q.length,
      t = [0];
    for (let i = 1; i < n; i++) t.push(t[i - 1] + V.len(V.sub(Q[i], Q[i - 1])));
    const M = [[], [], []];
    for (let d = 0; d < 3; d++) {
      const y = Q.map(q => q[d]),
        m = new Array(n).fill(0);
      if (n > 2) {
        const a = [],
          b = [],
          c = [],
          r = [];
        for (let i = 1; i < n - 1; i++) {
          const h0 = t[i] - t[i - 1],
            h1 = t[i + 1] - t[i];
          a.push(h0);
          b.push(2 * (h0 + h1));
          c.push(h1);
          r.push(6 * ((y[i + 1] - y[i]) / h1 - (y[i] - y[i - 1]) / h0));
        }
        const k = b.length;
        for (let i = 1; i < k; i++) {
          const w = a[i] / b[i - 1];
          b[i] -= w * c[i - 1];
          r[i] -= w * r[i - 1];
        }
        const x = new Array(k);
        x[k - 1] = r[k - 1] / b[k - 1];
        for (let i = k - 2; i >= 0; i--) x[i] = (r[i] - c[i] * x[i + 1]) / b[i];
        for (let i = 0; i < k; i++) m[i + 1] = x[i];
      }
      M[d] = m;
    }
    function at(i, s) {
      const h = t[i + 1] - t[i],
        p = [],
        d1 = [],
        d2 = [];
      for (let d = 0; d < 3; d++) {
        const y0 = Q[i][d],
          y1 = Q[i + 1][d],
          m0 = M[d][i],
          m1 = M[d][i + 1],
          A = (t[i + 1] - (t[i] + s)) / h,
          B = s / h;
        p.push(A * y0 + B * y1 + ((A * A * A - A) * m0 + (B * B * B - B) * m1) * h * h / 6);
        d1.push((y1 - y0) / h - (3 * A * A - 1) / 6 * h * m0 + (3 * B * B - 1) / 6 * h * m1);
        d2.push(A * m0 + B * m1);
      }
      return {
        p,
        d1,
        d2
      };
    }
    return {
      t,
      at,
      nseg: n - 1
    };
  }
  const curvOf = (d1, d2) => V.len(V.cross(d1, d2)) / Math.pow(V.len(d1), 3);
  function sampleSpline(sp, per = 40) {
    const pts = [],
      k = [];
    for (let i = 0; i < sp.nseg; i++) {
      const h = sp.t[i + 1] - sp.t[i],
        m = Math.max(4, Math.ceil(per * h / (sp.t[sp.nseg] / sp.nseg)));
      for (let j = i ? 1 : 0; j <= m; j++) {
        const r = sp.at(i, h * j / m);
        pts.push(r.p);
        k.push(curvOf(r.d1, r.d2));
      }
    }
    const s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + V.len(V.sub(pts[i], pts[i - 1])));
    return {
      pts,
      k,
      s
    };
  }
  function analyse(Q) {
    const d = sampleSpline(naturalSpline(Q));
    let wi = 0;
    for (let i = 1; i < d.k.length; i++) if (d.k[i] > d.k[wi]) wi = i;
    return {
      Q,
      d,
      wi,
      minR: 1 / d.k[wi],
      len: d.s[d.s.length - 1]
    };
  }
  // stand-in for the optimiser: corner-cutting subdivision that keeps the end points and densifies the route
  function generate(P, spacing) {
    let Q = P.slice();
    for (let r = 0; r < 3; r++) {
      const o = [Q[0]];
      for (let i = 0; i < Q.length - 1; i++) {
        const a = Q[i],
          b = Q[i + 1];
        o.push(V.add(V.mul(a, .75), V.mul(b, .25)));
        o.push(V.add(V.mul(a, .25), V.mul(b, .75)));
      }
      o.push(Q[Q.length - 1]);
      Q = o;
    }
    const out = [Q[0]];
    for (let i = 1; i < Q.length; i++) {
      if (V.len(V.sub(Q[i], out[out.length - 1])) >= spacing * 0.6 || i === Q.length - 1) out.push(Q[i]);
    }
    return out.map(p => p.map(c => Math.round(c * 100) / 100));
  }
  function closestOnPath(p, path) {
    let bf = null,
      bd = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i],
        b = path[i + 1],
        ab = V.sub(b, a),
        L2 = V.dot(ab, ab);
      let t = L2 ? V.dot(V.sub(p, a), ab) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const foot = V.add(a, V.mul(ab, t)),
        d = V.len(V.sub(p, foot));
      if (d < bd) {
        bd = d;
        bf = foot;
      }
    }
    return {
      foot: bf,
      d: bd
    };
  }
  function adjustClearance(master, slave, gap, mode) {
    const before = [],
      after = [],
      shift = [],
      moved = slave.map((p, i) => {
        const {
          foot,
          d
        } = closestOnPath(p, master);
        before.push(d);
        if (mode === 'min' && d >= gap) {
          shift.push(0);
          return p.slice();
        }
        const dir = V.norm(V.len(V.sub(p, foot)) < 1e-9 ? [0, 0, 1] : V.sub(p, foot)),
          q = V.add(p, V.mul(dir, gap - d));
        shift.push(Math.abs(gap - d));
        return q;
      });
    moved.forEach(p => after.push(closestOnPath(p, master).d));
    return {
      moved: moved.map(p => p.map(c => Math.round(c * 1000) / 1000)),
      before,
      after,
      shift
    };
  }
  function toPts(Q, info) {
    const f = c => c.toFixed(2).padStart(15);
    return ["!", "!       DATUM POINT ARRAY DATA FILE", "!", `! Hose min bend radius ${info.R} mm, design ${info.designR} mm, achieved ${info.minR.toFixed(1)} mm`, `! ${Q.length} points, route length ~${Math.round(info.len)} mm`, "!", "! Enter values with respect to datum arrays' coordinate system:", "!", "!CARTESIAN coordinates:", "!        X                Y                Z", "!", ...Q.map(q => `${f(q[0])} ${f(q[1])} ${f(q[2])}`)].join("\n") + "\n";
  }
  const PRESETS = {
    target: `! example target points
-1655.50  -225.00  -155.50
-1133.50  -671.80   -90.00
 -833.75  -563.19  -141.16
 -583.50  -671.80   -90.00
 -253.50  -528.51     1.00
 -183.50  -279.99    -3.00
    0.00     0.00     0.00`,
    slave: `! slave route, gap varies 18-62 mm
-1652.80  -218.70  -138.94
-1125.25  -652.55   -39.40
 -831.65  -558.29  -128.28
 -574.20  -650.10   -32.96
 -249.75  -519.76    24.00
 -179.00  -269.49    24.60
    7.20    16.80    44.16`
  };
  PRESETS.master = PRESETS.target.replace('example target points', 'master route');
  const PALETTE = ['#2B6CB0', '#C8323C', '#2F8F63', '#8A5BD6', '#D08A1E', '#0E7C86'];
  const fmt = (v, d = 1) => v == null || !isFinite(v) ? '--' : v.toFixed(d);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  window.RS = {
    V,
    parsePts,
    analyse,
    generate,
    adjustClearance,
    toPts,
    PRESETS,
    PALETTE,
    fmt,
    css
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/route-studio/geometry.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Legend = __ds_scope.Legend;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.CompareTable = __ds_scope.CompareTable;

__ds_ns.Readout = __ds_scope.Readout;

__ds_ns.RunItem = __ds_scope.RunItem;

__ds_ns.RunList = __ds_scope.RunList;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.FieldGrid = __ds_scope.FieldGrid;

__ds_ns.Hint = __ds_scope.Hint;

__ds_ns.Disclosure = __ds_scope.Disclosure;

__ds_ns.Presets = __ds_scope.Presets;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.TextInput = __ds_scope.TextInput;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
