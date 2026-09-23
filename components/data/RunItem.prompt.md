Comparison run list — each row has a show-checkbox, an 11px colour swatch, the run name with a tabular metric sub-line, and a bare × to remove. Clicking the row selects it.

```jsx
<RunList hint="Tick to show in the 3D view. Click a run to select it and load its settings.">
  <RunItem run={{name:'As entered R65',color:'var(--run-1)',sub:'R 41.7 mm · 7 pts'}} onSelect={…} />
  <RunItem selected run={{name:'Generated R65 x1.5',color:'var(--run-2)',sub:'R 98.2 mm · 34 pts'}} />
</RunList>
```

Run names are terse: "As entered R65", "Generated R65 x1.5", "Gap 40 min xy". Colours cycle `--run-1` … `--run-6`.
