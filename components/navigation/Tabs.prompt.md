Underline tabs — `sidebar` variant switches the two use-case forms; `dock` variant switches the bottom panel (chart / compare / points).

```jsx
<Tabs value={tab} onChange={setTab} tabs={[{id:'bend',label:'Bend radius'},{id:'clear',label:'Clearance'}]} />
<Tabs variant="dock" value={dock} onChange={setDock} tabs={[{id:'rad',label:'Bend radius'},{id:'clr',label:'Clearance'},{id:'cmp',label:'Compare'},{id:'pts',label:'Points'}]} />
```

No icons, no counts, no pill backgrounds — text and a 2px underline only.
