/** Comparison run row (.run) and its list wrapper (.runs). Selected row gets field bg + inset 1px rule ring. */
export interface Run { name: string; color: string; sub?: React.ReactNode; visible?: boolean; }
export interface RunItemProps {
  run: Run;
  selected?: boolean;
  onToggle?: (visible: boolean) => void;
  onSelect?: () => void;
  onRemove?: () => void;
  style?: React.CSSProperties;
}
export declare function RunItem(props: RunItemProps): JSX.Element;
export interface RunListProps {
  /** default "Comparison runs" */
  title?: string;
  children?: React.ReactNode;
  /** default "No runs yet. Run a check to add one." */
  empty?: string;
  hint?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function RunList(props: RunListProps): JSX.Element;
