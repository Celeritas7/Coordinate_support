/** Field layout helpers: FieldGrid (2/3 columns), Hint (hint/status text), Disclosure (details/summary), Presets (Load: row). */
export interface FieldGridProps { columns?: 2 | 3; children: React.ReactNode; style?: React.CSSProperties; }
export declare function FieldGrid(props: FieldGridProps): JSX.Element;
export interface HintProps {
  /** hint: 12px, 5px above. status: 12.5px, 9px above, reserves one line so the layout doesn't jump. */
  tone?: 'hint' | 'status';
  children?: React.ReactNode; style?: React.CSSProperties;
}
export declare function Hint(props: HintProps): JSX.Element;
export interface DisclosureProps { summary: React.ReactNode; children: React.ReactNode; open?: boolean; style?: React.CSSProperties; }
export declare function Disclosure(props: DisclosureProps): JSX.Element;
export interface PresetsProps { children: React.ReactNode; style?: React.CSSProperties; }
export declare function Presets(props: PresetsProps): JSX.Element;
