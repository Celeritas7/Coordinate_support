Form controls — `TextInput` (mono by default, `font="sans"` for numbers), `Textarea` for pasted `.pts` blocks, `Select` for enum settings.

```jsx
<Textarea id="pts" rows={7} defaultValue={points} />
<TextInput id="r" font="sans" type="number" defaultValue={65} min={1} step={1} inputMode="decimal" />
<TextInput id="lock" placeholder="0,1,16" />
<Select id="mode" options={['min','const']} />
```

Values are lowercase engineering shorthand (`min`, `const`, `xy`). Placeholders show the expected format, not a description.
