Field layout — `FieldGrid` for 2/3 equal columns of Label+input pairs; `Hint` for muted helper/status text; `Disclosure` hides advanced settings; `Presets` is the "Load: example route" row.

```jsx
<FieldGrid columns={3}>
  <div><Label htmlFor="r" unit="mm">Min radius</Label><TextInput id="r" font="sans" type="number" defaultValue={65} /></div>
  <div><Label htmlFor="sf">Safety factor</Label><TextInput id="sf" font="sans" type="number" defaultValue={1.5} step={0.1} /></div>
  <div><Label htmlFor="sp" unit="mm">Spacing</Label><TextInput id="sp" font="sans" type="number" defaultValue={85} /></div>
</FieldGrid>
<Disclosure summary="Fix end directions">…</Disclosure>
<Hint>Direction of travel along the hose, as X,Y,Z.</Hint>
<Hint tone="status">Added. Generated route holds R 98.2 mm over 34 points.</Hint>
<Presets><Button variant="link">example route</Button></Presets>
```
