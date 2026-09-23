3D-view annotations and the compare table. `Legend` explains line colours; `Tag` floats next to geometry; `CompareTable` lines runs up as columns.

```jsx
<Legend items={[{color:'var(--bad)',label:'below min radius'},{color:'var(--warn)',label:'inside safety margin'},{color:'var(--ok)',label:'OK'}]} />
<Tag>tightest bend R 41.7 mm</Tag>  <Tag variant="text">P3</Tag>
<CompareTable runs={[{name:'As entered R65',color:'var(--run-1)'}]} rows={[{label:'Points',values:[7]},{label:'Min bend radius, mm',values:['41.7']}]} />
```

Legend labels are lowercase except "OK". Metric labels carry their unit after a comma: "Route length, mm".
