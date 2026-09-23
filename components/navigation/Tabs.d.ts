/**
 * Underline tabs (.tabs / .docktabs). Selected tab is ink with a 2px ink underline; others muted.
 * @startingPoint section="Navigation" subtitle="Sidebar and dock underline tabs" viewport="700x180"
 */
export interface TabsProps {
  tabs: { id: string; label: string }[];
  value: string;
  onChange?: (id: string) => void;
  /** sidebar: equal-width 14px tabs. dock: compact 13px tabs, left-aligned. */
  variant?: 'sidebar' | 'dock';
  /** Optional right-aligned slot (dock only in the product). */
  right?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Tabs(props: TabsProps): JSX.Element;
