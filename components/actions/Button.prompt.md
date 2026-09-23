Route Studio button — use `primary` for the one action per form ("Check, then add to comparison"), `outline` for view tools, `small` inside the dock, `link` for inline presets, `icon` for remove (×).

```jsx
<Button variant="primary">Check, then add to comparison</Button>
<Button variant="outline">Zoom to tightest bend</Button>
<Button variant="small">Download .pts</Button>
<Button variant="link">example route</Button>
<Button variant="icon" aria-label="remove">×</Button>
```

Props: `variant`, `disabled` (opacity .55), `busy` (progress cursor while disabled). Copy is sentence case, verb first, no trailing period.
