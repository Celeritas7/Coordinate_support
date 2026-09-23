Segmented toggle for mutually exclusive view modes; the pressed segment inverts to ink.

```jsx
<SegmentedControl label="Colour" value={mode} onChange={setMode}
  options={[{id:'radius',label:'Colour by radius'},{id:'run',label:'By run'}]} />
```

Labels are short sentence-case phrases. Used only in the 3D view toolbar in the product.
