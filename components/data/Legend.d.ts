/** Legend (.legend), Tag (.tag) and CompareTable (table) from the 3D view and dock. */
export interface LegendProps { items: { color: string; label: React.ReactNode }[]; style?: React.CSSProperties; }
export declare function Legend(props: LegendProps): JSX.Element;
export interface TagProps {
  children: React.ReactNode;
  /** box: bordered panel chip for measurements. text: bare muted label for point names / "master". */
  variant?: 'box' | 'text';
  style?: React.CSSProperties;
}
export declare function Tag(props: TagProps): JSX.Element;
export interface CompareTableProps {
  runs: { name: string; color: string }[];
  rows: { label: React.ReactNode; values: React.ReactNode[] }[];
  style?: React.CSSProperties;
}
export declare function CompareTable(props: CompareTableProps): JSX.Element;
